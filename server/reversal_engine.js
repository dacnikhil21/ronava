import { postLedgerEntry } from './ledger_engine.js';

/**
 * Reverse a transaction by posting signed reversing entries to financial_ledger.
 * Never modifies or deletes past ledger records (immutable audit trail).
 * 
 * Invariants (FIX 1):
 * 1. Considers ALL withdrawals of that merchant and channel regardless of age, inside one locked transaction.
 * 2. If the wallet balance on that channel can cover the reversal, reverse fully (merchant credit and every upline commission).
 * 3. If it cannot because of PENDING withdrawals, refuse with a plain message listing those withdrawals so Admin rejects them first.
 * 4. If money was already submitted or paid, Admin may record the shortfall as OWED (withdrawals blocked until cleared).
 * 5. Same for uplines who already withdrew a clawed-back commission.
 * 6. Never calls nested BEGIN (relies strictly on caller or withTransaction client).
 */
export async function reverseTransaction(client, {
  txnId,
  reason = 'Transaction reversed',
  callerId,
  confirmFraud = false,
  recordShortfallAsOwed = false
}) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('DATABASE_CLIENT_REQUIRED: reverseTransaction requires an active client.');
  }
  if (!callerId) {
    throw new Error('CALLER_IDENTIFICATION_REQUIRED: callerId is required for reversal.');
  }
  if (!txnId) {
    throw new Error('INVALID_ARGUMENT: txnId is required for reversal.');
  }

  const isConfirmedOwed = Boolean(confirmFraud || recordShortfallAsOwed);

  // 1. Lock and check transaction
  const txnRes = await client.query(`
    SELECT id, merchant_id, amount_paise, status, channel, created_at
    FROM transactions 
    WHERE id = $1 
    FOR UPDATE
  `, [txnId]);

  if (txnRes.rows.length === 0) {
    throw new Error(`TRANSACTION_NOT_FOUND: Transaction "${txnId}" does not exist.`);
  }

  const txn = txnRes.rows[0];
  if (txn.status === 'REVERSED') {
    throw new Error(`TRANSACTION_ALREADY_REVERSED: Transaction "${txnId}" has already been reversed.`);
  }

  // 2. Fetch all original credit and commission entries posted for this transaction
  const ledgerRes = await client.query(`
    SELECT id, user_id, type, amount_paise, channel, metadata
    FROM financial_ledger
    WHERE reference_id = $1 AND type IN ('swipe_credit', 'commission')
  `, [txnId]);

  const originalEntries = ledgerRes.rows;
  if (originalEntries.length === 0) {
    throw new Error(`NO_LEDGER_ENTRIES: No ledger entries found for transaction "${txnId}".`);
  }

  const merchantCreditEntry = originalEntries.find(e => e.type === 'swipe_credit');
  if (!merchantCreditEntry) {
    throw new Error(`CORRUPTED_TRANSACTION: Original swipe credit entry missing for "${txnId}".`);
  }
  const merchantClawbackPaise = BigInt(merchantCreditEntry.amount_paise);

  // 3. Lock merchant wallet row and compute live channel balance
  await client.query(`
    SELECT balance_paise, held_paise FROM wallets WHERE UPPER(user_id) = UPPER($1) FOR UPDATE
  `, [txn.merchant_id]);

  const merchantChannelRes = await client.query(`
    SELECT COALESCE(SUM(amount_paise), 0)::bigint AS channel_balance_paise
    FROM financial_ledger
    WHERE UPPER(user_id) = UPPER($1) AND channel = $2
  `, [txn.merchant_id, txn.channel]);
  const merchantChannelBalPaise = BigInt(merchantChannelRes.rows[0]?.channel_balance_paise || 0);

  // 4. Consider ALL withdrawals for this merchant and channel regardless of age
  const relatedPayoutsRes = await client.query(`
    SELECT id, amount_paise, status, admin_remark, created_at
    FROM withdrawals
    WHERE UPPER(merchant_id) = UPPER($1)
      AND channel = $2
      AND status IN ('PENDING', 'SUBMITTED_TO_BANK', 'COMPLETED', 'APPROVED')
    FOR UPDATE
  `, [txn.merchant_id, txn.channel]);

  const relatedPayouts = relatedPayoutsRes.rows;
  const pendingPayouts = relatedPayouts.filter(p => p.status === 'PENDING');
  const submittedOrCompleted = relatedPayouts.filter(p => p.status === 'SUBMITTED_TO_BANK' || p.status === 'COMPLETED' || p.status === 'APPROVED');

  // Check if merchant channel balance can cover the clawback:
  if (merchantChannelBalPaise < merchantClawbackPaise) {
    const pendingTotalPaise = pendingPayouts.reduce((sum, p) => sum + BigInt(p.amount_paise), 0n);

    // If pending withdrawals exist and holding them prevented covering the reversal:
    if (pendingPayouts.length > 0 && (merchantChannelBalPaise + pendingTotalPaise >= merchantClawbackPaise)) {
      const pIds = pendingPayouts.map(p => p.id).join(', ');
      const err = new Error(
        `Cannot reverse swipe: funds are held in pending withdrawal(s) (${pIds}). Please reject these withdrawals first to release held funds back to the wallet.`
      );
      err.code = 'REVERSAL_BLOCKED_PENDING_WITHDRAWALS';
      err.pendingPayoutIds = pendingPayouts.map(p => p.id);
      throw err;
    }

    // If funds were already submitted to bank, completed, or cannot be covered even by pending:
    if (!isConfirmedOwed) {
      const shortfallPaise = merchantClawbackPaise - merchantChannelBalPaise;
      const formattedShortfall = (Number(shortfallPaise) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      const pIds = relatedPayouts.map(p => p.id);
      if (pIds.length > 0) {
        await client.query(`
          UPDATE withdrawals
          SET admin_remark = CONCAT(COALESCE(admin_remark, ''), ' [FRAUD_ALERT: Reversal of swipe ', $1::text, ' requested with shortfall. Requires Admin fraud confirmation.]')
          WHERE id = ANY($2)
        `, [txnId, pIds]);
      }
      const err = new Error(
        `REVERSAL_REQUIRES_FRAUD_CONFIRMATION: Insufficient channel balance to cover reversal (Shortfall: Rs ${formattedShortfall}). Payouts have already been submitted or completed. To proceed, Admin must record the shortfall as OWED.`
      );
      err.code = 'REVERSAL_REQUIRES_FRAUD_CONFIRMATION';
      err.statusCode = 409;
      err.shortfallPaise = shortfallPaise.toString();
      err.payoutIds = pIds;
      throw err;
    }
  }

  // 5. Check uplines for commission clawback coverage
  const commissionEntries = originalEntries.filter(e => e.type === 'commission');
  for (const commEntry of commissionEntries) {
    const commPaise = BigInt(commEntry.amount_paise);
    if (commPaise <= 0n) continue;

    await client.query(`
      SELECT balance_paise, held_paise FROM wallets WHERE UPPER(user_id) = UPPER($1) FOR UPDATE
    `, [commEntry.user_id]);

    const uplineChannelRes = await client.query(`
      SELECT COALESCE(SUM(amount_paise), 0)::bigint AS channel_balance_paise
      FROM financial_ledger
      WHERE UPPER(user_id) = UPPER($1) AND channel = $2
    `, [commEntry.user_id, commEntry.channel]);
    const uplineChannelBal = BigInt(uplineChannelRes.rows[0]?.channel_balance_paise || 0);

    if (uplineChannelBal < commPaise && !isConfirmedOwed) {
      const commShortfall = commPaise - uplineChannelBal;
      const formattedUplineShortfall = (Number(commShortfall) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      const err = new Error(
        `REVERSAL_REQUIRES_FRAUD_CONFIRMATION: Upline ${commEntry.user_id} has insufficient balance to claw back commission (Shortfall: Rs ${formattedUplineShortfall}). Admin must record the shortfall as OWED.`
      );
      err.code = 'REVERSAL_REQUIRES_FRAUD_CONFIRMATION';
      err.statusCode = 409;
      err.shortfallPaise = commShortfall.toString();
      throw err;
    }
  }

  // 6. Post reversing entries for merchant and all uplines
  const isMerchantShortfall = merchantChannelBalPaise < merchantClawbackPaise;
  for (const entry of originalEntries) {
    const origAmountPaise = BigInt(entry.amount_paise);
    const reversingAmountPaise = -origAmountPaise; // Exact signed negation
    const reversingType = entry.type === 'swipe_credit' ? 'refund' : 'adjustment';
    const isThisShortfall = entry.type === 'swipe_credit' ? isMerchantShortfall : isConfirmedOwed;

    const metadata = {
      reversed_ledger_id: entry.id,
      reversal_reason: reason,
      original_type: entry.type,
      original_amount_paise: entry.amount_paise
    };

    if (isThisShortfall) {
      metadata.is_shortfall_owed = true;
      metadata.shortfall_owed_paise = (origAmountPaise).toString();
    }

    await postLedgerEntry(client, {
      userId: entry.user_id,
      type: reversingType,
      amountPaise: reversingAmountPaise,
      referenceId: txnId,
      referenceType: 'REVERSAL',
      channel: entry.channel,
      metadata,
      createdBy: callerId
    });
  }

  // 7. Update transaction status to REVERSED
  await client.query(`
    UPDATE transactions
    SET status = 'REVERSED',
        notes = CONCAT(COALESCE(notes, ''), ' [REVERSED: ', $2::text, ']')
    WHERE id = $1
  `, [txnId, reason]);

  return {
    id: txnId,
    status: 'REVERSED',
    reversing_entries_count: originalEntries.length,
    recorded_shortfall_owed: isMerchantShortfall
  };
}
