import { postLedgerEntry } from './ledger_engine.js';

/**
 * Reverse a transaction by posting signed reversing entries to financial_ledger.
 * Never modifies or deletes past ledger records (immutable audit trail).
 */
export async function reverseTransaction(client, {
  txnId,
  reason = 'Transaction reversed',
  callerId = 'ADMIN'
}) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('DATABASE_CLIENT_REQUIRED: reverseTransaction requires an active client.');
  }
  if (!txnId) {
    throw new Error('INVALID_ARGUMENT: txnId is required for reversal.');
  }

  await client.query('BEGIN');
  try {
    // 1. Lock and check transaction
    const txnRes = await client.query(`
      SELECT id, merchant_id, amount_paise, status 
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

    await client.query('COMMIT');

    return {
      id: txnId,
      status: 'REVERSED',
      reversing_entries_count: originalEntries.length
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}
