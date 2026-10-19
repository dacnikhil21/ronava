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
  const headers = [
    'Sl No',
    'Beneficiary Name',
    'Account Number',
    'IFSC Code',
    'Bank Name',
    'Net Amount (INR)',
    'Merchant ID',
    'Merchant Name',
    'Merchant Mobile',
    'Channel',
    'Machine Name',
    'Withdrawal Mode',
    'Swipe Mode',
    'UTR Number',
    'Date & Time'
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""').trim();
    return `"${str}"`;
  };

  const rows = payoutsList.map((item, index) => {
    const slNo = index + 1;
    const merchantId = item.merchant_id || item.user_id || 'MID-UNKNOWN';
    const merchantName = item.merchant_name || item.name || '';
    const rawMob = String(item.merchant_mobile || item.mobile || '').replace(/[^0-9]/g, '').trim();
    const formattedMob = rawMob ? `="${rawMob}"` : '""';

    let recipient = item.holder_name || item.beneficiary_name || item.customer_name || '';
    if (!recipient && item.admin_remark) {
      const nameMatch = item.admin_remark.match(/Name:\s*([^|•\r\n]+)/i);
      if (nameMatch) recipient = nameMatch[1].trim();
    }
    if (!recipient) recipient = merchantName || 'Beneficiary';

    const rawAcc = String(item.account_number || item.accountNumber || item.bank_account || '').replace(/[^0-9]/g, '').trim();
    const formattedAcc = rawAcc ? `="${rawAcc}"` : '""';

    const ifsc = String(item.ifsc_code || item.ifsc || '').toUpperCase().trim();
    const bankName = item.bank_name || item.bankName || 'Bank';

    const grossAmt = parseFloat(item.amount || item.amount_rupees || 0);
    const feeAmt = parseFloat(item.fee !== undefined ? item.fee : (item.fee_paise !== undefined ? (Number(item.fee_paise) / 100) : 0));
    const netAmt = parseFloat(item.net_payout !== undefined ? item.net_payout : (item.net_payout_paise !== undefined ? (Number(item.net_payout_paise) / 100) : (grossAmt - feeAmt)));

    // Machine Name / Terminal ID
    let rawTerm = item.terminal_id || item.pos_terminal || item.pos_terminal_id || '';
    if (!rawTerm && item.channels && typeof item.channels === 'object') {
      const chKey = (item.channel || 'pinelabs').toLowerCase().replace(/[^a-z]/g, '');
      rawTerm = item.channels[chKey]?.terminal_id || item.channels[chKey]?.terminalId || '';
    }
    let cleanTerminal = rawTerm ? String(rawTerm).trim() : '';
    if (cleanTerminal.includes('[PORTFOLIO]')) {
      try {
        const parsed = JSON.parse(cleanTerminal.replace('[PORTFOLIO]', '').trim());
        cleanTerminal = parsed.terminal_id || parsed.serial || parsed.terminal || cleanTerminal;
      } catch (_) {}
    }
    if (!cleanTerminal || cleanTerminal === 'N/A') {
      const chKey = (item.channel || 'pinelabs').toLowerCase();
      cleanTerminal = chKey.includes('qr') ? 'Company QR' : 'Main Terminal';
    }

    // Channel
    let channel = 'Pine Labs';
    const rawProv = (item.channel || item.pos_provider || item.provider || '').toLowerCase();
    if (rawProv.includes('qr')) channel = 'Company QR (UPI)';
    else if (rawProv.includes('swiff')) channel = 'Payswiff';
    else channel = 'Pine Labs';

    // Modes
    const withdrawalMode = (item.withdrawal_mode || item.settlement_mode || item.settlement_type || 'T1').toUpperCase().replace('T1', 'T+1');
    let swipeMode = (item.swipe_mode || item.swipe_settlement_type || 'T1').toUpperCase().replace('T1', 'T+1');
    if (swipeMode === 'UNKNOWN' || swipeMode === 'N/A') swipeMode = withdrawalMode;

    // UTR Number
    let utrVal = item.utr_number || item.rrn_number || item.utr || item.ref_number || item.bank_rrn || '';
    if (!utrVal && typeof item.admin_remark === 'string') {
      const utrMatch = item.admin_remark.match(/UTR:?\s*([A-Za-z0-9_-]+)/i);
      if (utrMatch) utrVal = utrMatch[1].trim();
    }
    const cleanUtr = String(utrVal).trim();
    const formattedUtr = cleanUtr && cleanUtr !== 'N/A' ? `="${cleanUtr}"` : '"Pending Bank Transfer"';

    // Date & Time
    const d = item.created_at ? new Date(item.created_at) : new Date();
    const formattedDateTime = d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    return [
      slNo,
      escapeCSV(recipient),
      formattedAcc,
      escapeCSV(ifsc),
      escapeCSV(bankName),
      netAmt.toFixed(2),
      escapeCSV(merchantId),
      escapeCSV(merchantName),
      formattedMob,
      escapeCSV(channel),
      escapeCSV(cleanTerminal),
      escapeCSV(withdrawalMode),
      escapeCSV(swipeMode),
      formattedUtr,
      escapeCSV(formattedDateTime)
    ].join(',');
  });

  // Prepend UTF-8 BOM (\uFEFF) so Excel opens seamlessly without encoding problems
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  return { success: true, csvContent, count: payoutsList.length };
}

