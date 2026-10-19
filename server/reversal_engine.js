import { postLedgerEntry } from './ledger_engine.js';

/**
 * Reverse a transaction by posting signed reversing entries to financial_ledger.
 * Never modifies or deletes past ledger records (immutable audit trail).
 */
export async function reverseTransaction(client, {
  txnId,
  reason = 'Transaction reversed',
  callerId,
  confirmFraud = false
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

    // 1.1 Check related payouts for this merchant created on or after the swipe
    const relatedPayoutsRes = await client.query(`
      SELECT id, amount_paise, status, admin_remark
      FROM withdrawals
      WHERE UPPER(merchant_id) = UPPER($1)
        AND status IN ('PENDING', 'SUBMITTED_TO_BANK', 'COMPLETED', 'APPROVED')
        AND created_at >= ($2::timestamptz - INTERVAL '5 minutes')
      FOR UPDATE
    `, [txn.merchant_id, txn.created_at]);

    const relatedPayouts = relatedPayoutsRes.rows;
    const submittedOrCompleted = relatedPayouts.filter(p => p.status === 'SUBMITTED_TO_BANK' || p.status === 'COMPLETED' || p.status === 'APPROVED');

    // Rule 5 & 6: If payout is SUBMITTED_TO_BANK or COMPLETED, do NOT reverse automatically.
    // Raise alert on that payout in Admin Payouts asking Admin to reconfirm fraud.
    if (submittedOrCompleted.length > 0 && !confirmFraud) {
      const pIds = submittedOrCompleted.map(p => p.id);
      await client.query(`
        UPDATE withdrawals
        SET admin_remark = CONCAT(COALESCE(admin_remark, ''), ' [FRAUD_ALERT: Reversal of swipe ', $1::text, ' requested. Requires Admin fraud reconfirmation.]')
        WHERE id = ANY($2)
      `, [txnId, pIds]);
      const err = new Error(`REVERSAL_REQUIRES_FRAUD_CONFIRMATION: Payout(s) ${pIds.join(', ')} already in status ${submittedOrCompleted[0].status}. Please reconfirm fraud in Admin Payouts before proceeding.`);
      err.code = 'REVERSAL_REQUIRES_FRAUD_CONFIRMATION';
      err.statusCode = 409;
      err.payoutIds = pIds;
      throw err;
    }

    // Rule 4: If related payout is PENDING, reversing swipe must also reject held payout and return its hold in same TX
    const pendingPayouts = relatedPayouts.filter(p => p.status === 'PENDING');
    for (const p of pendingPayouts) {
      const pAmtPaise = BigInt(p.amount_paise);
      await postLedgerEntry(client, {
        userId: txn.merchant_id,
        type: 'withdrawal_reversal',
        amountPaise: pAmtPaise,
        referenceId: p.id,
        referenceType: 'WITHDRAWAL',
        channel: txn.channel,
        metadata: {
          reversal_reason: `Auto-rejected due to reversal of swipe ${txnId}`,
          original_withdrawal_id: p.id
        },
        createdBy: callerId
      });

      await client.query(`
        UPDATE wallets 
        SET held_paise = GREATEST(0, held_paise - $1)
        WHERE UPPER(user_id) = UPPER($2)
      `, [pAmtPaise, txn.merchant_id]);

      await client.query(`
        UPDATE withdrawals
        SET status = 'REJECTED',
            admin_remark = CONCAT(COALESCE(admin_remark, ''), ' [AUTO_REJECTED_ON_SWIPE_REVERSAL: Swipe ', $1::text, ' reversed]')
        WHERE id = $2
      `, [txnId, p.id]);
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

    // 3. Post reversing entries for merchant and all upline distributors
    for (const entry of originalEntries) {
      const origAmountPaise = BigInt(entry.amount_paise);
      const reversingAmountPaise = -origAmountPaise; // Exact signed negation
      const reversingType = entry.type === 'swipe_credit' ? 'refund' : 'adjustment';

      await postLedgerEntry(client, {
        userId: entry.user_id,
        type: reversingType,
        amountPaise: reversingAmountPaise,
        referenceId: txnId,
        referenceType: 'REVERSAL',
        channel: entry.channel,
        metadata: {
          reversed_ledger_id: entry.id,
          reversal_reason: reason,
          original_type: entry.type,
          original_amount_paise: entry.amount_paise
        },
        createdBy: callerId
      });
    }

    // 4. Update transaction status to REVERSED
    await client.query(`
      UPDATE transactions
      SET status = 'REVERSED',
          notes = CONCAT(COALESCE(notes, ''), ' [REVERSED: ', $2::text, ']')
      WHERE id = $1
    `, [txnId, reason]);

    return {
      id: txnId,
      status: 'REVERSED',
      reversing_entries_count: originalEntries.length
    };
}
