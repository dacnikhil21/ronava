// Centralized Frontend API Service connected to local SQLite REST backend
const API_BASE = '/api';

export async function loginUser(credentials) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials)
  });
  return res.json();
}

export async function getAllUsers() {
  const res = await fetch(`${API_BASE}/users`);
  return res.json();
}

export async function createDownstreamUser(userData) {
  const res = await fetch(`${API_BASE}/users/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData)
  });
  return res.json();
}

export async function getWallet(userId) {
  const res = await fetch(`${API_BASE}/wallet/${userId}`);
  return res.json();
}

export async function recordMerchantSale(saleData) {
  const res = await fetch(`${API_BASE}/transactions/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(saleData)
  });
  return res.json();
}

export async function getMerchantTransactions(merchantId) {
  const res = await fetch(`${API_BASE}/transactions/merchant/${merchantId}`);
  return res.json();
}

export async function getAdminPending() {
  const res = await fetch(`${API_BASE}/admin/pending`);
  return res.json();
}

export async function verifyTransaction(txnId, action, remark = '') {
  const res = await fetch(`${API_BASE}/admin/verify-transaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txn_id: txnId, action, remark })
  });
  return res.json();
}

export async function requestWithdrawal(withdrawalData) {
  const res = await fetch(`${API_BASE}/withdrawals/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withdrawalData)
  });
  return res.json();
}

export async function verifyWithdrawal(withdrawalId, action, remark = '') {
  const res = await fetch(`${API_BASE}/admin/verify-withdrawal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ withdrawal_id: withdrawalId, action, remark })
  });
  return res.json();
}

export async function getBeneficiaries(merchantId) {
  const res = await fetch(`${API_BASE}/beneficiaries/${merchantId}`);
  return res.json();
}

export async function addBeneficiary(data) {
  const res = await fetch(`${API_BASE}/beneficiaries/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function getMerchantWithdrawals(merchantId) {
  const res = await fetch(`${API_BASE}/withdrawals/merchant/${merchantId}`);
  return res.json();
}

export async function submitInquiry(inquiryData) {
  const res = await fetch(`${API_BASE}/inquiries/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inquiryData)
  });
  return res.json();
}

export async function getInquiries() {
  const res = await fetch(`${API_BASE}/inquiries`);
  return res.json();
}

export async function getDownstreamNetwork(creatorId) {
  const res = await fetch(`${API_BASE}/network/downstream?creator_id=${encodeURIComponent(creatorId)}`);
  return res.json();
}

export async function getPartnerTransactions(creatorId, partnerId) {
  const res = await fetch(`${API_BASE}/network/partner-transactions?creator_id=${encodeURIComponent(creatorId)}&partner_id=${encodeURIComponent(partnerId)}`);
  return res.json();
}