/**
 * Universal browser-safe file download trigger
 */
export function triggerBrowserDownload(csvContent, fileName) {
  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = (window.URL || window.webkitURL).createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        (window.URL || window.webkitURL).revokeObjectURL(url);
      } catch (err) {
        console.debug('[bankExportUtils] revokeObjectURL cleanup notice:', err);
      }
    }, 2000);
    return true;
  } catch (err) {
    try {
      const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', fileName);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          if (document.body.contains(link)) {
            document.body.removeChild(link);
          }
        } catch (err) {
          console.debug('[bankExportUtils] removeChild cleanup notice:', err);
        }
      }, 2000);
      return true;
    } catch (fallbackErr) {
      console.error('Download failed:', fallbackErr);
      return false;
    }
  }
}

export function downloadBankBatchFile(payoutsList, options = {}) {
  if (!payoutsList || payoutsList.length === 0) {
    return { success: false, count: 0, error: 'No payout records to export' };
  }

  const { csvContent, count } = generateBankBatchCSV(payoutsList, options);
  const today = new Date().toISOString().slice(0, 10);
  const fileName = options.fileName || `RONAV_Bank_Payout_${today}.csv`;

  const ok = triggerBrowserDownload(csvContent, fileName);
  if (ok) {
    return { success: true, count, fileName };
  }
  return { success: false, count: 0, error: 'Browser blocked file download.' };
}

/**
 * Commission & Partner Profit Disbursal Export Utility
 * Generates Excel/CSV tailored specifically for Self-Commission and Profit Margin Disbursals
 * across Super Distributors, Master Distributors, District Distributors, Distributors, and Merchants.
 * Note: Excludes card swipe slip UTRs & POS modes since this is partner profit earnings.
 */
