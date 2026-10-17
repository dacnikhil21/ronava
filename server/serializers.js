/**
 * Shared Model Serializer for Ronav FinTech Engine
 * Converts internal *_paise database integer representations into authoritative
 * Rupee fields (amount, customer_charge, net_amount, fee, net_payout, available_balance, etc.)
 * across all API endpoints, while preserving BigInt-safe JSON serialization.
 */

export function paiseToRupees(paise, decimals = 2) {
  if (paise === null || paise === undefined) return null;
  const p = typeof paise === 'bigint' ? paise : BigInt(Math.round(Number(paise) || 0));
  const sign = p < 0n ? '-' : '';
  const absP = p < 0n ? -p : p;
  const whole = absP / 100n;
  const fraction = absP % 100n;
  const decStr = fraction.toString().padStart(2, '0');
  if (decimals === 0) return `${sign}${whole}`;
  return `${sign}${whole}.${decStr}`;
}

export function paiseToRupeesNum(paise) {
  if (paise === null || paise === undefined) return null;
  const str = paiseToRupees(paise, 2);
  return str !== null ? parseFloat(str) : null;
}

/**
 * Universal Serializer for any single row or array of rows
 * @param {Object|Array} data 
 * @returns {Object|Array}
 */
export function serializeMoneyFields(data) {
  if (!data) return data;
  if (Array.isArray(data)) {
    return data.map(item => serializeMoneyFields(item));
  }
  if (typeof data !== 'object') {
    return data;
  }

  const out = { ...data };

  // Convert any BigInt fields to String to prevent JSON.stringify errors
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === 'bigint') {
      out[k] = v.toString();
    }
  }

  // 1. Transaction & Ledger Amount fields
  if (out.amount_paise !== undefined && out.amount_paise !== null) {
    const amtStr = paiseToRupees(out.amount_paise, 2);
    out.amount = amtStr;
    out.amount_rupees = amtStr;
    out.amount_num = parseFloat(amtStr);
  }

  if (out.customer_charge_paise !== undefined && out.customer_charge_paise !== null) {
    const chargeStr = paiseToRupees(out.customer_charge_paise, 2);
    out.customer_charge = chargeStr;
    out.customer_charge_rupees = chargeStr;
    out.fee = chargeStr;
    out.fee_rupees = chargeStr;
    out.fee_deducted = parseFloat(chargeStr);
    out.company_fee = parseFloat(chargeStr);
    out.customer_charge_num = parseFloat(chargeStr);
  }

  if (out.net_amount_paise !== undefined && out.net_amount_paise !== null) {
    const netStr = paiseToRupees(out.net_amount_paise, 2);
    out.net_amount = netStr;
    out.net_amount_rupees = netStr;
    out.net = netStr;
    out.net_num = parseFloat(netStr);
  }

  // 2. Withdrawal & Payout fields
  if (out.fee_paise !== undefined && out.fee_paise !== null) {
    const feeStr = paiseToRupees(out.fee_paise, 2);
    out.fee = feeStr;
    out.fee_rupees = feeStr;
    out.fee_num = parseFloat(feeStr);
  }

  if (out.net_payout_paise !== undefined && out.net_payout_paise !== null) {
    const payoutStr = paiseToRupees(out.net_payout_paise, 2);
    out.net_payout = payoutStr;
    out.net_payout_rupees = payoutStr;
    out.net_payout_num = parseFloat(payoutStr);
  }

  if (out.commission_paise !== undefined && out.commission_paise !== null) {
    const commStr = paiseToRupees(out.commission_paise, 2);
    out.commission = commStr;
    out.commission_rupees = commStr;
    out.commission_num = parseFloat(commStr);
  }

  // 3. Wallet Balance fields
  if (out.balance_paise !== undefined && out.balance_paise !== null) {
    const balNum = paiseToRupeesNum(out.balance_paise);
    const balStr = paiseToRupees(out.balance_paise, 2);
    out.available_balance = balNum;
    out.balance = balNum;
    out.balance_rupees = balStr;
  }

  if (out.held_paise !== undefined && out.held_paise !== null) {
    const heldNum = paiseToRupeesNum(out.held_paise);
    const heldStr = paiseToRupees(out.held_paise, 2);
    out.held_balance = heldNum;
    out.held_rupees = heldStr;
  }

  if (out.total_sales_paise !== undefined && out.total_sales_paise !== null) {
    const salesNum = paiseToRupeesNum(out.total_sales_paise);
    const salesStr = paiseToRupees(out.total_sales_paise, 2);
    out.total_sales = salesNum;
    out.total_sales_rupees = salesStr;
  }

  if (out.withdrawn_paise !== undefined && out.withdrawn_paise !== null) {
    const wNum = paiseToRupeesNum(out.withdrawn_paise);
    const wStr = paiseToRupees(out.withdrawn_paise, 2);
    out.withdrawn_amount = wNum;
    out.withdrawn_rupees = wStr;
  }

  // 4. Nested Distributions array (for card swipe splits)
  if (Array.isArray(out.distributions)) {
    out.distributions = out.distributions.map(d => serializeMoneyFields(d));
  }

  return out;
}

/**
 * Remove sensitive password and hash fields from user models
 */
export function sanitizeUser(user) {
  if (!user) return user;
  if (Array.isArray(user)) {
    return user.map(u => sanitizeUser(u));
  }
  if (typeof user !== 'object') {
    return user;
  }
  const safe = { ...user };
  delete safe.password;
  delete safe.password_hash;
  delete safe.salt;
  return safe;
}

export default {
  paiseToRupees,
  paiseToRupeesNum,
  serializeMoneyFields,
  sanitizeUser
};
