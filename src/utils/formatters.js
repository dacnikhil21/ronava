/**
 * Authoritative Currency & Number Formatters
 * Formats integer paise and basis points strictly according to Indian FinTech standards.
 */

/**
 * Format paise (BigInt, number, or numeric string) into Indian Rupees (e.g. ₹1,25,000.50)
 * @param {bigint|number|string} paise
 * @param {boolean} includeSymbol - whether to prepend the ₹ symbol
 * @returns {string}
 */
export function formatPaiseToRupees(paise, includeSymbol = true) {
  if (paise === null || paise === undefined || paise === '') {
    return includeSymbol ? '₹0.00' : '0.00';
  }

  let pBig;
  try {
    pBig = BigInt(paise);
  } catch (_) {
    const num = parseFloat(paise);
    if (isNaN(num)) return includeSymbol ? '₹0.00' : '0.00';
    pBig = BigInt(Math.round(num));
  }

  const isNegative = pBig < 0n;
  const absPaise = isNegative ? -pBig : pBig;
  const rupeesPart = (absPaise / 100n).toString();
  const paisePart = (absPaise % 100n).toString().padStart(2, '0');

  // Format integer rupee part with Indian comma groupings (e.g. 12,34,567)
  let formattedRupees = '';
  if (rupeesPart.length <= 3) {
    formattedRupees = rupeesPart;
  } else {
    const last3 = rupeesPart.slice(-3);
    const rest = rupeesPart.slice(0, -3);
    const withCommas = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formattedRupees = `${withCommas},${last3}`;
  }

  const sign = isNegative ? '-' : '';
  const prefix = includeSymbol ? '₹' : '';
  return `${sign}${prefix}${formattedRupees}.${paisePart}`;
}

/**
 * Convert rupee amount (e.g. 1500.50) to integer paise (150050n)
 * @param {number|string} rupees
 * @returns {bigint}
 */
export function rupeesToPaise(rupees) {
  if (rupees === null || rupees === undefined || rupees === '') return 0n;
  const clean = String(rupees).replace(/[^0-9.-]/g, '');
  const num = parseFloat(clean);
  if (isNaN(num)) return 0n;
  return BigInt(Math.round(num * 100));
}

/**
 * Format basis points (e.g. 150) to percentage string (e.g. "1.50%")
 * @param {number|string} bps
 * @returns {string}
 */
export function formatBpsToPercent(bps) {
  const num = Number(bps);
  if (isNaN(num)) return '0.00%';
  return `${(num / 100).toFixed(2)}%`;
}

/**
 * Convert percentage (e.g. 1.5 or "1.50%") to basis points integer (e.g. 150)
 * @param {number|string} percent
 * @returns {number}
 */
export function percentToBps(percent) {
  if (percent === null || percent === undefined) return 0;
  const clean = String(percent).replace(/[^0-9.-]/g, '');
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

/**
 * Format raw number with Indian numbering system (e.g. 1,00,000)
 * @param {number|string} val
 * @param {number} decimals
 * @returns {string}
 */
export function formatNumberIndian(val, decimals = 2) {
  const num = parseFloat(val);
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Generate a unique idempotency key for transactions & withdrawals
 * @param {string} prefix
 * @returns {string}
 */
export function generateIdempotencyKey(prefix = 'IDEMP') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
}