export function generateCommissionBatchCSV(commissionPayoutsList, options = {}) {
  const headers = [
    'Sl No',
    'User ID (Partner ID)',
    'Partner Role / Tier',
    'Partner Name (Store / Legal Owner)',
    'Mobile Number',
    'Beneficiary Name (Account Holder)',
    'Account Number',
    'IFSC Code',
    'Bank Name',
    'Commission Amount (INR)',
    'Senior Upline / Distributor',
    'Request Date & Time',
    'Status'
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""').trim();
    return `"${str}"`;
  };

  const rows = commissionPayoutsList.map((item, index) => {
    const slNo = index + 1;
    const userId = item.merchant_id || item.user_id || 'UID-UNKNOWN';

    // Tier/Role determination
    let partnerRole = item.role || item.user_role || '';
    if (!partnerRole) {
      const uIdUpper = String(userId).toUpperCase();
      if (uIdUpper.startsWith('SD')) partnerRole = 'Super Distributor';
      else if (uIdUpper.startsWith('DD')) partnerRole = 'District Distributor';
      else if (uIdUpper.startsWith('DIST')) partnerRole = 'Distributor';
      else if (uIdUpper.startsWith('MD')) partnerRole = 'Master Distributor';
      else if (uIdUpper.startsWith('MID')) partnerRole = 'Merchant';
      else partnerRole = 'Partner';
    } else {
      partnerRole = partnerRole.replace(/_/g, ' ');
    }

    const partnerName = item.merchant_name || item.name || 'Partner Name';
    const rawMob = String(item.merchant_mobile || item.mobile || '').replace(/[^0-9]/g, '').trim();
    const formattedMob = rawMob ? `="${rawMob}"` : '""';

    let beneficiary = item.customer_name || item.holder_name || item.beneficiary_name || '';
    if (!beneficiary && item.admin_remark) {
      const nameMatch = item.admin_remark.match(/Name:\s*([^|•\r\n]+)/i);
      if (nameMatch && !nameMatch[1].toLowerCase().includes('self')) beneficiary = nameMatch[1].trim();
    }
    if (!beneficiary) beneficiary = partnerName;

    const rawAcc = String(item.account_number || item.accountNumber || item.bank_account || '').replace(/[^0-9]/g, '').trim();
    const formattedAcc = rawAcc ? `="${rawAcc}"` : '""';

    const ifsc = String(item.ifsc_code || item.ifsc || '').toUpperCase().trim();
    const bankName = item.bank_name || item.bankName || 'Bank';
    const amt = parseFloat(item.amount || 0).toFixed(2);

    const upline = item.creator_name ? `${item.creator_name} (${item.creator_id || 'DIRECT'})` : (item.parent_id || item.creator_id || 'Super Admin (Direct)');
    const dateStr = item.created_at ? new Date(item.created_at).toLocaleString('en-IN') : 'N/A';
    const status = item.status || 'PENDING';

    return [
      slNo,
      escapeCSV(userId),
      escapeCSV(partnerRole),
      escapeCSV(partnerName),
      formattedMob,
      escapeCSV(beneficiary),
      formattedAcc,
      escapeCSV(ifsc),
      escapeCSV(bankName),
      amt,
      escapeCSV(upline),
      escapeCSV(dateStr),
      escapeCSV(status)
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  return { success: true, csvContent, count: commissionPayoutsList.length };
}

export function downloadCommissionBatchFile(commissionPayoutsList, options = {}) {
  if (!commissionPayoutsList || commissionPayoutsList.length === 0) {
    return { success: false, count: 0, error: 'No commission payout records to export' };
  }

  const { csvContent, count } = generateCommissionBatchCSV(commissionPayoutsList, options);
  const today = new Date().toISOString().slice(0, 10);
  const fileName = options.fileName || `RONAV_Commission_Payouts_${today}.csv`;

  const ok = triggerBrowserDownload(csvContent, fileName);
  if (ok) {
    return { success: true, count, fileName };
  }
  return { success: false, count: 0, error: 'Browser blocked file download.' };
}

/**
 * Completed Sales Ledger Export Utility
 * Exports completed merchant transactions showing only: gross volume, platform fee, and net settled amount with Bank UTRs.
 */
export function generateCompletedSalesCSV(transactionsList, options = {}) {
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
    const fee = parseFloat(item.company_fee !== undefined ? item.company_fee : (item.fee_deducted !== undefined ? item.fee_deducted : (item.admin_net_margin || item.admin_margin || item.admin_cut || 0)));
    const netSettled = item.net_amount !== undefined 
      ? parseFloat(item.net_amount).toFixed(2)
      : (item.net_amount_paise !== undefined 
          ? (Number(item.net_amount_paise) / 100).toFixed(2) 
          : parseFloat(item.net_settled !== undefined ? item.net_settled : item.amount || 0).toFixed(2));

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
      netSettled,
      escapeCSV(utr),
      escapeCSV(speed),
      escapeCSV(status)
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  return { success: true, csvContent, count: transactionsList.length };
}

export function downloadCompletedSalesFile(transactionsList, options = {}) {
  if (!transactionsList || transactionsList.length === 0) {
    return { success: false, count: 0, error: 'No transaction records to export' };
  }

  const { csvContent, count } = generateCompletedSalesCSV(transactionsList, options);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const today = new Date().toISOString().slice(0, 10);
  const fileName = options.fileName || `RONAV_Completed_Sales_${today}.csv`;

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    try {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.debug('[bankExportUtils] DOM cleanup notice:', err);
    }
  }, 3000);
  
  return { success: true, count, fileName };
}

// Backward-compatible aliases without tax logic
export const generateGstAuditCSV = generateCompletedSalesCSV;
export const downloadGstAuditFile = downloadCompletedSalesFile;

/**
 * Monthly POS Terminal Rental Report Export Utility (Item #22 & #23)
 * Exports merchant terminal rent status (Paid vs Pending monthly/custom rent per merchant).
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
    const mName = item.merchant_name || item.name || '';
    const shopName = item.shop_name || item.business_name || 'Retail Outlet';
    const mobile = item.mobile || item.merchant_mobile || 'N/A';
    const provider = item.pos_provider || item.provider || 'Pine Labs';
    const tid = item.terminal_id || item.pos_terminal || 'TID-N/A';
    const plan = item.device_plan || item.plan || 'RENTAL';
    const rentAmt = parseFloat(item.monthly_rent !== undefined && item.monthly_rent !== null ? item.monthly_rent : (item.rent !== undefined && item.rent !== null ? item.rent : (options.defaultRent || 0))).toFixed(2);
    const distributor = item.creator_name ? `${item.creator_name} (${item.creator_id || 'DIRECT'})` : (item.parent_name || item.creator_id || 'DIRECT');
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
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    try {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.debug('[bankExportUtils] DOM cleanup notice:', err);
    }
  }, 3000);
  
  return { success: true, count, fileName };
}


