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
  // Comprehensive Payout Report with Merchant Identifiers, Bank Details, and Audit Trail
  const headers = [
    'Sl No',
    'Merchant ID (User ID)',
    'Merchant Name (Store / Owner)',
    'Merchant Mobile',
    'Beneficiary Name (Recipient)',
    'Account Number',
    'IFSC Code',
    'Bank Name',
    'Payout Amount (INR)',
    'Channel / Provider',
    'Settlement Speed',
    'Payout Reference ID',
    'Request Date & Time',
    'Status'
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""').trim();
    return `"${str}"`;
  };

  const rows = payoutsList.map((item, index) => {
    // 1. Sl No (1 to N)
    const slNo = index + 1;

    // 2. Merchant ID / User ID
    const merchantId = item.merchant_id || item.user_id || 'MID-UNKNOWN';

    // 3. Merchant Name
    const merchantName = item.merchant_name || item.name || 'Merchant';

    // 4. Merchant Mobile
    const merchantMobile = item.merchant_mobile || item.mobile || 'N/A';

    // 5. Beneficiary Name (Whom they want to send money to)
    let recipient = item.customer_name || item.holder_name || item.beneficiary_name || '';
    if (!recipient && item.admin_remark) {
      const nameMatch = item.admin_remark.match(/Name:\s*([^|•\r\n]+)/i);
      if (nameMatch) recipient = nameMatch[1].trim();
    }
    if (!recipient) recipient = item.merchant_name || 'Beneficiary';

    // 6. Account Number (Preserved as text formula ="..." so Excel never corrupts digits or uses scientific notation)
    const rawAcc = String(item.account_number || item.accountNumber || item.bank_account || '').replace(/[^0-9]/g, '').trim();
    const formattedAcc = rawAcc ? `="${rawAcc}"` : '""';

    // 7. IFSC Code
    const ifsc = String(item.ifsc_code || item.ifsc || '').toUpperCase().trim();

    // 8. Bank Name
    const bankName = item.bank_name || item.bankName || 'Bank';

    // 9. Payout Amount
    const amt = parseFloat(item.amount || 0).toFixed(2);

    // 10. Channel / Provider
    const channel = item.channel || item.pos_provider || (item.is_customer_payout ? 'Customer Payout' : 'Bank Transfer');

    // 11. Settlement Speed
    const speed = (item.settlement_mode || item.settlement_type || 'T1').toUpperCase();

    // 12. Payout Ref ID
    const refId = item.id || item.ref_number || item.payout_id || 'N/A';

    // 13. Date & Time
    const dateStr = item.created_at ? new Date(item.created_at).toLocaleString('en-IN') : 'N/A';

    // 14. Status
    const status = item.status || 'PENDING';

    return [
      slNo,
      escapeCSV(merchantId),
      escapeCSV(merchantName),
      escapeCSV(merchantMobile),
      escapeCSV(recipient),
      formattedAcc,
      escapeCSV(ifsc),
      escapeCSV(bankName),
      amt,
      escapeCSV(channel),
      escapeCSV(speed),
      escapeCSV(refId),
      escapeCSV(dateStr),
      escapeCSV(status)
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

/**
 * Monthly POS Terminal Rental Report Export Utility (Item #22 & #23)
 * Exports merchant terminal rent status (Paid vs Pending ₹499/custom rent per merchant).
 */
export function generateRentalReportCSV(rentalList, options = {}) {
  const headers = [
    'Sl No',
    'Merchant ID',
    'Merchant Name',
    'Store / Shop Name',
    'Merchant Mobile',
    'POS Machine Provider',
    'Terminal ID (TID)',
    'Device Plan',
    'Monthly Rent (INR)',
    'Assigned Distributor / Creator',
    'Billing Cycle / Month',
    'Rental Status',
    'Payment Date',
    'Remarks / Notes'
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""').trim();
    return `"${str}"`;
  };

  const rows = rentalList.map((item, index) => {
    const slNo = index + 1;
    const mid = item.merchant_id || item.id || 'MID-UNKNOWN';
    const mName = item.merchant_name || item.name || 'Merchant';
    const shopName = item.shop_name || item.business_name || 'Retail Outlet';
    const mobile = item.mobile || item.merchant_mobile || 'N/A';
    const provider = item.pos_provider || item.provider || 'Pine Labs';
    const tid = item.terminal_id || item.pos_terminal || 'TID-N/A';
    const plan = item.device_plan || item.plan || 'RENTAL';
    const rentAmt = parseFloat(item.monthly_rent || item.rent || 499).toFixed(2);
    const distributor = item.creator_name ? `${item.creator_name} (${item.creator_id || 'DIRECT'})` : (item.creator_id || 'Super Admin');
    const month = item.billing_month || options.billingMonth || new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    const status = (item.rental_status || item.status || 'PENDING').toUpperCase();
    const payDate = item.paid_at ? new Date(item.paid_at).toLocaleDateString('en-IN') : (status === 'PAID' ? 'Collected' : 'Pending');
    const remark = item.remarks || item.notes || (status === 'PAID' ? 'Rental collected' : 'Pending payment for billing month');

    return [
      slNo,
      escapeCSV(mid),
      escapeCSV(mName),
      escapeCSV(shopName),
      escapeCSV(mobile),
      escapeCSV(provider),
      escapeCSV(tid),
      escapeCSV(plan),
      rentAmt,
      escapeCSV(distributor),
      escapeCSV(month),
      escapeCSV(status),
      escapeCSV(payDate),
      escapeCSV(remark)
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  return { success: true, csvContent, count: rentalList.length };
}

export function downloadRentalReportFile(rentalList, options = {}) {
  if (!rentalList || rentalList.length === 0) {
    return { success: false, count: 0, error: 'No rental records to export' };
  }

  const { csvContent, count } = generateRentalReportCSV(rentalList, options);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const today = new Date().toISOString().slice(0, 10);
  const fileName = options.fileName || `RONAV_Monthly_POS_Rental_Report_${today}.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  return { success: true, count, fileName };
}


