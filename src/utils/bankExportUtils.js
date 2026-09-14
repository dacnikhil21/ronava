/**
 * Bank Bulk Payout & CMS Batch Export Utility
 * Generates clean Excel/CSV files formatted strictly for Bank Payout Disbursement.
 * Exactly 6 Columns required by Bank:
 * 1. Sl No
 * 2. Beneficiary Name
 * 3. Account Number
 * 4. IFSC Code
 * 5. Bank Name
 * 6. Amount
 */

export function generateBankBatchCSV(payoutsList, options = {}) {
  // STRICTLY 6 COLUMNS: Sl No, Beneficiary Name, Account Number, IFSC Code, Bank Name, Amount
  const headers = [
    'Sl No',
    'Beneficiary Name',
    'Account Number',
    'IFSC Code',
    'Bank Name',
    'Amount'
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""').trim();
    return `"${str}"`;
  };

  const rows = payoutsList.map((item, index) => {
    // 1. Sl No (1 to N)
    const slNo = index + 1;

    // 2. Beneficiary Name (Whom they want to send money to)
    let recipient = item.customer_name || item.holder_name || item.beneficiary_name || '';
    if (!recipient && item.admin_remark) {
      const nameMatch = item.admin_remark.match(/Name:\s*([^|•\r\n]+)/i);
      if (nameMatch) recipient = nameMatch[1].trim();
    }
    if (!recipient) recipient = item.merchant_name || 'Beneficiary';

    // 3. Account Number (Preserved as text formula ="..." so Excel never corrupts digits or uses scientific notation)
    const rawAcc = String(item.account_number || item.accountNumber || item.bank_account || '').replace(/[^0-9]/g, '').trim();
    const formattedAcc = rawAcc ? `="${rawAcc}"` : '""';

    // 4. IFSC Code
    const ifsc = String(item.ifsc_code || item.ifsc || '').toUpperCase().trim();

    // 5. Bank Name
    const bankName = item.bank_name || item.bankName || 'Bank';

    // 6. Amount
    const amt = parseFloat(item.amount || 0).toFixed(2);

    return [
      slNo,
      escapeCSV(recipient),
      formattedAcc,
      escapeCSV(ifsc),
      escapeCSV(bankName),
      amt
    ].join(',');
  });

  // Prepend UTF-8 BOM (\uFEFF) so Excel opens seamlessly without encoding problems
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  return { success: true, csvContent, count: payoutsList.length };
}

export function downloadBankBatchFile(payoutsList, options = {}) {
  if (!payoutsList || payoutsList.length === 0) {
    return { success: false, count: 0, error: 'No payout records to export' };
  }

  const { csvContent, count } = generateBankBatchCSV(payoutsList, options);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const today = new Date().toISOString().slice(0, 10);
  const fileName = options.fileName || `RONAV_Bank_Payout_${today}.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  return { success: true, count, fileName };
}

/**
 * GST & Tax Audit Ledger Export Utility (For CA / Income Tax / GST Filing)
 * Exports completed merchant transactions with gross volume, convenience fees, 18% GST, and Bank UTRs.
 */
export function generateGstAuditCSV(transactionsList, options = {}) {
  const headers = [
    'Sl No',
    'Transaction Date & Time',
    'Channel / Vendor',
    'Merchant ID',
    'Merchant Name',
    'Customer / Counter Name',
    'Bank Account Number',
    'Bank IFSC',
    'Gross Volume (INR)',
    'Platform Fee / Margin (INR)',
    'GST on Fee @ 18% (INR)',
    'Net Settled (INR)',
    'Bank UTR / Ref Number',
    'Settlement Speed',
    'Audit Status'
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""').trim();
    return `"${str}"`;
  };

  const rows = transactionsList.map((item, index) => {
    const slNo = index + 1;
    const dateStr = item.created_at || item.verified_at 
      ? new Date(item.created_at || item.verified_at).toLocaleString('en-IN') 
      : 'N/A';

    const channel = item.pos_vendor 
      ? (item.pos_vendor.toLowerCase().includes('rp') ? 'Payswiff (RP Tech)' : 'Payswiff (Ronav Tech)')
      : (item.pos_provider || 'POS Machine');

    const mid = item.merchant_id || 'MID-UNKNOWN';
    const mName = item.merchant_name || 'Ronav Merchant';
    const cName = item.customer_name || item.holder_name || 'Counter Customer';

    const rawAcc = String(item.account_number || item.accountNumber || item.bank_account || '').replace(/[^0-9]/g, '').trim();
    const formattedAcc = rawAcc ? `="${rawAcc}"` : '""';
    const ifsc = String(item.ifsc_code || item.ifsc || '').toUpperCase().trim();

    const gross = parseFloat(item.amount || 0);
    const fee = parseFloat(item.admin_margin || item.admin_cut || (gross * 0.0015) || 0);
    const gst = parseFloat((fee * 0.18).toFixed(2));
    const netSettled = (gross - fee).toFixed(2);

    const utr = String(item.bank_rrn || item.utr_number || item.rrn_number || item.ref_number || item.id || 'N/A').trim();
    const speed = (item.settlement_mode || item.settlement_type || 'T1').toUpperCase();
    const status = item._subStatus || item.status || 'COMPLETED';

    return [
      slNo,
      escapeCSV(dateStr),
      escapeCSV(channel),
      escapeCSV(mid),
      escapeCSV(mName),
      escapeCSV(cName),
      formattedAcc,
      escapeCSV(ifsc),
      gross.toFixed(2),
      fee.toFixed(2),
      gst.toFixed(2),
      netSettled,
      escapeCSV(utr),
      escapeCSV(speed),
      escapeCSV(status)
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  return { success: true, csvContent, count: transactionsList.length };
}

export function downloadGstAuditFile(transactionsList, options = {}) {
  if (!transactionsList || transactionsList.length === 0) {
    return { success: false, count: 0, error: 'No transaction records to export for GST audit' };
  }

  const { csvContent, count } = generateGstAuditCSV(transactionsList, options);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const today = new Date().toISOString().slice(0, 10);
  const fileName = options.fileName || `RONAV_GST_Tax_Audit_${today}.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  return { success: true, count, fileName };
}

