import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Menu, Bell, ChevronDown, Calendar, ChevronRight, Landmark, 
  Building2, Receipt, CreditCard, Smartphone, Users, AlertCircle, 
  Copy, Search, X, TrendingUp, CheckCircle2, Clock, LogOut, 
  Shield, Activity, PlusCircle, RefreshCw, GitFork, Layers, 
  Store, Briefcase, ShieldCheck, ArrowRight, ArrowLeft,
  Check, Phone, DollarSign, ArrowUpRight, Zap, Crown, User,
  Download, Edit3, UserCheck, UserX, FileText, MapPin, BadgeCheck, Key
} from 'lucide-react';
import { downloadBankBatchFile, downloadGstAuditFile, downloadRentalReportFile } from '../utils/bankExportUtils.js';
import { 
  getAdminPending, 
  verifyTransaction, 
  getAllUsers, 
  createDownstreamUser, 
  verifyWithdrawal,
  verifyWithdrawalsBatch,
  markWithdrawalsSubmittedToBank,
  revertWithdrawalsToPending,
  getInquiries,
  updateInquiryStatus,
  updateUserStatus,
  updateUserDetails,
  getHierarchyTree,
  getBeneficiaries,
  getMerchantWithdrawals,
  getPlatformQrConfig,
  savePlatformQrConfig,
  adminResetUserPassword,
  updateMerchantChannels,
  parseMerchantChannels,
  serializeMerchantChannels,
  classifyTransactionChannel,
  getMonthlyRentalReport,
  updatePosRentalStatus
} from '../services/api';
import { subscribeToAdminFeed } from '../services/supabase';
import RonavLogo from './RonavLogo';

export default function AdminDashboardPage({ onLogout, onNavigate }) {
  // Navigation View: 'overview' | 'master_distributors' | 'super_distributors' | 'district_distributors' | 'distributors' | 'merchants' | 'payouts' | 'loans' | 'franchises'
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [tabLoading, setTabLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [copiedId, setCopiedId] = useState({});
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target)) {
        setShowAccountMenu(false);
      }
    };
    if (showAccountMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showAccountMenu]);

  // Active Person Dossier Drilldown View (When clicking ANY card)
  const [viewingUserDossier, setViewingUserDossier] = useState(null);
  const [showFullChain, setShowFullChain] = useState(false);
  const [dossierTab, setDossierTab] = useState('transactions'); // 'transactions' | 'withdrawals' | 'banks'
  const [dossierHistory, setDossierHistory] = useState([]);
  const [dossierBeneficiaries, setDossierBeneficiaries] = useState([]);
  const [dossierWithdrawals, setDossierWithdrawals] = useState([]);

  // Inquiries State (Loans & ATM/CDM Franchises)
  const [inquiriesList, setInquiriesList] = useState([]);
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState('ALL'); // 'ALL' | 'New' | 'Under Review' | 'Approved' | 'Rejected'
  
  // Real-Time Date Range Filter
  const [dateRangeFilter, setDateRangeFilter] = useState('ALL'); // 'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH'

  // Edit Partner Modal State
  const [editingPartner, setEditingPartner] = useState({
    isOpen: false,
    user: null,
    name: '',
    mobile: ''
  });

  // Admin Reset Password Modal State
  const [resetPassModal, setResetPassModal] = useState({
    isOpen: false,
    user: null,
    newPassword: '',
    isSubmitting: false,
    successResult: null
  });

  // Disbursal & Bank UTR Modal State
  const [disbursingPayout, setDisbursingPayout] = useState(null); // { payout, utr: '', mode: 'IMPS' }

  // Record Sale Portal Verification Modal State & Sub-filter
  const [verifyingSwipe, setVerifyingSwipe] = useState(null); // { txn, action: 'APPROVE', remark: '', reason: '' }
  const [swipeSubTab, setSwipeSubTab] = useState('PENDING'); // 'PENDING' | 'APPROVED' | 'REJECTED'

  // Dynamic Data Stores
  const [networkUsers, setNetworkUsers] = useState([]);
  const [hierarchyData, setHierarchyData] = useState(null);
  const [pendingTxns, setPendingTxns] = useState([]);
  const [pendingPayouts, setPendingPayouts] = useState([]);
  const [allPayouts, setAllPayouts] = useState([]);
  const [payoutCategoryFilter, setPayoutCategoryFilter] = useState('ALL'); // 'ALL' | 'SWIPES' | 'WITHDRAWALS'
  const [payoutStatusFilter, setPayoutStatusFilter] = useState('PENDING'); // 'APPROVED' | 'PENDING' | 'INVALID'
  const [payoutSearchQuery, setPayoutSearchQuery] = useState('');
  const [payoutDateFilter, setPayoutDateFilter] = useState('TODAY'); // 'TODAY' | 'ALL' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'CUSTOM'
  const [payoutCustomDate, setPayoutCustomDate] = useState('');
  const [payoutFromDate, setPayoutFromDate] = useState('');
  const [payoutToDate, setPayoutToDate] = useState('');
  const [payoutPage, setPayoutPage] = useState(1);
  const [payoutSettlementFilter, setPayoutSettlementFilter] = useState('ALL'); // 'ALL' | 'T1' | 'INSTANT'
  const [batchDisbursalModal, setBatchDisbursalModal] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState('all'); // 'all' | 'pinelabs' | 'payswiff' | 'qr'
  const [selectedPayswiffVendor, setSelectedPayswiffVendor] = useState('ronav'); // 'ronav' | 'rp'
  const [companyQrImage, setCompanyQrImage] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ronav_company_qr_image') || null;
    }
    return null;
  });
  const [companyQrPayeeName, setCompanyQrPayeeName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ronav_company_qr_name') || 'RONAV TECHNOLOGIES';
    }
    return 'RONAV TECHNOLOGIES';
  });
  const [showAdminQrPreview, setShowAdminQrPreview] = useState(false);

  const [expandedPayoutId, setExpandedPayoutId] = useState(null);
  const [transactionsLedger, setTransactionsLedger] = useState([]);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [selectedPendingIds, setSelectedPendingIds] = useState(new Set());
  const [expandedBatchIds, setExpandedBatchIds] = useState({});
  const [metrics, setMetrics] = useState({
    totalVolume: 0,
    adminNetProfit: 0,
    totalMerchants: 0,
    totalSuperDistributors: 0,
    totalDistributors: 0,
    pendingWithdrawalsCount: 0,
    vendorSummary: {
      roseNavaneethamVolume: 0,
      roseNavaneethamProfit: 0,
      ronavTechVolume: 0,
      rpTechVolume: 0,
      payswiffAdminProfit: 0
    },
    devicePlanSummary: {
      rentalCount: 0,
      lifetimeCount: 0,
      monthlyRentDue: 0
    }
  });

  // Universal Onboard Partner Modal State with Full Merchant Rights & Dynamic Rates
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdResultModal, setCreatedResultModal] = useState(null);
  const [onboardForm, setOnboardForm] = useState({
    name: '',
    mobile: '',
    role: 'MERCHANT', // 'SUPER_DISTRIBUTOR' | 'DISTRICT_DISTRIBUTOR' | 'DISTRIBUTOR' | 'MERCHANT'
    parent_id: '',
    assign_pos: true, // Assign counter POS machine to this user
    pos_provider: 'Pine Labs', // 'Pine Labs' | 'Payswiff'
    pos_vendor: 'Rose Navaneetham Enterprises', // 'Rose Navaneetham Enterprises' | 'RONAV Technologies' | 'R.P. Technologies'
    device_plan: 'RENTAL', // 'RENTAL' | 'LIFETIME'
    monthly_rent: '499',
    settlement_type: 'T1', // 'T1' | 'INSTANT'
    commission_rate_t1: '1.50', // T+1 Base MDR %
    commission_rate_instant: '1.80', // Instant Settlement MDR %
    pos_terminal_id: '' // Real physical POS machine serial number / TID
  });

  // Multi-Channel Onboarding State (Option 1: Add Channel inventory model)
  const [onboardChannels, setOnboardChannels] = useState({
    pine_labs: {
      enabled: true,
      terminal_id: '',
      vendor: 'Rose Navaneetham Enterprises',
      plan: 'RENTAL',
      rent: '499',
      rate_t1: '1.50',
      rate_instant: '1.80'
    },
    payswiff: null,
    qr: null
  });

  // Manage Terminals & Channels Modal State for Existing Merchants
  const [managingChannelsMerchant, setManagingChannelsMerchant] = useState(null);
  const [managingChannelsData, setManagingChannelsData] = useState({
    pine_labs: { enabled: false, terminal_id: '', rate_t1: 1.50, rate_instant: 1.80, vendor: 'Rose Navaneetham Enterprises', plan: 'RENTAL', rent: 499 },
    payswiff: { enabled: false, terminal_id: '', rate_t1: 1.50, rate_instant: 1.80, vendor: 'RONAV Technologies', plan: 'RENTAL', rent: 499 },
    qr: { enabled: false, rate_instant: 1.50, vendor: 'RONAV Technologies' }
  });
  const [isSavingChannels, setIsSavingChannels] = useState(false);

  // Dedicated Ecosystem Profit & Commission Distribution State
  const [profitDateFilter, setProfitDateFilter] = useState('TODAY'); // 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'ALL' | 'CUSTOM'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedProfitTier, setSelectedProfitTier] = useState('COMPANY'); // 'COMPANY' | 'MASTER' | 'SUPER' | 'DISTRICT' | 'DISTRIBUTOR' | 'MERCHANT'

  // Monthly POS Terminal Rental Report State (Items #22 & #23)
  const [rentalReportData, setRentalReportData] = useState({
    list: [],
    summary: { totalTerminals: 0, totalDue: 0, totalCollected: 0, totalPending: 0, paidCount: 0, pendingCount: 0 }
  });
  const [rentalMonth, setRentalMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [rentalStatusFilter, setRentalStatusFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'PAID'
  const [rentalSearchQuery, setRentalSearchQuery] = useState('');
  const [isLoadingRental, setIsLoadingRental] = useState(false);
  const [updatingRentalId, setUpdatingRentalId] = useState(null);

  const fetchRentalReport = async (monthVal) => {
    setIsLoadingRental(true);
    try {
      const res = await getMonthlyRentalReport(monthVal || rentalMonth);
      if (res && res.success) {
        setRentalReportData({
          list: res.list || [],
          summary: res.summary || {}
        });
      }
    } catch (e) {
      console.error('Failed to load rental report:', e);
    } finally {
      setIsLoadingRental(false);
    }
  };

  const handleToggleRentalStatus = async (item) => {
    const newStatus = item.rental_status === 'PAID' ? 'PENDING' : 'PAID';
    setUpdatingRentalId(`${item.merchant_id}_${item.terminal_id}`);
    try {
      const res = await updatePosRentalStatus({
        merchant_id: item.merchant_id,
        terminal_id: item.terminal_id,
        billing_month: item.billing_month || rentalMonth,
        status: newStatus,
        remarks: newStatus === 'PAID' ? 'Collected by Admin' : 'Marked pending'
      });
      if (res && res.success) {
        triggerToast(`✓ Updated ${item.merchant_name} (${item.terminal_id}) to ${newStatus}!`, 'success');
        fetchRentalReport(rentalMonth);
      } else {
        triggerToast(res?.message || 'Failed to update rental status', 'error');
      }
    } catch (e) {
      triggerToast('Error updating rental status', 'error');
    } finally {
      setUpdatingRentalId(null);
    }
  };

  // Toast Helper
  const triggerToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Clipboard Helper
  const copyToClipboard = (text, id) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(prev => ({ ...prev, [id]: true }));
      triggerToast(`Copied: ${text}`, 'info');
      setTimeout(() => {
        setCopiedId(prev => ({ ...prev, [id]: false }));
      }, 1500);
    });
  };

  // QR Upload & Reset Handlers for Company Official QR (Direct Supabase Sync)
  const handleAdminQrUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      triggerToast('Please select an image file (PNG, JPG, WebP)', 'error');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      triggerToast('Image size should be under 4MB', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      setCompanyQrImage(base64);
      const res = await savePlatformQrConfig({ image: base64, name: companyQrPayeeName });
      if (res.syncedToSupabase) {
        triggerToast('✓ Company Official QR saved and synced to Supabase (visible on all devices)!', 'success');
      } else {
        triggerToast('✓ Company Official QR updated!', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetAdminQr = async () => {
    if (window.confirm('Reset company QR code to standard default?')) {
      setCompanyQrImage(null);
      await savePlatformQrConfig({ image: null, name: companyQrPayeeName });
      triggerToast('✓ Company QR reset to default across all devices', 'info');
    }
  };

  // Load Fresh Data from Backend
  const fetchAdminData = async () => {
    try {
      // Sync platform QR from Supabase in background
      getPlatformQrConfig().then(cfg => {
        if (cfg) {
          if (cfg.image) setCompanyQrImage(cfg.image);
          if (cfg.name) setCompanyQrPayeeName(cfg.name);
        }
      }).catch(() => {});

      const [pendingRes, usersRes, treeRes, inqRes] = await Promise.all([
        getAdminPending().catch(() => ({ success: false })),
        getAllUsers().catch(() => ({ success: false })),
        getHierarchyTree().catch(() => ({ success: false })),
        getInquiries().catch(() => ({ success: false, inquiries: [] }))
      ]);

      if (inqRes && inqRes.inquiries) {
        setInquiriesList(inqRes.inquiries);
      }

      if (pendingRes && pendingRes.success) {
        setPendingTxns(pendingRes.pendingTransactions || []);
        setPendingPayouts(pendingRes.pendingWithdrawals || []);
        setAllPayouts(pendingRes.allWithdrawals || []);
        setTransactionsLedger(pendingRes.allTransactions || []);
        if (pendingRes.stats) {
          setMetrics(prev => ({
            ...prev,
            ...pendingRes.stats,
            vendorSummary: {
              ...prev.vendorSummary,
              ...(pendingRes.stats.vendorSummary || {})
            },
            devicePlanSummary: {
              ...prev.devicePlanSummary,
              ...(pendingRes.stats.devicePlanSummary || {})
            }
          }));
        }
      }

      if (usersRes && usersRes.success) {
        setNetworkUsers(usersRes.users || []);
      }

      if (treeRes && treeRes.success) {
        setHierarchyData(treeRes);
      }

      fetchRentalReport(rentalMonth);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    }
  };

  useEffect(() => {
    fetchAdminData();
    const unsubscribe = subscribeToAdminFeed(() => {
      fetchAdminData();
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // View Switcher
  const handleTabSwitch = (tab) => {
    setTabLoading(true);
    setActiveTab(tab);
    setSearchQuery('');
    setViewingUserDossier(null);
    setDossierHistory([]);
    fetchAdminData();
    if (tab === 'rentals') {
      fetchRentalReport(rentalMonth);
    }
    setTimeout(() => setTabLoading(false), 150);
  };

  // Back Navigation for Dossier Drilldown
  const handleBackDossier = () => {
    if (dossierHistory.length > 0) {
      const prev = dossierHistory[dossierHistory.length - 1];
      setDossierHistory(prevList => prevList.slice(0, -1));
      setViewingUserDossier(prev);
      window.scrollTo(0, 0);
    } else {
      setViewingUserDossier(null);
      window.scrollTo(0, 0);
    }
  };

  // Open Create Modal with Preselected Role
  const handleOpenCreateModal = (role = 'MERCHANT', parentId = '') => {
    const rateT1 = role === 'MASTER' ? '1.35' : (role === 'SUPER_DISTRIBUTOR' ? '1.40' : (role === 'DISTRICT_DISTRIBUTOR' ? '1.45' : (role === 'DISTRIBUTOR' ? '1.48' : '1.50')));
    const rateInstant = role === 'MASTER' ? '1.65' : (role === 'SUPER_DISTRIBUTOR' ? '1.70' : (role === 'DISTRICT_DISTRIBUTOR' ? '1.75' : (role === 'DISTRIBUTOR' ? '1.78' : '1.80')));

    setOnboardForm({
      name: '',
      mobile: '',
      email: '',
      aadhaar: '',
      pan: '',
      address: '',
      agreement_accepted: false,
      role: role,
      parent_id: parentId,
      assign_pos: true,
      pos_provider: 'Pine Labs',
      pos_vendor: 'Rose Navaneetham Enterprises',
      device_plan: 'RENTAL',
      monthly_rent: '499',
      settlement_type: 'T1',
      commission_rate_t1: rateT1,
      commission_rate_instant: rateInstant,
      pos_terminal_id: ''
    });

    // Default: Add Pine Labs POS card. Payswiff & QR are optional and can be added via [+ Add Channel] buttons.
    setOnboardChannels({
      pine_labs: {
        enabled: true,
        terminal_id: '',
        vendor: 'Rose Navaneetham Enterprises',
        plan: 'RENTAL',
        rent: '499',
        rate_t1: rateT1,
        rate_instant: rateInstant
      },
      payswiff: null,
      qr: null
    });

    setIsCreateModalOpen(true);
  };

  // Open Manage Terminals & QR Channel Portfolio for Existing Merchant
  const handleOpenManageChannels = (user) => {
    const ch = user.channels || (user.pos_raw ? parseMerchantChannels(user.pos_raw) : parseMerchantChannels(null));
    setManagingChannelsMerchant(user);
    setManagingChannelsData(JSON.parse(JSON.stringify(ch)));
  };

  // Save Channel Portfolio for Existing Merchant
  const handleSaveManageChannels = async () => {
    if (!managingChannelsMerchant) return;
    setIsSavingChannels(true);
    try {
      const res = await updateMerchantChannels(managingChannelsMerchant.id, managingChannelsData);
      if (res.success) {
        triggerToast(`✓ Successfully updated channel portfolio for ${managingChannelsMerchant.name}!`, 'success');
        setManagingChannelsMerchant(null);
        fetchAdminData();
      } else {
        triggerToast(res.message || 'Failed to update channels', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error saving channels', 'error');
    } finally {
      setIsSavingChannels(false);
    }
  };

  // Submit User Creation with Multi-Channel Portfolio
  const handleSubmitOnboard = async (e) => {
    e.preventDefault();
    const cleanName = (onboardForm.name || '').trim();
    const cleanMobile = (onboardForm.mobile || '').replace(/\D/g, '').trim();
    const cleanEmail = (onboardForm.email || '').trim();
    const cleanAadhaar = (onboardForm.aadhaar || '').replace(/\D/g, '').trim();
    const cleanPan = (onboardForm.pan || '').toUpperCase().trim();
    const cleanAddress = (onboardForm.address || '').trim();

    if (!cleanName) {
      triggerToast('Please provide full name / store name.', 'error');
      return;
    }
    if (!cleanMobile || cleanMobile.length !== 10) {
      triggerToast('Please provide a valid 10-digit mobile number.', 'error');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      triggerToast('Please provide a valid email address.', 'error');
      return;
    }
    if (!cleanAadhaar || cleanAadhaar.length !== 12) {
      triggerToast('Please provide a valid 12-digit Aadhaar Card number.', 'error');
      return;
    }
    if (!cleanPan || cleanPan.length !== 10) {
      triggerToast('Please provide a valid 10-digit PAN Card number.', 'error');
      return;
    }
    if (!cleanAddress) {
      triggerToast('Please provide the full business address.', 'error');
      return;
    }
    if (!onboardForm.agreement_accepted) {
      triggerToast('Please accept the Merchant Service Agreement to proceed.', 'error');
      return;
    }

    // Determine primary provider for legacy compatibility
    let primaryProvider = 'Pine Labs';
    let primaryVendor = 'Rose Navaneetham Enterprises';
    let primaryTid = '';
    let primaryRateT1 = onboardForm.commission_rate_t1 || '1.50';
    let primaryRateInstant = onboardForm.commission_rate_instant || '1.80';

    if (onboardChannels.pine_labs) {
      primaryProvider = 'Pine Labs';
      primaryVendor = 'Rose Navaneetham Enterprises';
      primaryTid = onboardChannels.pine_labs.terminal_id || '';
      primaryRateT1 = onboardChannels.pine_labs.rate_t1 || '1.50';
      primaryRateInstant = onboardChannels.pine_labs.rate_instant || '1.80';
    } else if (onboardChannels.payswiff) {
      primaryProvider = 'Payswiff';
      primaryVendor = onboardChannels.payswiff.vendor || 'RONAV Technologies';
      primaryTid = onboardChannels.payswiff.terminal_id || '';
      primaryRateT1 = onboardChannels.payswiff.rate_t1 || '1.50';
      primaryRateInstant = onboardChannels.payswiff.rate_instant || '1.80';
    } else if (onboardChannels.qr) {
      primaryProvider = 'QR';
      primaryVendor = 'RONAV Technologies';
      primaryTid = 'QR-CHANNEL';
      primaryRateT1 = onboardChannels.qr.rate_instant || '1.50';
      primaryRateInstant = onboardChannels.qr.rate_instant || '1.50';
    }

    setIsSubmitting(true);
    try {
      const payload = {
        creator_id: 'ADM001',
        parent_id: onboardForm.parent_id || 'ADM001',
        name: cleanName,
        mobile: cleanMobile,
        email: cleanEmail,
        aadhaar: cleanAadhaar,
        pan: cleanPan,
        address: cleanAddress,
        role: onboardForm.role,
        channels: onboardChannels,
        pos_provider: primaryProvider,
        pos_vendor: primaryVendor,
        pos_terminal_id: primaryTid,
        device_plan: onboardChannels.pine_labs?.plan || onboardChannels.payswiff?.plan || 'RENTAL',
        monthly_rent: onboardChannels.pine_labs?.rent || onboardChannels.payswiff?.rent || '499',
        settlement_type: 'INSTANT',
        commission_rate_t1: primaryRateT1,
        commission_rate_instant: primaryRateInstant
      };


      const res = await createDownstreamUser(payload);
      if (res && res.success) {
        setIsCreateModalOpen(false);
        setCreatedResultModal(res.credentials || {
          id: res.user?.id,
          name: res.user?.name,
          mobile: res.user?.mobile,
          role: res.user?.role,
          parent_name: res.parent?.name || 'Super Admin',
          password: 'Ronav@123'
        });
        triggerToast(`✓ Successfully created ${onboardForm.role}!`, 'success');
        fetchAdminData();
      } else {
        triggerToast(res.message || 'Failed to create user', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Error creating user', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };


  // Disburse an entire batch of T+1 withdrawals at once
  const handleBatchPayoutDisbursal = async (items, batchUtr, remark) => {
    if (!items || items.length === 0) return;
    try {
      setBatchDisbursalModal(prev => ({ ...prev, isSubmitting: true }));
      const ids = items.map(item => item.id);
      const res = await verifyWithdrawalsBatch(ids, 'APPROVE', remark || 'Disbursed via Bank CMS Batch', batchUtr);
      if (res && res.success) {
        triggerToast(`✓ Successfully settled batch of ${items.length} payouts! (Batch UTR: ${batchUtr})`, 'success');
        setBatchDisbursalModal(null);
        fetchAdminData();
      } else {
        triggerToast(res?.message || 'Failed to process batch', 'error');
        setBatchDisbursalModal(prev => ({ ...prev, isSubmitting: false }));
      }
    } catch (err) {
      console.error('handleBatchPayoutDisbursal error:', err);
      triggerToast('Error settling batch', 'error');
      setBatchDisbursalModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  // Approve / Reject / Dispatch Payout Action
  const handlePayoutAction = async (id, action, merchantName, amount, utr = '', remark = '') => {
    try {
      const finalRemark = remark || (action === 'DISPATCH' ? 'T+1 Standard Bank Transfer' : 'Disbursed via IMPS');
      const res = await verifyWithdrawal(id, action, finalRemark, utr);
      if (res && res.success) {
        let msg = '';
        if (action === 'DISPATCH') {
          msg = `✓ Payout of ₹${parseFloat(amount).toLocaleString('en-IN')} moved to "Pending to Disburse" (T+1) for ${merchantName}!`;
        } else if (action === 'APPROVE') {
          msg = `✓ Settled payout of ₹${parseFloat(amount).toLocaleString('en-IN')} ${utr ? `(UTR: ${utr})` : ''} for ${merchantName}!`;
        } else {
          msg = `✕ Rejected payout request.`;
        }
        triggerToast(msg, action === 'REJECT' ? 'info' : 'success');
        setDisbursingPayout(null);
        fetchAdminData();
      } else {
        triggerToast(res.message || 'Failed to process payout', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Connection error processing payout', 'error');
    }
  };

  // Approve / Reject Merchant Swipe Action
  const handleTransactionAction = async (id, action, merchantName, amount, remark = '') => {
    try {
      const res = await verifyTransaction(id, action, remark);
      if (res && res.success) {
        triggerToast(
          action === 'APPROVE' 
            ? `✓ Approved & Credited ₹${parseFloat(amount).toLocaleString('en-IN')} for ${merchantName}!` 
            : `✕ Marked transaction as ${action === 'REJECT' ? 'Invalid' : 'Pending'}.`,
          action === 'APPROVE' ? 'success' : 'info'
        );
        setVerifyingSwipe(null);
        fetchAdminData();
      } else {
        triggerToast(res.message || 'Failed to verify transaction', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Connection error verifying transaction', 'error');
    }
  };

  // Stage 1: Withdrawal Requests (New requests from merchants / card swipe payouts)
  const withdrawalRequests = useMemo(() => {
    return allPayouts.filter(p => p.status === 'PENDING' && !(p.admin_remark || '').includes('[PENDING_TO_DISBURSE]'));
  }, [allPayouts]);

  // Stage 2: Pending to Disburse (Initiated / T+1 Bank Clearance in Progress)
  const pendingToDisburse = useMemo(() => {
    return allPayouts.filter(p => p.status === 'PENDING' && (p.admin_remark || '').includes('[PENDING_TO_DISBURSE]'));
  }, [allPayouts]);

  // Stage 3: Settled / Approved Payouts
  const settledPayouts = useMemo(() => {
    return allPayouts.filter(p => p.status === 'APPROVED');
  }, [allPayouts]);

  // Channel & Vendor Pending Payouts Counter (strictly PENDING, resets daily with date scope)
  const channelPendingCounts = useMemo(() => {
    const userPosLookup = {};
    (networkUsers || []).forEach(u => {
      if (u && u.id) {
        userPosLookup[u.id] = {
          provider: u.pos_provider,
          vendor: u.pos_vendor,
          terminal: u.pos_terminal
        };
      }
    });

    const now = new Date();
    const toLocalDateStr = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    };
    const todayStr = toLocalDateStr(now);

    const pendingItems = (allPayouts || []).filter(w => {
      if (w.status !== 'PENDING') return false;
      if (payoutDateFilter === 'TODAY') {
        const itemDateStr = toLocalDateStr(w.created_at || w.verified_at);
        return itemDateStr === todayStr;
      }
      return true;
    });

    let pine = 0;
    let swiffRonav = 0;
    let swiffRp = 0;
    let qr = 0;

    pendingItems.forEach(item => {
      const channel = classifyTransactionChannel(item);
      const uPos = userPosLookup[item.merchant_id] || {};
      const v = (item.pos_vendor || uPos.vendor || '').toLowerCase();
      const notes = (item.notes || item.admin_remark || '').toLowerCase();

      if (channel === 'qr') {
        qr++;
      } else if (channel === 'payswiff') {
        const isRp = v.includes('rp') || notes.includes('r.p.') || notes.includes('rp tech') || notes.includes('rp_');
        if (isRp) {
          swiffRp++;
        } else {
          swiffRonav++;
        }
      } else {
        pine++;
      }
    });

    return {
      pine,
      swiffRonav,
      swiffRp,
      swiffTotal: swiffRonav + swiffRp,
      qr,
      total: pine + swiffRonav + swiffRp + qr
    };
  }, [allPayouts, networkUsers, payoutDateFilter]);

  // Process Master Distributors List (Tier 0 / Apex Command Tier)
  const masterDistributorsList = useMemo(() => {
    return networkUsers.filter(u => 
      u.role === 'MASTER' || 
      u.role === 'MASTER_DISTRIBUTOR' || 
      (u.id && u.id.startsWith('MST'))
    ).map(u => ({
      ...u,
      super_distributor_count: networkUsers.filter(s => (s.creator_id === u.id || s.parent_id === u.id) && (s.role === 'SUPER_DISTRIBUTOR' || (s.id && s.id.startsWith('SD')))).length,
      total_network_count: networkUsers.filter(s => s.creator_id === u.id || s.parent_id === u.id).length,
      network_volume: u.total_sales || 0,
      super_distributors: networkUsers.filter(s => (s.creator_id === u.id || s.parent_id === u.id) && (s.role === 'SUPER_DISTRIBUTOR' || (s.id && s.id.startsWith('SD'))))
    }));
  }, [networkUsers]);

  // Process Super Distributors List
  const superDistributorsList = useMemo(() => {
    if (hierarchyData?.tree?.superDistributors) {
      return hierarchyData.tree.superDistributors.filter(u => !(u.id && u.id.startsWith('MST')));
    }
    return networkUsers.filter(u => u.role === 'SUPER_DISTRIBUTOR' && !(u.id && u.id.startsWith('MST'))).map(u => ({
      ...u,
      parent_master_name: u.creator_name || 'Super Admin',
      distributor_count: 0,
      total_merchant_count: 0,
      network_volume: u.total_sales || 0,
      distributors: []
    }));
  }, [hierarchyData, networkUsers]);

  // Process District Distributors (DIST Franchise) List
  const districtDistributorsList = useMemo(() => {
    if (hierarchyData?.tree?.districtDistributors) {
      return hierarchyData.tree.districtDistributors;
    }
    return networkUsers.filter(u => 
      u.role === 'DISTRICT_DISTRIBUTOR' || 
      u.role === 'DIST_FRANCHISE' || 
      (u.id && (u.id.startsWith('DD') || u.id.startsWith('DF')))
    ).map(u => ({
      ...u,
      parent_sd_name: u.creator_name || 'Super Admin',
      distributor_count: 0,
      total_merchant_count: 0,
      downline_volume: u.total_sales || 0,
      distributors: []
    }));
  }, [hierarchyData, networkUsers]);

  // Process Distributors List
  const distributorsList = useMemo(() => {
    if (hierarchyData?.tree?.distributors) {
      return hierarchyData.tree.distributors;
    }
    return networkUsers.filter(u => 
      u.role === 'DISTRIBUTOR' && 
      !(u.id && (u.id.startsWith('DD') || u.id.startsWith('DF')))
    ).map(u => ({
      ...u,
      parent_sd_name: u.creator_name || 'Super Admin',
      merchant_count: 0,
      downline_volume: u.total_sales || 0,
      merchants: []
    }));
  }, [hierarchyData, networkUsers]);

  // Process Merchants List
  const merchantsList = useMemo(() => {
    return networkUsers.filter(u => u.role === 'MERCHANT');
  }, [networkUsers]);

  // Open Dossier for Any Member (Full Dedicated Page)
  const handleOpenDossier = (user, type = 'MERCHANT', isDrilldown = false) => {
    if (viewingUserDossier && isDrilldown) {
      setDossierHistory(prev => [...prev, viewingUserDossier]);
    } else if (!isDrilldown) {
      setDossierHistory([]);
    }

    // Trace full upline chain (Super Admin -> SD -> DD -> DIST -> User)
    const uplineChain = [];
    let currParentId = user.creator_id;
    while (currParentId && currParentId !== 'ADM001') {
      const parentObj = networkUsers.find(u => u.id === currParentId);
      if (!parentObj) break;
      uplineChain.unshift(parentObj);
      currParentId = parentObj.creator_id;
    }

    // If Merchant, fetch their linked bank accounts and withdrawal records
    if (type === 'MERCHANT') {
      getBeneficiaries(user.id).then(res => {
        if (res && res.success) setDossierBeneficiaries(res.beneficiaries || []);
        else setDossierBeneficiaries([]);
      }).catch(() => setDossierBeneficiaries([]));

      getMerchantWithdrawals(user.id).then(res => {
        if (res && res.success) setDossierWithdrawals(res.withdrawals || []);
        else setDossierWithdrawals([]);
      }).catch(() => setDossierWithdrawals([]));
    } else {
      setDossierBeneficiaries([]);
      setDossierWithdrawals([]);
    }

    // Robust Downline Entity Resolution
    let childSDs = [];
    let childDDs = [];
    let childDists = [];
    let childMerchants = [];
    const allRelevantIds = new Set([user.id]);

    if (type === 'MASTER') {
      const directSDs = user.super_distributors || superDistributorsList.filter(sd => sd.creator_id === user.id || sd.parent_id === user.id);
      childSDs = directSDs;
      childDDs = directSDs.flatMap(sd => sd.district_distributors || districtDistributorsList.filter(dd => dd.creator_id === sd.id || dd.parent_id === sd.id));
      const directDists = childDDs.flatMap(dd => dd.distributors || distributorsList.filter(d => d.creator_id === dd.id || d.parent_id === dd.id));
      childDists = Array.from(new Map(directDists.map(d => [d.id, d])).values());
      const distMerchants = childDists.flatMap(d => d.merchants || merchantsList.filter(m => m.creator_id === d.id || m.parent_id === d.id));
      childMerchants = Array.from(new Map(distMerchants.map(m => [m.id, m])).values());

      directSDs.forEach(sd => allRelevantIds.add(sd.id));
      childDDs.forEach(dd => allRelevantIds.add(dd.id));
      childDists.forEach(d => allRelevantIds.add(d.id));
      childMerchants.forEach(m => allRelevantIds.add(m.id));
    } else if (type === 'SUPER_DISTRIBUTOR') {
      childDDs = user.district_distributors || districtDistributorsList.filter(dd => dd.creator_id === user.id || dd.parent_id === user.id);
      const directDists = user.distributors || distributorsList.filter(d => d.creator_id === user.id || d.parent_id === user.id);
      const ddDists = childDDs.flatMap(dd => dd.distributors || distributorsList.filter(d => d.creator_id === dd.id || d.parent_id === dd.id));
      const combinedDists = [...directDists, ...ddDists];
      childDists = Array.from(new Map(combinedDists.map(d => [d.id, d])).values());

      const directMerchants = user.direct_merchants || merchantsList.filter(m => m.creator_id === user.id);
      const distMerchants = childDists.flatMap(d => d.merchants || merchantsList.filter(m => m.creator_id === d.id || m.parent_id === d.id));
      const combinedMerchants = [...directMerchants, ...distMerchants];
      childMerchants = Array.from(new Map(combinedMerchants.map(m => [m.id, m])).values());

      childDDs.forEach(dd => allRelevantIds.add(dd.id));
      childDists.forEach(d => allRelevantIds.add(d.id));
      childMerchants.forEach(m => allRelevantIds.add(m.id));
    } else if (type === 'DISTRICT_DISTRIBUTOR') {
      const dists = user.distributors || distributorsList.filter(d => d.creator_id === user.id || d.parent_id === user.id);
      childDists = Array.from(new Map(dists.map(d => [d.id, d])).values());
      const distMerchants = childDists.flatMap(d => d.merchants || merchantsList.filter(m => m.creator_id === d.id || m.parent_id === d.id));
      childMerchants = Array.from(new Map(distMerchants.map(m => [m.id, m])).values());

      childDists.forEach(d => allRelevantIds.add(d.id));
      childMerchants.forEach(m => allRelevantIds.add(m.id));
    } else if (type === 'DISTRIBUTOR') {
      const merchants = user.merchants || merchantsList.filter(m => m.creator_id === user.id || m.parent_id === user.id);
      childMerchants = Array.from(new Map(merchants.map(m => [m.id, m])).values());

      childMerchants.forEach(m => allRelevantIds.add(m.id));
    }

    // Filter transactions: User transactions or transactions of any downline merchant
    const userTxns = transactionsLedger.filter(t => 
      allRelevantIds.has(t.merchant_id) || 
      allRelevantIds.has(t.mid) || 
      allRelevantIds.has(t.user_id) ||
      (user.name && t.merchant_name?.toLowerCase() === user.name?.toLowerCase())
    );

    let totalVol = 0;
    let profitEarned = 0;
    let downlineCount = 0;

    if (type === 'MASTER') {
      totalVol = parseFloat(user.network_volume || user.total_sales || 0);
      if (totalVol === 0 && childMerchants.length > 0) {
        totalVol = childMerchants.reduce((sum, m) => sum + parseFloat(m.total_sales || 0), 0);
      }
      profitEarned = totalVol * 0.0020;
      downlineCount = childSDs.length + childDDs.length + childDists.length + childMerchants.length;
    } else if (type === 'SUPER_DISTRIBUTOR') {
      totalVol = parseFloat(user.network_volume || user.total_sales || 0);
      if (totalVol === 0 && childMerchants.length > 0) {
        totalVol = childMerchants.reduce((sum, m) => sum + parseFloat(m.total_sales || 0), 0);
      }
      profitEarned = totalVol * 0.0015;
      downlineCount = childDDs.length + childDists.length + childMerchants.length;
    } else if (type === 'DISTRICT_DISTRIBUTOR') {
      totalVol = parseFloat(user.downline_volume || user.total_sales || 0);
      if (totalVol === 0 && childMerchants.length > 0) {
        totalVol = childMerchants.reduce((sum, m) => sum + parseFloat(m.total_sales || 0), 0);
      }
      profitEarned = totalVol * 0.0008;
      downlineCount = childDists.length + childMerchants.length;
    } else if (type === 'DISTRIBUTOR') {
      totalVol = parseFloat(user.downline_volume || user.total_sales || 0);
      if (totalVol === 0 && childMerchants.length > 0) {
        totalVol = childMerchants.reduce((sum, m) => sum + parseFloat(m.total_sales || 0), 0);
      }
      profitEarned = totalVol * 0.0025;
      downlineCount = childMerchants.length;
    } else {
      totalVol = parseFloat(user.total_sales || 0);
      if (totalVol === 0 && userTxns.length > 0) {
        totalVol = userTxns.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
      }
      const isPine = (user.pos_provider || '').includes('Pine');
      const isInstant = (user.pos_settlement || '').includes('INSTANT');
      const rate = isPine ? (isInstant ? 0.0025 : 0.0015) : 0.0005;
      profitEarned = totalVol * rate;
      downlineCount = 1;
    }

    setViewingUserDossier({
      ...user,
      dossierType: type,
      totalVol,
      profitEarned,
      downlineCount,
      uplineChain,
      super_distributors: childSDs,
      district_distributors: childDDs,
      distributors: childDists,
      merchants: childMerchants,
      transactions: userTxns
    });
    window.scrollTo(0, 0);
  };

  // Filtered Lists Based on Active Search Query
  const filteredMasters = useMemo(() => {
    return masterDistributorsList.filter(m => 
      !searchQuery ||
      m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.mobile?.includes(searchQuery)
    );
  }, [masterDistributorsList, searchQuery]);

  const filteredSDs = useMemo(() => {
    return superDistributorsList.filter(sd => 
      !searchQuery ||
      sd.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sd.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sd.mobile?.includes(searchQuery)
    );
  }, [superDistributorsList, searchQuery]);

  const filteredDDs = useMemo(() => {
    return districtDistributorsList.filter(dd => 
      !searchQuery ||
      dd.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dd.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dd.mobile?.includes(searchQuery) ||
      dd.parent_sd_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [districtDistributorsList, searchQuery]);

  const filteredDists = useMemo(() => {
    return distributorsList.filter(d => 
      !searchQuery ||
      d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.mobile?.includes(searchQuery) ||
      d.parent_sd_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [distributorsList, searchQuery]);

  const filteredMerchants = useMemo(() => {
    return merchantsList.filter(m => 
      !searchQuery ||
      m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.mobile?.includes(searchQuery) ||
      m.pos_vendor?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.pos_provider?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [merchantsList, searchQuery]);

  // Inquiries Subsets (Loans & Franchises)
  const loansList = useMemo(() => {
    return inquiriesList.filter(inq => inq.type === 'LOAN');
  }, [inquiriesList]);

  const franchisesList = useMemo(() => {
    return inquiriesList.filter(inq => inq.type === 'FRANCHISE');
  }, [inquiriesList]);

  const pendingLoansCount = useMemo(() => {
    return loansList.filter(l => l.status === 'New' || l.status === 'Under Review').length;
  }, [loansList]);

  const pendingFranchisesCount = useMemo(() => {
    return franchisesList.filter(f => f.status === 'New' || f.status === 'Under Review').length;
  }, [franchisesList]);

  const displayedLoans = useMemo(() => {
    return loansList.filter(l => {
      const matchSearch = !searchQuery || 
        l.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        l.phone?.includes(searchQuery) ||
        l.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.category?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = inquiryStatusFilter === 'ALL' || l.status === inquiryStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [loansList, searchQuery, inquiryStatusFilter]);

  const displayedFranchises = useMemo(() => {
    return franchisesList.filter(f => {
      const matchSearch = !searchQuery || 
        f.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        f.phone?.includes(searchQuery) ||
        f.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.category?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = inquiryStatusFilter === 'ALL' || f.status === inquiryStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [franchisesList, searchQuery, inquiryStatusFilter]);

  // Date Range Filter Engine
  const filteredData = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const startOfWeek = now.getTime() - 7 * 86400000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let txns = transactionsLedger || [];
    let allVol = 0;
    let allProfit = 0;

    const getTxnCompanyFee = (t) => {
      let compFee = parseFloat(t.company_fee);
      if (isNaN(compFee) || compFee <= 0) {
        if (t.notes && typeof t.notes === 'string' && t.notes.includes('company_fee')) {
          try {
            const jsonPart = t.notes.slice(t.notes.indexOf('{'));
            const parsed = JSON.parse(jsonPart);
            if (parsed.company_fee) compFee = parseFloat(parsed.company_fee);
          } catch (_) {}
        }
      }
      if (isNaN(compFee) || compFee <= 0) {
        const amt = parseFloat(t.amount) || 0;
        compFee = amt * 0.017;
      }
      return compFee;
    };

    txns.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.status === 'APPROVED' || t.status === 'Success') {
        allVol += amt;
        allProfit += getTxnCompanyFee(t);
      }
    });

    let filteredTxns = txns;
    if (dateRangeFilter === 'TODAY') {
      filteredTxns = txns.filter(t => new Date(t.created_at || Date.now()).getTime() >= startOfToday);
    } else if (dateRangeFilter === 'YESTERDAY') {
      filteredTxns = txns.filter(t => {
        const time = new Date(t.created_at || Date.now()).getTime();
        return time >= startOfYesterday && time < startOfToday;
      });
    } else if (dateRangeFilter === 'WEEK') {
      filteredTxns = txns.filter(t => new Date(t.created_at || Date.now()).getTime() >= startOfWeek);
    } else if (dateRangeFilter === 'MONTH') {
      filteredTxns = txns.filter(t => new Date(t.created_at || Date.now()).getTime() >= startOfMonth);
    }

    let volume = 0;
    let adminProfit = 0;
    filteredTxns.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (t.status === 'APPROVED' || t.status === 'Success') {
        volume += amt;
        adminProfit += getTxnCompanyFee(t);
      }
    });

    return {
      transactions: filteredTxns,
      volume,
      adminProfit,
      allVolume: allVol,
      allAdminProfit: allProfit,
      count: filteredTxns.length
    };
  }, [transactionsLedger, dateRangeFilter]);

  // Combined Totals for Metrics (Dynamically respecting Date Filter)
  const displayVolume = dateRangeFilter === 'ALL'
    ? parseFloat(metrics.totalVolume || filteredData.allVolume || 0)
    : filteredData.volume;
  const displayAdminProfit = dateRangeFilter === 'ALL'
    ? parseFloat(metrics.adminNetProfit || filteredData.allAdminProfit || 0)
    : filteredData.adminProfit;

  const totalVolumeDisplay = displayVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const adminProfitDisplay = displayAdminProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 });

  // Dedicated Calculation Engine for Today's Profit & Commission Distribution Hub
  const profitDistributionData = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;

    // User lookup map
    const userMap = {};
    (networkUsers || []).forEach(u => { if (u?.id) userMap[u.id] = u; });

    // Filter transactions (Approved / Success only)
    let txns = (transactionsLedger || []).filter(t => t.status === 'APPROVED' || t.status === 'Success');

    if (profitDateFilter === 'TODAY') {
      txns = txns.filter(t => new Date(t.created_at || Date.now()).getTime() >= startOfToday);
    } else if (profitDateFilter === 'YESTERDAY') {
      txns = txns.filter(t => {
        const time = new Date(t.created_at || Date.now()).getTime();
        return time >= startOfYesterday && time < startOfToday;
      });
    } else if (profitDateFilter === 'WEEK') {
      txns = txns.filter(t => new Date(t.created_at || Date.now()).getTime() >= (now.getTime() - 7 * 86400000));
    } else if (profitDateFilter === 'MONTH') {
      txns = txns.filter(t => new Date(t.created_at || Date.now()).getTime() >= new Date(now.getFullYear(), now.getMonth(), 1).getTime());
    } else if (profitDateFilter === 'CUSTOM' && customStartDate) {
      const start = new Date(customStartDate + 'T00:00:00').getTime();
      const end = customEndDate ? new Date(customEndDate + 'T23:59:59').getTime() : Date.now();
      txns = txns.filter(t => {
        const time = new Date(t.created_at || Date.now()).getTime();
        return time >= start && time <= end;
      });
    }

    let companyNet = 0;
    let masterTotal = 0;
    let superTotal = 0;
    let districtTotal = 0;
    let distributorTotal = 0;
    let merchantTotal = 0;

    const breakdowns = {
      COMPANY: [],
      MASTER: [],
      SUPER: [],
      DISTRICT: [],
      DISTRIBUTOR: [],
      MERCHANT: []
    };

    txns.forEach(t => {
      const amt = parseFloat(t.amount) || 0;
      if (amt <= 0) return;

      const merchant = userMap[t.merchant_id] || { id: t.merchant_id, name: t.merchant_name || t.merchant_id || 'Merchant' };
      
      let companyFee = parseFloat(t.company_fee);
      let merchantComm = parseFloat(t.merchant_commission);

      if (isNaN(companyFee) || companyFee <= 0) {
        companyFee = amt * 0.017;
      }
      if (isNaN(merchantComm)) {
        merchantComm = Math.max(0, (amt * 0.02) - companyFee);
      }

      // 1. Merchant Earnings
      merchantTotal += merchantComm;
      breakdowns.MERCHANT.push({
        partner_id: merchant.id,
        partner_name: merchant.name,
        merchant_id: merchant.id,
        merchant_name: merchant.name,
        txn_id: t.id,
        amount: amt,
        provider: t.pos_provider || t.provider || 'POS',
        commission_rate: amt > 0 ? `${((merchantComm / amt) * 100).toFixed(2)}%` : '0.30%',
        commission_amount: merchantComm,
        created_at: t.created_at || new Date().toISOString(),
        role: 'MERCHANT'
      });

      // 2. Trace Uplines for this merchant
      let curr = merchant;
      const uplines = [];
      const visited = new Set();
      while (curr && curr.creator_id && curr.creator_id !== 'ADM001' && !visited.has(curr.creator_id)) {
        visited.add(curr.creator_id);
        const parent = userMap[curr.creator_id];
        if (!parent) break;
        uplines.unshift(parent);
        curr = parent;
      }

      const masterUser = uplines.find(u => u.role === 'MASTER' || u.role === 'MASTER_DISTRIBUTOR' || (u.id && u.id.startsWith('MST')));
      const superUser = uplines.find(u => u.role === 'SUPER_DISTRIBUTOR' || (u.id && u.id.startsWith('SD')));
      const districtUser = uplines.find(u => u.role === 'DISTRICT_DISTRIBUTOR' || u.role === 'DIST_FRANCHISE' || (u.id && (u.id.startsWith('DD') || u.id.startsWith('DF'))));
      const distUser = uplines.find(u => u.role === 'DISTRIBUTOR');

      let paidUplines = 0;

      // Master Distributor Cut (0.05%)
      if (masterUser) {
        const cut = (amt * 0.05) / 100;
        masterTotal += cut;
        paidUplines += cut;
        breakdowns.MASTER.push({
          partner_id: masterUser.id,
          partner_name: masterUser.name,
          merchant_id: merchant.id,
          merchant_name: merchant.name,
          txn_id: t.id,
          amount: amt,
          provider: t.pos_provider || t.provider || 'POS',
          commission_rate: '0.05% override',
          commission_amount: cut,
          created_at: t.created_at || new Date().toISOString(),
          role: 'MASTER_DISTRIBUTOR'
        });
      }

      // Super Distributor Cut (0.10%)
      if (superUser) {
        const cut = (amt * 0.10) / 100;
        superTotal += cut;
        paidUplines += cut;
        breakdowns.SUPER.push({
          partner_id: superUser.id,
          partner_name: superUser.name,
          merchant_id: merchant.id,
          merchant_name: merchant.name,
          txn_id: t.id,
          amount: amt,
          provider: t.pos_provider || t.provider || 'POS',
          commission_rate: '0.10% override',
          commission_amount: cut,
          created_at: t.created_at || new Date().toISOString(),
          role: 'SUPER_DISTRIBUTOR'
        });
      }

      // District Distributor Cut (0.10%)
      if (districtUser) {
        const cut = (amt * 0.10) / 100;
        districtTotal += cut;
        paidUplines += cut;
        breakdowns.DISTRICT.push({
          partner_id: districtUser.id,
          partner_name: districtUser.name,
          merchant_id: merchant.id,
          merchant_name: merchant.name,
          txn_id: t.id,
          amount: amt,
          provider: t.pos_provider || t.provider || 'POS',
          commission_rate: '0.10% override',
          commission_amount: cut,
          created_at: t.created_at || new Date().toISOString(),
          role: 'DISTRICT_DISTRIBUTOR'
        });
      }

      // Distributor Cut (0.10%)
      if (distUser) {
        const cut = (amt * 0.10) / 100;
        distributorTotal += cut;
        paidUplines += cut;
        breakdowns.DISTRIBUTOR.push({
          partner_id: distUser.id,
          partner_name: distUser.name,
          merchant_id: merchant.id,
          merchant_name: merchant.name,
          txn_id: t.id,
          amount: amt,
          provider: t.pos_provider || t.provider || 'POS',
          commission_rate: '0.10% override',
          commission_amount: cut,
          created_at: t.created_at || new Date().toISOString(),
          role: 'DISTRIBUTOR'
        });
      }

      // Company Net Margin = companyFee - paidUplines
      const companyEarned = Math.max(0, companyFee - paidUplines);
      companyNet += companyEarned;
      breakdowns.COMPANY.push({
        partner_id: 'ADM001',
        partner_name: 'RONAV Technologies (Company)',
        merchant_id: merchant.id,
        merchant_name: merchant.name,
        txn_id: t.id,
        amount: amt,
        provider: t.pos_provider || t.provider || 'POS',
        commission_rate: amt > 0 ? `${((companyEarned / amt) * 100).toFixed(2)}% net margin` : '1.20% net margin',
        commission_amount: companyEarned,
        created_at: t.created_at || new Date().toISOString(),
        role: 'ADMIN'
      });
    });

    return {
      companyNet,
      masterTotal,
      superTotal,
      districtTotal,
      distributorTotal,
      merchantTotal,
      breakdowns,
      txnsCount: txns.length,
      counts: {
        company: breakdowns.COMPANY.length,
        master: new Set(breakdowns.MASTER.map(b => b.partner_id)).size,
        super: new Set(breakdowns.SUPER.map(b => b.partner_id)).size,
        district: new Set(breakdowns.DISTRICT.map(b => b.partner_id)).size,
        distributor: new Set(breakdowns.DISTRIBUTOR.map(b => b.partner_id)).size,
        merchant: new Set(breakdowns.MERCHANT.map(b => b.partner_id)).size
      }
    };
  }, [networkUsers, transactionsLedger, profitDateFilter, customStartDate, customEndDate]);


  // Inquiry Status Handler
  const handleUpdateInquiry = async (inquiryId, status, remarks = '') => {
    try {
      const res = await updateInquiryStatus(inquiryId, status, remarks);
      if (res && res.success) {
        setInquiriesList(prev => prev.map(inq => inq.id === inquiryId ? { ...inq, status, remarks: remarks || inq.remarks } : inq));
        triggerToast(`✓ Inquiry ${inquiryId} marked as ${status}!`, 'success');
      } else {
        triggerToast(res?.message || 'Failed to update inquiry status', 'error');
      }
    } catch (e) {
      triggerToast('Error updating inquiry status', 'error');
    }
  };

  // Partner Governance Handlers
  const handleToggleUserStatus = async (user, e) => {
    if (e) e.stopPropagation();
    const currentStatus = user.status || 'ACTIVE';
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const confirmMsg = nextStatus === 'SUSPENDED' 
      ? `Are you sure you want to suspend ${user.name} (${user.id})? Their POS terminals & settlement will be frozen.`
      : `Reactivate ${user.name} (${user.id})?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await updateUserStatus(user.id, nextStatus);
      if (res && res.success) {
        setNetworkUsers(prev => prev.map(u => u.id === user.id ? { ...u, status: nextStatus } : u));
        if (viewingUserDossier && viewingUserDossier.id === user.id) {
          setViewingUserDossier(prev => ({ ...prev, status: nextStatus }));
        }
        triggerToast(`✓ ${user.name} is now ${nextStatus}!`, nextStatus === 'ACTIVE' ? 'success' : 'warning');
      } else {
        triggerToast(res?.message || 'Failed to update status', 'error');
      }
    } catch (e) {
      triggerToast('Error updating partner status', 'error');
    }
  };

  const handleOpenEditPartner = (user, e) => {
    if (e) e.stopPropagation();
    setEditingPartner({
      isOpen: true,
      user,
      name: user.name || '',
      mobile: user.mobile || ''
    });
  };

  const handleSavePartnerDetails = async (e) => {
    e.preventDefault();
    if (!editingPartner.name.trim() || !editingPartner.mobile.trim()) {
      triggerToast('Name and Mobile cannot be empty.', 'error');
      return;
    }
    try {
      const res = await updateUserDetails(editingPartner.user.id, {
        name: editingPartner.name,
        mobile: editingPartner.mobile
      });
      if (res && res.success) {
        setNetworkUsers(prev => prev.map(u => u.id === editingPartner.user.id ? { ...u, name: editingPartner.name, mobile: editingPartner.mobile } : u));
        if (viewingUserDossier && viewingUserDossier.id === editingPartner.user.id) {
          setViewingUserDossier(prev => ({ ...prev, name: editingPartner.name, mobile: editingPartner.mobile }));
        }
        setEditingPartner({ isOpen: false, user: null, name: '', mobile: '' });
        triggerToast(`✓ Partner profile updated!`, 'success');
      } else {
        triggerToast(res?.message || 'Failed to update partner details', 'error');
      }
    } catch (e) {
      triggerToast('Error updating partner details', 'error');
    }
  };

  const handleOpenResetPassword = (user, e) => {
    if (e) e.stopPropagation();
    const suggested = `Ronav@${(user?.id || '').slice(-4) || '2025'}`;
    setResetPassModal({
      isOpen: true,
      user,
      newPassword: suggested,
      isSubmitting: false,
      successResult: null
    });
  };

  const handleConfirmResetPassword = async (e) => {
    if (e) e.preventDefault();
    if (!resetPassModal.user || !resetPassModal.newPassword.trim()) {
      triggerToast('Please enter a valid password.', 'error');
      return;
    }
    setResetPassModal(prev => ({ ...prev, isSubmitting: true }));
    try {
      const res = await adminResetUserPassword(resetPassModal.user.id, resetPassModal.newPassword.trim());
      if (res && res.success) {
        triggerToast(`✓ Password for ${resetPassModal.user.name} successfully reset!`, 'success');
        setResetPassModal(prev => ({
          ...prev,
          isSubmitting: false,
          successResult: {
            id: resetPassModal.user.id,
            name: resetPassModal.user.name,
            mobile: resetPassModal.user.mobile,
            password: resetPassModal.newPassword.trim()
          }
        }));
      } else {
        triggerToast(res?.message || 'Failed to reset password', 'error');
        setResetPassModal(prev => ({ ...prev, isSubmitting: false }));
      }
    } catch (e) {
      triggerToast('Error updating password', 'error');
      setResetPassModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };


  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 relative" style={{ width: '100%', overflowX: 'hidden' }}>
      
      {/* 1. Global Toast Notification Surface */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          left: '16px',
          maxWidth: '420px',
          margin: '0 auto',
          zIndex: 9999,
          backgroundColor: toast.type === 'success' ? '#059669' : toast.type === 'error' ? '#DC2626' : '#0F52BA',
          padding: '0.75rem 1rem',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          color: '#FFFFFF',
          animation: 'slideIn 0.25s ease-out'
        }}>
          <CheckCircle2 style={{ width: '18px', height: '18px', color: '#FFF', flexShrink: 0 }} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>{toast.msg}</span>
        </div>
      )}

      {/* OFFICIAL EXECUTIVE HEADER */}
      <header className="admin-header">
          <div className="admin-header-inner">
            {/* Left: Brand Logo ONLY on Overview; Clean Back Button on remaining sub-pages */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {activeTab === 'overview' ? (
                <div 
                  onClick={() => handleTabSwitch('overview')}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <RonavLogo height="40px" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleTabSwitch('overview')}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    color: '#0F172A',
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '0.78125rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                  }}
                  title="Back to Overview"
                >
                  <ArrowLeft style={{ width: '14px', height: '14px' }} />
                  <span>Back</span>
                </button>
              )}
            </div>

            {/* Dedicated Desktop Header Navigation Bar (Visible only on Desktop >= 1024px) */}
            <nav className="admin-desktop-header-nav" aria-label="Admin Desktop Navigation">
              {[
                { id: 'overview', label: 'Overview', icon: Activity },
                { id: 'profits', label: 'Profits', icon: TrendingUp },
                { id: 'master_distributors', label: 'Master', icon: Crown },
                { id: 'super_distributors', label: 'Super Dist', icon: Zap },
                { id: 'district_distributors', label: 'District Dist', icon: Shield },
                { id: 'distributors', label: 'Distributor', icon: GitFork },
                { id: 'merchants', label: 'Merchants', icon: Store },
                { id: 'rentals', label: 'POS Rentals', icon: CreditCard },
                { id: 'payouts', label: 'Payouts', icon: Landmark, badge: channelPendingCounts.total > 0 ? channelPendingCounts.total : null },
                { id: 'loans', label: 'Loans', icon: FileText },
                { id: 'franchises', label: 'Franchise', icon: Building2 }
              ].map(tabItem => {
                const isTabActive = activeTab === tabItem.id;
                const IconComponent = tabItem.icon;
                return (
                  <button
                    key={tabItem.id}
                    type="button"
                    onClick={() => handleTabSwitch(tabItem.id)}
                    className={`admin-desktop-tab-btn ${isTabActive ? 'is-active' : ''}`}
                  >
                    <IconComponent style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                    <span>{tabItem.label}</span>
                    {tabItem.badge && (
                      <span className="admin-desktop-tab-badge">
                        {tabItem.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right Side: Quick Onboard CTA (Desktop) + Single Account Icon Menu */}
            <div ref={accountMenuRef} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0, position: 'relative' }}>
              <button
                type="button"
                onClick={() => handleOpenCreateModal('MERCHANT', 'ADM001')}
                className="admin-desktop-onboard-btn"
                title="Onboard New Partner / Shop"
              >
                <PlusCircle style={{ width: '13px', height: '13px' }} />
                <span>+ Onboard Partner</span>
              </button>

              {/* Single Account Icon Button for Super Admin */}
              <button
                type="button"
                onClick={() => setShowAccountMenu(prev => !prev)}
                aria-label="Super Admin Account Menu"
                title="Super Admin Profile & Logout"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: showAccountMenu ? '#0F52BA' : '#EFF6FF',
                  border: showAccountMenu ? '2px solid #0F52BA' : '1.5px solid #BFDBFE',
                  color: showAccountMenu ? '#FFFFFF' : '#0F52BA',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  padding: 0,
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 3px rgba(15,82,186,0.12)'
                }}
              >
                <User style={{ width: '19px', height: '19px' }} />
                <span style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#10B981',
                  border: '1.5px solid #FFFFFF'
                }} />
              </button>

              {/* Account Dropdown Popover */}
              {showAccountMenu && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: '240px',
                  background: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #CBD5E1',
                  boxShadow: '0 12px 30px -5px rgba(15,23,42,0.18), 0 4px 10px -2px rgba(15,23,42,0.08)',
                  zIndex: 100,
                  overflow: 'hidden',
                  animation: 'slideIn 0.15s ease-out'
                }}>
                  {/* Account Header */}
                  <div style={{
                    padding: '0.875rem 1rem',
                    background: '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      background: '#EFF6FF',
                      border: '1.5px solid #BFDBFE',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0F52BA',
                      flexShrink: 0
                    }}>
                      <ShieldCheck style={{ width: '20px', height: '20px' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <strong style={{ fontSize: '0.875rem', color: '#0A192F', fontWeight: 900 }}>Super Admin</strong>
                        <span style={{ fontSize: '0.5625rem', background: '#DCFCE7', color: '#15803D', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>ACTIVE</span>
                      </div>
                      <span style={{ fontSize: '0.6875rem', color: '#64748B', display: 'block', marginTop: '1px' }}>
                        ADM001 • Apex Root
                      </span>
                    </div>
                  </div>

                  {/* Account Body & Logout */}
                  <div style={{ padding: '0.625rem' }}>
                    <div style={{
                      padding: '0.45rem 0.65rem',
                      fontSize: '0.6875rem',
                      color: '#64748B',
                      background: '#F1F5F9',
                      borderRadius: '6px',
                      marginBottom: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span>Access Role</span>
                      <strong style={{ color: '#0F52BA' }}>System Master</strong>
                    </div>

                    {onLogout && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowAccountMenu(false);
                          onLogout();
                        }}
                        style={{
                          width: '100%',
                          padding: '0.6rem 0.75rem',
                          borderRadius: '8px',
                          background: '#FEF2F2',
                          border: '1px solid #FECACA',
                          color: '#DC2626',
                          fontSize: '0.78125rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <LogOut style={{ width: '14px', height: '14px' }} />
                        <span>Logout Super Admin</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

      {/* TOP CHANNEL TABS: ONLY ON PAYOUTS TAB */}
      {activeTab === 'payouts' && (
        <div className="admin-channel-bar-wrapper">
          <div className="admin-channel-bar-inner">
            {/* iOS Native Segmented Track */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              background: '#ECEEF0',
              padding: '3px',
              borderRadius: '11px',
              gap: '3px'
            }}>
            {[
              { id: 'all', label: 'All Channels', icon: '🌐', count: channelPendingCounts.total },
              { id: 'pinelabs', label: 'Pine Labs', icon: '🌲', count: channelPendingCounts.pine },
              { id: 'payswiff', label: 'Payswiff', icon: '⚡', count: channelPendingCounts.swiffTotal },
              { id: 'qr', label: 'QR', icon: '📱', count: channelPendingCounts.qr }
            ].map(ch => {
              const isActive = selectedChannel === ch.id;
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    setSelectedChannel(ch.id);
                    if (ch.id === 'payswiff') {
                      if (channelPendingCounts.swiffRp > 0 && channelPendingCounts.swiffRonav === 0) {
                        setSelectedPayswiffVendor('rp');
                      } else if (channelPendingCounts.swiffRonav > 0 && channelPendingCounts.swiffRp === 0) {
                        setSelectedPayswiffVendor('ronav');
                      } else if (!selectedPayswiffVendor || selectedPayswiffVendor === 'ALL') {
                        setSelectedPayswiffVendor('ronav');
                      }
                    }
                  }}
                  style={{
                    background: isActive ? '#FFFFFF' : 'transparent',
                    color: isActive ? '#0F172A' : '#64748B',
                    border: 'none',
                    borderRadius: '9px',
                    padding: '0.45rem 0.35rem',
                    fontSize: '0.78125rem',
                    fontWeight: isActive ? 700 : 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)' : 'none',
                    transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <span>{ch.icon}</span>
                    <span>{ch.label}</span>
                  </span>
                  <span style={{
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    padding: '1px 5px',
                    borderRadius: '999px',
                    background: ch.count > 0 
                      ? (isActive ? '#DC2626' : '#FEE2E2') 
                      : (isActive ? '#F1F5F9' : '#E2E8F0'),
                    color: ch.count > 0 
                      ? (isActive ? '#FFFFFF' : '#DC2626') 
                      : '#64748B',
                    lineHeight: '1.2',
                    minWidth: '18px',
                    textAlign: 'center',
                    flexShrink: 0,
                    boxShadow: ch.count > 0 && isActive ? '0 1px 2px rgba(220,38,38,0.25)' : 'none'
                  }}>
                    {ch.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* SUB-VENDOR BAR: ONLY WHEN PAYSWIFF IS ACTIVE (JUST 2 OPTIONS: RONAV TECH & RP TECH) */}
          {selectedChannel === 'payswiff' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              background: '#ECEEF0',
              padding: '3px',
              borderRadius: '9px',
              gap: '3px',
              marginTop: '0.4rem'
            }}>
              {[
                { id: 'ronav', label: 'Ronav Tech', count: channelPendingCounts.swiffRonav },
                { id: 'rp', label: 'RP Tech', count: channelPendingCounts.swiffRp }
              ].map(v => {
                const isSubActive = selectedPayswiffVendor === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedPayswiffVendor(v.id)}
                    style={{
                      background: isSubActive ? '#FFFFFF' : 'transparent',
                      color: isSubActive ? '#0F172A' : '#64748B',
                      border: 'none',
                      borderRadius: '7px',
                      padding: '0.35rem 0.5rem',
                      fontSize: '0.75rem',
                      fontWeight: isSubActive ? 700 : 500,
                      cursor: 'pointer',
                      boxShadow: isSubActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>{v.label}</span>
                    <span style={{
                      fontSize: '0.65625rem',
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: '999px',
                      background: v.count > 0 
                        ? (isSubActive ? '#D97706' : '#FEF3C7') 
                        : (isSubActive ? '#F1F5F9' : '#E2E8F0'),
                      color: v.count > 0 
                        ? (isSubActive ? '#FFFFFF' : '#B45309') 
                        : '#64748B',
                      lineHeight: '1.2',
                      minWidth: '16px',
                      textAlign: 'center',
                      boxShadow: v.count > 0 && isSubActive ? '0 1px 2px rgba(217,119,6,0.25)' : 'none'
                    }}>
                      {v.count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* QR CODE MANAGEMENT BAR: CLEAN SINGLE ROW TOOLBAR */}
          {selectedChannel === 'qr' && (
            <div style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              padding: '0.35rem 0.65rem',
              marginTop: '0.35rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              whiteSpace: 'nowrap',
              overflowX: 'auto',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}>
              {/* Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <span style={{ fontSize: '0.8125rem' }}>📱</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>Company QR:</span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <label style={{
                  background: '#0F52BA',
                  color: '#FFFFFF',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  boxShadow: '0 1px 2px rgba(15,82,186,0.2)'
                }}>
                  <span>⬆ Upload</span>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleAdminQrUpload}
                  />
                </label>

                {companyQrImage && (
                  <button
                    type="button"
                    onClick={() => setShowAdminQrPreview(true)}
                    style={{
                      background: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      color: '#0F52BA',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    👁 View
                  </button>
                )}
              </div>

              {/* Subtle Divider */}
              <div style={{ width: '1px', height: '18px', background: '#CBD5E1', flexShrink: 0 }} />

              {/* Inline Payee Field */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, minWidth: '200px' }}>
                <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 700, flexShrink: 0 }}>
                  Payee:
                </span>
                <input
                  type="text"
                  placeholder="RONAV TECHNOLOGIES"
                  value={companyQrPayeeName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCompanyQrPayeeName(val);
                    savePlatformQrConfig({ image: companyQrImage, name: val });
                  }}
                  style={{
                    width: '100%',
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: '#0F172A',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* 4. Main Executive Workspace */}
      <main className="admin-main-container">
        
        {/* If Admin is viewing a specific Person Dossier */}
        {viewingUserDossier ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Back Navigation Action */}
            <button
              onClick={handleBackDossier}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                padding: '0.5rem 0.875rem',
                borderRadius: '8px',
                color: '#0F172A',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                width: 'fit-content'
              }}
            >
              <ArrowLeft style={{ width: '14px', height: '14px' }} />
              <span>Back to {dossierHistory.length > 0 
                ? (dossierHistory[dossierHistory.length - 1].name || dossierHistory[dossierHistory.length - 1].dossierType.replace('_', ' ')) 
                : `${viewingUserDossier.dossierType.replace('_', ' ')} List`}
              </span>
            </button>

            {/* Person Dossier Header Card */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
                      {viewingUserDossier.name}
                    </h2>
                    <span style={{ 
                      fontSize: '0.625rem', 
                      fontWeight: 800, 
                      padding: '2px 8px', 
                      borderRadius: '4px',
                      background: viewingUserDossier.dossierType === 'MASTER' ? '#FAF5FF' : viewingUserDossier.dossierType === 'SUPER_DISTRIBUTOR' ? '#F3E8FF' : viewingUserDossier.dossierType === 'DISTRIBUTOR' ? '#EFF6FF' : '#ECFDF5',
                      color: viewingUserDossier.dossierType === 'MASTER' ? '#7C3AED' : viewingUserDossier.dossierType === 'SUPER_DISTRIBUTOR' ? '#7C3AED' : viewingUserDossier.dossierType === 'DISTRIBUTOR' ? '#0F52BA' : '#059669',
                      border: '1px solid currentColor'
                    }}>
                      {viewingUserDossier.dossierType === 'MASTER' ? '👑 Master Distributor' : viewingUserDossier.dossierType.replace('_', ' ')}
                    </span>
                    <span style={{ 
                      fontSize: '0.625rem', 
                      fontWeight: 800, 
                      padding: '2px 8px', 
                      borderRadius: '4px', 
                      background: viewingUserDossier.status === 'SUSPENDED' ? '#FEF2F2' : '#D1FAE5', 
                      color: viewingUserDossier.status === 'SUSPENDED' ? '#DC2626' : '#059669',
                      border: viewingUserDossier.status === 'SUSPENDED' ? '1px solid #FECACA' : '1px solid #A7F3D0'
                    }}>
                      {viewingUserDossier.status === 'SUSPENDED' ? '⚠️ Suspended' : '✓ Active'}
                    </span>
                  </div>

                  {/* Hierarchy: Super Distributor to Distributor (Click to show full path) */}
                  {(() => {
                    const chain = viewingUserDossier.uplineChain || [];
                    const topSD = chain.find(c => c.role === 'SUPER_DISTRIBUTOR' || c.id.startsWith('SD')) || chain[0];
                    const directParent = chain.length > 0 ? chain[chain.length - 1] : null;

                    return (
                      <div style={{ marginTop: '0.625rem' }}>
                        {!showFullChain ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 800 }}>Hierarchy:</span>
                            {topSD && directParent && topSD.id !== directParent.id ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.6875rem', fontWeight: 800 }}>
                                <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#F3E8FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}>
                                  ⚡ {topSD.name}
                                </span>
                                <span style={{ color: '#94A3B8' }}>➔</span>
                                <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#EFF6FF', color: '#0F52BA', border: '1px solid #BFDBFE' }}>
                                  📦 {directParent.name}
                                </span>
                              </div>
                            ) : directParent ? (
                              <span style={{ fontSize: '0.6875rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: '#EFF6FF', color: '#0F52BA', border: '1px solid #BFDBFE' }}>
                                📦 Parent: {directParent.name} ({directParent.id})
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.6875rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0' }}>
                                Direct to Super Admin
                              </span>
                            )}

                            {chain.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setShowFullChain(true)}
                                style={{
                                  background: '#EFF6FF',
                                  color: '#0F52BA',
                                  border: '1px solid #BFDBFE',
                                  borderRadius: '4px',
                                  padding: '2px 8px',
                                  fontSize: '0.625rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px'
                                }}
                              >
                                <span>▾ View Full Path</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                              <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Full Hierarchy Path</span>
                              <button
                                type="button"
                                onClick={() => setShowFullChain(false)}
                                style={{ background: 'none', border: 'none', color: '#0F52BA', fontSize: '0.625rem', fontWeight: 800, cursor: 'pointer', padding: 0 }}
                              >
                                ▴ Collapse Path
                              </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: '#0F172A', color: '#FFF' }}>
                                👑 Super Admin
                              </span>
                              {chain.map(ancestor => (
                                <React.Fragment key={ancestor.id}>
                                  <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>➔</span>
                                  <button
                                    onClick={() => handleOpenDossier(ancestor, ancestor.role, true)}
                                    style={{
                                      fontSize: '0.625rem',
                                      fontWeight: 800,
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      background: ancestor.role === 'MASTER' ? '#FAF5FF' : ancestor.role === 'SUPER_DISTRIBUTOR' ? '#F3E8FF' : ancestor.role === 'DISTRICT_DISTRIBUTOR' ? '#FEF3C7' : '#EFF6FF',
                                      color: ancestor.role === 'MASTER' ? '#7C3AED' : ancestor.role === 'SUPER_DISTRIBUTOR' ? '#7C3AED' : ancestor.role === 'DISTRICT_DISTRIBUTOR' ? '#B45309' : '#0F52BA',
                                      border: '1px solid currentColor',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '3px'
                                    }}
                                    title={`View ${ancestor.name}`}
                                  >
                                    <span>{ancestor.role === 'MASTER' ? '👑' : ancestor.role === 'SUPER_DISTRIBUTOR' ? '⚡' : ancestor.role === 'DISTRICT_DISTRIBUTOR' ? '🏛️' : '📦'}</span>
                                    <span>{ancestor.name} ({ancestor.id})</span>
                                  </button>
                                </React.Fragment>
                              ))}
                              <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>➔</span>
                              <span style={{
                                fontSize: '0.625rem',
                                fontWeight: 900,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: '#ECFDF5',
                                color: '#059669',
                                border: '1px solid #10B981'
                              }}>
                                {viewingUserDossier.name} ({viewingUserDossier.id}) [Current]
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Hardware & Channel Portfolio for Merchant */}
                  {viewingUserDossier.dossierType === 'MERCHANT' && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      {viewingUserDossier.channels?.pine_labs?.enabled && (
                        <span style={{ fontSize: '0.625rem', fontWeight: 800, background: '#EFF6FF', color: '#0F52BA', padding: '3px 8px', borderRadius: '6px', border: '1px solid #BFDBFE' }}>
                          🌲 Pine Labs: {viewingUserDossier.channels.pine_labs.terminal_id || 'PL-01'} (Rose Navaneetham) • {viewingUserDossier.channels.pine_labs.rate_t1}% T+1 / {viewingUserDossier.channels.pine_labs.rate_instant}% Instant
                        </span>
                      )}
                      {viewingUserDossier.channels?.payswiff?.enabled && (
                        <span style={{ fontSize: '0.625rem', fontWeight: 800, background: '#FFFBEB', color: '#D97706', padding: '3px 8px', borderRadius: '6px', border: '1px solid #FDE68A' }}>
                          ⚡ Payswiff: {viewingUserDossier.channels.payswiff.terminal_id || 'SWIFF-01'} ({viewingUserDossier.channels.payswiff.vendor}) • {viewingUserDossier.channels.payswiff.rate_t1}% T+1 / {viewingUserDossier.channels.payswiff.rate_instant}% Instant
                        </span>
                      )}
                      {viewingUserDossier.channels?.qr?.enabled && (
                        <span style={{ fontSize: '0.625rem', fontWeight: 800, background: '#F5F3FF', color: '#7C3AED', padding: '3px 8px', borderRadius: '6px', border: '1px solid #DDD6FE' }}>
                          📱 QR Active: {viewingUserDossier.channels.qr.rate_instant}% Instant Settlement (RONAV Technologies)
                        </span>
                      )}
                      {(!viewingUserDossier.channels || (!viewingUserDossier.channels.pine_labs?.enabled && !viewingUserDossier.channels.payswiff?.enabled && !viewingUserDossier.channels.qr?.enabled)) && (
                        <span style={{ fontSize: '0.625rem', fontWeight: 800, background: '#F1F5F9', color: '#334155', padding: '3px 8px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                          📟 Machine: {viewingUserDossier.pos_provider || 'Pine Labs'} ({(viewingUserDossier.pos_terminal || 'PL-TS').split('|')[0]})
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenManageChannels(viewingUserDossier)}
                        style={{
                          background: '#0F52BA',
                          color: '#FFFFFF',
                          border: 'none',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          fontSize: '0.65625rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        ⚙️ Manage Terminals & QR
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={(e) => handleOpenEditPartner(viewingUserDossier, e)}
                    style={{ background: '#EFF6FF', color: '#0F52BA', border: '1px solid #BFDBFE', padding: '0.4rem 0.65rem', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Edit Partner Details"
                  >
                    <Edit3 style={{ width: '12px', height: '12px' }} />
                    <span>Edit Profile</span>
                  </button>

                  <button
                    onClick={(e) => handleToggleUserStatus(viewingUserDossier, e)}
                    style={{
                      background: viewingUserDossier.status === 'SUSPENDED' ? '#FEF2F2' : '#FFFBEB',
                      color: viewingUserDossier.status === 'SUSPENDED' ? '#DC2626' : '#B45309',
                      border: viewingUserDossier.status === 'SUSPENDED' ? '1px solid #FECACA' : '1px solid #FDE68A',
                      padding: '0.4rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {viewingUserDossier.status === 'SUSPENDED' ? <UserCheck style={{ width: '12px', height: '12px' }} /> : <UserX style={{ width: '12px', height: '12px' }} />}
                    <span>{viewingUserDossier.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}</span>
                  </button>

                  <button
                    onClick={() => copyToClipboard(`ID: ${viewingUserDossier.id}\nMobile: ${viewingUserDossier.mobile}`, viewingUserDossier.id)}
                    style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '0.4rem 0.65rem', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Copy style={{ width: '12px', height: '12px' }} />
                    <span>{copiedId[viewingUserDossier.id] ? 'Copied!' : 'Copy Info'}</span>
                  </button>

                  <button
                    onClick={(e) => handleOpenResetPassword(viewingUserDossier, e)}
                    style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', padding: '0.4rem 0.65rem', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Reset User Password"
                  >
                    <Key style={{ width: '12px', height: '12px' }} />
                    <span>Reset Password</span>
                  </button>
                </div>
              </div>

              {/* Complete Financial Cards Tailored to Role */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.625rem', marginTop: '1.25rem' }}>
                {viewingUserDossier.dossierType === 'MERCHANT' ? (
                  <>
                    <div style={{ background: '#EFF6FF', padding: '0.75rem', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
                      <span style={{ fontSize: '0.625rem', color: '#0F52BA', fontWeight: 800, textTransform: 'uppercase' }}>Available Wallet</span>
                      <strong style={{ display: 'block', fontSize: '1.0625rem', fontWeight: 900, color: '#0F52BA', marginTop: '2px' }}>
                        ₹{parseFloat(viewingUserDossier.available_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div style={{ background: '#F8FAFC', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <span style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase' }}>Total Sales</span>
                      <strong style={{ display: 'block', fontSize: '1.0625rem', fontWeight: 900, color: '#0A192F', marginTop: '2px' }}>
                        ₹{viewingUserDossier.totalVol.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div style={{ background: '#FFFBEB', padding: '0.75rem', borderRadius: '8px', border: '1px solid #FDE68A' }}>
                      <span style={{ fontSize: '0.625rem', color: '#B45309', fontWeight: 800, textTransform: 'uppercase' }}>Pending Balance</span>
                      <strong style={{ display: 'block', fontSize: '1.0625rem', fontWeight: 900, color: '#D97706', marginTop: '2px' }}>
                        ₹{parseFloat(viewingUserDossier.pending_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div style={{ background: '#F0FDF4', padding: '0.75rem', borderRadius: '8px', border: '1px solid #BBF7D0' }}>
                      <span style={{ fontSize: '0.625rem', color: '#15803D', fontWeight: 800, textTransform: 'uppercase' }}>Withdrawn to Bank</span>
                      <strong style={{ display: 'block', fontSize: '1.0625rem', fontWeight: 900, color: '#16A34A', marginTop: '2px' }}>
                        ₹{parseFloat(viewingUserDossier.withdrawn_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div style={{ background: '#ECFDF5', padding: '0.75rem', borderRadius: '8px', border: '1px solid #A7F3D0' }}>
                      <span style={{ fontSize: '0.625rem', color: '#059669', fontWeight: 800, textTransform: 'uppercase' }}>Admin Profit</span>
                      <strong style={{ display: 'block', fontSize: '1.0625rem', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
                        +₹{viewingUserDossier.profitEarned.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ background: '#F8FAFC', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                      <span style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase' }}>Downline Turnover</span>
                      <strong style={{ display: 'block', fontSize: '1.0625rem', fontWeight: 900, color: '#0A192F', marginTop: '2px' }}>
                        ₹{viewingUserDossier.totalVol.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div style={{ background: '#F5F3FF', padding: '0.75rem', borderRadius: '8px', border: '1px solid #DDD6FE' }}>
                      <span style={{ fontSize: '0.625rem', color: '#6D28D9', fontWeight: 800, textTransform: 'uppercase' }}>Commission Earned</span>
                      <strong style={{ display: 'block', fontSize: '1.0625rem', fontWeight: 900, color: '#7C3AED', marginTop: '2px' }}>
                        +₹{(viewingUserDossier.totalVol * (viewingUserDossier.dossierType === 'SUPER_DISTRIBUTOR' ? 0.0015 : 0.0025)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div style={{ background: '#EFF6FF', padding: '0.75rem', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
                      <span style={{ fontSize: '0.625rem', color: '#0F52BA', fontWeight: 800, textTransform: 'uppercase' }}>Wallet Balance</span>
                      <strong style={{ display: 'block', fontSize: '1.0625rem', fontWeight: 900, color: '#0F52BA', marginTop: '2px' }}>
                        ₹{parseFloat(viewingUserDossier.available_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                    <div style={{ background: '#ECFDF5', padding: '0.75rem', borderRadius: '8px', border: '1px solid #A7F3D0' }}>
                      <span style={{ fontSize: '0.625rem', color: '#059669', fontWeight: 800, textTransform: 'uppercase' }}>Admin Profit</span>
                      <strong style={{ display: 'block', fontSize: '1.0625rem', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
                        +₹{viewingUserDossier.profitEarned.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Merchant Activity: Unified 3-Tab View (Transactions, Withdrawals, Linked Banks) */}
            {viewingUserDossier.dossierType === 'MERCHANT' && (
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                {/* 3 Modern Clean Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', padding: '0.35rem 0.5rem', gap: '0.35rem' }}>
                  {[
                    { id: 'transactions', label: 'Transactions', count: viewingUserDossier.transactions?.length || 0, icon: '💳' },
                    { id: 'withdrawals', label: 'Withdrawals', count: dossierWithdrawals.length, icon: '💸' },
                    { id: 'banks', label: 'Linked Banks', count: dossierBeneficiaries.length, icon: '🏦' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setDossierTab(tab.id)}
                      style={{
                        padding: '0.5rem 0.85rem',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        borderRadius: '6px',
                        border: dossierTab === tab.id ? '1px solid #CBD5E1' : '1px solid transparent',
                        background: dossierTab === tab.id ? '#FFFFFF' : 'transparent',
                        color: dossierTab === tab.id ? '#0F52BA' : '#64748B',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: dossierTab === tab.id ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                      }}
                    >
                      <span>{tab.icon} {tab.label}</span>
                      <span style={{
                        fontSize: '0.625rem',
                        padding: '1px 6px',
                        borderRadius: '10px',
                        background: dossierTab === tab.id ? '#EFF6FF' : '#E2E8F0',
                        color: dossierTab === tab.id ? '#0F52BA' : '#475569'
                      }}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Tab 1: Transactions */}
                {dossierTab === 'transactions' && (
                  <div style={{ padding: '1rem' }}>
                    {(!viewingUserDossier.transactions || viewingUserDossier.transactions.length === 0) ? (
                      <div style={{ padding: '2rem', textAlign: 'center', background: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1', color: '#64748B', fontSize: '0.75rem' }}>
                        No transactions recorded for this merchant yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {viewingUserDossier.transactions.map(t => (
                          <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0A192F' }}>
                                  {t.type === 'POS_SWIPE' ? '💳 Card Swipe' : t.type === 'BBPS_BILL' ? '⚡ Utility Bill' : '📱 Payment'}
                                </span>
                                <span style={{
                                  fontSize: '0.55rem',
                                  fontWeight: 800,
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  background: t.status === 'APPROVED' || t.status === 'Success' ? '#D1FAE5' : '#FEE2E2',
                                  color: t.status === 'APPROVED' || t.status === 'Success' ? '#059669' : '#DC2626'
                                }}>
                                  {t.status}
                                </span>
                              </div>
                              <span style={{ display: 'block', fontSize: '0.625rem', color: '#64748B', marginTop: '2px' }}>
                                TXN: {t.id} • {new Date(t.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <strong style={{ fontSize: '0.875rem', color: '#0A192F', display: 'block' }}>
                                ₹{parseFloat(t.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                              {t.notes && t.notes.includes('company_fee') && (
                                <span style={{ fontSize: '0.625rem', color: '#059669', fontWeight: 700 }}>
                                  Admin Cut: ₹{(() => {
                                    try {
                                      const n = JSON.parse(t.notes.replace('[CARD_SWIPE_ENTRY] ', ''));
                                      return (n.company_fee || 0).toFixed(2);
                                    } catch {
                                      return (parseFloat(t.amount) * 0.0015).toFixed(2);
                                    }
                                  })()}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 2: Withdrawals */}
                {dossierTab === 'withdrawals' && (
                  <div style={{ padding: '1rem' }}>
                    {dossierWithdrawals.length === 0 ? (
                      <div style={{ padding: '2rem', background: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1', fontSize: '0.75rem', color: '#64748B', textAlign: 'center' }}>
                        No withdrawal requests submitted by this merchant yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {dossierWithdrawals.map(w => (
                          <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                              <strong style={{ fontSize: '0.8125rem', color: '#0A192F' }}>
                                ₹{parseFloat(w.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} ➔ {w.bank_name}
                              </strong>
                              <span style={{ display: 'block', fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>
                                A/C: ••••{w.account_number.slice(-4)} • {new Date(w.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {w.admin_remark && (
                                <span style={{ display: 'block', fontSize: '0.625rem', color: '#475569', fontStyle: 'italic', marginTop: '2px' }}>
                                  Remark: "{w.admin_remark}"
                                </span>
                              )}
                            </div>
                            <span style={{
                              fontSize: '0.625rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: w.status === 'APPROVED' ? '#D1FAE5' : w.status === 'PENDING' ? '#FEF3C7' : '#FEE2E2',
                              color: w.status === 'APPROVED' ? '#059669' : w.status === 'PENDING' ? '#B45309' : '#DC2626'
                            }}>
                              {w.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab 3: Bank Accounts */}
                {dossierTab === 'banks' && (
                  <div style={{ padding: '1rem' }}>
                    {dossierBeneficiaries.length === 0 ? (
                      <div style={{ padding: '2rem', background: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1', fontSize: '0.75rem', color: '#64748B', textAlign: 'center' }}>
                        No bank accounts linked yet.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.625rem' }}>
                        {dossierBeneficiaries.map(b => (
                          <div key={b.id} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ fontSize: '0.8125rem', color: '#0A192F' }}>{b.bank_name}</strong>
                              {b.is_primary === 1 && (
                                <span style={{ fontSize: '0.55rem', fontWeight: 800, background: '#D1FAE5', color: '#059669', padding: '1px 6px', borderRadius: '3px' }}>PRIMARY</span>
                              )}
                            </div>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#334155', marginTop: '4px', fontFamily: 'monospace', fontWeight: 700 }}>
                              A/C: ••••{b.account_number.slice(-4)}
                            </span>
                            <span style={{ display: 'block', fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>
                              IFSC: {b.ifsc} • {b.holder_name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Downline Roster for Master Dist: Super Distributors */}
            {viewingUserDossier.dossierType === 'MASTER' && (
              <div style={{ background: '#FFFFFF', border: '1.5px solid #DDD6FE', borderRadius: '12px', padding: '1rem' }}>
                <h3 style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#0A192F', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>👑</span> Downline Super Distributors ({viewingUserDossier.super_distributors?.length || 0})
                </h3>
                {(!viewingUserDossier.super_distributors || viewingUserDossier.super_distributors.length === 0) ? (
                  <div style={{ padding: '1rem', background: '#FAF5FF', borderRadius: '8px', border: '1px dashed #DDD6FE', fontSize: '0.75rem', color: '#64748B', textAlign: 'center' }}>
                    No Super Distributors assigned under this Master Distributor yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {viewingUserDossier.super_distributors.map(sd => (
                      <div key={sd.id} onClick={() => handleOpenDossier(sd, 'SUPER_DISTRIBUTOR', true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#FAF5FF', borderRadius: '8px', border: '1px solid #E9D5FF', cursor: 'pointer' }}>
                        <div>
                          <strong style={{ fontSize: '0.8125rem', color: '#0A192F' }}>⚡ {sd.name}</strong>
                          <span style={{ display: 'block', fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>ID: {sd.id} • {sd.mobile}</span>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#7C3AED' }}>
                            ₹{parseFloat(sd.network_volume || sd.total_sales || 0).toLocaleString('en-IN')}
                          </span>
                          <ChevronRight style={{ width: '14px', height: '14px', color: '#94A3B8' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Downline Roster for Super Dist: District Distributors & Area Distributors & Retail Stores */}
            {viewingUserDossier.dossierType === 'SUPER_DISTRIBUTOR' && (
              <>
                {viewingUserDossier.district_distributors && viewingUserDossier.district_distributors.length > 0 && (
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1rem' }}>
                    <h3 style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#0A192F', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🏛️</span> Downline District Distributors ({viewingUserDossier.district_distributors.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {viewingUserDossier.district_distributors.map(dd => (
                        <div key={dd.id} onClick={() => handleOpenDossier(dd, 'DISTRICT_DISTRIBUTOR', true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', cursor: 'pointer' }}>
                          <div>
                            <strong style={{ fontSize: '0.8125rem', color: '#0A192F' }}>{dd.name}</strong>
                            <span style={{ display: 'block', fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>ID: {dd.id} • {dd.mobile}</span>
                          </div>
                          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#0A192F' }}>
                              ₹{parseFloat(dd.downline_volume || dd.total_sales || 0).toLocaleString('en-IN')}
                            </span>
                            <ChevronRight style={{ width: '14px', height: '14px', color: '#94A3B8' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viewingUserDossier.distributors && viewingUserDossier.distributors.length > 0 && (
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1rem' }}>
                    <h3 style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#0A192F', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📦</span> Downline Area Distributors ({viewingUserDossier.distributors.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {viewingUserDossier.distributors.map(d => (
                        <div key={d.id} onClick={() => handleOpenDossier(d, 'DISTRIBUTOR', true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', cursor: 'pointer' }}>
                          <div>
                            <strong style={{ fontSize: '0.8125rem', color: '#0A192F' }}>{d.name}</strong>
                            <span style={{ display: 'block', fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>ID: {d.id} • {d.mobile}</span>
                          </div>
                          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#0A192F' }}>
                              ₹{parseFloat(d.downline_volume || d.total_sales || 0).toLocaleString('en-IN')}
                            </span>
                            <ChevronRight style={{ width: '14px', height: '14px', color: '#94A3B8' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viewingUserDossier.merchants && viewingUserDossier.merchants.length > 0 && (
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1rem' }}>
                    <h3 style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#0A192F', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🏪</span> Downline Retail Stores / POS Machines ({viewingUserDossier.merchants.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {viewingUserDossier.merchants.map(m => (
                        <div key={m.id} onClick={() => handleOpenDossier(m, 'MERCHANT', true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', cursor: 'pointer' }}>
                          <div>
                            <strong style={{ fontSize: '0.8125rem', color: '#0A192F' }}>{m.name}</strong>
                            <span style={{ display: 'block', fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>
                              MID: {m.id} • {m.mobile} • {m.pos_provider || 'Pine Labs'} ({(m.pos_terminal || 'PL-TS').split('|')[0]})
                            </span>
                          </div>
                          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div>
                              <strong style={{ fontSize: '0.8125rem', color: '#0A192F', display: 'block' }}>
                                ₹{parseFloat(m.total_sales || 0).toLocaleString('en-IN')}
                              </strong>
                              <span style={{ fontSize: '0.625rem', color: '#059669', fontWeight: 800 }}>
                                Bal: ₹{parseFloat(m.available_balance || 0).toFixed(0)}
                              </span>
                            </div>
                            <ChevronRight style={{ width: '14px', height: '14px', color: '#94A3B8' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Downline Roster for District Distributor */}
            {viewingUserDossier.dossierType === 'DISTRICT_DISTRIBUTOR' && (
              <>
                {viewingUserDossier.distributors && viewingUserDossier.distributors.length > 0 && (
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1rem' }}>
                    <h3 style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#0A192F', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📦</span> Downline Area Distributors ({viewingUserDossier.distributors.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {viewingUserDossier.distributors.map(d => (
                        <div key={d.id} onClick={() => handleOpenDossier(d, 'DISTRIBUTOR', true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', cursor: 'pointer' }}>
                          <div>
                            <strong style={{ fontSize: '0.8125rem', color: '#0A192F' }}>{d.name}</strong>
                            <span style={{ display: 'block', fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>ID: {d.id} • {d.mobile}</span>
                          </div>
                          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#0A192F' }}>
                              ₹{parseFloat(d.downline_volume || d.total_sales || 0).toLocaleString('en-IN')}
                            </span>
                            <ChevronRight style={{ width: '14px', height: '14px', color: '#94A3B8' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viewingUserDossier.merchants && viewingUserDossier.merchants.length > 0 && (
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1rem' }}>
                    <h3 style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#0A192F', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>🏪</span> Downline Retail Stores ({viewingUserDossier.merchants.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {viewingUserDossier.merchants.map(m => (
                        <div key={m.id} onClick={() => handleOpenDossier(m, 'MERCHANT', true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', cursor: 'pointer' }}>
                          <div>
                            <strong style={{ fontSize: '0.8125rem', color: '#0A192F' }}>{m.name}</strong>
                            <span style={{ display: 'block', fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>
                              MID: {m.id} • {m.mobile} • {m.pos_provider || 'Pine Labs'} ({(m.pos_terminal || 'PL-TS').split('|')[0]})
                            </span>
                          </div>
                          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div>
                              <strong style={{ fontSize: '0.8125rem', color: '#0A192F', display: 'block' }}>
                                ₹{parseFloat(m.total_sales || 0).toLocaleString('en-IN')}
                              </strong>
                              <span style={{ fontSize: '0.625rem', color: '#059669', fontWeight: 800 }}>
                                Bal: ₹{parseFloat(m.available_balance || 0).toFixed(0)}
                              </span>
                            </div>
                            <ChevronRight style={{ width: '14px', height: '14px', color: '#94A3B8' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Downline Roster for Distributor (Retail Stores) */}
            {viewingUserDossier.dossierType === 'DISTRIBUTOR' && viewingUserDossier.merchants && viewingUserDossier.merchants.length > 0 && (
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1rem' }}>
                <h3 style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#0A192F', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🏪</span> Downline Retail Stores ({viewingUserDossier.merchants.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {viewingUserDossier.merchants.map(m => (
                    <div key={m.id} onClick={() => handleOpenDossier(m, 'MERCHANT', true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', cursor: 'pointer' }}>
                      <div>
                        <strong style={{ fontSize: '0.8125rem', color: '#0A192F' }}>{m.name}</strong>
                        <span style={{ display: 'block', fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>
                          MID: {m.id} • {m.mobile} • {m.pos_provider || 'Pine Labs'} ({(m.pos_terminal || 'PL-TS').split('|')[0]})
                        </span>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div>
                          <strong style={{ fontSize: '0.8125rem', color: '#0A192F', display: 'block' }}>
                            ₹{parseFloat(m.total_sales || 0).toLocaleString('en-IN')}
                          </strong>
                          <span style={{ fontSize: '0.625rem', color: '#059669', fontWeight: 800 }}>
                            Bal: ₹{parseFloat(m.available_balance || 0).toFixed(0)}
                          </span>
                        </div>
                        <ChevronRight style={{ width: '14px', height: '14px', color: '#94A3B8' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Direct Transaction History Log for Non-Merchant Accounts */}
            {viewingUserDossier.dossierType !== 'MERCHANT' && (
              <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
                    Direct Transactions ({viewingUserDossier.transactions?.length || 0})
                  </h3>
                  <span style={{ fontSize: '0.625rem', color: '#059669', fontWeight: 800, background: '#ECFDF5', padding: '2px 8px', borderRadius: '12px', border: '1px solid #A7F3D0' }}>
                    Verified Ledger
                  </span>
                </div>

                {(!viewingUserDossier.transactions || viewingUserDossier.transactions.length === 0) ? (
                  <div style={{ padding: '2rem', textAlign: 'center', background: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1', color: '#64748B', fontSize: '0.75rem' }}>
                    No recorded transactions found for this account yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {viewingUserDossier.transactions.map(t => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0A192F' }}>
                              {t.type === 'POS_SWIPE' ? '💳 Card Swipe' : t.type === 'BBPS_BILL' ? '⚡ Utility Bill' : '📱 Payment'}
                            </span>
                            <span style={{
                              fontSize: '0.55rem',
                              fontWeight: 800,
                              padding: '1px 5px',
                              borderRadius: '3px',
                              background: t.status === 'APPROVED' || t.status === 'Success' ? '#D1FAE5' : '#FEE2E2',
                              color: t.status === 'APPROVED' || t.status === 'Success' ? '#059669' : '#DC2626'
                            }}>
                              {t.status}
                            </span>
                          </div>
                          <span style={{ display: 'block', fontSize: '0.625rem', color: '#64748B', marginTop: '2px' }}>
                            TXN: {t.id} • {new Date(t.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <strong style={{ fontSize: '0.875rem', fontWeight: 900, color: '#059669', display: 'block' }}>
                            ₹{parseFloat(t.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </strong>
                          <span style={{ fontSize: '0.5625rem', color: '#0F52BA', fontWeight: 700 }}>
                            Admin Cut: +₹{(parseFloat(t.amount || 0) * 0.0015).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        ) : (
          /* STANDARD TABBED SECTIONS (Zero Bloat, Zero Clutter) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* TAB VIEW 1: EXECUTIVE COMMAND DASHBOARD */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* 4 Core Financial & Ecosystem KPI Cards */}
                <div className="admin-kpi-grid">
                  
                  {/* Card 1: Total Sales */}
                  <div style={{ background: '#FFFFFF', padding: '1rem', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                        Total Sales
                      </span>
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TrendingUp style={{ width: '15px', height: '15px' }} />
                      </div>
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0A192F', margin: '6px 0 2px' }}>
                      ₹{totalVolumeDisplay}
                    </h3>
                    <span style={{ fontSize: '0.625rem', color: '#059669', fontWeight: 700 }}>
                      All Shops Combined
                    </span>
                  </div>

                  {/* Card 2: Admin Profit -> Opens Dedicated Profits Page */}
                  <div 
                    onClick={() => handleTabSwitch('profits')}
                    style={{ 
                      background: '#ECFDF5', 
                      padding: '1rem', 
                      borderRadius: '12px', 
                      border: '1.5px solid #A7F3D0', 
                      boxShadow: '0 2px 6px rgba(5, 150, 105, 0.08)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#059669'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#A7F3D0'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>Admin Net Profit</span>
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#D1FAE5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <DollarSign style={{ width: '15px', height: '15px' }} />
                      </div>
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#059669', margin: '6px 0 2px' }}>
                      ₹{adminProfitDisplay}
                    </h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.625rem', color: '#047857', fontWeight: 700 }}>Company Earnings</span>
                      <span style={{ fontSize: '0.625rem', color: '#059669', fontWeight: 800 }}>Inspect 6 Tiers →</span>
                    </div>
                  </div>

                  {/* Card 3: Pending Payout Requests */}
                  <div 
                    onClick={() => handleTabSwitch('payouts')}
                    style={{ background: '#FFFFFF', padding: '1rem', borderRadius: '12px', border: channelPendingCounts.total > 0 ? '1.5px solid #F87171' : '1px solid #E2E8F0', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Pending Payouts</span>
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Landmark style={{ width: '15px', height: '15px' }} />
                      </div>
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: channelPendingCounts.total > 0 ? '#DC2626' : '#0A192F', margin: '6px 0 2px' }}>
                      {channelPendingCounts.total}
                    </h3>
                    <span style={{ fontSize: '0.625rem', color: channelPendingCounts.total > 0 ? '#DC2626' : '#059669', fontWeight: 700, display: 'block' }}>
                      {channelPendingCounts.total > 0 
                        ? `⚡ Swiff: ${channelPendingCounts.swiffTotal} • 🌲 Pine: ${channelPendingCounts.pine}` 
                        : 'All Cleared'}
                    </span>
                  </div>

                  {/* Card 4: Hardware POS & Device Plans */}
                  <div 
                    onClick={() => handleTabSwitch('merchants')}
                    style={{ background: '#FFFFFF', padding: '1rem', borderRadius: '12px', border: '1px solid #E2E8F0', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Active Machines</span>
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CreditCard style={{ width: '15px', height: '15px' }} />
                      </div>
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0A192F', margin: '6px 0 2px' }}>
                      {metrics.devicePlanSummary?.rentalCount + metrics.devicePlanSummary?.lifetimeCount || merchantsList.length}
                    </h3>
                    <span style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 700 }}>
                      {metrics.devicePlanSummary?.rentalCount || 0} Rental • {metrics.devicePlanSummary?.lifetimeCount || 0} Lifetime
                    </span>
                  </div>

                  {/* Card 5: Loan Applications Hub */}
                  <div 
                    onClick={() => handleTabSwitch('loans')}
                    style={{ 
                      background: '#FFFFFF', 
                      padding: '1rem', 
                      borderRadius: '12px', 
                      border: pendingLoansCount > 0 ? '1.5px solid #93C5FD' : '1px solid #E2E8F0', 
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Loans</span>
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Receipt style={{ width: '15px', height: '15px' }} />
                      </div>
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F52BA', margin: '6px 0 2px' }}>
                      {loansList.length}
                    </h3>
                    <span style={{ fontSize: '0.625rem', color: '#0F52BA', fontWeight: 700 }}>
                      {pendingLoansCount > 0 ? `${pendingLoansCount} Under Review →` : 'Manage Disbursals →'}
                    </span>
                  </div>

                  {/* Card 6: ATM & CDM Franchise Hub */}
                  <div 
                    onClick={() => handleTabSwitch('franchises')}
                    style={{ 
                      background: '#FFFFFF', 
                      padding: '1rem', 
                      borderRadius: '12px', 
                      border: pendingFranchisesCount > 0 ? '1.5px solid #FCD34D' : '1px solid #E2E8F0', 
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>ATM Franchise</span>
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Building2 style={{ width: '15px', height: '15px' }} />
                      </div>
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#D97706', margin: '6px 0 2px' }}>
                      {franchisesList.length}
                    </h3>
                    <span style={{ fontSize: '0.625rem', color: '#B45309', fontWeight: 700 }}>
                      {pendingFranchisesCount > 0 ? `${pendingFranchisesCount} Pending Setup →` : 'Manage Outlets →'}
                    </span>
                  </div>

                </div>

                {/* 1. NETWORK DIRECTORY (5 TIERS) + QUICK ONBOARD BUTTON */}
                <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
                        Network Hierarchy Directory (5 Tiers)
                      </h3>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748B' }}>
                        {masterDistributorsList.length + superDistributorsList.length + districtDistributorsList.length + distributorsList.length + merchantsList.length} Active Partners in System
                      </span>
                    </div>

                    {/* Prominent Quick Action Button for Admin */}
                    <button
                      onClick={() => setIsCreateModalOpen(true)}
                      style={{
                        background: '#0F52BA',
                        color: '#FFFFFF',
                        border: 'none',
                        padding: '0.45rem 0.875rem',
                        borderRadius: '8px',
                        fontSize: '0.6875rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        boxShadow: '0 2px 6px rgba(15, 82, 186, 0.25)'
                      }}
                    >
                      <PlusCircle style={{ width: '14px', height: '14px' }} />
                      <span>+ Onboard Partner / Shop</span>
                    </button>
                  </div>

                  <div className="admin-network-directory-grid">
                    
                    {/* Tier 0: Master Distributors (Apex Command on Top of All) */}
                    <button 
                      onClick={() => handleTabSwitch('master_distributors')}
                      style={{ 
                        gridColumn: '1 / -1',
                        background: 'linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)', 
                        border: '1.5px solid #DDD6FE', 
                        padding: '0.875rem 1rem', 
                        borderRadius: '10px', 
                        textAlign: 'left', 
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(124, 58, 237, 0.08)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '1.5rem' }}>👑</span>
                          <div>
                            <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 900, color: '#581C87' }}>
                              Master Distributors (Apex Tier)
                            </span>
                            <span style={{ fontSize: '0.6875rem', color: '#7E22CE', fontWeight: 600 }}>
                              State Command & Top-Tier Regional Leaders →
                            </span>
                          </div>
                        </div>
                        <strong style={{ fontSize: '1.375rem', fontWeight: 900, color: '#7C3AED' }}>
                          {masterDistributorsList.length}
                        </strong>
                      </div>
                    </button>

                    {/* Tier 1: Super Distributors */}
                    <button 
                      onClick={() => handleTabSwitch('super_distributors')}
                      style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.875rem', borderRadius: '8px', textAlign: 'left', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '1.25rem' }}>⚡</span>
                        <strong style={{ fontSize: '1.125rem', color: '#7C3AED' }}>{superDistributorsList.length}</strong>
                      </div>
                      <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#0A192F', marginTop: '4px' }}>Super Distributors</span>
                      <span style={{ fontSize: '0.625rem', color: '#64748B' }}>Regional Hubs →</span>
                    </button>

                    {/* Tier 2: District Distributors */}
                    <button 
                      onClick={() => handleTabSwitch('district_distributors')}
                      style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.875rem', borderRadius: '8px', textAlign: 'left', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '1.25rem' }}>🏛️</span>
                        <strong style={{ fontSize: '1.125rem', color: '#D97706' }}>{districtDistributorsList.length}</strong>
                      </div>
                      <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#0A192F', marginTop: '4px' }}>District Distributors</span>
                      <span style={{ fontSize: '0.625rem', color: '#64748B' }}>DIST Franchises →</span>
                    </button>

                    {/* Tier 3: Distributors */}
                    <button 
                      onClick={() => handleTabSwitch('distributors')}
                      style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.875rem', borderRadius: '8px', textAlign: 'left', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '1.25rem' }}>📦</span>
                        <strong style={{ fontSize: '1.125rem', color: '#0F52BA' }}>{distributorsList.length}</strong>
                      </div>
                      <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#0A192F', marginTop: '4px' }}>Distributors</span>
                      <span style={{ fontSize: '0.625rem', color: '#64748B' }}>Area Managers →</span>
                    </button>

                    {/* Tier 4: Retail Merchants */}
                    <button 
                      onClick={() => handleTabSwitch('merchants')}
                      style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.875rem', borderRadius: '8px', textAlign: 'left', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '1.25rem' }}>🏪</span>
                        <strong style={{ fontSize: '1.125rem', color: '#059669' }}>{merchantsList.length}</strong>
                      </div>
                      <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, color: '#0A192F', marginTop: '4px' }}>Retail Merchants</span>
                      <span style={{ fontSize: '0.625rem', color: '#64748B' }}>Stores & POS →</span>
                    </button>

                  </div>
                </div>

                {/* 2. REDESIGNED MERCHANT BANK PAYOUTS: NORMAL SLIM BAR WITH ALERT */}
                <div 
                  onClick={() => handleTabSwitch('payouts')}
                  style={{
                    background: channelPendingCounts.total > 0 ? '#FEF2F2' : '#F0FDF4',
                    border: channelPendingCounts.total > 0 ? '1.5px solid #FCA5A5' : '1px solid #BBF7D0',
                    borderRadius: '10px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow: channelPendingCounts.total > 0 ? '0 2px 8px rgba(220, 38, 38, 0.08)' : 'none',
                    flexWrap: 'wrap',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '7px',
                      background: channelPendingCounts.total > 0 ? '#DC2626' : '#22C55E',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8125rem',
                      fontWeight: 900,
                      flexShrink: 0
                    }}>
                      {channelPendingCounts.total > 0 ? '!' : '✓'}
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.8125rem', color: channelPendingCounts.total > 0 ? '#991B1B' : '#166534', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {channelPendingCounts.total > 0 
                          ? `⚠️ Alert: ${channelPendingCounts.total} Merchant Payout(s) Waiting For Approval`
                          : 'Merchant Bank Payouts: All Cleared'}
                      </strong>
                      {channelPendingCounts.total > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                          {/* Pine Labs Pill */}
                          <span style={{ 
                            fontSize: '0.65625rem', 
                            fontWeight: 700, 
                            background: channelPendingCounts.pine > 0 ? '#FEE2E2' : '#FFFFFF', 
                            color: channelPendingCounts.pine > 0 ? '#991B1B' : '#64748B', 
                            padding: '2px 7px', 
                            borderRadius: '5px',
                            border: channelPendingCounts.pine > 0 ? '1px solid #FECACA' : '1px solid #E2E8F0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <span>🌲 Pine Labs:</span>
                            <strong style={{ color: channelPendingCounts.pine > 0 ? '#DC2626' : '#0F172A' }}>{channelPendingCounts.pine}</strong>
                          </span>

                          {/* Payswiff Pill */}
                          <span style={{ 
                            fontSize: '0.65625rem', 
                            fontWeight: 700, 
                            background: channelPendingCounts.swiffTotal > 0 ? '#FEF3C7' : '#FFFFFF', 
                            color: channelPendingCounts.swiffTotal > 0 ? '#92400E' : '#64748B', 
                            padding: '2px 7px', 
                            borderRadius: '5px',
                            border: channelPendingCounts.swiffTotal > 0 ? '1px solid #FDE68A' : '1px solid #E2E8F0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <span>⚡ Payswiff:</span>
                            <strong style={{ color: channelPendingCounts.swiffTotal > 0 ? '#B45309' : '#0F172A' }}>{channelPendingCounts.swiffTotal}</strong>
                            <span style={{ fontSize: '0.59375rem', opacity: 0.85 }}>
                              (RP Tech: {channelPendingCounts.swiffRp} • Ronav: {channelPendingCounts.swiffRonav})
                            </span>
                          </span>

                          {/* QR Pill */}
                          <span style={{ 
                            fontSize: '0.65625rem', 
                            fontWeight: 700, 
                            background: channelPendingCounts.qr > 0 ? '#F3E8FF' : '#FFFFFF', 
                            color: channelPendingCounts.qr > 0 ? '#6B21A8' : '#64748B', 
                            padding: '2px 7px', 
                            borderRadius: '5px',
                            border: channelPendingCounts.qr > 0 ? '1px solid #E9D5FF' : '1px solid #E2E8F0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <span>📱 QR:</span>
                            <strong style={{ color: channelPendingCounts.qr > 0 ? '#7C3AED' : '#0F172A' }}>{channelPendingCounts.qr}</strong>
                          </span>
                        </div>
                      ) : (
                        <span style={{ display: 'block', fontSize: '0.625rem', color: '#15803D' }}>
                          Zero pending withdrawals • All merchant payouts are up to date
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setActiveTab('payouts');
                      setSelectedChannel('all');
                      setPayoutCategoryFilter('SWIPES');
                      setPayoutStatusFilter('PENDING');
                    }}
                    style={{
                      background: channelPendingCounts.total > 0 ? '#DC2626' : '#FFFFFF',
                      color: channelPendingCounts.total > 0 ? '#FFFFFF' : '#15803D',
                      border: channelPendingCounts.total > 0 ? 'none' : '1px solid #86EFAC',
                      padding: '0.4rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxShadow: channelPendingCounts.total > 0 ? '0 1px 3px rgba(220,38,38,0.25)' : 'none'
                    }}
                  >
                    {channelPendingCounts.total > 0 ? `Review (${channelPendingCounts.total}) →` : 'History →'}
                  </button>
                </div>

                {/* 2.5 PENDING TRANSACTIONS VERIFICATION FEED */}
                {pendingTxns && pendingTxns.length > 0 && (
                  <div style={{ background: '#FFFBEB', borderRadius: '12px', border: '1px solid #FCD34D', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#D97706', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 900 }}>
                          ⚡
                        </div>
                        <div>
                          <h3 style={{ fontSize: '0.875rem', fontWeight: 900, color: '#92400E', margin: 0 }}>
                            Pending Counter Swipes ({pendingTxns.length})
                          </h3>
                          <span style={{ fontSize: '0.6875rem', color: '#B45309' }}>
                            Merchants waiting for verification to credit funds
                          </span>
                        </div>
                      </div>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, background: '#FEF3C7', color: '#B45309', padding: '2px 8px', borderRadius: '4px', border: '1px solid #FDE68A' }}>
                        Action Required
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                      {pendingTxns.map(tx => (
                        <div key={tx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem', background: '#FFFFFF', borderRadius: '10px', border: '1.5px solid #FDE68A', flexWrap: 'wrap', gap: '0.625rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <strong style={{ fontSize: '0.875rem', color: '#0A192F' }}>
                                {tx.merchant_name || tx.merchant_id} ({tx.merchant_id})
                              </strong>
                              <span style={{ 
                                fontSize: '0.625rem', 
                                fontWeight: 800, 
                                background: tx.settlement_type === 'INSTANT' ? '#FEF3C7' : '#EFF6FF', 
                                color: tx.settlement_type === 'INSTANT' ? '#B45309' : '#1D4ED8', 
                                padding: '2px 7px', 
                                borderRadius: '4px',
                                border: tx.settlement_type === 'INSTANT' ? '1px solid #FDE68A' : '1px solid #BFDBFE'
                              }}>
                                {tx.settlement_type === 'INSTANT' ? '⚡ Instant Disbursal' : '📅 T+1 Standard'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '4px', flexWrap: 'wrap', fontSize: '0.6875rem', color: '#475569' }}>
                              <span><strong>Customer:</strong> <span style={{ color: '#0F172A', fontWeight: 700 }}>{tx.customer_name || 'Counter Customer'}</span> {tx.customer_mobile ? `(${tx.customer_mobile})` : ''}</span>
                              <span>•</span>
                              <span><strong>Slip UTR:</strong> <code style={{ color: '#0F52BA', fontWeight: 800, background: '#EFF6FF', padding: '1px 5px', borderRadius: '4px' }}>{tx.rrn_number || tx.ref_number || tx.id}</code></span>
                              <span>•</span>
                              <span><strong>Machine:</strong> {tx.pos_provider || 'Pine Labs'}</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ textAlign: 'right' }}>
                              <strong style={{ fontSize: '1.0625rem', fontWeight: 900, color: '#0A192F', display: 'block' }}>
                                ₹{parseFloat(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                              <span style={{ fontSize: '0.5625rem', color: '#D97706', fontWeight: 800, background: '#FEF3C7', padding: '1px 5px', borderRadius: '4px' }}>
                                Check POS Slip
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.375rem' }}>
                              <button
                                onClick={() => {
                                  setActiveTab('payouts');
                                  setSelectedChannel('all');
                                  setPayoutCategoryFilter('SWIPES');
                                  setPayoutStatusFilter('PENDING');
                                  setExpandedPayoutId(`card_${tx.id}`);
                                }}
                                style={{ background: '#0F52BA', color: '#FFFFFF', border: 'none', padding: '0.45rem 0.85rem', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                                title="Open full transaction inspection dossier on Clearance page"
                              >
                                <span>Inspect Slip & Review →</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. RECENT SWIPES & LIVE TRANSACTION ACTIVITY */}
                {transactionsLedger && transactionsLedger.length > 0 && (
                  <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <div>
                        <h3 style={{ fontSize: '0.875rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
                          Live Swipes & Transactions
                        </h3>
                        <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                          Recent POS machine transactions and profit cuts
                        </span>
                      </div>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, background: '#EFF6FF', color: '#0F52BA', padding: '2px 8px', borderRadius: '4px' }}>
                        Live Feed
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {transactionsLedger.slice(0, 4).map(txn => (
                        <div key={txn.id || txn.txn_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.75rem', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <strong style={{ fontSize: '0.75rem', color: '#0A192F' }}>
                              {txn.merchant_name || txn.title || 'Merchant Swipe'}
                            </strong>
                            <span style={{ display: 'block', fontSize: '0.625rem', color: '#64748B' }}>
                              {txn.pos_provider || 'POS Machine'} • {new Date(txn.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <strong style={{ fontSize: '0.875rem', fontWeight: 900, color: '#0A192F' }}>
                              ₹{parseFloat(txn.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </strong>
                            <span style={{ display: 'block', fontSize: '0.625rem', color: '#059669', fontWeight: 800 }}>
                              +₹{parseFloat(txn.admin_margin || txn.admin_cut || (txn.amount * 0.0015)).toFixed(2)} Profit
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. AT THE VERY LAST: LEGAL SETTLEMENT ACCOUNTS & VENDOR LEDGERS */}
                <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
                        Legal Settlement Accounts & Vendor Ledgers
                      </h3>
                      <p style={{ fontSize: '0.6875rem', color: '#64748B', margin: '2px 0 0' }}>
                        Official settlement routing according to client partner agreements
                      </p>
                    </div>
                    <span style={{ fontSize: '0.625rem', fontWeight: 800, background: '#EFF6FF', color: '#0F52BA', padding: '2px 6px', borderRadius: '4px' }}>
                      3 Vendors Active
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                    
                    {/* Vendor 1: Rose Navaneetham Enterprises (Pine Labs) */}
                    <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0.875rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1E293B' }}>Rose Navaneetham Enterprises</span>
                        <span style={{ fontSize: '0.55rem', fontWeight: 800, background: '#EFF6FF', color: '#1D4ED8', padding: '1px 5px', borderRadius: '4px' }}>
                          Pine Labs (Single Vendor)
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.5rem' }}>
                        <strong style={{ fontSize: '1rem', fontWeight: 900, color: '#0A192F' }}>
                          ₹{(metrics.vendorSummary?.roseNavaneethamVolume || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </strong>
                        <span style={{ fontSize: '0.625rem', color: '#059669', fontWeight: 800 }}>
                          +₹{(metrics.vendorSummary?.roseNavaneethamProfit || 0).toFixed(2)} Profit
                        </span>
                      </div>
                      <span style={{ fontSize: '0.6rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                        MDR: 1.53% (T+1) / 1.83% (Instant)
                      </span>
                    </div>

                    {/* Vendor 2: RONAV Technologies (Payswiff Vendor 01) */}
                    <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0.875rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1E293B' }}>RONAV Technologies</span>
                        <span style={{ fontSize: '0.55rem', fontWeight: 800, background: '#FEF3C7', color: '#B45309', padding: '1px 5px', borderRadius: '4px' }}>
                          Payswiff (Vendor 01)
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.5rem' }}>
                        <strong style={{ fontSize: '1rem', fontWeight: 900, color: '#0A192F' }}>
                          ₹{(metrics.vendorSummary?.ronavTechVolume || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </strong>
                        <span style={{ fontSize: '0.625rem', color: '#059669', fontWeight: 800 }}>
                          ₹0.30/Instant Fee
                        </span>
                      </div>
                      <span style={{ fontSize: '0.6rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                        Settlement A/C 01 Active
                      </span>
                    </div>

                    {/* Vendor 3: R.P. Technologies (Payswiff Vendor 02) */}
                    <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0.875rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1E293B' }}>R.P. Technologies</span>
                        <span style={{ fontSize: '0.55rem', fontWeight: 800, background: '#ECFDF5', color: '#059669', padding: '1px 5px', borderRadius: '4px' }}>
                          Payswiff (Vendor 02)
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '0.5rem' }}>
                        <strong style={{ fontSize: '1rem', fontWeight: 900, color: '#0A192F' }}>
                          ₹{(metrics.vendorSummary?.rpTechVolume || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </strong>
                        <span style={{ fontSize: '0.625rem', color: '#059669', fontWeight: 800 }}>
                          ₹0.30/Instant Fee
                        </span>
                      </div>
                      <span style={{ fontSize: '0.6rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                        Settlement A/C 02 Active
                      </span>
                    </div>

                  </div>
                </div>

              </div>
            )}

            {/* TAB VIEW: DEDICATED ECOSYSTEM PROFITS & COMMISSION LEDGER */}
            {activeTab === 'profits' && (() => {
              const currentTierKey = selectedProfitTier || 'COMPANY';
              const currentItems = profitDistributionData.breakdowns[currentTierKey] || [];
              const tierMetaMap = {
                COMPANY: {
                  title: 'Company Net Margin',
                  icon: '🏢',
                  accentColor: '#059669',
                  tabId: null,
                  total: profitDistributionData.companyNet
                },
                MASTER: {
                  title: 'Master Distributors',
                  icon: '👑',
                  accentColor: '#7C3AED',
                  tabId: 'master_distributors',
                  total: profitDistributionData.masterTotal
                },
                SUPER: {
                  title: 'Super Distributors',
                  icon: '⚡',
                  accentColor: '#4F46E5',
                  tabId: 'super_distributors',
                  total: profitDistributionData.superTotal
                },
                DISTRICT: {
                  title: 'District Distributors',
                  icon: '🏛️',
                  accentColor: '#D97706',
                  tabId: 'district_distributors',
                  total: profitDistributionData.districtTotal
                },
                DISTRIBUTOR: {
                  title: 'Distributors',
                  icon: '📦',
                  accentColor: '#0F52BA',
                  tabId: 'distributors',
                  total: profitDistributionData.distributorTotal
                },
                MERCHANT: {
                  title: 'Retail Merchants',
                  icon: '🏪',
                  accentColor: '#0284C7',
                  tabId: 'merchants',
                  total: profitDistributionData.merchantTotal
                }
              };
              const activeMeta = tierMetaMap[currentTierKey] || tierMetaMap.COMPANY;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {/* Horizontal Scrolling Date Filter Buttons directly below header */}
                  <div 
                    className="admin-date-filter-scroll no-scrollbar"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      overflowX: 'auto',
                      paddingBottom: '2px',
                      WebkitOverflowScrolling: 'touch',
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none'
                    }}
                  >
                    {[
                      { id: 'TODAY', label: "Today" },
                      { id: 'YESTERDAY', label: "Yesterday" },
                      { id: 'WEEK', label: "7 Days" },
                      { id: 'MONTH', label: "This Month" },
                      { id: 'ALL', label: "All Time" },
                      { id: 'CUSTOM', label: "Custom Range" }
                    ].map(p => (
                      <button
                        key={p.id}
                        onClick={() => setProfitDateFilter(p.id)}
                        style={{
                          background: profitDateFilter === p.id ? '#0F52BA' : '#FFFFFF',
                          color: profitDateFilter === p.id ? '#FFFFFF' : '#475569',
                          border: profitDateFilter === p.id ? '1px solid #0F52BA' : '1px solid #CBD5E1',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '0.6875rem',
                          fontWeight: profitDateFilter === p.id ? 800 : 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom Date Inputs (Only when Custom Range is active) */}
                  {profitDateFilter === 'CUSTOM' && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem'
                    }}>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        style={{
                          padding: '0.35rem 0.5rem',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          fontSize: '0.75rem',
                          color: '#0A192F',
                          fontWeight: 600
                        }}
                      />
                      <span style={{ fontSize: '0.75rem', color: '#64748B' }}>to</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        style={{
                          padding: '0.35rem 0.5rem',
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          fontSize: '0.75rem',
                          color: '#0A192F',
                          fontWeight: 600
                        }}
                      />
                      {(customStartDate || customEndDate) && (
                        <button
                          onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                          style={{
                            background: '#F1F5F9',
                            border: 'none',
                            color: '#64748B',
                            padding: '0.35rem 0.6rem',
                            borderRadius: '6px',
                            fontSize: '0.6875rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}

                  {/* 2-COLUMN GRID: 6 CLEAN TIERS (NO SUBTITLES, NO OVERRIDES TEXT) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '0.875rem'
                  }}>

                    {/* Tier 1: Company Net Margin */}
                    <div
                      onClick={() => setSelectedProfitTier('COMPANY')}
                      style={{
                        background: selectedProfitTier === 'COMPANY' ? '#ECFDF5' : '#FFFFFF',
                        border: selectedProfitTier === 'COMPANY' ? '2px solid #059669' : '1px solid #E2E8F0',
                        borderRadius: '12px',
                        padding: '1rem',
                        cursor: 'pointer',
                        boxShadow: selectedProfitTier === 'COMPANY' ? '0 4px 12px rgba(5, 150, 105, 0.12)' : '0 2px 4px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>
                          🏢 Company Margin
                        </span>
                        {selectedProfitTier === 'COMPANY' ? (
                          <span style={{ fontSize: '0.6rem', fontWeight: 800, background: '#059669', color: '#FFF', padding: '1px 6px', borderRadius: '10px' }}>
                            ✓ Active
                          </span>
                        ) : (
                          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#D1FAE5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <DollarSign style={{ width: '15px', height: '15px' }} />
                          </div>
                        )}
                      </div>
                      <h3 style={{ fontSize: '1.375rem', fontWeight: 900, color: '#059669', margin: '8px 0 0' }}>
                        ₹{profitDistributionData.companyNet.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </h3>
                    </div>

                    {/* Tier 2: Master Distributors */}
                    <div
                      onClick={() => setSelectedProfitTier('MASTER')}
                      style={{
                        background: selectedProfitTier === 'MASTER' ? '#FAF5FF' : '#FFFFFF',
                        border: selectedProfitTier === 'MASTER' ? '2px solid #7C3AED' : '1px solid #E2E8F0',
                        borderRadius: '12px',
                        padding: '1rem',
                        cursor: 'pointer',
                        boxShadow: selectedProfitTier === 'MASTER' ? '0 4px 12px rgba(124, 58, 237, 0.12)' : '0 2px 4px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase' }}>
                          👑 Master Dist
                        </span>
                        {selectedProfitTier === 'MASTER' ? (
                          <span style={{ fontSize: '0.6rem', fontWeight: 800, background: '#7C3AED', color: '#FFF', padding: '1px 6px', borderRadius: '10px' }}>
                            ✓ Active
                          </span>
                        ) : (
                          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#F3E8FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Crown style={{ width: '15px', height: '15px' }} />
                          </div>
                        )}
                      </div>
                      <h3 style={{ fontSize: '1.375rem', fontWeight: 900, color: '#7C3AED', margin: '8px 0 0' }}>
                        ₹{profitDistributionData.masterTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </h3>
                    </div>

                    {/* Tier 3: Super Distributors */}
                    <div
                      onClick={() => setSelectedProfitTier('SUPER')}
                      style={{
                        background: selectedProfitTier === 'SUPER' ? '#EEF2FF' : '#FFFFFF',
                        border: selectedProfitTier === 'SUPER' ? '2px solid #4F46E5' : '1px solid #E2E8F0',
                        borderRadius: '12px',
                        padding: '1rem',
                        cursor: 'pointer',
                        boxShadow: selectedProfitTier === 'SUPER' ? '0 4px 12px rgba(79, 70, 229, 0.12)' : '0 2px 4px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#4F46E5', textTransform: 'uppercase' }}>
                          ⚡ Super Dist
                        </span>
                        {selectedProfitTier === 'SUPER' ? (
                          <span style={{ fontSize: '0.6rem', fontWeight: 800, background: '#4F46E5', color: '#FFF', padding: '1px 6px', borderRadius: '10px' }}>
                            ✓ Active
                          </span>
                        ) : (
                          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#E0E7FF', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Zap style={{ width: '15px', height: '15px' }} />
                          </div>
                        )}
                      </div>
                      <h3 style={{ fontSize: '1.375rem', fontWeight: 900, color: '#4F46E5', margin: '8px 0 0' }}>
                        ₹{profitDistributionData.superTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </h3>
                    </div>

                    {/* Tier 4: District Distributors */}
                    <div
                      onClick={() => setSelectedProfitTier('DISTRICT')}
                      style={{
                        background: selectedProfitTier === 'DISTRICT' ? '#FFFBEB' : '#FFFFFF',
                        border: selectedProfitTier === 'DISTRICT' ? '2px solid #D97706' : '1px solid #E2E8F0',
                        borderRadius: '12px',
                        padding: '1rem',
                        cursor: 'pointer',
                        boxShadow: selectedProfitTier === 'DISTRICT' ? '0 4px 12px rgba(217, 119, 6, 0.12)' : '0 2px 4px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#D97706', textTransform: 'uppercase' }}>
                          🏛️ District Dist
                        </span>
                        {selectedProfitTier === 'DISTRICT' ? (
                          <span style={{ fontSize: '0.6rem', fontWeight: 800, background: '#D97706', color: '#FFF', padding: '1px 6px', borderRadius: '10px' }}>
                            ✓ Active
                          </span>
                        ) : (
                          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Building2 style={{ width: '15px', height: '15px' }} />
                          </div>
                        )}
                      </div>
                      <h3 style={{ fontSize: '1.375rem', fontWeight: 900, color: '#D97706', margin: '8px 0 0' }}>
                        ₹{profitDistributionData.districtTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </h3>
                    </div>

                    {/* Tier 5: Distributors */}
                    <div
                      onClick={() => setSelectedProfitTier('DISTRIBUTOR')}
                      style={{
                        background: selectedProfitTier === 'DISTRIBUTOR' ? '#EFF6FF' : '#FFFFFF',
                        border: selectedProfitTier === 'DISTRIBUTOR' ? '2px solid #0F52BA' : '1px solid #E2E8F0',
                        borderRadius: '12px',
                        padding: '1rem',
                        cursor: 'pointer',
                        boxShadow: selectedProfitTier === 'DISTRIBUTOR' ? '0 4px 12px rgba(15, 82, 186, 0.12)' : '0 2px 4px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#0F52BA', textTransform: 'uppercase' }}>
                          📦 Distributor
                        </span>
                        {selectedProfitTier === 'DISTRIBUTOR' ? (
                          <span style={{ fontSize: '0.6rem', fontWeight: 800, background: '#0F52BA', color: '#FFF', padding: '1px 6px', borderRadius: '10px' }}>
                            ✓ Active
                          </span>
                        ) : (
                          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#DBEAFE', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <GitFork style={{ width: '15px', height: '15px' }} />
                          </div>
                        )}
                      </div>
                      <h3 style={{ fontSize: '1.375rem', fontWeight: 900, color: '#0F52BA', margin: '8px 0 0' }}>
                        ₹{profitDistributionData.distributorTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </h3>
                    </div>

                    {/* Tier 6: Retail Merchants */}
                    <div
                      onClick={() => setSelectedProfitTier('MERCHANT')}
                      style={{
                        background: selectedProfitTier === 'MERCHANT' ? '#F0F9FF' : '#FFFFFF',
                        border: selectedProfitTier === 'MERCHANT' ? '2px solid #0284C7' : '1px solid #E2E8F0',
                        borderRadius: '12px',
                        padding: '1rem',
                        cursor: 'pointer',
                        boxShadow: selectedProfitTier === 'MERCHANT' ? '0 4px 12px rgba(2, 132, 199, 0.12)' : '0 2px 4px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#0284C7', textTransform: 'uppercase' }}>
                          🏪 Merchants
                        </span>
                        {selectedProfitTier === 'MERCHANT' ? (
                          <span style={{ fontSize: '0.6rem', fontWeight: 800, background: '#0284C7', color: '#FFF', padding: '1px 6px', borderRadius: '10px' }}>
                            ✓ Active
                          </span>
                        ) : (
                          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#E0F2FE', color: '#0284C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Store style={{ width: '15px', height: '15px' }} />
                          </div>
                        )}
                      </div>
                      <h3 style={{ fontSize: '1.375rem', fontWeight: 900, color: '#0284C7', margin: '8px 0 0' }}>
                        ₹{profitDistributionData.merchantTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </h3>
                    </div>

                  </div>

                  {/* INLINE DETAILED BREAKDOWN BELOW ALL BUTTONS */}
                  <div style={{
                    background: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    padding: '1rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                  }}>
                    {/* Clean Header */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.75rem',
                      paddingBottom: '0.625rem',
                      borderBottom: '1px solid #F1F5F9',
                      flexWrap: 'wrap',
                      gap: '0.5rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.25rem' }}>{activeMeta.icon}</span>
                        <h3 style={{ fontSize: '0.9375rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
                          {activeMeta.title} ({currentItems.length})
                        </h3>
                      </div>

                      {activeMeta.tabId && (
                        <button
                          onClick={() => handleTabSwitch(activeMeta.tabId)}
                          style={{
                            background: '#0F52BA',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.6875rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <span>Open Directory</span>
                          <ArrowRight style={{ width: '12px', height: '12px' }} />
                        </button>
                      )}
                    </div>

                    {/* Itemized Transactions List */}
                    {currentItems.length === 0 ? (
                      <div style={{
                        padding: '1.75rem 1rem',
                        textAlign: 'center',
                        color: '#64748B',
                        fontSize: '0.8125rem'
                      }}>
                        No transactions recorded for {activeMeta.title} in selected period.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                        {currentItems.map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              borderRadius: '8px',
                              padding: '0.75rem',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: '0.75rem'
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <strong style={{ fontSize: '0.8125rem', color: '#0A192F' }}>
                                  {item.partner_name}
                                </strong>
                                <span style={{ fontSize: '0.625rem', color: '#64748B' }}>
                                  ({item.partner_id})
                                </span>
                              </div>

                              <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>
                                Swipe at {item.merchant_name} • ₹{(item.amount || 0).toLocaleString('en-IN')} on {item.provider}
                              </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <strong style={{ fontSize: '1rem', fontWeight: 900, color: '#059669' }}>
                                +₹{(item.commission_amount || 0).toFixed(2)}
                              </strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>

                </div>
              );
            })()}

            {/* TAB VIEW 1B: DEDICATED MASTER DISTRIBUTORS PAGE (APEX COMMAND TIER) */}
            {activeTab === 'master_distributors' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                
                {/* Top Action Header: Title + Create Master Button beside it */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '1.25rem' }}>👑</span>
                    <h2 style={{ fontSize: '1.0625rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
                      Master Distributors ({filteredMasters.length})
                    </h2>
                  </div>
                  <button
                    onClick={() => handleOpenCreateModal('MASTER', 'ADM001')}
                    style={{
                      background: '#7C3AED',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '0.375rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: '0 2px 5px rgba(124, 58, 237, 0.25)'
                    }}
                  >
                    <PlusCircle style={{ width: '13px', height: '13px' }} />
                    <span>+ Create Master Dist</span>
                  </button>
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative' }}>
                  <Search style={{ width: '14px', height: '14px', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    type="text"
                    placeholder="Search by Master Name, Mobile, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.75rem 0.45rem 2rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.75rem', outline: 'none' }}
                  />
                </div>

                {/* Cards List with Interactive Downline Tree Drilldown */}
                {filteredMasters.length === 0 ? (
                  <div style={{ padding: '2.5rem 1rem', textAlign: 'center', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', color: '#64748B' }}>
                    <p style={{ margin: 0, fontSize: '0.8125rem' }}>No Master Distributors found matching search.</p>
                    <button onClick={() => handleOpenCreateModal('MASTER', 'ADM001')} style={{ marginTop: '0.75rem', background: '#7C3AED', color: '#FFF', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 800 }}>
                      + Create First Master Distributor
                    </button>
                  </div>
                ) : (
                  <div className="admin-roster-grid">
                    {filteredMasters.map(m => {
                      const mVol = parseFloat(m.network_volume || m.total_sales || 0);
                      const mProfit = mVol * 0.0020;

                      // Robust Downline Aggregation (SD -> DD -> Dist -> Shops)
                      const childSDs = m.super_distributors || superDistributorsList.filter(sd => sd.creator_id === m.id || sd.parent_id === m.id);
                      const childDDs = childSDs.flatMap(sd => sd.district_distributors || districtDistributorsList.filter(dd => dd.creator_id === sd.id || dd.parent_id === sd.id));
                      const directDists = childDDs.flatMap(dd => dd.distributors || distributorsList.filter(d => d.creator_id === dd.id || d.parent_id === dd.id));
                      const uniqueDists = Array.from(new Map(directDists.map(d => [d.id, d])).values());

                      const allMerchants = uniqueDists.flatMap(d => d.merchants || merchantsList.filter(mer => mer.creator_id === d.id || mer.parent_id === d.id));
                      const uniqueMerchants = Array.from(new Map(allMerchants.map(mer => [mer.id, mer])).values());
                      const totalMachines = uniqueMerchants.length;

                      return (
                        <div
                          key={m.id}
                          onClick={() => handleOpenDossier(m, 'MASTER')}
                          style={{
                            background: '#FFFFFF',
                            border: '1.5px solid #DDD6FE',
                            borderRadius: '12px',
                            padding: '1rem',
                            boxShadow: '0 2px 4px rgba(124, 58, 237, 0.04)',
                            cursor: 'pointer',
                            transition: 'all 150ms ease'
                          }}
                        >
                          {/* Master Distributor Top Row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <span style={{ fontSize: '1.125rem' }}>👑</span>
                                <strong style={{ fontSize: '0.9375rem', color: '#0A192F' }}>{m.name}</strong>
                              </div>
                              <span style={{ fontSize: '0.6875rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                                Apex ID: <strong style={{ color: '#7C3AED' }}>{m.id}</strong> • Mobile: {m.mobile}
                              </span>
                            </div>

                            {/* Status Pill */}
                            <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '3px 7px', borderRadius: '6px', background: '#FAF5FF', color: '#7C3AED', border: '1px solid #DDD6FE', whiteSpace: 'nowrap' }}>
                              👑 APEX PARTNER
                            </span>
                          </div>

                          {/* 4 Metric Pills */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.375rem', marginTop: '0.625rem', background: '#FAF5FF', padding: '0.5rem 0.625rem', borderRadius: '8px', border: '1px solid #E9D5FF' }}>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>State Turnover</span>
                              <strong style={{ fontSize: '0.8125rem', color: '#0A192F', fontWeight: 900 }}>
                                ₹{mVol.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#7C3AED', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>Master Cut (0.20%)</span>
                              <strong style={{ fontSize: '0.8125rem', color: '#7C3AED', fontWeight: 900 }}>
                                +₹{(mVol * 0.0020).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#0F52BA', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>Master Wallet</span>
                              <strong style={{ fontSize: '0.8125rem', color: '#0F52BA', fontWeight: 900 }}>
                                ₹{parseFloat(m.available_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#059669', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>Admin Net</span>
                              <strong style={{ fontSize: '0.8125rem', color: '#059669', fontWeight: 900 }}>
                                +₹{mProfit.toFixed(2)}
                              </strong>
                            </div>
                          </div>

                          {/* Action Footer Bar */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
                            <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 700 }}>
                              Downline: {childSDs.length} SD Hubs • {childDDs.length} DD • {uniqueDists.length} Dist • {totalMachines} Stores
                            </span>
                            <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#7C3AED', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              View Dossier & Command Chain <ChevronRight style={{ width: '12px', height: '12px' }} />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            )}

            {/* TAB VIEW 2: DEDICATED SUPER DISTRIBUTORS PAGE */}
            {activeTab === 'super_distributors' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                
                {/* Top Action Header: Title + Create SD Button beside it (Clean, No Wasted Subtitles) */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '1.0625rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
                    Super Distributors ({filteredSDs.length})
                  </h2>
                  <button
                    onClick={() => handleOpenCreateModal('SUPER_DISTRIBUTOR', 'ADM001')}
                    style={{
                      background: '#7C3AED',
                      color: '#FFFFFF',
                      border: 'none',
                      padding: '0.375rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: '0 2px 5px rgba(124, 58, 237, 0.25)'
                    }}
                  >
                    <PlusCircle style={{ width: '13px', height: '13px' }} />
                    <span>+ Create SD</span>
                  </button>
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative' }}>
                  <Search style={{ width: '14px', height: '14px', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    type="text"
                    placeholder="Search by SD Name, Mobile, or ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '0.45rem 0.75rem 0.45rem 2rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.75rem', outline: 'none' }}
                  />
                </div>

                {/* Cards List with Interactive Downline Tree Drilldown */}
                {filteredSDs.length === 0 ? (
                  <div style={{ padding: '2.5rem 1rem', textAlign: 'center', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', color: '#64748B' }}>
                    <p style={{ margin: 0, fontSize: '0.8125rem' }}>No Super Distributors found matching search.</p>
                    <button onClick={() => handleOpenCreateModal('SUPER_DISTRIBUTOR', 'ADM001')} style={{ marginTop: '0.75rem', background: '#7C3AED', color: '#FFF', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 800 }}>
                      + Create First Super Distributor
                    </button>
                  </div>
                ) : (
                  <div className="admin-roster-grid">
                    {filteredSDs.map(sd => {
                      const sdVol = parseFloat(sd.network_volume || sd.total_sales || 0);
                      const sdProfit = sdVol * 0.0015;

                      // Robust Downline Aggregation (District Dist -> Dist -> Shops)
                      const childDDs = sd.district_distributors || districtDistributorsList.filter(dd => dd.creator_id === sd.id || dd.parent_id === sd.id);
                      const directDists = sd.distributors || distributorsList.filter(d => d.creator_id === sd.id || d.parent_id === sd.id);
                      const allDists = [
                        ...directDists,
                        ...childDDs.flatMap(dd => dd.distributors || distributorsList.filter(d => d.creator_id === dd.id || d.parent_id === dd.id))
                      ];
                      const uniqueDists = Array.from(new Map(allDists.map(d => [d.id, d])).values());

                      const allMerchants = [
                        ...(sd.direct_merchants || merchantsList.filter(m => m.creator_id === sd.id)),
                        ...uniqueDists.flatMap(d => d.merchants || merchantsList.filter(m => m.creator_id === d.id || m.parent_id === d.id))
                      ];
                      const uniqueMerchants = Array.from(new Map(allMerchants.map(m => [m.id, m])).values());
                      const totalMachines = uniqueMerchants.length || sd.total_merchant_count || 0;

                      return (
                        <div
                          key={sd.id}
                          onClick={() => handleOpenDossier(sd, 'SUPER_DISTRIBUTOR')}
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            borderRadius: '12px',
                            padding: '1rem',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                            cursor: 'pointer',
                            transition: 'all 150ms ease'
                          }}
                        >
                          {/* Super Distributor Top Row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <span style={{ fontSize: '1rem' }}>⚡</span>
                                <strong style={{ fontSize: '0.9375rem', color: '#0A192F' }}>{sd.name}</strong>
                              </div>
                              <span style={{ fontSize: '0.6875rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                                ID: <strong style={{ color: '#7C3AED' }}>{sd.id}</strong> • Mobile: {sd.mobile}
                              </span>
                            </div>

                            {/* Machines Count Pill */}
                            <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '3px 7px', borderRadius: '6px', background: '#F3E8FF', color: '#7C3AED', border: '1px solid #E9D5FF', whiteSpace: 'nowrap' }}>
                              {totalMachines} POS Machines
                            </span>
                          </div>

                          {/* 4 Metric Pills: [Turnover] [SD Commission 0.15%] [SD Wallet] [Admin Profit] */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.375rem', marginTop: '0.625rem', background: '#F8FAFC', padding: '0.5rem 0.625rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>Network Turnover</span>
                              <strong style={{ fontSize: '0.8125rem', color: '#0A192F', fontWeight: 900 }}>
                                ₹{sdVol.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#7C3AED', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>SD Cut (0.15%)</span>
                              <strong style={{ fontSize: '0.8125rem', color: '#7C3AED', fontWeight: 900 }}>
                                +₹{(sdVol * 0.0015).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#0F52BA', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>SD Wallet</span>
                              <strong style={{ fontSize: '0.8125rem', color: '#0F52BA', fontWeight: 900 }}>
                                ₹{parseFloat(sd.available_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#059669', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>Admin Net</span>
                              <strong style={{ fontSize: '0.8125rem', color: '#059669', fontWeight: 900 }}>
                                +₹{sdProfit.toFixed(2)}
                              </strong>
                            </div>
                          </div>

                          {/* Action Footer Bar */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
                            <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 700 }}>
                              Downline: {childDDs.length} DD • {uniqueDists.length} Dist • {totalMachines} Stores
                            </span>
                            <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#7C3AED', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              View Details & Team <ChevronRight style={{ width: '12px', height: '12px' }} />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            )}

            {/* TAB VIEW 3: DEDICATED DISTRICT DISTRIBUTORS PAGE */}
            {activeTab === 'district_distributors' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                
                {/* Top Action Header: Clean Title + Button Beside It */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '1.0625rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
                    District Distributors ({filteredDDs.length})
                  </h2>
                  <button
                    onClick={() => handleOpenCreateModal('DISTRICT_DISTRIBUTOR', '')}
                    style={{
                      background: '#D97706',
                      color: '#FFF',
                      border: 'none',
                      padding: '0.375rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: '0 2px 5px rgba(217, 119, 6, 0.25)'
                    }}
                  >
                    <PlusCircle style={{ width: '13px', height: '13px' }} />
                    <span>+ Create DD</span>
                  </button>
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative' }}>
                  <Search style={{ width: '14px', height: '14px', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    type="text"
                    placeholder="Search by District Distributor Name, Mobile, DD ID, or Parent SD..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.75rem', outline: 'none' }}
                  />
                </div>

                {/* Mobile Cards List for District Distributors */}
                {filteredDDs.length === 0 ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', color: '#64748B' }}>
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>No District Distributors found matching search.</p>
                    <button onClick={() => handleOpenCreateModal('DISTRICT_DISTRIBUTOR', '')} style={{ marginTop: '0.75rem', background: '#D97706', color: '#FFF', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
                      + Create First District Distributor
                    </button>
                  </div>
                ) : (
                  <div className="admin-roster-grid">
                    {filteredDDs.map(dd => {
                      const ddVol = parseFloat(dd.downline_volume || dd.total_sales || 0);
                      const ddProfit = ddVol * 0.0008;

                      return (
                        <div
                          key={dd.id}
                          onClick={() => handleOpenDossier(dd, 'DISTRICT_DISTRIBUTOR')}
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            borderRadius: '12px',
                            padding: '1rem',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                            transition: 'all 150ms ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <span style={{ fontSize: '1rem' }}>🏛️</span>
                                <strong style={{ fontSize: '0.9375rem', color: '#0A192F' }}>{dd.name}</strong>
                              </div>
                              <span style={{ fontSize: '0.6875rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                                ID: <strong style={{ color: '#D97706' }}>{dd.id}</strong> • Mobile: {dd.mobile}
                              </span>
                              <span style={{ fontSize: '0.625rem', color: '#475569', display: 'block', marginTop: '1px' }}>
                                Under: <strong>{dd.parent_sd_name || 'Super Admin'}</strong>
                              </span>
                            </div>
                            <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A' }}>
                              {dd.distributor_count || (dd.distributors?.length || 0)} Dists • {dd.total_merchant_count || 0} Stores
                            </span>
                          </div>

                          {/* 4 Metric Pills for District Distributor */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.375rem', marginTop: '0.625rem', background: '#F8FAFC', padding: '0.5rem 0.625rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>Downline Sales</span>
                              <strong style={{ fontSize: '0.8125rem', color: '#0A192F', fontWeight: 900 }}>
                                ₹{ddVol.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#D97706', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>DD Cut (0.08%)</span>
                              <strong style={{ fontSize: '0.8125rem', color: '#D97706', fontWeight: 900 }}>
                                +₹{(ddVol * 0.0008).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#0F52BA', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>DD Wallet</span>
                              <strong style={{ fontSize: '0.8125rem', color: '#0F52BA', fontWeight: 900 }}>
                                ₹{parseFloat(dd.available_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#059669', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>Admin Net</span>
                              <strong style={{ fontSize: '0.8125rem', color: '#059669', fontWeight: 900 }}>
                                +₹{ddProfit.toFixed(2)}
                              </strong>
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                            <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#D97706', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              View Details & Dists <ChevronRight style={{ width: '12px', height: '12px' }} />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            )}

            {/* TAB VIEW 4: DEDICATED DISTRIBUTORS PAGE */}
            {activeTab === 'distributors' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                
                {/* Top Action Header: Clean Title + Button Beside It */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '1.0625rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
                    Distributors ({filteredDists.length})
                  </h2>
                  <button
                    onClick={() => handleOpenCreateModal('DISTRIBUTOR', '')}
                    style={{
                      background: '#0F52BA',
                      color: '#FFF',
                      border: 'none',
                      padding: '0.375rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: '0 2px 5px rgba(15, 82, 186, 0.25)'
                    }}
                  >
                    <PlusCircle style={{ width: '13px', height: '13px' }} />
                    <span>+ Create Dist</span>
                  </button>
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative' }}>
                  <Search style={{ width: '14px', height: '14px', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    type="text"
                    placeholder="Search by Distributor Name, Mobile, ID, or Parent SD..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.75rem', outline: 'none' }}
                  />
                </div>

                {/* Mobile Cards List for Distributors */}
                {filteredDists.length === 0 ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', color: '#64748B' }}>
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>No Distributors found matching search.</p>
                    <button onClick={() => handleOpenCreateModal('DISTRIBUTOR', '')} style={{ marginTop: '0.75rem', background: '#0F52BA', color: '#FFF', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
                      + Create First Distributor
                    </button>
                  </div>
                ) : (
                  <div className="admin-roster-grid">
                    {filteredDists.map(d => {
                      const distVol = parseFloat(d.downline_volume || d.total_sales || 0);
                      const distProfit = distVol * 0.0006;

                      return (
                        <div
                          key={d.id}
                          onClick={() => handleOpenDossier(d, 'DISTRIBUTOR')}
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            borderRadius: '12px',
                            padding: '1rem',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <span style={{ fontSize: '1rem' }}>📦</span>
                                <strong style={{ fontSize: '0.9375rem', color: '#0A192F' }}>{d.name}</strong>
                              </div>
                              <span style={{ fontSize: '0.6875rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                                ID: <strong style={{ color: '#0F52BA' }}>{d.id}</strong> • Mobile: {d.mobile}
                              </span>
                              <span style={{ fontSize: '0.625rem', color: '#475569', display: 'block', marginTop: '1px' }}>
                                Under: <strong>{d.parent_sd_name || 'Super Admin'}</strong>
                              </span>
                            </div>
                            <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: '#EFF6FF', color: '#0F52BA', border: '1px solid #BFDBFE' }}>
                              {d.merchant_count || (d.merchants?.length || 0)} Stores
                            </span>
                          </div>

                          {/* 4 Metric Pills for Distributor */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.375rem', marginTop: '0.625rem', background: '#F8FAFC', padding: '0.5rem 0.625rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>Downline Sales</span>
                              <strong style={{ fontSize: '0.8125rem', color: '#0A192F', fontWeight: 900 }}>
                                ₹{distVol.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#0F52BA', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>Dist Cut (0.25%)</span>
                              <strong style={{ fontSize: '0.8125rem', color: '#0F52BA', fontWeight: 900 }}>
                                +₹{(distVol * 0.0025).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#10B981', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>Dist Wallet</span>
                              <strong style={{ fontSize: '0.8125rem', color: '#059669', fontWeight: 900 }}>
                                ₹{parseFloat(d.available_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#059669', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>Admin Net</span>
                              <strong style={{ fontSize: '0.8125rem', color: '#059669', fontWeight: 900 }}>
                                +₹{distProfit.toFixed(2)}
                              </strong>
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                            <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#0F52BA', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              View Details & Stores <ChevronRight style={{ width: '12px', height: '12px' }} />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            )}

            {/* TAB VIEW 5: DEDICATED MERCHANTS & RETAILERS PAGE */}
            {activeTab === 'merchants' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                
                {/* Top Action Header: Clean Title + Button Beside It */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '1.0625rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
                    Merchants & Retailers ({filteredMerchants.length})
                  </h2>
                  <button
                    onClick={() => handleOpenCreateModal('MERCHANT', '')}
                    style={{
                      background: '#059669',
                      color: '#FFF',
                      border: 'none',
                      padding: '0.375rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: '0 2px 5px rgba(5, 150, 105, 0.25)'
                    }}
                  >
                    <PlusCircle style={{ width: '13px', height: '13px' }} />
                    <span>+ Create Shop</span>
                  </button>
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative' }}>
                  <Search style={{ width: '14px', height: '14px', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    type="text"
                    placeholder="Search by Store Name, MID, Mobile, Vendor..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.75rem', outline: 'none' }}
                  />
                </div>

                {/* Mobile Cards List for Merchants */}
                {filteredMerchants.length === 0 ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', color: '#64748B' }}>
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>No Merchants found matching search.</p>
                    <button onClick={() => handleOpenCreateModal('MERCHANT', '')} style={{ marginTop: '0.75rem', background: '#059669', color: '#FFF', border: 'none', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>
                      + Create First Merchant
                    </button>
                  </div>
                ) : (
                  <div className="admin-roster-grid">
                    {filteredMerchants.map(m => {
                      const sales = parseFloat(m.total_sales || 0);
                      const isPine = (m.pos_provider || '').includes('Pine');
                      const isInstant = (m.pos_settlement || '').includes('INSTANT');
                      const rate = isPine ? (isInstant ? 0.0025 : 0.0015) : 0.0005;
                      const adminProfit = sales * rate;

                      return (
                        <div
                          key={m.id}
                          onClick={() => handleOpenDossier(m, 'MERCHANT')}
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            borderRadius: '12px',
                            padding: '1rem',
                            cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <span style={{ fontSize: '1rem' }}>🏪</span>
                                <strong style={{ fontSize: '0.9375rem', color: '#0A192F' }}>{m.name}</strong>
                              </div>
                              <span style={{ fontSize: '0.6875rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                                MID: <strong style={{ color: '#059669' }}>{m.id}</strong> • Mobile: {m.mobile}
                              </span>
                              
                              {/* Full Upline Hierarchy Chain */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 800 }}>Upline Chain:</span>
                                <span style={{ fontSize: '0.625rem', color: '#0F172A', fontWeight: 700, background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px', border: '1px solid #E2E8F0' }}>
                                  {m.upline_path_str || (m.parent_sd_name ? `Super Admin ➔ ⚡ ${m.parent_sd_name} ➔ 📦 ${m.creator_name}` : `Super Admin ➔ ${m.creator_name}`)}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span style={{
                                fontSize: '0.625rem',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: m.status === 'SUSPENDED' ? '#FEF2F2' : '#ECFDF5',
                                color: m.status === 'SUSPENDED' ? '#DC2626' : '#059669',
                                border: m.status === 'SUSPENDED' ? '1px solid #FECACA' : '1px solid #A7F3D0'
                              }}>
                                {m.status === 'SUSPENDED' ? '⚠️ Suspended' : '✓ Active'}
                              </span>
                              <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>
                                Wallet: ₹{parseFloat(m.available_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          {/* Multi-Channel Portfolio & Legal Vendor Badges */}
                          <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            {m.channels?.pine_labs?.enabled && (
                              <span style={{ fontSize: '0.6rem', fontWeight: 800, background: '#EFF6FF', color: '#0F52BA', padding: '2px 6px', borderRadius: '4px', border: '1px solid #BFDBFE' }}>
                                🌲 Pine Labs: {m.channels.pine_labs.terminal_id || 'PL-01'} (Rose Navaneetham)
                              </span>
                            )}
                            {m.channels?.payswiff?.enabled && (
                              <span style={{ fontSize: '0.6rem', fontWeight: 800, background: '#FFFBEB', color: '#D97706', padding: '2px 6px', borderRadius: '4px', border: '1px solid #FDE68A' }}>
                                ⚡ Payswiff: {m.channels.payswiff.terminal_id || 'SWIFF-01'} ({m.channels.payswiff.vendor || 'RONAV'})
                              </span>
                            )}
                            {m.channels?.qr?.enabled && (
                              <span style={{ fontSize: '0.6rem', fontWeight: 800, background: '#F5F3FF', color: '#7C3AED', padding: '2px 6px', borderRadius: '4px', border: '1px solid #DDD6FE' }}>
                                📱 QR Active: {m.channels.qr.rate_instant || 1.50}% Instant
                              </span>
                            )}
                            {(!m.channels || (!m.channels.pine_labs?.enabled && !m.channels.payswiff?.enabled && !m.channels.qr?.enabled)) && (
                              <span style={{ fontSize: '0.6rem', fontWeight: 800, background: '#F1F5F9', color: '#64748B', padding: '2px 6px', borderRadius: '4px' }}>
                                📟 {m.pos_provider || 'Pine Labs'} ({(m.pos_terminal || 'PL-TS').split('|')[0]})
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenManageChannels(m);
                              }}
                              style={{
                                marginLeft: 'auto',
                                background: '#EFF6FF',
                                border: '1px solid #BFDBFE',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.625rem',
                                fontWeight: 800,
                                color: '#0F52BA',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              ⚙️ Manage Terminals
                            </button>
                          </div>

                          {/* 4 Financial Metrics Grid */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.375rem', marginTop: '0.625rem', background: '#F8FAFC', padding: '0.5rem 0.625rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#0F52BA', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>Available Wallet</span>
                              <strong style={{ fontSize: '0.8125rem', color: '#0F52BA', fontWeight: 900 }}>
                                ₹{parseFloat(m.available_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: parseFloat(m.pending_balance || 0) > 0 ? '#D97706' : '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>Pending Swipes</span>
                              <strong style={{ fontSize: '0.8125rem', color: parseFloat(m.pending_balance || 0) > 0 ? '#D97706' : '#64748B', fontWeight: 900 }}>
                                ₹{parseFloat(m.pending_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#0A192F', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>Total Sales</span>
                              <strong style={{ fontSize: '0.8125rem', color: '#0A192F', fontWeight: 900 }}>
                                ₹{sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#16A34A', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>Withdrawn to Bank</span>
                              <strong style={{ fontSize: '0.8125rem', color: '#16A34A', fontWeight: 900 }}>
                                ₹{parseFloat(m.withdrawn_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', marginTop: '0.625rem', paddingTop: '0.625rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 800 }}>
                                Admin Profit: +₹{adminProfit.toFixed(2)}
                              </span>
                              <button
                                onClick={(e) => handleOpenEditPartner(m, e)}
                                style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '2px 6px', borderRadius: '4px', fontSize: '0.625rem', fontWeight: 700, color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                                title="Edit Merchant Details"
                              >
                                <Edit3 style={{ width: '10px', height: '10px' }} />
                                <span>Edit</span>
                              </button>
                              <button
                                onClick={(e) => handleOpenResetPassword(m, e)}
                                style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '2px 6px', borderRadius: '4px', fontSize: '0.625rem', fontWeight: 700, color: '#15803D', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                                title="Reset Merchant Password"
                              >
                                <Key style={{ width: '10px', height: '10px' }} />
                                <span>Pass</span>
                              </button>
                              <button
                                onClick={(e) => handleToggleUserStatus(m, e)}
                                style={{
                                  background: m.status === 'SUSPENDED' ? '#FEF2F2' : '#F8FAFC',
                                  border: m.status === 'SUSPENDED' ? '1px solid #FECACA' : '1px solid #CBD5E1',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.625rem',
                                  fontWeight: 700,
                                  color: m.status === 'SUSPENDED' ? '#DC2626' : '#64748B',
                                  cursor: 'pointer'
                                }}
                              >
                                {m.status === 'SUSPENDED' ? 'Reactivate' : 'Suspend'}
                              </button>
                            </div>
                            <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#059669', display: 'flex', alignItems: 'center', gap: '2px' }}>
                              View Details & Sales <ChevronRight style={{ width: '12px', height: '12px' }} />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            )}

            {/* TAB VIEW 5: DEDICATED PAYOUT APPROVALS & FINANCIAL CLEARANCE QUEUE */}
            {activeTab === 'payouts' && (() => {
              // Robust Deduplication Helper ensuring zero doubled records
              const dedupeById = (items) => {
                if (!Array.isArray(items)) return [];
                const seen = new Set();
                return items.filter(item => {
                  if (!item) return false;
                  const key = item.id || `${item.created_at || ''}_${item.amount || ''}_${item.merchant_id || ''}`;
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                });
              };

              // Settlement Classifier Helper
              const isItemInstant = (item) => {
                const mode = (item.settlement_mode || item.settlement_type || '').toUpperCase();
                const remark = (item.admin_remark || '').toUpperCase();
                const notes = (item.notes || '').toUpperCase();
                return mode.includes('INSTANT') || remark.includes('IMPS') || remark.includes('INSTANT') || notes.includes('INSTANT');
              };

              // Genuine live Supabase transactions only (NO dummy or seed data)
              const combinedPendingTxns = dedupeById(pendingTxns);
              const combinedLedger = dedupeById(transactionsLedger);
              const combinedPayouts = dedupeById(allPayouts);

              // Date filter helper (accurate local calendar day)
              const toLocalDateStr = (d) => {
                if (!d) return '';
                const dt = new Date(d);
                return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
              };

              const filterByDate = (items, dateField = 'created_at') => {
                if (!payoutDateFilter || payoutDateFilter === 'ALL') return items;
                const now = new Date();
                const todayStr = toLocalDateStr(now);
                const yesterday = new Date(now);
                yesterday.setDate(now.getDate() - 1);
                const yesterdayStr = toLocalDateStr(yesterday);
                const weekAgo = new Date(now);
                weekAgo.setDate(now.getDate() - 7);

                return items.filter(item => {
                  const dVal = item[dateField] || item.created_at || item.verified_at;
                  if (!dVal) return true;
                  const itemDateStr = toLocalDateStr(dVal);
                  const itemDateObj = new Date(dVal);

                  if (payoutDateFilter === 'TODAY') return itemDateStr === todayStr;
                  if (payoutDateFilter === 'YESTERDAY') return itemDateStr === yesterdayStr;
                  if (payoutDateFilter === 'WEEK') return itemDateObj >= weekAgo;
                  if (payoutDateFilter === 'MONTH') {
                    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                    return itemDateObj >= startOfMonth;
                  }
                  if (payoutDateFilter === 'CUSTOM') {
                    if (payoutFromDate && payoutToDate) {
                      return itemDateStr >= payoutFromDate && itemDateStr <= payoutToDate;
                    } else if (payoutFromDate) {
                      return itemDateStr >= payoutFromDate;
                    } else if (payoutCustomDate) {
                      return itemDateStr === payoutCustomDate;
                    }
                  }
                  return true;
                });
              };

              // Tag records
              const allSwipes = dedupeById([
                ...combinedPendingTxns.map(item => ({ ...item, _entityType: 'SWIPE', _subStatus: 'PENDING' })),
                ...combinedLedger.filter(t => t.status === 'APPROVED').map(item => ({ ...item, _entityType: 'SWIPE', _subStatus: 'APPROVED' })),
                ...combinedLedger.filter(t => t.status === 'REJECTED' || t.status === 'INVALID').map(item => ({ ...item, _entityType: 'SWIPE', _subStatus: 'INVALID' }))
              ]);

              const allWithdrawals = dedupeById([
                ...combinedPayouts.filter(p => p.status === 'PENDING').map(item => ({ 
                  ...item, 
                  _entityType: 'WITHDRAWAL', 
                  _subStatus: (item.is_submitted_to_bank || (item.admin_remark && item.admin_remark.includes('[SUBMITTED_TO_BANK]'))) ? 'SUBMITTED_TO_BANK' : 'PENDING' 
                })),
                ...combinedPayouts.filter(p => p.status === 'APPROVED').map(item => ({ ...item, _entityType: 'WITHDRAWAL', _subStatus: 'APPROVED' })),
                ...combinedPayouts.filter(p => p.status === 'REJECTED' || p.status === 'INVALID').map(item => ({ ...item, _entityType: 'WITHDRAWAL', _subStatus: 'INVALID' }))
              ]);

              // STEP 1: Strict Channel Filter (Genuine Database Items Only)
              const userPosLookup = {};
              (networkUsers || []).forEach(u => {
                if (u && u.id) {
                  userPosLookup[u.id] = {
                    provider: u.pos_provider,
                    vendor: u.pos_vendor,
                    terminal: u.pos_terminal
                  };
                }
              });

              const filterByChannel = (items) => {
                return items.filter(item => {
                  if (!item) return false;
                  const channel = classifyTransactionChannel(item);
                  const uPos = userPosLookup[item.merchant_id] || {};
                  const v = (item.pos_vendor || uPos.vendor || '').toLowerCase();
                  const notes = (item.notes || item.admin_remark || '').toLowerCase();

                  if (selectedChannel === 'all') {
                    return true;
                  }

                  if (selectedChannel === 'qr') {
                    return channel === 'qr';
                  }

                  if (selectedChannel === 'payswiff') {
                    if (channel !== 'payswiff') return false;

                    const isRp = v.includes('rp') || notes.includes('r.p.') || notes.includes('rp tech') || notes.includes('rp_');
                    if (selectedPayswiffVendor === 'rp') {
                      return isRp;
                    } else if (selectedPayswiffVendor === 'ronav') {
                      return !isRp;
                    }
                    return true;
                  }

                  if (selectedChannel === 'pinelabs') {
                    return channel === 'pinelabs';
                  }

                  return true;
                });
              };

              const channelSwipes = dedupeById(filterByDate(filterByChannel(allSwipes)));
              const channelWithdrawals = dedupeById(filterByDate(filterByChannel(allWithdrawals)));
              const channelAllItems = dedupeById([...channelSwipes, ...channelWithdrawals]);

              // Contextual counts
              const totalSwipesCount = channelSwipes.length;
              const totalWithdrawalsCount = channelWithdrawals.length;
              const totalAllActivityCount = channelAllItems.length;

              // Filter by Category
              let categoryList = channelAllItems;
              if (payoutCategoryFilter === 'SWIPES') categoryList = channelSwipes;
              else if (payoutCategoryFilter === 'WITHDRAWALS') categoryList = channelWithdrawals;

              const statusCounts = {
                all: categoryList.length,
                completed: categoryList.filter(i => i._subStatus === 'APPROVED').length,
                pending: categoryList.filter(i => i._subStatus === 'PENDING').length,
                submitted: categoryList.filter(i => i._subStatus === 'SUBMITTED_TO_BANK').length,
                invalid: categoryList.filter(i => i._subStatus === 'INVALID').length
              };

              // Filter by Status
              let statusFilteredList = categoryList;
              if (payoutStatusFilter === 'APPROVED') statusFilteredList = categoryList.filter(i => i._subStatus === 'APPROVED');
              else if (payoutStatusFilter === 'PENDING') statusFilteredList = categoryList.filter(i => i._subStatus === 'PENDING');
              else if (payoutStatusFilter === 'SUBMITTED_TO_BANK') statusFilteredList = categoryList.filter(i => i._subStatus === 'SUBMITTED_TO_BANK');
              else if (payoutStatusFilter === 'INVALID') statusFilteredList = categoryList.filter(i => i._subStatus === 'INVALID');

              const settlementCounts = {
                all: statusFilteredList.length,
                t1: statusFilteredList.filter(i => !isItemInstant(i)).length,
                instant: statusFilteredList.filter(i => isItemInstant(i)).length
              };

              // Filter by Settlement Speed
              let candidateList = statusFilteredList;
              if (payoutSettlementFilter === 'T1') candidateList = statusFilteredList.filter(i => !isItemInstant(i));
              else if (payoutSettlementFilter === 'INSTANT') candidateList = statusFilteredList.filter(i => isItemInstant(i));

              // T+1 Batch Items
              const t1BatchPendingItems = channelWithdrawals.filter(w => w._subStatus === 'PENDING' && !isItemInstant(w));
              const totalBatchAmount = t1BatchPendingItems.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0);

              // Apply Search Query
              const q = (payoutSearchQuery || '').toLowerCase().trim();
              const activeList = q ? candidateList.filter(item => {
                const merchantName = (item.merchant_name || '').toLowerCase();
                const custName = (item.customer_name || '').toLowerCase();
                const custMobile = (item.customer_mobile || '').toLowerCase();
                const merchantMobile = (item.merchant_mobile || '').toLowerCase();
                const mid = (item.merchant_id || '').toLowerCase();
                const acc = (item.account_number || '').toLowerCase();
                const ifsc = (item.ifsc_code || '').toLowerCase();
                const utr = (item.utr_number || item.bank_rrn || item.ref_number || item.rrn_number || '').toLowerCase();
                const id = (item.id || '').toLowerCase();
                const amount = String(item.amount || '');
                const bank = (item.bank_name || '').toLowerCase();
                const remark = (item.admin_remark || '').toLowerCase();
                return merchantName.includes(q) || custName.includes(q) || custMobile.includes(q) || merchantMobile.includes(q) || mid.includes(q) || acc.includes(q) || ifsc.includes(q) || utr.includes(q) || id.includes(q) || amount.includes(q) || bank.includes(q) || remark.includes(q);
              }) : candidateList;

              const PAGE_SIZE = 12;
              const totalPages = Math.max(1, Math.ceil(activeList.length / PAGE_SIZE));
              const currentItems = activeList.slice((payoutPage - 1) * PAGE_SIZE, payoutPage * PAGE_SIZE);

              const renderPayoutPagination = (pages, count) => {
                if (count <= PAGE_SIZE) return null;
                const startItem = (payoutPage - 1) * PAGE_SIZE + 1;
                const endItem = Math.min(payoutPage * PAGE_SIZE, count);

                return (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.625rem 0.875rem',
                    background: '#FFFFFF',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    marginTop: '0.5rem',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                      Showing <strong style={{ color: '#0F172A' }}>{startItem}–{endItem}</strong> of <strong style={{ color: '#0F172A' }}>{count}</strong> records
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <button
                        type="button"
                        disabled={payoutPage <= 1}
                        onClick={() => setPayoutPage(prev => Math.max(1, prev - 1))}
                        style={{
                          padding: '0.3rem 0.65rem',
                          fontSize: '0.71875rem',
                          fontWeight: 700,
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          background: payoutPage <= 1 ? '#F8FAFC' : '#FFFFFF',
                          color: payoutPage <= 1 ? '#94A3B8' : '#0F172A',
                          cursor: payoutPage <= 1 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        ← Previous
                      </button>
                      <span style={{
                        fontSize: '0.71875rem',
                        fontWeight: 800,
                        color: '#0F52BA',
                        padding: '0.3rem 0.5rem',
                        background: '#EFF6FF',
                        borderRadius: '6px',
                        border: '1px solid #DBEAFE'
                      }}>
                        Page {payoutPage} of {pages}
                      </span>
                      <button
                        type="button"
                        disabled={payoutPage >= pages}
                        onClick={() => setPayoutPage(prev => Math.min(pages, prev + 1))}
                        style={{
                          padding: '0.3rem 0.65rem',
                          fontSize: '0.71875rem',
                          fontWeight: 700,
                          borderRadius: '6px',
                          border: '1px solid #CBD5E1',
                          background: payoutPage >= pages ? '#F8FAFC' : '#FFFFFF',
                          color: payoutPage >= pages ? '#94A3B8' : '#0F172A',
                          cursor: payoutPage >= pages ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                );
              };

              const parsePayoutDetails = (p) => {
                let utr = p.bank_rrn || '';
                let recipient = '';
                const remark = p.admin_remark || '';
                const utrMatch = remark.match(/(?:UTR:?\s*)+([A-Za-z0-9]+)/i) || (p.bank_rrn ? p.bank_rrn.match(/(?:UTR:?\s*)+([A-Za-z0-9]+)/i) : null);
                if (utrMatch) utr = utrMatch[1];
                else if (!utr && remark && !remark.includes('[')) utr = remark.replace('[PENDING_TO_DISBURSE]', '').trim();
                const nameMatch = remark.match(/Name:\s*([^|•\r\n]+)/i);
                if (nameMatch) recipient = nameMatch[1].trim();

                const isCommission = remark.includes('[COMMISSION_PAYOUT]') || p.payout_purpose === 'COMMISSION';
                const matchNote = remark.match(/Note:\s*([^|•\r\n]+)/i);
                const merchantNote = matchNote ? matchNote[1].trim() : (p.merchant_remarks || '');
                
                return {
                  utr: utr || 'IMPS Cleared',
                  recipient: recipient || p.merchant_name,
                  bank: p.bank_name || 'Bank',
                  acc: p.account_number || '',
                  ifsc: p.ifsc_code || 'SBIN0001234',
                  isCommission,
                  purpose: isCommission ? 'COMMISSION' : 'REGULAR',
                  remarks: merchantNote
                };
              };

              const formatPayoutDateTime = (isoStr) => {
                if (!isoStr) return '';
                const d = new Date(isoStr);
                if (isNaN(d.getTime())) return '';
                return d.toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                });
              };

              const channelTotalVol = channelAllItems.reduce((acc, i) => acc + (parseFloat(i.amount) || 0), 0);

              const handleDownloadBankExcel = async () => {
                setIsExportMenuOpen(false);
                const channelAllWithdrawals = dedupeById(filterByChannel(allWithdrawals));
                const channelSlug = selectedChannel === 'all'
                  ? 'All_Channels'
                  : (selectedChannel === 'pinelabs' 
                      ? 'PineLabs' 
                      : (selectedPayswiffVendor === 'rp' ? 'Payswiff_RP' : 'Payswiff_RONAV'));
                const channelName = selectedChannel === 'all'
                  ? 'All Channels'
                  : (selectedChannel === 'pinelabs' 
                      ? 'Pine Labs' 
                      : (selectedPayswiffVendor === 'rp' ? 'Payswiff (RP Tech)' : 'Payswiff (RONAV Tech)'));
                const now = new Date();
                const today = now.toISOString().slice(0, 10);

                // Normal Pending Payouts
                const allPendingT1Withdrawals = channelAllWithdrawals.filter(item => 
                  item._entityType === 'WITHDRAWAL' &&
                  !isItemInstant(item) &&
                  item._subStatus === 'PENDING'
                );

                if (allPendingT1Withdrawals.length === 0) {
                  triggerToast(`No Pending T+1 withdrawals found for ${channelName}.`, 'info');
                  return;
                }

                // If admin selected specific checkboxes, download only those selected items!
                let itemsToBatch = allPendingT1Withdrawals;
                if (selectedPendingIds && selectedPendingIds.size > 0) {
                  const filtered = allPendingT1Withdrawals.filter(w => selectedPendingIds.has(w.id));
                  if (filtered.length > 0) {
                    itemsToBatch = filtered;
                  }
                }

                // Calculate today's batch number
                const submittedToday = channelAllWithdrawals.filter(item => 
                  item._entityType === 'WITHDRAWAL' && 
                  item._subStatus === 'SUBMITTED_TO_BANK'
                );
                const todayBatchIds = new Set();
                submittedToday.forEach(item => {
                  const m = (item.admin_remark || '').match(/\[BATCH:([^\]]+)\]/);
                  if (m) todayBatchIds.add(m[1]);
                });
                const batchSeq = todayBatchIds.size + 1;
                const batchId = `BATCH_${today.replace(/-/g, '')}_${batchSeq}`;
                const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const dayName = daysOfWeek[now.getDay()];
                const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                const batchName = `Today's Batch #${batchSeq} (${dayName} · ${timeStr})`;

                // Name file with channel, batch, and date
                const fileName = `RONAV_${channelSlug}_T1_Batch_${batchSeq}_${today}.csv`;

                // Download 6-column bank CSV/Excel
                const res = downloadBankBatchFile(itemsToBatch, { fileName });
                if (res && res.success) {
                  const downloadedIds = itemsToBatch.map(w => w.id);
                  await markWithdrawalsSubmittedToBank(downloadedIds, {
                    batchId,
                    batchName,
                    submittedAt: now.toISOString()
                  });
                  setSelectedPendingIds(new Set());
                  await fetchAdminData();
                  setPayoutStatusFilter('SUBMITTED_TO_BANK');
                  triggerToast(`📥 Created ${batchName} with ${itemsToBatch.length} payout(s)! Transferred to Submitted tab.`, 'success');
                } else {
                  triggerToast(res?.error || 'Failed to download bank sheet.', 'error');
                }
              };

              const handleRedownloadSingleBatch = (batch) => {
                const channelSlug = selectedChannel === 'all'
                  ? 'All_Channels'
                  : (selectedChannel === 'pinelabs' 
                      ? 'PineLabs' 
                      : (selectedPayswiffVendor === 'rp' ? 'Payswiff_RP' : 'Payswiff_RONAV'));
                const today = new Date().toISOString().slice(0, 10);
                const fileName = `RONAV_${channelSlug}_${batch.batchId || 'Batch'}_${today}.csv`;
                const res = downloadBankBatchFile(batch.items, { fileName });
                if (res && res.success) {
                  triggerToast(`📥 Re-downloaded ${batch.batchName} (${batch.items.length} records).`, 'success');
                } else {
                  triggerToast('Failed to download batch file', 'error');
                }
              };

              const handleCompleteEntireBatch = async (batch) => {
                const confirmed = window.confirm(`Mark all ${batch.items.length} withdrawal(s) in "${batch.batchName}" as Completed & Disbursed?`);
                if (!confirmed) return;
                try {
                  const ids = batch.items.map(item => item.id);
                  const res = await verifyWithdrawalsBatch(ids, 'APPROVE', 'Bank Payout Disbursed', 'CMS-SETTLED');
                  if (res && res.success) {
                    triggerToast(`✓ Completed all ${batch.items.length} payouts in ${batch.batchName}! Moved to Completed tab.`, 'success');
                    await fetchAdminData();
                  } else {
                    triggerToast(res?.message || 'Failed to complete batch', 'error');
                  }
                } catch (err) {
                  console.error('handleCompleteEntireBatch error:', err);
                  triggerToast('Error completing batch', 'error');
                }
              };

              const handleDownloadGstAudit = () => {
                setIsExportMenuOpen(false);

                // Filter swipes and withdrawals by channel and date
                const channelSwipes = filterByDate(filterByChannel(allSwipes));
                const channelWithdrawals = filterByDate(filterByChannel(allWithdrawals));
                const allChannelItems = [...channelSwipes, ...channelWithdrawals];

                // For GST & Tax filing, only completed/approved transactions are exported
                const completedItems = allChannelItems.filter(item => item._subStatus === 'APPROVED');

                const channelName = selectedChannel === 'all'
                  ? 'All Channels'
                  : (selectedChannel === 'pinelabs' 
                      ? 'Pine Labs' 
                      : (selectedPayswiffVendor === 'rp' ? 'Payswiff (RP Tech)' : 'Payswiff (RONAV Tech)'));
                const dateLabel = payoutDateFilter === 'CUSTOM' 
                  ? (payoutFromDate && payoutToDate ? `${payoutFromDate}_to_${payoutToDate}` : (payoutFromDate || payoutCustomDate || 'Custom_Range')) 
                  : payoutDateFilter;

                if (completedItems.length === 0) {
                  triggerToast(`No completed sales found for ${channelName} (${dateLabel}) for GST filing.`, 'info');
                  return;
                }

                const channelSlug = selectedChannel === 'all'
                  ? 'All_Channels'
                  : (selectedChannel === 'pinelabs' 
                      ? 'PineLabs' 
                      : (selectedPayswiffVendor === 'rp' ? 'Payswiff_RP' : 'Payswiff_RONAV'));
                const dateSlug = dateLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
                const today = new Date().toISOString().slice(0, 10);
                const fileName = `RONAV_Completed_Sales_GST_${channelSlug}_${dateSlug}_${today}.csv`;

                const res = downloadGstAuditFile(completedItems, { fileName });
                if (res && res.success) {
                  triggerToast(`📊 Downloaded completed sales (${dateLabel}) with 18% GST for CA filing!`, 'success');
                } else {
                  triggerToast(res?.error || 'Failed to download GST audit file.', 'error');
                }
              };

              const handleRevertSingleToPending = async (itemId) => {
                await revertWithdrawalsToPending([itemId]);
                await fetchAdminData();
                triggerToast('↺ Moved withdrawal back to Pending in database.', 'info');
              };

              // Group submitted withdrawals into Batches with date, day, time, count, amount
              const submittedBatches = (() => {
                const submittedItems = channelWithdrawals.filter(item => 
                  item._entityType === 'WITHDRAWAL' && 
                  item._subStatus === 'SUBMITTED_TO_BANK'
                );

                const batchesMap = new Map();
                submittedItems.forEach(item => {
                  let batchId = 'DEFAULT';
                  const m = (item.admin_remark || '').match(/\[BATCH:([^\]]+)\]/);
                  if (m) {
                    batchId = m[1];
                  } else if (item.submitted_to_bank_at) {
                    batchId = `BATCH_${item.submitted_to_bank_at.slice(0, 16)}`;
                  }

                  let batchName = null;
                  const nm = (item.admin_remark || '').match(/\[BATCH_NAME:([^\]]+)\]/);
                  if (nm) {
                    batchName = nm[1];
                  }

                  const subDate = item.submitted_to_bank_at ? new Date(item.submitted_to_bank_at) : new Date(item.created_at || Date.now());

                  if (!batchesMap.has(batchId)) {
                    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    const dayName = daysOfWeek[subDate.getDay()];
                    const timeStr = subDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                    const dateStr = subDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

                    batchesMap.set(batchId, {
                      batchId,
                      batchName: batchName || `Batch · ${dayName}, ${dateStr} (${timeStr})`,
                      dayName,
                      timeStr,
                      dateStr,
                      submittedAt: subDate,
                      items: []
                    });
                  }
                  batchesMap.get(batchId).items.push(item);
                });

                const arr = Array.from(batchesMap.values()).map(b => {
                  const totalAmount = b.items.reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);
                  return { ...b, totalAmount };
                });

                arr.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
                return arr;
              })();

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  
                  {/* 1. SEARCH, DATE FILTER & ICON-ONLY DOWNLOAD BUTTON (COMPACT SINGLE ROW) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    width: '100%'
                  }}>
                    {/* Search Input */}
                    <div style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      background: '#F1F5F9',
                      borderRadius: '10px',
                      padding: '0 0.65rem',
                      height: '38px',
                      boxSizing: 'border-box'
                    }}>
                      <Search style={{ width: '14px', height: '14px', color: '#94A3B8', flexShrink: 0 }} />
                      <input 
                        type="text"
                        placeholder="Search merchant, UTR, amount..."
                        value={payoutSearchQuery}
                        onChange={(e) => { setPayoutSearchQuery(e.target.value); setPayoutPage(1); }}
                        style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.8125rem', color: '#0F172A' }}
                      />
                      {payoutSearchQuery && (
                        <button type="button" onClick={() => { setPayoutSearchQuery(''); setPayoutPage(1); }} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }}>
                          <X style={{ width: '13px', height: '13px' }} />
                        </button>
                      )}
                    </div>

                    {/* Compact Date Filter Dropdown (Sized exactly for 'All Dates' to give search bar room) */}
                    <div style={{ flex: '0 0 auto', position: 'relative' }}>
                      <div style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        background: '#FFFFFF',
                        borderRadius: '10px',
                        border: '1px solid #CBD5E1',
                        padding: '0 0.4rem',
                        height: '38px',
                        width: '104px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                        boxSizing: 'border-box'
                      }}>
                        <Calendar style={{ width: '13px', height: '13px', color: '#0F52BA', flexShrink: 0, marginRight: '2px' }} />
                        <select
                          value={payoutDateFilter}
                          onChange={(e) => {
                            setPayoutDateFilter(e.target.value);
                            setPayoutPage(1);
                          }}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            outline: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#0F172A',
                            cursor: 'pointer',
                            width: '100%',
                            paddingRight: '14px',
                            appearance: 'none',
                            WebkitAppearance: 'none',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden'
                          }}
                        >
                          <option value="ALL">All Dates</option>
                          <option value="TODAY">Today</option>
                          <option value="YESTERDAY">Yesterday</option>
                          <option value="WEEK">Week (7D)</option>
                          <option value="MONTH">This Month</option>
                          <option value="CUSTOM">Custom Range</option>
                        </select>
                        <ChevronDown style={{ width: '11px', height: '11px', color: '#64748B', position: 'absolute', right: '5px', pointerEvents: 'none' }} />
                      </div>
                    </div>

                    {/* Compact Download Icon-Only Button for GST & Audit Reports (Hidden on Pending tab to avoid duplicate button confusion) */}
                    {payoutStatusFilter !== 'PENDING' && (
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => setIsExportMenuOpen(prev => !prev)}
                          title="Download Completed Sales (For GST & Taxes)"
                          aria-label="Export Financial Reports"
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            border: isExportMenuOpen ? '1.5px solid #0F52BA' : '1px solid #CBD5E1',
                            background: isExportMenuOpen ? '#EFF6FF' : '#FFFFFF',
                            color: '#0F52BA',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <Download style={{ width: '16px', height: '16px' }} />
                        </button>

                        {/* Dropdown Menu */}
                        {isExportMenuOpen && (
                          <>
                            {/* Invisible Click-away Backdrop */}
                            <div 
                              onClick={() => setIsExportMenuOpen(false)}
                              style={{ position: 'fixed', inset: 0, zIndex: 99, cursor: 'default' }}
                            />

                            {/* Menu Card */}
                            <div style={{
                              position: 'absolute',
                              right: 0,
                              top: '44px',
                              zIndex: 100,
                              width: '320px',
                              maxWidth: '90vw',
                              background: '#FFFFFF',
                              borderRadius: '14px',
                              border: '1px solid #CBD5E1',
                              boxShadow: '0 12px 30px -4px rgba(15,23,42,0.18)',
                              padding: '6px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              animation: 'fadeIn 0.12s ease'
                            }}>
                              <div style={{
                                padding: '6px 10px 4px',
                                fontSize: '0.6875rem',
                                fontWeight: 800,
                                color: '#64748B',
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase'
                              }}>
                                Reports & Tax Filing
                              </div>

                              {/* Option: Download Completed Sales (For GST & Taxes) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setIsExportMenuOpen(false);
                                  handleDownloadGstAudit();
                                }}
                                style={{
                                  width: '100%',
                                  textAlign: 'left',
                                  background: '#F8FAFC',
                                  border: '1px solid #E2E8F0',
                                  borderRadius: '10px',
                                  padding: '8px 10px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '10px',
                                  transition: 'all 0.15s ease'
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.background = '#F0FDF4';
                                  e.currentTarget.style.borderColor = '#BBF7D0';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background = '#F8FAFC';
                                  e.currentTarget.style.borderColor = '#E2E8F0';
                                }}
                              >
                                <div style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '8px',
                                  background: '#DCFCE7',
                                  color: '#166534',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  marginTop: '2px'
                                }}>
                                  <FileText style={{ width: '15px', height: '15px' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                    <strong style={{ fontSize: '0.8125rem', color: '#0F172A' }}>
                                      Download Completed Sales
                                    </strong>
                                    <span style={{ fontSize: '0.625rem', fontWeight: 800, background: '#EFF6FF', color: '#1E40AF', padding: '1px 5px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                                      For GST
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.71875rem', color: '#64748B', marginTop: '2px', lineHeight: 1.3 }}>
                                    For your CA / Tax filing. Settled sales for <strong>{payoutDateFilter === 'CUSTOM' ? (payoutCustomDate || 'Selected Date') : payoutDateFilter}</strong> with 18% GST & Bank UTRs.
                                  </div>
                                </div>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Custom Date Range Picker (From - To) */}
                  {payoutDateFilter === 'CUSTOM' && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      borderRadius: '10px',
                      padding: '0.45rem 0.75rem',
                      flexWrap: 'wrap'
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1E40AF' }}>From:</span>
                      <input
                        type="date"
                        value={payoutFromDate}
                        onChange={(e) => {
                          setPayoutFromDate(e.target.value);
                          setPayoutPage(1);
                        }}
                        style={{
                          border: '1px solid #93C5FD',
                          borderRadius: '6px',
                          padding: '0.2rem 0.45rem',
                          fontSize: '0.75rem',
                          color: '#0F172A',
                          background: '#FFFFFF',
                          outline: 'none'
                        }}
                      />
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1E40AF' }}>To:</span>
                      <input
                        type="date"
                        value={payoutToDate}
                        onChange={(e) => {
                          setPayoutToDate(e.target.value);
                          setPayoutPage(1);
                        }}
                        style={{
                          border: '1px solid #93C5FD',
                          borderRadius: '6px',
                          padding: '0.2rem 0.45rem',
                          fontSize: '0.75rem',
                          color: '#0F172A',
                          background: '#FFFFFF',
                          outline: 'none'
                        }}
                      />
                      {(payoutFromDate || payoutToDate || payoutCustomDate) && (
                        <button
                          type="button"
                          onClick={() => { 
                            setPayoutFromDate(''); 
                            setPayoutToDate(''); 
                            setPayoutCustomDate(''); 
                            setPayoutDateFilter('ALL'); 
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#DC2626',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            marginLeft: 'auto'
                          }}
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  )}

                  {/* 2. CATEGORY SELECTOR (SWIPES / RECORD SALE vs WITHDRAW) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    background: '#FFFFFF',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    padding: '3px',
                    gap: '4px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                  }}>
                    {/* All Category */}
                    <button
                      type="button"
                      onClick={() => {
                        setPayoutCategoryFilter('ALL');
                        setPayoutPage(1);
                      }}
                      style={{
                        background: payoutCategoryFilter === 'ALL' ? '#0F52BA' : 'transparent',
                        color: payoutCategoryFilter === 'ALL' ? '#FFFFFF' : '#334155',
                        border: 'none',
                        borderRadius: '7px',
                        padding: '0.42rem 0.35rem',
                        fontSize: '0.8125rem',
                        fontWeight: payoutCategoryFilter === 'ALL' ? 700 : 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>All</span>
                    </button>

                    {/* Swipes (Record Sale) */}
                    <button
                      type="button"
                      onClick={() => {
                        setPayoutCategoryFilter(payoutCategoryFilter === 'SWIPES' ? 'ALL' : 'SWIPES');
                        setPayoutPage(1);
                      }}
                      style={{
                        background: payoutCategoryFilter === 'SWIPES' ? '#0F52BA' : 'transparent',
                        color: payoutCategoryFilter === 'SWIPES' ? '#FFFFFF' : '#334155',
                        border: 'none',
                        borderRadius: '7px',
                        padding: '0.42rem 0.5rem',
                        fontSize: '0.8125rem',
                        fontWeight: payoutCategoryFilter === 'SWIPES' ? 700 : 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <CreditCard style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                      <span>Swipes</span>
                    </button>

                    {/* Withdraw (Payouts) */}
                    <button
                      type="button"
                      onClick={() => {
                        setPayoutCategoryFilter(payoutCategoryFilter === 'WITHDRAWALS' ? 'ALL' : 'WITHDRAWALS');
                        setPayoutPage(1);
                      }}
                      style={{
                        background: payoutCategoryFilter === 'WITHDRAWALS' ? '#0F52BA' : 'transparent',
                        color: payoutCategoryFilter === 'WITHDRAWALS' ? '#FFFFFF' : '#334155',
                        border: 'none',
                        borderRadius: '7px',
                        padding: '0.42rem 0.5rem',
                        fontSize: '0.8125rem',
                        fontWeight: payoutCategoryFilter === 'WITHDRAWALS' ? 700 : 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Landmark style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                      <span>Withdraw</span>
                    </button>
                  </div>

                  {/* 3. SPEED PILLS ROW (CLEAN & FIXED) */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    {/* Instant Pill */}
                    <button
                      type="button"
                      onClick={() => {
                        setPayoutSettlementFilter(payoutSettlementFilter === 'INSTANT' ? 'ALL' : 'INSTANT');
                        setPayoutPage(1);
                      }}
                      style={{
                        flex: 1,
                        height: '38px',
                        padding: '0 0.85rem',
                        borderRadius: '9999px',
                        background: payoutSettlementFilter === 'INSTANT' ? '#2563EB' : '#FFFFFF',
                        color: payoutSettlementFilter === 'INSTANT' ? '#FFFFFF' : '#1E293B',
                        border: payoutSettlementFilter === 'INSTANT' ? '1.5px solid #2563EB' : '1px solid #CBD5E1',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: payoutSettlementFilter === 'INSTANT' ? '0 2px 6px rgba(37,99,235,0.3)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Zap style={{ width: '13px', height: '13px', fill: payoutSettlementFilter === 'INSTANT' ? '#FFFFFF' : 'none' }} />
                      <span>Instant</span>
                    </button>

                    {/* T+1 Pill */}
                    <button
                      type="button"
                      onClick={() => {
                        setPayoutSettlementFilter(payoutSettlementFilter === 'T1' ? 'ALL' : 'T1');
                        setPayoutPage(1);
                      }}
                      style={{
                        flex: 1,
                        height: '38px',
                        padding: '0 0.85rem',
                        borderRadius: '9999px',
                        background: payoutSettlementFilter === 'T1' ? '#2563EB' : '#FFFFFF',
                        color: payoutSettlementFilter === 'T1' ? '#FFFFFF' : '#1E293B',
                        border: payoutSettlementFilter === 'T1' ? '1.5px solid #2563EB' : '1px solid #CBD5E1',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: payoutSettlementFilter === 'T1' ? '0 2px 6px rgba(37,99,235,0.3)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Calendar style={{ width: '13px', height: '13px' }} />
                      <span>T+1</span>
                    </button>

                    {/* All Pill */}
                    <button
                      type="button"
                      onClick={() => {
                        setPayoutSettlementFilter('ALL');
                        setPayoutPage(1);
                      }}
                      style={{
                        flex: 1,
                        height: '38px',
                        padding: '0 0.85rem',
                        borderRadius: '9999px',
                        background: payoutSettlementFilter === 'ALL' ? '#FFFFFF' : '#FFFFFF',
                        color: '#1E293B',
                        border: payoutSettlementFilter === 'ALL' ? '1.5px solid #0F172A' : '1px solid #CBD5E1',
                        fontSize: '0.8125rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: payoutSettlementFilter === 'ALL' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>All</span>
                    </button>
                  </div>

                  {/* 3. STATUS SEGMENTED TRACK (PENDING, SUBMITTED TO BANK, COMPLETED, INVALID) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    background: '#ECEEF0',
                    padding: '3px',
                    borderRadius: '9999px',
                    gap: '3px'
                  }}>
                    {[
                      { 
                        id: 'PENDING', 
                        label: statusCounts.pending > 0 
                          ? `Pending (${statusCounts.pending > 99 ? '99+' : statusCounts.pending})` 
                          : 'Pending' 
                      },
                      {
                        id: 'SUBMITTED_TO_BANK',
                        label: statusCounts.submitted > 0
                          ? `Submitted (${statusCounts.submitted > 99 ? '99+' : statusCounts.submitted})`
                          : 'Submitted'
                      },
                      { id: 'APPROVED', label: 'Completed' },
                      { id: 'INVALID', label: 'Invalid' }
                    ].map(st => {
                      const isActive = payoutStatusFilter === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => {
                            setPayoutStatusFilter(payoutStatusFilter === st.id ? 'ALL' : st.id);
                            setPayoutPage(1);
                          }}
                          style={{
                            background: isActive ? '#FFFFFF' : 'transparent',
                            color: '#0F172A',
                            border: 'none',
                            borderRadius: '9999px',
                            padding: '0.45rem 0.25rem',
                            fontSize: '0.72rem',
                            fontWeight: isActive ? 700 : 600,
                            cursor: 'pointer',
                            textAlign: 'center',
                            boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            transition: 'all 0.15s ease',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {st.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* PENDING BATCH SELECTION & DOWNLOAD TOOLBAR */}
                  {payoutStatusFilter === 'PENDING' && (
                    (() => {
                      const pendingWithdrawals = candidateList.filter(item => 
                        item._entityType === 'WITHDRAWAL' && item._subStatus === 'PENDING'
                      );
                      if (pendingWithdrawals.length === 0) return null;

                      const isAllSelected = selectedPendingIds.size > 0 && selectedPendingIds.size === pendingWithdrawals.length;
                      const selectedList = pendingWithdrawals.filter(w => selectedPendingIds.has(w.id));
                      const selectedTotal = selectedList.reduce((acc, w) => acc + (parseFloat(w.amount) || 0), 0);
                      const allPendingTotal = pendingWithdrawals.reduce((acc, w) => acc + (parseFloat(w.amount) || 0), 0);

                      const handleToggleSelectAll = () => {
                        if (isAllSelected) {
                          setSelectedPendingIds(new Set());
                        } else {
                          const allIds = new Set(pendingWithdrawals.map(w => w.id));
                          setSelectedPendingIds(allIds);
                        }
                      };

                      return (
                        <div style={{
                          background: '#F8FAFC',
                          border: '1.5px solid #CBD5E1',
                          borderRadius: '12px',
                          padding: '0.65rem 0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          flexWrap: 'wrap'
                        }}>
                          {/* Left: Select All Checkbox & Count */}
                          <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            cursor: 'pointer',
                            userSelect: 'none'
                          }}>
                            <input
                              type="checkbox"
                              checked={isAllSelected}
                              onChange={handleToggleSelectAll}
                              style={{
                                width: '17px',
                                height: '17px',
                                accentColor: '#0F52BA',
                                cursor: 'pointer'
                              }}
                            />
                            <div>
                              <strong style={{ fontSize: '0.8125rem', color: '#0F172A', display: 'block' }}>
                                {selectedPendingIds.size > 0 
                                  ? `${selectedPendingIds.size} of ${pendingWithdrawals.length} Selected (₹${selectedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`
                                  : `Select All (${pendingWithdrawals.length} Pending · ₹${allPendingTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`}
                              </strong>
                              <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                                {selectedPendingIds.size > 0 
                                  ? 'Click Download Bank Sheet to batch only selected payouts.'
                                  : 'Select all or choose individual payouts to download into bank batch.'}
                              </span>
                            </div>
                          </label>

                          {/* Right: Download Bank Sheet Button */}
                          <button
                            type="button"
                            onClick={handleDownloadBankExcel}
                            style={{
                              background: '#0F52BA',
                              color: '#FFFFFF',
                              border: 'none',
                              padding: '7px 14px',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 1px 3px rgba(15,82,186,0.25)',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <Download style={{ width: '13px', height: '13px' }} />
                            <span>
                              {selectedPendingIds.size > 0 
                                ? `Download Selected Batch (${selectedPendingIds.size})`
                                : `Download Bank Sheet (${pendingWithdrawals.length})`}
                            </span>
                          </button>
                        </div>
                      );
                    })()
                  )}

                  {/* 4. TRANSACTION LEDGER / BATCH CARDS */}
                  {payoutStatusFilter === 'SUBMITTED_TO_BANK' ? (
                    submittedBatches.length === 0 ? (
                      <div style={{
                        padding: '2.5rem 1.25rem',
                        textAlign: 'center',
                        background: '#FFFFFF',
                        borderRadius: '16px',
                        border: '1px solid #E2E8F0',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.625rem'
                      }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                          <Clock style={{ width: '20px', height: '20px' }} />
                        </div>
                        <div>
                          <strong style={{ fontSize: '0.9375rem', color: '#0F172A', display: 'block' }}>
                            No batches currently in Submitted tab
                          </strong>
                          <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                            All previous batches have been completed and moved to the Completed tab!
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPayoutStatusFilter('PENDING')}
                          style={{
                            marginTop: '0.35rem',
                            padding: '0.4rem 1rem',
                            borderRadius: '9999px',
                            background: '#0F52BA',
                            color: '#FFFFFF',
                            border: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Go to Pending Tab
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                        {submittedBatches.map((batch, bIdx) => {
                          const isBatchExpanded = expandedBatchIds[batch.batchId] !== false;
                          const toggleBatch = () => {
                            setExpandedBatchIds(prev => ({
                              ...prev,
                              [batch.batchId]: !isBatchExpanded
                            }));
                          };

                          return (
                            <div 
                              key={batch.batchId || bIdx}
                              style={{
                                background: '#FFFFFF',
                                borderRadius: '16px',
                                border: '1.5px solid #CBD5E1',
                                boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
                                overflow: 'hidden'
                              }}
                            >
                              {/* BATCH CARD HEADER */}
                              <div 
                                style={{
                                  background: '#F8FAFC',
                                  borderBottom: isBatchExpanded ? '1px solid #E2E8F0' : 'none',
                                  padding: '0.85rem 1rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '0.75rem',
                                  flexWrap: 'wrap'
                                }}
                              >
                                {/* Left: Batch Title & Metadata */}
                                <div 
                                  onClick={toggleBatch}
                                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
                                >
                                  <div style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '10px',
                                    background: '#EFF6FF',
                                    border: '1px solid #BFDBFE',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#1D4ED8',
                                    flexShrink: 0
                                  }}>
                                    <FileText style={{ width: '18px', height: '18px' }} />
                                  </div>
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <strong style={{ fontSize: '0.9375rem', color: '#0F172A' }}>
                                        {batch.batchName}
                                      </strong>
                                      <span style={{
                                        background: '#DBEAFE',
                                        color: '#1E40AF',
                                        fontSize: '0.6875rem',
                                        fontWeight: 700,
                                        padding: '2px 7px',
                                        borderRadius: '9999px'
                                      }}>
                                        📤 In Bank Processing
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span>📅 {batch.dayName ? `${batch.dayName}, ` : ''}{formatPayoutDateTime(batch.submittedAt)}</span>
                                      <span>•</span>
                                      <strong>{batch.items.length} Withdrawals</strong>
                                      <span>•</span>
                                      <strong style={{ color: '#0F172A' }}>₹{batch.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                    </div>
                                  </div>
                                </div>

                                {/* Right: Actions (Re-download & Mark All Complete) */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {/* Re-download Sheet Button */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRedownloadSingleBatch(batch);
                                    }}
                                    title="Re-download this batch bank sheet CSV"
                                    style={{
                                      background: '#FFFFFF',
                                      color: '#0F52BA',
                                      border: '1px solid #BFDBFE',
                                      padding: '6px 11px',
                                      borderRadius: '8px',
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                                    }}
                                  >
                                    <Download style={{ width: '13px', height: '13px' }} />
                                    <span>Re-Download Sheet</span>
                                  </button>

                                  {/* Chevron Toggle */}
                                  <button
                                    type="button"
                                    onClick={toggleBatch}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      padding: '4px',
                                      cursor: 'pointer',
                                      color: '#64748B'
                                    }}
                                  >
                                    <ChevronDown style={{
                                      width: '16px',
                                      height: '16px',
                                      transform: isBatchExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                      transition: 'transform 0.15s ease'
                                    }} />
                                  </button>
                                </div>
                              </div>

                              {/* BATCH ITEMS LIST (ONE-BY-ONE VERIFICATION) */}
                              {isBatchExpanded && (
                                <div>
                                  {batch.items.map((item, idx) => {
                                    const isItemExpanded = expandedPayoutId === `batch_${batch.batchId}_item_${item.id}`;
                                    const details = parsePayoutDetails(item);
                                    const maskedAcc = item.account_number 
                                      ? `••••${item.account_number.slice(-4)}`
                                      : '••••';

                                    return (
                                      <div key={item.id} style={{ borderBottom: idx < batch.items.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                                        {/* ITEM ROW */}
                                        <div
                                          onClick={() => setExpandedPayoutId(prev => prev === `batch_${batch.batchId}_item_${item.id}` ? null : `batch_${batch.batchId}_item_${item.id}`)}
                                          style={{
                                            padding: '0.85rem 1rem',
                                            cursor: 'pointer',
                                            background: isItemExpanded ? '#F8FAFC' : '#FFFFFF',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '0.75rem',
                                            flexWrap: 'wrap'
                                          }}
                                        >
                                          {/* Left: Merchant & Bank Details */}
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{
                                              width: '30px',
                                              height: '30px',
                                              borderRadius: '8px',
                                              background: '#F1F5F9',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              color: '#64748B',
                                              fontSize: '0.75rem',
                                              fontWeight: 700
                                            }}>
                                              {idx + 1}
                                            </div>
                                            <div>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                <strong style={{ fontSize: '0.875rem', color: '#0F172A' }}>
                                                  {item.merchant_name || details.recipient || 'Merchant'}
                                                </strong>
                                                <span style={{ fontSize: '0.6875rem', color: '#64748B', fontFamily: 'monospace' }}>
                                                  ({item.merchant_id})
                                                </span>
                                                <span style={{
                                                  display: 'inline-flex',
                                                  alignItems: 'center',
                                                  gap: '3px',
                                                  fontSize: '0.65rem',
                                                  fontWeight: 800,
                                                  padding: '1px 6px',
                                                  borderRadius: '4px',
                                                  background: '#EFF6FF',
                                                  color: '#1D4ED8',
                                                  border: '1px solid #BFDBFE',
                                                  letterSpacing: '0.02em',
                                                  textTransform: 'uppercase'
                                                }}>
                                                  🏦 Withdrawal
                                                </span>
                                              </div>
                                              <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '1px' }}>
                                                <span>{item.bank_name || 'Bank'}</span>
                                                <span style={{ margin: '0 4px' }}>•</span>
                                                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{maskedAcc}</span>
                                                <span style={{ margin: '0 4px' }}>•</span>
                                                <span style={{ fontFamily: 'monospace' }}>IFSC: {item.ifsc_code || 'N/A'}</span>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Right: Amount & 3 Direct Buttons */}
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <strong style={{ fontSize: '1rem', color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                                              ₹{parseFloat(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </strong>

                                            {/* 3 ONE-BY-ONE ACTIONS */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }} onClick={e => e.stopPropagation()}>
                                              {/* 1. Mark Complete -> Opens Modal with Details & UTR input */}
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setDisbursingPayout({
                                                    payout: item,
                                                    utr: '',
                                                    remark: '',
                                                    actionType: 'APPROVE',
                                                    isSubmitting: false
                                                  });
                                                }}
                                                title="Enter Bank UTR and complete this payout"
                                                style={{
                                                  background: '#059669',
                                                  color: '#FFFFFF',
                                                  border: 'none',
                                                  padding: '5px 9px',
                                                  borderRadius: '6px',
                                                  fontSize: '0.72rem',
                                                  fontWeight: 700,
                                                  cursor: 'pointer',
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: '3px'
                                                }}
                                              >
                                                ✓ Complete
                                              </button>

                                              {/* 2. Keep in Pending / Move to Pending */}
                                              <button
                                                type="button"
                                                onClick={() => handleRevertSingleToPending(item.id)}
                                                title="Bank issue? Move this single withdrawal back to Pending tab"
                                                style={{
                                                  background: '#FFFBEB',
                                                  color: '#B45309',
                                                  border: '1px solid #FDE68A',
                                                  padding: '5px 8px',
                                                  borderRadius: '6px',
                                                  fontSize: '0.72rem',
                                                  fontWeight: 700,
                                                  cursor: 'pointer'
                                                }}
                                              >
                                                ⏳ Move to Pending
                                              </button>

                                              {/* 3. Reject */}
                                              <button
                                                type="button"
                                                onClick={() => handlePayoutAction(item.id, 'REJECT', item.merchant_name, item.amount, '', 'Bank Transfer Failed')}
                                                title="Reject payout and refund wallet balance"
                                                style={{
                                                  background: '#FEF2F2',
                                                  color: '#DC2626',
                                                  border: '1px solid #FECACA',
                                                  padding: '5px 8px',
                                                  borderRadius: '6px',
                                                  fontSize: '0.72rem',
                                                  fontWeight: 700,
                                                  cursor: 'pointer'
                                                }}
                                              >
                                                ✕ Reject
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )
                  ) : activeList.length === 0 ? (
                    <div style={{
                      padding: '2.5rem 1.25rem',
                      textAlign: 'center',
                      background: '#FFFFFF',
                      borderRadius: '16px',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.625rem'
                    }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
                        <Search style={{ width: '18px', height: '18px' }} />
                      </div>
                      <div>
                        <strong style={{ fontSize: '0.9375rem', color: '#0F172A', display: 'block' }}>
                          No transactions found
                        </strong>
                        <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                          No records match the current filter selection under {selectedChannel}.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPayoutSearchQuery('');
                          setPayoutCategoryFilter('ALL');
                          setPayoutSettlementFilter('ALL');
                          setPayoutStatusFilter('ALL');
                          setPayoutDateFilter('ALL');
                          setPayoutCustomDate('');
                          setPayoutPage(1);
                        }}
                        style={{
                          marginTop: '0.35rem',
                          padding: '0.4rem 1rem',
                          borderRadius: '9999px',
                          background: '#0F172A',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Reset All Filters
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      background: '#FFFFFF',
                      borderRadius: '16px',
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 1px 3px rgba(15,23,42,0.03)',
                      overflow: 'hidden'
                    }}>
                      {currentItems.map((item, idx) => {
                        const isSwipe = item._entityType === 'SWIPE';
                        const isPending = item._subStatus === 'PENDING';
                        const isApproved = item._subStatus === 'APPROVED';
                        const cardId = isSwipe ? `swipe_${item.id}` : `payout_${item.id}`;
                        const isExpanded = expandedPayoutId === cardId;
                        const displayDate = formatPayoutDateTime(item.created_at || item.verified_at);

                        let merchantTitle = '';
                        let amountStr = '';
                        let rrnOrUtr = '';
                        let channelTag = '';
                        let details = {};

                        if (isSwipe) {
                          amountStr = `+₹${parseFloat(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                          merchantTitle = item.merchant_name || 'Merchant';
                          rrnOrUtr = item.rrn_number || item.ref_number || item.id || 'N/A';
                          channelTag = item.pos_vendor 
                            ? (item.pos_vendor.toLowerCase().includes('rp') ? 'Payswiff (RP Tech)' : 'Payswiff (Ronav Tech)')
                            : (item.pos_provider || 'POS');
                        } else {
                          // Withdrawal
                          details = parsePayoutDetails(item);
                          amountStr = `-₹${parseFloat(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                          merchantTitle = item.merchant_name || details.recipient || 'Balaji Super Bazaar';
                          rrnOrUtr = details.utr && details.utr !== 'IMPS Cleared' ? details.utr : (item.bank_rrn || item.id);
                          channelTag = item.bank_name 
                            ? `${item.bank_name}${item.account_number ? ` ••${item.account_number.slice(-4)}` : ''}` 
                            : 'Bank Transfer';
                        }

                        const speedLabel = isItemInstant(item) ? 'Instant' : 'T+1';

                        return (
                          <div key={cardId}>
                            {/* COLLAPSED CARD FACE: CLEAN 3-ROW LAYOUT (ZERO OVERLAP RISK) */}
                            <div
                              onClick={() => setExpandedPayoutId(prev => prev === cardId ? null : cardId)}
                              style={{
                                padding: '0.9rem 1rem',
                                cursor: 'pointer',
                                background: isExpanded ? '#F8FAFC' : '#FFFFFF',
                                transition: 'background 0.12s ease'
                              }}
                            >
                              {/* ROW 1: Merchant Name & Type Badge (Left) | Tabular Amount (Right) */}
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.75rem'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: '6px 8px',
                                  fontSize: '0.9375rem',
                                  fontWeight: 700,
                                  color: '#0F172A',
                                  letterSpacing: '-0.01em',
                                  lineHeight: 1.3
                                }}>
                                  {!isSwipe && isPending && (
                                    <input
                                      type="checkbox"
                                      checked={selectedPendingIds.has(item.id)}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        setSelectedPendingIds(prev => {
                                          const next = new Set(prev);
                                          if (next.has(item.id)) next.delete(item.id);
                                          else next.add(item.id);
                                          return next;
                                        });
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        width: '17px',
                                        height: '17px',
                                        accentColor: '#0F52BA',
                                        cursor: 'pointer'
                                      }}
                                    />
                                  )}
                                  <span>{merchantTitle}</span>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontSize: '0.6875rem',
                                    fontWeight: 800,
                                    padding: '2px 7px',
                                    borderRadius: '5px',
                                    background: isSwipe ? '#ECFDF5' : (details.isCommission ? '#F5F3FF' : '#EFF6FF'),
                                    color: isSwipe ? '#047857' : (details.isCommission ? '#7C3AED' : '#1D4ED8'),
                                    border: isSwipe ? '1px solid #A7F3D0' : (details.isCommission ? '1px solid #DDD6FE' : '1px solid #BFDBFE'),
                                    letterSpacing: '0.02em',
                                    textTransform: 'uppercase',
                                    whiteSpace: 'nowrap',
                                    lineHeight: 1.2
                                  }}>
                                    {isSwipe ? '💳 Swipe' : (details.isCommission ? '💎 Commission Payout' : '🏦 Regular Settlement')}
                                  </span>
                                </div>

                                <div style={{
                                  fontSize: '1rem',
                                  fontWeight: 800,
                                  color: isSwipe ? '#059669' : '#0F172A',
                                  fontVariantNumeric: 'tabular-nums',
                                  letterSpacing: '-0.02em',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {amountStr}
                                </div>
                              </div>

                              {/* ROW 2: Clear Date on Left | Status Pill & Chevron on Right (No colliding text) */}
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '0.5rem',
                                marginTop: '0.35rem'
                              }}>
                                <div style={{
                                  fontSize: '0.75rem',
                                  color: '#64748B',
                                  fontWeight: 500,
                                  whiteSpace: 'nowrap'
                                }}>
                                  {displayDate}
                                </div>

                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  flexShrink: 0,
                                  whiteSpace: 'nowrap'
                                }}>
                                  {isPending ? (
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#D97706' }}>
                                      ● Pending · {speedLabel}
                                    </span>
                                  ) : item._subStatus === 'SUBMITTED_TO_BANK' ? (
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563EB', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                      📤 Submitted to Bank · {speedLabel}
                                    </span>
                                  ) : isApproved ? (
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669' }}>
                                      ✓ Settled · {speedLabel}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#DC2626' }}>
                                      ✕ Invalid
                                    </span>
                                  )}
                                  <ChevronDown style={{
                                    width: '12px',
                                    height: '12px',
                                    color: '#94A3B8',
                                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.15s ease'
                                  }} />
                                </div>
                              </div>

                              {/* ROW 3: Dedicated UTR identity chip with 1-click copy (Uncramped, full width breathing room) */}
                              <div style={{
                                marginTop: '0.45rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(rrnOrUtr, `utr_${item.id}`);
                                  }}
                                  title="Click to copy UTR number"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontFamily: 'monospace',
                                    fontWeight: 700,
                                    color: '#0F52BA',
                                    background: '#EFF6FF',
                                    padding: '3px 8px',
                                    borderRadius: '5px',
                                    border: '1px solid #BFDBFE',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    letterSpacing: '0.02em',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  <span>UTR: {rrnOrUtr}</span>
                                  {copiedId[`utr_${item.id}`] ? (
                                    <span style={{ fontSize: '0.65625rem', color: '#059669', fontWeight: 800 }}>✓ Copied</span>
                                  ) : (
                                    <Copy style={{ width: '11px', height: '11px', color: '#3B82F6', flexShrink: 0 }} />
                                  )}
                                </button>

                                {selectedChannel === 'qr' && (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    color: '#7C3AED',
                                    background: '#F5F3FF',
                                    border: '1px solid #DDD6FE',
                                    padding: '3px 8px',
                                    borderRadius: '5px'
                                  }}>
                                    <span style={{ color: '#6D28D9' }}>Payee:</span>
                                    <strong>{companyQrPayeeName || 'RONAV TECHNOLOGIES'}</strong>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* EXPANDED DETAIL TRAY: APPLE HIG INSET-GROUPED LIST (ZERO CRAMMED BOXES) */}
                            {isExpanded && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  padding: '0.85rem 1rem',
                                  background: '#F8FAFC',
                                  borderTop: '1px solid #E2E8F0',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.625rem'
                                }}
                              >
                                {isSwipe ? (
                                  /* SWIPE (RECORD SALE) INSET DETAILS */
                                  <div style={{
                                    background: '#FFFFFF',
                                    borderRadius: '12px',
                                    border: '1px solid #E2E8F0',
                                    overflow: 'hidden',
                                    boxShadow: '0 1px 2px rgba(15,23,42,0.03)'
                                  }}>
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      padding: '0.65rem 0.85rem',
                                      borderBottom: '1px solid #F1F5F9',
                                      fontSize: '0.78125rem'
                                    }}>
                                      <span style={{ color: '#64748B', fontWeight: 600 }}>Merchant</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <strong style={{ color: '#0F172A', fontSize: '0.8125rem' }}>
                                          {item.merchant_name}
                                        </strong>
                                        <span style={{ fontFamily: 'monospace', color: '#64748B', fontSize: '0.71875rem' }}>
                                          ({item.merchant_id})
                                        </span>
                                      </div>
                                    </div>

                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      padding: '0.65rem 0.85rem',
                                      borderBottom: '1px solid #F1F5F9',
                                      fontSize: '0.78125rem'
                                    }}>
                                      <span style={{ color: '#64748B', fontWeight: 600 }}>Customer</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <strong style={{ color: '#0F172A', fontSize: '0.8125rem' }}>
                                          {item.customer_name || 'Walk-in Customer'}
                                        </strong>
                                        {item.customer_mobile && (
                                          <>
                                            <span style={{ color: '#CBD5E1' }}>•</span>
                                            <a href={`tel:${item.customer_mobile}`} style={{ color: '#0F52BA', textDecoration: 'none', fontWeight: 700 }}>
                                              {item.customer_mobile}
                                            </a>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      padding: '0.65rem 0.85rem',
                                      borderBottom: '1px solid #F1F5F9',
                                      fontSize: '0.78125rem'
                                    }}>
                                      <span style={{ color: '#64748B', fontWeight: 600 }}>Slip UTR</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0F172A', fontSize: '0.84375rem' }}>
                                          {rrnOrUtr}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => copyToClipboard(rrnOrUtr, `slip_${item.id}`)}
                                          style={{
                                            background: '#EFF6FF',
                                            border: '1px solid #BFDBFE',
                                            padding: '2px 7px',
                                            borderRadius: '4px',
                                            fontSize: '0.6875rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            color: '#0F52BA'
                                          }}
                                        >
                                          {copiedId[`slip_${item.id}`] ? '✓' : 'Copy'}
                                        </button>
                                      </div>
                                    </div>

                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      padding: '0.65rem 0.85rem',
                                      borderBottom: '1px solid #F1F5F9',
                                      fontSize: '0.78125rem'
                                    }}>
                                      <span style={{ color: '#64748B', fontWeight: 600 }}>POS Channel</span>
                                      <span style={{ color: '#0F172A', fontWeight: 700 }}>{channelTag}</span>
                                    </div>

                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      padding: '0.65rem 0.85rem',
                                      borderBottom: '1px solid #F1F5F9',
                                      fontSize: '0.78125rem'
                                    }}>
                                      <span style={{ color: '#64748B', fontWeight: 600 }}>Settlement Mode</span>
                                      <span style={{ color: speedLabel === 'Instant' ? '#0F52BA' : '#475569', fontWeight: 700 }}>
                                        {speedLabel === 'Instant' ? '⚡ Instant Clearance' : '📅 T+1 Standard Batch'}
                                      </span>
                                    </div>

                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      padding: '0.65rem 0.85rem',
                                      fontSize: '0.78125rem'
                                    }}>
                                      <span style={{ color: '#64748B', fontWeight: 600 }}>Submitted At</span>
                                      <span style={{ color: '#0F172A', fontWeight: 600 }}>{displayDate}</span>
                                    </div>
                                  </div>
                                ) : (
                                  /* WITHDRAWAL (BANK PAYOUT) INSET DETAILS */
                                  <div style={{
                                    background: '#FFFFFF',
                                    borderRadius: '12px',
                                    border: '1px solid #E2E8F0',
                                    overflow: 'hidden',
                                    boxShadow: '0 1px 2px rgba(15,23,42,0.03)'
                                  }}>
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      padding: '0.65rem 0.85rem',
                                      borderBottom: '1px solid #F1F5F9',
                                      fontSize: '0.78125rem'
                                    }}>
                                      <span style={{ color: '#64748B', fontWeight: 600 }}>Merchant</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <strong style={{ color: '#0F172A', fontSize: '0.8125rem' }}>
                                          {item.merchant_name || details.recipient}
                                        </strong>
                                        <span style={{ fontFamily: 'monospace', color: '#64748B', fontSize: '0.71875rem' }}>
                                          ({item.merchant_id})
                                        </span>
                                      </div>
                                    </div>

                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      padding: '0.65rem 0.85rem',
                                      borderBottom: '1px solid #F1F5F9',
                                      fontSize: '0.78125rem'
                                    }}>
                                      <span style={{ color: '#64748B', fontWeight: 600 }}>Customer / Beneficiary</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <strong style={{ color: '#0F172A', fontSize: '0.8125rem' }}>
                                          {item.customer_name || item.holder_name || details.recipient || item.merchant_name}
                                        </strong>
                                        {(item.customer_mobile || item.merchant_mobile) && (
                                          <>
                                            <span style={{ color: '#CBD5E1' }}>•</span>
                                            <a href={`tel:${item.customer_mobile || item.merchant_mobile}`} style={{ color: '#0F52BA', textDecoration: 'none', fontWeight: 700 }}>
                                              {item.customer_mobile || item.merchant_mobile}
                                            </a>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      padding: '0.65rem 0.85rem',
                                      borderBottom: '1px solid #F1F5F9',
                                      fontSize: '0.78125rem'
                                    }}>
                                      <span style={{ color: '#64748B', fontWeight: 600 }}>Beneficiary Bank</span>
                                      <strong style={{ color: '#0F172A', fontSize: '0.8125rem' }}>
                                        {item.bank_name || details.bank || 'Bank'}
                                      </strong>
                                    </div>

                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      padding: '0.65rem 0.85rem',
                                      borderBottom: '1px solid #F1F5F9',
                                      fontSize: '0.78125rem'
                                    }}>
                                      <span style={{ color: '#64748B', fontWeight: 600 }}>Account Number</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0F172A', fontSize: '0.84375rem' }}>
                                          {item.account_number || details.acc || '—'}
                                        </span>
                                        {(item.account_number || details.acc) && (
                                          <button
                                            type="button"
                                            onClick={() => copyToClipboard(item.account_number || details.acc, `acc_${item.id}`)}
                                            style={{
                                              background: '#EFF6FF',
                                              border: '1px solid #BFDBFE',
                                              padding: '2px 7px',
                                              borderRadius: '4px',
                                              fontSize: '0.6875rem',
                                              fontWeight: 700,
                                              cursor: 'pointer',
                                              color: '#0F52BA'
                                            }}
                                          >
                                            {copiedId[`acc_${item.id}`] ? '✓' : 'Copy'}
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      padding: '0.65rem 0.85rem',
                                      borderBottom: '1px solid #F1F5F9',
                                      fontSize: '0.78125rem'
                                    }}>
                                      <span style={{ color: '#64748B', fontWeight: 600 }}>Bank IFSC Code</span>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <strong style={{ fontFamily: 'monospace', color: '#0F172A', fontSize: '0.84375rem' }}>
                                          {item.ifsc_code || details.ifsc || 'SBIN0001234'}
                                        </strong>
                                        <button
                                          type="button"
                                          onClick={() => copyToClipboard(item.ifsc_code || details.ifsc || 'SBIN0001234', `ifsc_${item.id}`)}
                                          style={{
                                            background: '#EFF6FF',
                                            border: '1px solid #BFDBFE',
                                            padding: '2px 7px',
                                            borderRadius: '4px',
                                            fontSize: '0.6875rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            color: '#0F52BA'
                                          }}
                                        >
                                          {copiedId[`ifsc_${item.id}`] ? '✓' : 'Copy'}
                                        </button>
                                      </div>
                                    </div>

                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      padding: '0.65rem 0.85rem',
                                      borderBottom: '1px solid #F1F5F9',
                                      fontSize: '0.78125rem'
                                    }}>
                                      <span style={{ color: '#64748B', fontWeight: 600 }}>Disbursal Mode</span>
                                      <span style={{ color: speedLabel === 'Instant' ? '#0F52BA' : '#475569', fontWeight: 700 }}>
                                        {speedLabel === 'Instant' ? '⚡ Instant IMPS' : '📅 T+1 NEFT Batch'}
                                      </span>
                                    </div>

                                    <div style={{
                                       display: 'flex',
                                       justifyContent: 'space-between',
                                       alignItems: 'center',
                                       padding: '0.65rem 0.85rem',
                                       borderBottom: '1px solid #F1F5F9',
                                       fontSize: '0.78125rem'
                                     }}>
                                       <span style={{ color: '#64748B', fontWeight: 600 }}>Payout Purpose</span>
                                       <span style={{
                                         fontSize: '0.71875rem',
                                         fontWeight: 800,
                                         color: details.isCommission ? '#7C3AED' : '#0F52BA',
                                         background: details.isCommission ? '#F5F3FF' : '#EFF6FF',
                                         padding: '2px 8px',
                                         borderRadius: '4px',
                                         border: details.isCommission ? '1px solid #DDD6FE' : '1px solid #BFDBFE'
                                       }}>
                                         {details.isCommission ? '💎 Commission Disbursal' : '💰 Regular Sales Settlement'}
                                       </span>
                                     </div>

                                     {details.remarks && (
                                       <div style={{
                                         display: 'flex',
                                         justifyContent: 'space-between',
                                         alignItems: 'center',
                                         padding: '0.65rem 0.85rem',
                                         borderBottom: '1px solid #F1F5F9',
                                         fontSize: '0.78125rem',
                                         background: '#FFFBEB'
                                       }}>
                                         <span style={{ color: '#92400E', fontWeight: 700 }}>Merchant Note</span>
                                         <strong style={{ color: '#B45309', fontSize: '0.8125rem' }}>
                                           "{details.remarks}"
                                         </strong>
                                       </div>
                                     )}

                                     <div style={{
                                       display: 'flex',
                                       justifyContent: 'space-between',
                                       alignItems: 'center',
                                       padding: '0.65rem 0.85rem',
                                       fontSize: '0.78125rem'
                                     }}>
                                       <span style={{ color: '#64748B', fontWeight: 600 }}>Requested At</span>
                                      <span style={{ color: '#0F172A', fontWeight: 600 }}>{displayDate}</span>
                                    </div>
                                  </div>
                                )}

                                {/* Financial Total Row */}
                                <div style={{
                                  background: '#FFFFFF',
                                  borderRadius: '10px',
                                  border: '1px solid #E2E8F0',
                                  padding: '0.65rem 0.85rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: '0.78125rem'
                                }}>
                                  <span style={{ color: '#64748B', fontWeight: 600 }}>
                                    {isSwipe ? 'Total Swipe Amount' : 'Disbursal Amount'}:
                                  </span>
                                  <strong style={{ fontSize: '1rem', color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                                    ₹{parseFloat(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </strong>
                                </div>

                                {/* ADMIN ACTIONS FOR PENDING / SUBMITTED ITEMS */}
                                {isSwipe ? (
                                  (isPending || item._subStatus === 'SUBMITTED_TO_BANK') && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleTransactionAction(item.id, 'APPROVE', item.merchant_name, item.amount, 'Slip Verified & Credited');
                                          setExpandedPayoutId(null);
                                        }}
                                        style={{
                                          background: '#059669',
                                          color: '#FFFFFF',
                                          border: 'none',
                                          padding: '0.55rem',
                                          borderRadius: '8px',
                                          fontSize: '0.75rem',
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '4px'
                                        }}
                                      >
                                        ✓ Verify Slip
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          triggerToast('Kept in pending queue', 'info');
                                          setExpandedPayoutId(null);
                                        }}
                                        style={{
                                          background: '#FFFBEB',
                                          color: '#D97706',
                                          border: '1px solid #FCD34D',
                                          padding: '0.55rem',
                                          borderRadius: '8px',
                                          fontSize: '0.75rem',
                                          fontWeight: 700,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        ⏳ Keep Pending
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleTransactionAction(item.id, 'REJECT', item.merchant_name, item.amount, 'Verification Failed');
                                          setExpandedPayoutId(null);
                                        }}
                                        style={{
                                          background: '#FEF2F2',
                                          color: '#DC2626',
                                          border: '1px solid #FECACA',
                                          padding: '0.55rem',
                                          borderRadius: '8px',
                                          fontSize: '0.75rem',
                                          fontWeight: 700,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        ✕ Reject
                                      </button>
                                    </div>
                                  )
                                ) : (
                                  /* WITHDRAWAL (BANK PAYOUT) ACTIONS */
                                  isPending ? (
                                    /* IN PENDING: STRICTLY ONLY REJECT BUTTON! NO COMPLETE BUTTON */
                                    <div style={{
                                      background: '#EFF6FF',
                                      border: '1px solid #BFDBFE',
                                      borderRadius: '8px',
                                      padding: '0.6rem 0.85rem',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: '0.5rem',
                                      flexWrap: 'wrap'
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Clock style={{ width: '15px', height: '15px', color: '#1D4ED8', flexShrink: 0 }} />
                                        <span style={{ fontSize: '0.75rem', color: '#1E40AF', fontWeight: 600 }}>
                                          Queued for Bank Batch · Select checkbox &amp; download sheet above to process
                                        </span>
                                      </div>
                                      <div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const confirmed = window.confirm(`Reject payout request of ₹${item.amount} for ${item.merchant_name}? Funds will be refunded to wallet.`);
                                            if (!confirmed) return;
                                            handlePayoutAction(item.id, 'REJECT', item.merchant_name, item.amount, '', 'Payout Request Declined by Admin');
                                            setExpandedPayoutId(null);
                                          }}
                                          style={{
                                            background: '#FEF2F2',
                                            color: '#DC2626',
                                            border: '1px solid #FECACA',
                                            padding: '0.45rem 0.85rem',
                                            borderRadius: '6px',
                                            fontSize: '0.72rem',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                          }}
                                        >
                                          ✕ Reject
                                        </button>
                                      </div>
                                    </div>
                                  ) : item._subStatus === 'SUBMITTED_TO_BANK' ? (
                                    /* IN SUBMITTED: ONE-BY-ONE CHECK WITH UTR MODAL */
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem' }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDisbursingPayout({
                                            payout: item,
                                            utr: '',
                                            remark: '',
                                            actionType: 'APPROVE',
                                            isSubmitting: false
                                          });
                                          setExpandedPayoutId(null);
                                        }}
                                        style={{
                                          background: '#059669',
                                          color: '#FFFFFF',
                                          border: 'none',
                                          padding: '0.55rem',
                                          borderRadius: '8px',
                                          fontSize: '0.75rem',
                                          fontWeight: 700,
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          gap: '4px'
                                        }}
                                      >
                                        ✓ Mark Complete
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleRevertSingleToPending(item.id);
                                          setExpandedPayoutId(null);
                                        }}
                                        title="Bank issue? Move this single withdrawal back to Pending"
                                        style={{
                                          background: '#FFFBEB',
                                          color: '#B45309',
                                          border: '1px solid #FDE68A',
                                          padding: '0.55rem',
                                          borderRadius: '8px',
                                          fontSize: '0.75rem',
                                          fontWeight: 700,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        ⏳ Move to Pending
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handlePayoutAction(item.id, 'REJECT', item.merchant_name, item.amount, '', 'Bank Transfer Failed');
                                          setExpandedPayoutId(null);
                                        }}
                                        style={{
                                          background: '#FEF2F2',
                                          color: '#DC2626',
                                          border: '1px solid #FECACA',
                                          padding: '0.55rem',
                                          borderRadius: '8px',
                                          fontSize: '0.75rem',
                                          fontWeight: 700,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        ✕ Reject
                                      </button>
                                    </div>
                                  ) : null
                                )}
                              </div>
                            )}

                            {/* Hairline Divider */}
                            {idx < currentItems.length - 1 && (
                              <div style={{ height: '1px', background: '#F1F5F9', margin: '0 1rem' }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {renderPayoutPagination(totalPages, activeList.length)}
                </div>
              );
            })()}

            {/* TAB VIEW 6: LOAN APPLICATIONS QUEUE */}
            {activeTab === 'loans' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button
                  onClick={() => handleTabSwitch('overview')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    color: '#334155',
                    cursor: 'pointer',
                    width: 'fit-content'
                  }}
                >
                  <ArrowLeft style={{ width: '12px', height: '12px' }} />
                  <span>← Back to Overview</span>
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
                      Loan Applications Queue ({loansList.length})
                    </h2>
                    <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                      Personal Loans (₹50k – ₹50L) & Business Loans (₹1L – ₹1Cr) review & disbursal
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F52BA', background: '#EFF6FF', padding: '3px 8px', borderRadius: '6px', border: '1px solid #BFDBFE' }}>
                    {pendingLoansCount} Pending Action
                  </span>
                </div>

                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '2px' }}>
                  {[
                    { id: 'ALL', label: `All (${loansList.length})` },
                    { id: 'New', label: `New (${loansList.filter(l => l.status === 'New').length})` },
                    { id: 'Under Review', label: `Under Review (${loansList.filter(l => l.status === 'Under Review').length})` },
                    { id: 'Approved', label: `Approved (${loansList.filter(l => l.status === 'Approved').length})` },
                    { id: 'Rejected', label: `Rejected (${loansList.filter(l => l.status === 'Rejected').length})` }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setInquiryStatusFilter(tab.id)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        border: inquiryStatusFilter === tab.id ? '1.5px solid #0F52BA' : '1px solid #CBD5E1',
                        background: inquiryStatusFilter === tab.id ? '#0F52BA' : '#FFFFFF',
                        color: inquiryStatusFilter === tab.id ? '#FFFFFF' : '#64748B',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative' }}>
                  <Search style={{ width: '14px', height: '14px', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    type="text"
                    placeholder="Search by Applicant Name, Phone, City, Category..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.75rem', outline: 'none' }}
                  />
                </div>

                {/* Applications List */}
                {displayedLoans.length === 0 ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', color: '#64748B' }}>
                    <Receipt style={{ width: '32px', height: '32px', margin: '0 auto 0.5rem', color: '#94A3B8' }} />
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>No loan applications found matching criteria.</p>
                  </div>
                ) : (
                  <div className="admin-roster-grid">
                    {displayedLoans.map(loan => {
                      const isNew = loan.status === 'New';
                      const isReview = loan.status === 'Under Review';
                      const isApproved = loan.status === 'Approved';
                      const isRejected = loan.status === 'Rejected';

                      return (
                        <div key={loan.id} style={{ background: '#FFFFFF', border: isNew ? '1.5px solid #93C5FD' : isReview ? '1.5px solid #FCD34D' : '1px solid #E2E8F0', borderRadius: '12px', padding: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: '0.9375rem', color: '#0A192F' }}>{loan.name}</strong>
                                <span style={{
                                  fontSize: '0.625rem',
                                  fontWeight: 800,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: isApproved ? '#ECFDF5' : isReview ? '#FEF3C7' : isRejected ? '#FEF2F2' : '#EFF6FF',
                                  color: isApproved ? '#059669' : isReview ? '#B45309' : isRejected ? '#DC2626' : '#0F52BA',
                                  border: '1px solid currentColor'
                                }}>
                                  {loan.status}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.6875rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                                App ID: <strong>{loan.id}</strong> • Phone: <strong>{loan.phone}</strong> • City: {loan.location || 'Hyderabad'}
                              </span>
                              <div style={{ display: 'flex', gap: '0.375rem', marginTop: '4px' }}>
                                <span style={{ fontSize: '0.625rem', fontWeight: 800, background: '#F1F5F9', color: '#334155', padding: '2px 6px', borderRadius: '4px' }}>
                                  📂 {loan.category}
                                </span>
                                {loan.merchant_id && (
                                  <span style={{ fontSize: '0.625rem', fontWeight: 800, background: '#ECFDF5', color: '#059669', padding: '2px 6px', borderRadius: '4px' }}>
                                    🏪 MID: {loan.merchant_id}
                                  </span>
                                )}
                              </div>
                              {loan.remarks && (
                                <p style={{ margin: '6px 0 0', fontSize: '0.6875rem', color: '#475569', fontStyle: 'italic', background: '#F8FAFC', padding: '4px 8px', borderRadius: '4px' }}>
                                  "{loan.remarks}"
                                </p>
                              )}
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '0.625rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Requested Loan</span>
                              <strong style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F52BA' }}>
                                {loan.amount}
                              </strong>
                              <span style={{ fontSize: '0.625rem', color: '#94A3B8', display: 'block' }}>
                                {new Date(loan.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #F1F5F9', marginTop: '0.875rem', paddingTop: '0.75rem', flexWrap: 'wrap' }}>
                            {!isRejected && (
                              <button
                                onClick={() => handleUpdateInquiry(loan.id, 'Rejected', 'Does not meet NBFC minimum turnover criteria')}
                                style={{ background: '#F8FAFC', color: '#DC2626', border: '1px solid #FECACA', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 800, cursor: 'pointer' }}
                              >
                                ✕ Reject
                              </button>
                            )}
                            {!isReview && !isApproved && (
                              <button
                                onClick={() => handleUpdateInquiry(loan.id, 'Under Review', 'Documents verified, awaiting bank score')}
                                style={{ background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 800, cursor: 'pointer' }}
                              >
                                ⏳ Mark Under Review
                              </button>
                            )}
                            {!isApproved && (
                              <button
                                onClick={() => handleUpdateInquiry(loan.id, 'Approved', 'KYC & CIBIL score approved. Disbursal scheduled.')}
                                style={{ background: '#059669', color: '#FFF', border: 'none', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 900, cursor: 'pointer', boxShadow: '0 2px 5px rgba(5,150,105,0.25)' }}
                              >
                                ✓ Approve & Disburse
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB VIEW 7: ATM & CDM FRANCHISE REQUESTS QUEUE */}
            {activeTab === 'franchises' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <button
                  onClick={() => handleTabSwitch('overview')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#F1F5F9',
                    border: '1px solid #CBD5E1',
                    borderRadius: '6px',
                    padding: '0.3rem 0.6rem',
                    fontSize: '0.6875rem',
                    fontWeight: 800,
                    color: '#334155',
                    cursor: 'pointer',
                    width: 'fit-content'
                  }}
                >
                  <ArrowLeft style={{ width: '12px', height: '12px' }} />
                  <span>← Back to Overview</span>
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
                      ATM & CDM Franchise Requests ({franchisesList.length})
                    </h2>
                    <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                      Franchise outlet applications, site reviews & territory allocations
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#D97706', background: '#FEF3C7', padding: '3px 8px', borderRadius: '6px', border: '1px solid #FDE68A' }}>
                    {pendingFranchisesCount} Pending Setup
                  </span>
                </div>

                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '2px' }}>
                  {[
                    { id: 'ALL', label: `All (${franchisesList.length})` },
                    { id: 'New', label: `New (${franchisesList.filter(f => f.status === 'New').length})` },
                    { id: 'Under Review', label: `Site Review (${franchisesList.filter(f => f.status === 'Under Review').length})` },
                    { id: 'Approved', label: `Approved (${franchisesList.filter(f => f.status === 'Approved').length})` },
                    { id: 'Rejected', label: `Rejected (${franchisesList.filter(f => f.status === 'Rejected').length})` }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setInquiryStatusFilter(tab.id)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        border: inquiryStatusFilter === tab.id ? '1.5px solid #D97706' : '1px solid #CBD5E1',
                        background: inquiryStatusFilter === tab.id ? '#D97706' : '#FFFFFF',
                        color: inquiryStatusFilter === tab.id ? '#FFFFFF' : '#64748B',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative' }}>
                  <Search style={{ width: '14px', height: '14px', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                  <input
                    type="text"
                    placeholder="Search by Applicant Name, Phone, Location, Machine..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.75rem', outline: 'none' }}
                  />
                </div>

                {/* Franchise List */}
                {displayedFranchises.length === 0 ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', color: '#64748B' }}>
                    <Building2 style={{ width: '32px', height: '32px', margin: '0 auto 0.5rem', color: '#94A3B8' }} />
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>No franchise requests found matching criteria.</p>
                  </div>
                ) : (
                  <div className="admin-roster-grid">
                    {displayedFranchises.map(franchise => {
                      const isNew = franchise.status === 'New';
                      const isReview = franchise.status === 'Under Review';
                      const isApproved = franchise.status === 'Approved';
                      const isRejected = franchise.status === 'Rejected';

                      return (
                        <div key={franchise.id} style={{ background: '#FFFFFF', border: isNew ? '1.5px solid #FCD34D' : isReview ? '1.5px solid #FDE68A' : '1px solid #E2E8F0', borderRadius: '12px', padding: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: '0.9375rem', color: '#0A192F' }}>{franchise.name}</strong>
                                <span style={{
                                  fontSize: '0.625rem',
                                  fontWeight: 800,
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: isApproved ? '#ECFDF5' : isReview ? '#FEF3C7' : isRejected ? '#FEF2F2' : '#EFF6FF',
                                  color: isApproved ? '#059669' : isReview ? '#B45309' : isRejected ? '#DC2626' : '#0F52BA',
                                  border: '1px solid currentColor'
                                }}>
                                  {franchise.status}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.6875rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                                Request ID: <strong>{franchise.id}</strong> • Phone: <strong>{franchise.phone}</strong>
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', color: '#0F172A', fontSize: '0.6875rem', fontWeight: 700 }}>
                                <MapPin style={{ width: '12px', height: '12px', color: '#DC2626' }} />
                                <span>{franchise.location}</span>
                              </div>
                              <div style={{ display: 'flex', gap: '0.375rem', marginTop: '4px' }}>
                                <span style={{ fontSize: '0.625rem', fontWeight: 800, background: '#FEF3C7', color: '#B45309', padding: '2px 6px', borderRadius: '4px' }}>
                                  🏧 {franchise.category}
                                </span>
                              </div>
                              {franchise.remarks && (
                                <p style={{ margin: '6px 0 0', fontSize: '0.6875rem', color: '#475569', fontStyle: 'italic', background: '#F8FAFC', padding: '4px 8px', borderRadius: '4px' }}>
                                  "{franchise.remarks}"
                                </p>
                              )}
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '0.625rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Deposit / Tier</span>
                              <strong style={{ fontSize: '1.25rem', fontWeight: 900, color: '#D97706' }}>
                                {franchise.amount}
                              </strong>
                              <span style={{ fontSize: '0.625rem', color: '#94A3B8', display: 'block' }}>
                                {new Date(franchise.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #F1F5F9', marginTop: '0.875rem', paddingTop: '0.75rem', flexWrap: 'wrap' }}>
                            {!isRejected && (
                              <button
                                onClick={() => handleUpdateInquiry(franchise.id, 'Rejected', 'Location distance to nearest ATM < 200m')}
                                style={{ background: '#F8FAFC', color: '#DC2626', border: '1px solid #FECACA', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 800, cursor: 'pointer' }}
                              >
                                ✕ Reject
                              </button>
                            )}
                            {!isReview && !isApproved && (
                              <button
                                onClick={() => handleUpdateInquiry(franchise.id, 'Under Review', 'Site inspection officer dispatched')}
                                style={{ background: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 800, cursor: 'pointer' }}
                              >
                                ⏳ Dispatch Site Inspection
                              </button>
                            )}
                            {!isApproved && (
                              <button
                                onClick={() => handleUpdateInquiry(franchise.id, 'Approved', 'Franchise territory allocated. Terminal delivery initiated.')}
                                style={{ background: '#059669', color: '#FFF', border: 'none', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 900, cursor: 'pointer', boxShadow: '0 2px 5px rgba(5,150,105,0.25)' }}
                              >
                                ✓ Approve & Allocate Franchise
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {/* TAB VIEW 8: MONTHLY POS TERMINAL RENTAL REPORT (ITEMS #22 & #23) */}
            {activeTab === 'rentals' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Header & Month Selector */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <button
                      onClick={() => handleTabSwitch('overview')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#F1F5F9',
                        border: '1px solid #CBD5E1',
                        borderRadius: '6px',
                        padding: '0.3rem 0.6rem',
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        color: '#334155',
                        cursor: 'pointer',
                        marginBottom: '0.5rem'
                      }}
                    >
                      <ArrowLeft style={{ width: '12px', height: '12px' }} />
                      <span>← Back to Overview</span>
                    </button>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0A192F', margin: 0, letterSpacing: '-0.01em' }}>
                      Monthly POS Terminal Rental Report
                    </h2>
                    <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                      Track merchant terminal rent collection status (Paid vs Pending ₹499/custom rent per merchant)
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {/* Billing Month Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
                      <Calendar style={{ width: '14px', height: '14px', color: '#64748B' }} />
                      <input 
                        type="month"
                        value={rentalMonth}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRentalMonth(val);
                          fetchRentalReport(val);
                        }}
                        style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', cursor: 'pointer' }}
                      />
                    </div>

                    <button
                      onClick={() => fetchRentalReport(rentalMonth)}
                      disabled={isLoadingRental}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: '8px',
                        padding: '0.45rem 0.75rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: '#334155',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <RefreshCw style={{ width: '13px', height: '13px', animation: isLoadingRental ? 'spin 1s linear infinite' : 'none' }} />
                      <span>Refresh</span>
                    </button>

                    <button
                      onClick={() => {
                        const filtered = rentalReportData.list.filter(item => {
                          if (rentalStatusFilter === 'PENDING' && item.rental_status !== 'PENDING') return false;
                          if (rentalStatusFilter === 'PAID' && item.rental_status !== 'PAID') return false;
                          if (rentalSearchQuery.trim()) {
                            const q = rentalSearchQuery.toLowerCase();
                            return (item.merchant_name || '').toLowerCase().includes(q) ||
                                   (item.merchant_id || '').toLowerCase().includes(q) ||
                                   (item.terminal_id || '').toLowerCase().includes(q) ||
                                   (item.mobile || '').includes(q) ||
                                   (item.creator_name || '').toLowerCase().includes(q);
                          }
                          return true;
                        });
                        downloadRentalReportFile(filtered, { billingMonth: rentalMonth });
                        triggerToast('✓ Exported POS Rental Report CSV!', 'success');
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #0F52BA 0%, #1E3A8A 100%)',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.45rem 0.875rem',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 2px 6px rgba(15,82,186,0.25)'
                      }}
                    >
                      <Download style={{ width: '13px', height: '13px' }} />
                      <span>Download CSV</span>
                    </button>
                  </div>
                </div>

                {/* 4 KPI Metric Cards */}
                <div className="admin-kpi-grid">
                  <div style={{ background: '#FFFFFF', padding: '1rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Rental Terminals</span>
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CreditCard style={{ width: '15px', height: '15px' }} />
                      </div>
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0A192F', margin: '6px 0 2px' }}>
                      {rentalReportData.summary?.totalTerminals || 0}
                    </h3>
                    <span style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 700 }}>
                      Active Machines on Rent
                    </span>
                  </div>

                  <div style={{ background: '#FFFFFF', padding: '1rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Total Rent Due</span>
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <DollarSign style={{ width: '15px', height: '15px' }} />
                      </div>
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0A192F', margin: '6px 0 2px' }}>
                      ₹{parseFloat(rentalReportData.summary?.totalDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </h3>
                    <span style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 700 }}>
                      Billing Cycle: {rentalMonth}
                    </span>
                  </div>

                  <div style={{ background: '#ECFDF5', padding: '1rem', borderRadius: '12px', border: '1.5px solid #A7F3D0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>Collected</span>
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#D1FAE5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle2 style={{ width: '15px', height: '15px' }} />
                      </div>
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#059669', margin: '6px 0 2px' }}>
                      ₹{parseFloat(rentalReportData.summary?.totalCollected || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </h3>
                    <span style={{ fontSize: '0.625rem', color: '#047857', fontWeight: 800 }}>
                      ✓ {rentalReportData.summary?.paidCount || 0} Terminals Cleared
                    </span>
                  </div>

                  <div style={{ background: '#FFFBEB', padding: '1rem', borderRadius: '12px', border: '1.5px solid #FDE68A' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#B45309', textTransform: 'uppercase' }}>Pending Collection</span>
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock style={{ width: '15px', height: '15px' }} />
                      </div>
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#B45309', margin: '6px 0 2px' }}>
                      ₹{parseFloat(rentalReportData.summary?.totalPending || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </h3>
                    <span style={{ fontSize: '0.625rem', color: '#D97706', fontWeight: 800 }}>
                      ⏳ {rentalReportData.summary?.pendingCount || 0} Terminals Unpaid
                    </span>
                  </div>
                </div>

                {/* Filter Toolbar & Search */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.625rem', background: '#FFFFFF', padding: '0.75rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  {/* Status Pills */}
                  <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto' }}>
                    {[
                      { id: 'ALL', label: `All Terminals (${rentalReportData.list.length})` },
                      { id: 'PENDING', label: `⏳ Pending (${rentalReportData.summary?.pendingCount || 0})` },
                      { id: 'PAID', label: `✓ Collected (${rentalReportData.summary?.paidCount || 0})` }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setRentalStatusFilter(tab.id)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '20px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          border: rentalStatusFilter === tab.id ? '1.5px solid #0F52BA' : '1px solid #CBD5E1',
                          background: rentalStatusFilter === tab.id ? '#0F52BA' : '#FFFFFF',
                          color: rentalStatusFilter === tab.id ? '#FFFFFF' : '#475569',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Search Input */}
                  <div style={{ position: 'relative', minWidth: '240px', flex: 1 }}>
                    <Search style={{ width: '14px', height: '14px', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                    <input
                      type="text"
                      placeholder="Search Merchant, TID, Mobile, Distributor..."
                      value={rentalSearchQuery}
                      onChange={(e) => setRentalSearchQuery(e.target.value)}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.75rem 0.45rem 2rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.75rem', outline: 'none' }}
                    />
                  </div>
                </div>

                {/* Rental Roster Table / Card Stream */}
                {(() => {
                  const filtered = rentalReportData.list.filter(item => {
                    if (rentalStatusFilter === 'PENDING' && item.rental_status !== 'PENDING') return false;
                    if (rentalStatusFilter === 'PAID' && item.rental_status !== 'PAID') return false;
                    if (rentalSearchQuery.trim()) {
                      const q = rentalSearchQuery.toLowerCase();
                      return (item.merchant_name || '').toLowerCase().includes(q) ||
                             (item.merchant_id || '').toLowerCase().includes(q) ||
                             (item.terminal_id || '').toLowerCase().includes(q) ||
                             (item.mobile || '').includes(q) ||
                             (item.creator_name || '').toLowerCase().includes(q);
                    }
                    return true;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div style={{ padding: '3rem 1rem', textAlign: 'center', background: '#FFFFFF', borderRadius: '12px', border: '1px dashed #CBD5E1', color: '#64748B' }}>
                        <CreditCard style={{ width: '32px', height: '32px', margin: '0 auto 0.5rem', color: '#94A3B8' }} />
                        <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                          No rental records found
                        </h4>
                        <p style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>
                          No POS terminals match the selected filter for {rentalMonth}.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                      {filtered.map(item => {
                        const isPaid = item.rental_status === 'PAID';
                        const isUpdating = updatingRentalId === `${item.merchant_id}_${item.terminal_id}`;
                        const isPine = (item.pos_provider || '').toLowerCase().includes('pine');

                        return (
                          <div
                            key={`${item.merchant_id}_${item.terminal_id}`}
                            style={{
                              background: '#FFFFFF',
                              border: isPaid ? '1px solid #E2E8F0' : '1.5px solid #FDE68A',
                              borderRadius: '12px',
                              padding: '0.875rem 1rem',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '0.75rem'
                            }}
                          >
                            {/* Left: Merchant & Machine identity */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: '240px', flex: 1 }}>
                              <div style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '10px',
                                background: isPine ? '#EFF6FF' : '#FEF3C7',
                                color: isPine ? '#0F52BA' : '#D97706',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 900,
                                fontSize: '1rem',
                                flexShrink: 0
                              }}>
                                {isPine ? '🌲' : '⚡'}
                              </div>

                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <strong style={{ fontSize: '0.875rem', color: '#0F172A' }}>{item.merchant_name}</strong>
                                  <span style={{ fontSize: '0.6875rem', color: '#64748B', fontFamily: 'monospace', background: '#F1F5F9', padding: '1px 5px', borderRadius: '4px' }}>
                                    {item.merchant_id}
                                  </span>
                                </div>

                                <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>
                                  <span>{item.pos_provider}</span>
                                  <span style={{ margin: '0 4px' }}>•</span>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0F52BA' }}>{item.terminal_id}</span>
                                  <span style={{ margin: '0 4px' }}>•</span>
                                  <span>Distributor: <strong>{item.creator_name || 'Super Admin'}</strong></span>
                                </div>
                              </div>
                            </div>

                            {/* Middle: Plan & Rent Fee */}
                            <div style={{ textAlign: 'right', minWidth: '130px' }}>
                              <span style={{ fontSize: '0.625rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>
                                Monthly Rent
                              </span>
                              <strong style={{ fontSize: '1.05rem', color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                                ₹{item.monthly_rent.toFixed(2)}
                              </strong>
                              <span style={{ fontSize: '0.65rem', color: '#64748B', display: 'block' }}>
                                {item.device_plan || 'RENTAL'}
                              </span>
                            </div>

                            {/* Right: Status Pill & Toggle Action Button */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: isPaid ? '#ECFDF5' : '#FEF3C7',
                                color: isPaid ? '#059669' : '#B45309',
                                border: isPaid ? '1px solid #A7F3D0' : '1px solid #FDE68A',
                                whiteSpace: 'nowrap'
                              }}>
                                {isPaid ? '✓ Paid' : '⏳ Pending'}
                              </span>

                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleToggleRentalStatus(item)}
                                style={{
                                  background: isPaid ? '#F1F5F9' : '#059669',
                                  color: isPaid ? '#475569' : '#FFFFFF',
                                  border: isPaid ? '1px solid #CBD5E1' : 'none',
                                  borderRadius: '6px',
                                  padding: '0.4rem 0.75rem',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  cursor: isUpdating ? 'not-allowed' : 'pointer',
                                  whiteSpace: 'nowrap',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                {isUpdating ? 'Updating...' : (isPaid ? 'Revert to Pending' : '✓ Mark Paid')}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

          </div>
        )}
      </main>

      {/* 5. Mobile Sticky Bottom Navigation Bar (5-Tier Network Hierarchy + Overview + Payouts) */}
      <nav className="admin-mobile-bottom-nav">
        {/* 1. Overview */}
        <button 
          onClick={() => handleTabSwitch('overview')} 
          style={{ background: 'none', border: 'none', color: activeTab === 'overview' ? '#38BDF8' : '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
        >
          <Activity style={{ width: '16px', height: '16px' }} />
          <span style={{ fontSize: '0.45rem', fontWeight: 800 }}>Overview</span>
        </button>

        {/* 1B. Tier 0: Master Dist */}
        <button 
          onClick={() => handleTabSwitch('master_distributors')} 
          style={{ background: 'none', border: 'none', color: activeTab === 'master_distributors' ? '#C084FC' : '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
        >
          <Crown style={{ width: '16px', height: '16px' }} />
          <span style={{ fontSize: '0.45rem', fontWeight: 800 }}>Master</span>
        </button>

        {/* 2. Tier 1: Super Dist */}
        <button 
          onClick={() => handleTabSwitch('super_distributors')} 
          style={{ background: 'none', border: 'none', color: activeTab === 'super_distributors' ? '#38BDF8' : '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
        >
          <Zap style={{ width: '16px', height: '16px' }} />
          <span style={{ fontSize: '0.45rem', fontWeight: 800 }}>Super Dist</span>
        </button>

        {/* 3. Tier 2: District Dist */}
        <button 
          onClick={() => handleTabSwitch('district_distributors')} 
          style={{ background: 'none', border: 'none', color: activeTab === 'district_distributors' ? '#38BDF8' : '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
        >
          <Shield style={{ width: '16px', height: '16px' }} />
          <span style={{ fontSize: '0.48rem', fontWeight: 800 }}>District Dist</span>
        </button>

        {/* 4. Tier 3: Distributors */}
        <button 
          onClick={() => handleTabSwitch('distributors')} 
          style={{ background: 'none', border: 'none', color: activeTab === 'distributors' ? '#38BDF8' : '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
        >
          <GitFork style={{ width: '16px', height: '16px' }} />
          <span style={{ fontSize: '0.48rem', fontWeight: 800 }}>Distributor</span>
        </button>

        {/* 5. Tier 4: Merchants */}
        <button 
          onClick={() => handleTabSwitch('merchants')} 
          style={{ background: 'none', border: 'none', color: activeTab === 'merchants' ? '#38BDF8' : '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
        >
          <Store style={{ width: '16px', height: '16px' }} />
          <span style={{ fontSize: '0.48rem', fontWeight: 800 }}>Merchants</span>
        </button>

        {/* 6. Action: Payouts */}
        <button 
          onClick={() => handleTabSwitch('payouts')} 
          style={{ position: 'relative', background: 'none', border: 'none', color: activeTab === 'payouts' ? '#38BDF8' : '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
        >
          <Landmark style={{ width: '16px', height: '16px' }} />
          <span style={{ fontSize: '0.48rem', fontWeight: 800 }}>Payouts</span>
          {channelPendingCounts.total > 0 && (
            <span style={{
              position: 'absolute',
              top: '-2px',
              right: '8px',
              minWidth: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: '#DC2626',
              color: '#FFF',
              fontSize: '0.5rem',
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {channelPendingCounts.total}
            </span>
          )}
        </button>
      </nav>

      {/* 6. Universal Onboard Partner / Merchant Modal */}
      {isCreateModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(10, 25, 47, 0.75)',
          backdropFilter: 'blur(4px)',
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.25rem',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
                  Onboard {onboardForm.role.replace('_', ' ')}
                </h3>
                <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>Create partner in ecosystem hierarchy</span>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <form onSubmit={handleSubmitOnboard} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              
              {/* Role Selector */}
              <div>
                <label style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Select Hierarchy Role
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.375rem' }}>
                  {[
                    { role: 'MASTER', label: '👑 Master Dist', color: '#7C3AED', bg: '#FAF5FF' },
                    { role: 'SUPER_DISTRIBUTOR', label: '⚡ Super Dist', color: '#2563EB', bg: '#EFF6FF' },
                    { role: 'DISTRICT_DISTRIBUTOR', label: '🏛️ District Dist', color: '#D97706', bg: '#FEF3C7' },
                    { role: 'DISTRIBUTOR', label: '📦 Distributor', color: '#059669', bg: '#ECFDF5' },
                    { role: 'MERCHANT', label: '🏪 Retailer / Shop', color: '#0F172A', bg: '#F1F5F9' }
                  ].map(item => (
                    <button
                      key={item.role}
                      type="button"
                      onClick={() => setOnboardForm(prev => ({ ...prev, role: item.role }))}
                      style={{
                        padding: '0.45rem 0.25rem',
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        borderRadius: '6px',
                        border: onboardForm.role === item.role ? `2px solid ${item.color}` : '1px solid #CBD5E1',
                        background: onboardForm.role === item.role ? item.bg : '#FFFFFF',
                        color: onboardForm.role === item.role ? item.color : '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name & Mobile */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Full Name / Store Name <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Enterprises"
                    value={onboardForm.name}
                    onChange={(e) => setOnboardForm(prev => ({ ...prev, name: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Mobile Number <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    placeholder="10-digit mobile"
                    value={onboardForm.mobile}
                    onChange={(e) => setOnboardForm(prev => ({ ...prev, mobile: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem' }}
                  />
                </div>
              </div>

              {/* Email & Aadhaar Card */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Gmail / Email Address <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. partner@gmail.com"
                    value={onboardForm.email || ''}
                    onChange={(e) => setOnboardForm(prev => ({ ...prev, email: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Aadhaar Card (12 Digits) <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={12}
                    placeholder="12-digit Aadhaar number"
                    value={onboardForm.aadhaar || ''}
                    onChange={(e) => setOnboardForm(prev => ({ ...prev, aadhaar: e.target.value.replace(/\D/g, '') }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem' }}
                  />
                </div>
              </div>

              {/* PAN Card & Full Business Address */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    PAN Card (10 Digits) <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="e.g. ABCDE1234F"
                    value={onboardForm.pan || ''}
                    onChange={(e) => setOnboardForm(prev => ({ ...prev, pan: e.target.value.toUpperCase() }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem', textTransform: 'uppercase' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Full Business Address <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Shop No, Street, City, PIN"
                    value={onboardForm.address || ''}
                    onChange={(e) => setOnboardForm(prev => ({ ...prev, address: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem' }}
                  />
                </div>
              </div>

              {/* Option 1: Assigned Payment Channels & Terminals (Multi-Channel Portfolio) */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 900, color: '#0F172A', display: 'block' }}>
                      Assigned Payment Channels & Terminals
                    </label>
                    <span style={{ fontSize: '0.625rem', color: '#64748B' }}>
                      Add physical swipe machines and/or grant Company QR access to this merchant.
                    </span>
                  </div>
                </div>

                {/* Channel Add Action Buttons */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {!onboardChannels.pine_labs && (
                    <button
                      type="button"
                      onClick={() => setOnboardChannels(prev => ({
                        ...prev,
                        pine_labs: {
                          enabled: true,
                          terminal_id: '',
                          vendor: 'Rose Navaneetham Enterprises',
                          plan: 'RENTAL',
                          rent: '499',
                          rate_t1: '1.50',
                          rate_instant: '1.80'
                        }
                      }))}
                      style={{
                        padding: '0.45rem 0.75rem',
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        borderRadius: '6px',
                        border: '1px dashed #0F52BA',
                        background: '#EFF6FF',
                        color: '#0F52BA',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>🌲 + Add Pine Labs POS</span>
                    </button>
                  )}

                  {!onboardChannels.payswiff && (
                    <button
                      type="button"
                      onClick={() => setOnboardChannels(prev => ({
                        ...prev,
                        payswiff: {
                          enabled: true,
                          terminal_id: '',
                          vendor: 'RONAV Technologies',
                          plan: 'RENTAL',
                          rent: '499',
                          rate_t1: '1.50',
                          rate_instant: '1.80'
                        }
                      }))}
                      style={{
                        padding: '0.45rem 0.75rem',
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        borderRadius: '6px',
                        border: '1px dashed #D97706',
                        background: '#FFFBEB',
                        color: '#D97706',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>⚡ + Add Payswiff POS</span>
                    </button>
                  )}

                  {!onboardChannels.qr && (
                    <button
                      type="button"
                      onClick={() => setOnboardChannels(prev => ({
                        ...prev,
                        qr: {
                          enabled: true,
                          vendor: 'RONAV Technologies',
                          rate_instant: '1.50'
                        }
                      }))}
                      style={{
                        padding: '0.45rem 0.75rem',
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        borderRadius: '6px',
                        border: '1px dashed #7C3AED',
                        background: '#F5F3FF',
                        color: '#7C3AED',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>📱 + Add QR Channel</span>
                    </button>
                  )}
                </div>

                {/* Empty State Warning */}
                {!onboardChannels.pine_labs && !onboardChannels.payswiff && !onboardChannels.qr && (
                  <div style={{ padding: '0.75rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', fontSize: '0.6875rem', color: '#DC2626' }}>
                    ⚠️ No channels assigned. Please click a button above to attach at least one POS machine or QR channel.
                  </div>
                )}

                {/* Pine Labs Card */}
                {onboardChannels.pine_labs && (
                  <div style={{ background: '#FFFFFF', border: '1.5px solid #BFDBFE', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '1rem' }}>🌲</span>
                        <strong style={{ fontSize: '0.75rem', color: '#0F52BA' }}>Pine Labs POS Terminal</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOnboardChannels(prev => ({ ...prev, pine_labs: null }))}
                        style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: '0.625rem', fontWeight: 800, borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}
                      >
                        ✕ Remove
                      </button>
                    </div>

                    <div style={{ fontSize: '0.65625rem', color: '#64748B' }}>
                      <strong>Vendor Entity:</strong> <span style={{ color: '#0F52BA', fontWeight: 700 }}>Rose Navaneetham Enterprises</span> (Exclusive)
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '2px' }}>
                          Terminal Serial / TID *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. PL-884920"
                          value={onboardChannels.pine_labs.terminal_id}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOnboardChannels(prev => ({
                              ...prev,
                              pine_labs: { ...prev.pine_labs, terminal_id: val }
                            }));
                          }}
                          style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem', fontWeight: 700, boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '2px' }}>
                          Device Plan
                        </label>
                        <select
                          value={onboardChannels.pine_labs.plan}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOnboardChannels(prev => ({
                              ...prev,
                              pine_labs: { ...prev.pine_labs, plan: val, rent: val === 'RENTAL' ? '499' : (prev.pine_labs.rent || '499') }
                            }));
                          }}
                          style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.6875rem', background: '#FFFFFF' }}
                        >
                          <option value="RENTAL">Monthly Rental (₹499/mo)</option>
                          <option value="CUSTOM">Custom Plan</option>
                        </select>

                        {onboardChannels.pine_labs.plan === 'CUSTOM' && (
                          <div style={{ marginTop: '5px' }}>
                            <label style={{ fontSize: '0.59375rem', fontWeight: 800, color: '#0F52BA', display: 'block', marginBottom: '2px' }}>
                              Custom Amount (₹) *
                            </label>
                            <div style={{ position: 'relative' }}>
                              <span style={{ position: 'absolute', left: '7px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>₹</span>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                required
                                placeholder="e.g. 799"
                                value={onboardChannels.pine_labs.rent || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setOnboardChannels(prev => ({
                                    ...prev,
                                    pine_labs: { ...prev.pine_labs, rent: val }
                                  }));
                                }}
                                style={{ width: '100%', padding: '0.35rem 0.5rem 0.35rem 1.3rem', borderRadius: '6px', border: '1.5px solid #0F52BA', fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', boxSizing: 'border-box' }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '2px' }}>
                          T+1 MDR (%) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={onboardChannels.pine_labs.rate_t1}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOnboardChannels(prev => ({
                              ...prev,
                              pine_labs: { ...prev.pine_labs, rate_t1: val }
                            }));
                          }}
                          style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem', fontWeight: 700, boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '2px' }}>
                          Instant MDR (%) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={onboardChannels.pine_labs.rate_instant}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOnboardChannels(prev => ({
                              ...prev,
                              pine_labs: { ...prev.pine_labs, rate_instant: val }
                            }));
                          }}
                          style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem', fontWeight: 700, boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Payswiff Card */}
                {onboardChannels.payswiff && (
                  <div style={{ background: '#FFFFFF', border: '1.5px solid #FDE68A', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '1rem' }}>⚡</span>
                        <strong style={{ fontSize: '0.75rem', color: '#D97706' }}>Payswiff POS Terminal</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOnboardChannels(prev => ({ ...prev, payswiff: null }))}
                        style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: '0.625rem', fontWeight: 800, borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}
                      >
                        ✕ Remove
                      </button>
                    </div>

                    {/* Vendor Entity Selector */}
                    <div>
                      <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '3px' }}>
                        Vendor Entity (Payswiff)
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.375rem' }}>
                        {['RONAV Technologies', 'R.P. Technologies'].map(v => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setOnboardChannels(prev => ({
                              ...prev,
                              payswiff: { ...prev.payswiff, vendor: v }
                            }))}
                            style={{
                              padding: '0.35rem',
                              fontSize: '0.625rem',
                              fontWeight: 800,
                              borderRadius: '6px',
                              border: onboardChannels.payswiff.vendor === v ? '2px solid #D97706' : '1px solid #CBD5E1',
                              background: onboardChannels.payswiff.vendor === v ? '#FEF3C7' : '#FFFFFF',
                              color: onboardChannels.payswiff.vendor === v ? '#B45309' : '#475569',
                              cursor: 'pointer'
                            }}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '2px' }}>
                          Terminal Serial / TID *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. SWIFF-58201"
                          value={onboardChannels.payswiff.terminal_id}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOnboardChannels(prev => ({
                              ...prev,
                              payswiff: { ...prev.payswiff, terminal_id: val }
                            }));
                          }}
                          style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem', fontWeight: 700, boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '2px' }}>
                          Device Plan
                        </label>
                        <select
                          value={onboardChannels.payswiff.plan}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOnboardChannels(prev => ({
                              ...prev,
                              payswiff: { ...prev.payswiff, plan: val, rent: val === 'RENTAL' ? '499' : (prev.payswiff.rent || '499') }
                            }));
                          }}
                          style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.6875rem', background: '#FFFFFF' }}
                        >
                          <option value="RENTAL">Monthly Rental (₹499/mo)</option>
                          <option value="CUSTOM">Custom Plan</option>
                        </select>

                        {onboardChannels.payswiff.plan === 'CUSTOM' && (
                          <div style={{ marginTop: '5px' }}>
                            <label style={{ fontSize: '0.59375rem', fontWeight: 800, color: '#D97706', display: 'block', marginBottom: '2px' }}>
                              Custom Amount (₹) *
                            </label>
                            <div style={{ position: 'relative' }}>
                              <span style={{ position: 'absolute', left: '7px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>₹</span>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                required
                                placeholder="e.g. 799"
                                value={onboardChannels.payswiff.rent || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setOnboardChannels(prev => ({
                                    ...prev,
                                    payswiff: { ...prev.payswiff, rent: val }
                                  }));
                                }}
                                style={{ width: '100%', padding: '0.35rem 0.5rem 0.35rem 1.3rem', borderRadius: '6px', border: '1.5px solid #D97706', fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', boxSizing: 'border-box' }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '2px' }}>
                          T+1 MDR (%) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={onboardChannels.payswiff.rate_t1}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOnboardChannels(prev => ({
                              ...prev,
                              payswiff: { ...prev.payswiff, rate_t1: val }
                            }));
                          }}
                          style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem', fontWeight: 700, boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '2px' }}>
                          Instant MDR (%) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={onboardChannels.payswiff.rate_instant}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOnboardChannels(prev => ({
                              ...prev,
                              payswiff: { ...prev.payswiff, rate_instant: val }
                            }));
                          }}
                          style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem', fontWeight: 700, boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* QR Channel Card */}
                {onboardChannels.qr && (
                  <div style={{ background: '#FFFFFF', border: '1.5px solid #DDD6FE', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '1rem' }}>📱</span>
                        <strong style={{ fontSize: '0.75rem', color: '#7C3AED' }}>Company QR (UPI) Channel</strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => setOnboardChannels(prev => ({ ...prev, qr: null }))}
                        style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: '0.625rem', fontWeight: 800, borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}
                      >
                        ✕ Remove
                      </button>
                    </div>

                    <div style={{ fontSize: '0.65625rem', color: '#64748B' }}>
                      <strong>Vendor Entity:</strong> <span style={{ color: '#7C3AED', fontWeight: 700 }}>RONAV Technologies</span> (Corporate HQ QR) • <span style={{ color: '#059669', fontWeight: 700 }}>Strictly Instant Settlement</span>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '2px' }}>
                        Custom Instant MDR Fee (%) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.0"
                        max="4.0"
                        value={onboardChannels.qr.rate_instant}
                        onChange={(e) => {
                          const val = e.target.value;
                          setOnboardChannels(prev => ({
                            ...prev,
                            qr: { ...prev.qr, rate_instant: val }
                          }));
                        }}
                        placeholder="e.g. 1.20 or 1.50"
                        style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8125rem', fontWeight: 800, color: '#7C3AED', boxSizing: 'border-box' }}
                      />
                      <span style={{ fontSize: '0.625rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                        This fee percentage is automatically deducted from instant customer UPI scans.
                      </span>
                    </div>
                  </div>
                )}

              </div>

              {/* Agreement Copy & Confirmation Checkbox */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.65rem 0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="admin_agreement_accepted"
                  required
                  checked={!!onboardForm.agreement_accepted}
                  onChange={(e) => setOnboardForm(prev => ({ ...prev, agreement_accepted: e.target.checked }))}
                  style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: '#0F52BA', cursor: 'pointer' }}
                />
                <label htmlFor="admin_agreement_accepted" style={{ fontSize: '0.6875rem', color: '#334155', lineHeight: '1.4', cursor: 'pointer', margin: 0 }}>
                  <strong style={{ color: '#0F172A' }}>Merchant Service Agreement & KYC Declaration:</strong> I hereby certify that the partner details, PAN, Aadhaar, and address have been physically verified. The onboarded partner agrees to RONAV Technologies terms of business and MDR margin structure. <span style={{ color: '#DC2626' }}>*</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{ flex: 1, padding: '0.5rem', background: '#F1F5F9', border: 'none', borderRadius: '8px', color: '#475569', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{ flex: 2, padding: '0.5rem', background: '#0F52BA', border: 'none', borderRadius: '8px', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}
                >
                  {isSubmitting ? 'Creating...' : `Confirm & Create ${onboardForm.role}`}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 7. Created Credentials Card Modal */}
      {createdResultModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(10, 25, 47, 0.8)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '400px',
            padding: '1.5rem',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)'
          }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#D1FAE5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
              <CheckCircle2 style={{ width: '28px', height: '28px' }} />
            </div>

            <h3 style={{ fontSize: '1.125rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
              Account Created Successfully!
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
              Partner onboarded into live RONAV Supabase network hierarchy
            </span>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.875rem', margin: '1rem 0', textAlign: 'left', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div><strong>Name:</strong> {createdResultModal.name}</div>
              <div><strong>Role:</strong> {createdResultModal.role}</div>
              <div><strong>User ID:</strong> <span style={{ color: '#0F52BA', fontWeight: 800 }}>{createdResultModal.id}</span></div>
              <div><strong>Mobile:</strong> {createdResultModal.mobile}</div>
              <div><strong>Temp Password:</strong> <span style={{ color: '#059669', fontWeight: 800 }}>{createdResultModal.password}</span></div>
              <div><strong>Sponsor:</strong> {createdResultModal.parent_name}</div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <a
                href={`https://api.whatsapp.com/send?phone=${createdResultModal.mobile}&text=${encodeURIComponent(`*RONAV Partner Welcome*\nHello ${createdResultModal.name},\nYour account has been registered successfully.\n\nRole: ${createdResultModal.role}\nUser ID: ${createdResultModal.id}\nMobile: ${createdResultModal.mobile}\nPassword: ${createdResultModal.password}\n\nLogin Portal: ${typeof window !== 'undefined' ? window.location.origin : ''}`)}`}
                target="_blank"
                rel="noreferrer"
                style={{ flex: 1, padding: '0.5rem', background: '#25D366', color: '#FFF', textDecoration: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              >
                <span>💬 Send via WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  const portalUrl = typeof window !== 'undefined' ? window.location.origin : '';
                  const shareText = `*RONAV Partner Welcome*\nName: ${createdResultModal.name}\nRole: ${createdResultModal.role}\nUser ID: ${createdResultModal.id}\nMobile: ${createdResultModal.mobile}\nPassword: ${createdResultModal.password}\nLogin Portal: ${portalUrl}`;
                  copyToClipboard(shareText, 'share-creds');
                }}
                style={{ flex: 1, padding: '0.5rem', background: '#059669', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              >
                <Copy style={{ width: '14px', height: '14px' }} />
                <span>{copiedId['share-creds'] ? 'Copied!' : 'Copy Text'}</span>
              </button>

              <button
                type="button"
                onClick={() => setCreatedResultModal(null)}
                style={{ padding: '0.5rem 1rem', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Terminals & QR Channel Portfolio Modal for Existing Merchants */}
      {managingChannelsMerchant && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(10, 25, 47, 0.7)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '540px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '1.25rem',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
                  Manage Terminals & Channels
                </h3>
                <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                  {managingChannelsMerchant.name} (MID: <strong style={{ color: '#059669' }}>{managingChannelsMerchant.id}</strong>)
                </span>
              </div>
              <button onClick={() => setManagingChannelsMerchant(null)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div style={{ fontSize: '0.71875rem', color: '#475569', background: '#F1F5F9', padding: '0.625rem', borderRadius: '8px' }}>
                💡 <strong>Option 1 Channel Inventory:</strong> Add or remove terminals and QR for this merchant. Changes update instantly without altering merchant login or wallet balance.
              </div>

              {/* Quick Add Channel Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {!managingChannelsData.pine_labs?.enabled && (
                  <button
                    type="button"
                    onClick={() => setManagingChannelsData(prev => ({
                      ...prev,
                      pine_labs: {
                        enabled: true,
                        terminal_id: prev.pine_labs?.terminal_id || '',
                        vendor: 'Rose Navaneetham Enterprises',
                        plan: prev.pine_labs?.plan || 'RENTAL',
                        rent: prev.pine_labs?.rent || 499,
                        rate_t1: prev.pine_labs?.rate_t1 || 1.50,
                        rate_instant: prev.pine_labs?.rate_instant || 1.80
                      }
                    }))}
                    style={{
                      padding: '0.45rem 0.75rem',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      borderRadius: '6px',
                      border: '1px dashed #0F52BA',
                      background: '#EFF6FF',
                      color: '#0F52BA',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>🌲 + Add Pine Labs POS</span>
                  </button>
                )}

                {!managingChannelsData.payswiff?.enabled && (
                  <button
                    type="button"
                    onClick={() => setManagingChannelsData(prev => ({
                      ...prev,
                      payswiff: {
                        enabled: true,
                        terminal_id: prev.payswiff?.terminal_id || '',
                        vendor: prev.payswiff?.vendor || 'RONAV Technologies',
                        plan: prev.payswiff?.plan || 'RENTAL',
                        rent: prev.payswiff?.rent || 499,
                        rate_t1: prev.payswiff?.rate_t1 || 1.50,
                        rate_instant: prev.payswiff?.rate_instant || 1.80
                      }
                    }))}
                    style={{
                      padding: '0.45rem 0.75rem',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      borderRadius: '6px',
                      border: '1px dashed #D97706',
                      background: '#FFFBEB',
                      color: '#D97706',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>⚡ + Add Payswiff POS</span>
                  </button>
                )}

                {!managingChannelsData.qr?.enabled && (
                  <button
                    type="button"
                    onClick={() => setManagingChannelsData(prev => ({
                      ...prev,
                      qr: {
                        enabled: true,
                        vendor: 'RONAV Technologies',
                        rate_instant: prev.qr?.rate_instant || 1.50
                      }
                    }))}
                    style={{
                      padding: '0.45rem 0.75rem',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      borderRadius: '6px',
                      border: '1px dashed #7C3AED',
                      background: '#F5F3FF',
                      color: '#7C3AED',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>📱 + Add QR Channel</span>
                  </button>
                )}
              </div>

              {/* Active Pine Labs Card */}
              {managingChannelsData.pine_labs?.enabled && (
                <div style={{ background: '#FFFFFF', border: '1.5px solid #BFDBFE', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '1rem' }}>🌲</span>
                      <strong style={{ fontSize: '0.75rem', color: '#0F52BA' }}>Pine Labs POS Terminal</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => setManagingChannelsData(prev => ({
                        ...prev,
                        pine_labs: { ...prev.pine_labs, enabled: false }
                      }))}
                      style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: '0.625rem', fontWeight: 800, borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}
                    >
                      ✕ Remove
                    </button>
                  </div>

                  <div style={{ fontSize: '0.65625rem', color: '#64748B' }}>
                    <strong>Vendor Entity:</strong> <span style={{ color: '#0F52BA', fontWeight: 700 }}>Rose Navaneetham Enterprises</span> (Exclusive)
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '2px' }}>
                        Terminal Serial / TID *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. PL-884920"
                        value={managingChannelsData.pine_labs.terminal_id || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setManagingChannelsData(prev => ({
                            ...prev,
                            pine_labs: { ...prev.pine_labs, terminal_id: val }
                          }));
                        }}
                        style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem', fontWeight: 700, boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '2px' }}>
                        Device Plan
                      </label>
                      <select
                        value={managingChannelsData.pine_labs.plan || 'RENTAL'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setManagingChannelsData(prev => ({
                            ...prev,
                            pine_labs: { ...prev.pine_labs, plan: val, rent: val === 'RENTAL' ? 499 : prev.pine_labs.rent }
                          }));
                        }}
                        style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.6875rem', background: '#FFFFFF' }}
                      >
                        <option value="RENTAL">Monthly Rental (₹499/mo)</option>
                        <option value="CUSTOM">Custom Plan</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '2px' }}>
                        T+1 MDR (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={managingChannelsData.pine_labs.rate_t1 || 1.50}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 1.50;
                          setManagingChannelsData(prev => ({
                            ...prev,
                            pine_labs: { ...prev.pine_labs, rate_t1: val }
                          }));
                        }}
                        style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem', fontWeight: 700, boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '2px' }}>
                        Instant MDR (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={managingChannelsData.pine_labs.rate_instant || 1.80}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 1.80;
                          setManagingChannelsData(prev => ({
                            ...prev,
                            pine_labs: { ...prev.pine_labs, rate_instant: val }
                          }));
                        }}
                        style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem', fontWeight: 700, boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Active Payswiff Card */}
              {managingChannelsData.payswiff?.enabled && (
                <div style={{ background: '#FFFFFF', border: '1.5px solid #FDE68A', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '1rem' }}>⚡</span>
                      <strong style={{ fontSize: '0.75rem', color: '#D97706' }}>Payswiff POS Terminal</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => setManagingChannelsData(prev => ({
                        ...prev,
                        payswiff: { ...prev.payswiff, enabled: false }
                      }))}
                      style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: '0.625rem', fontWeight: 800, borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}
                    >
                      ✕ Remove
                    </button>
                  </div>

                  {/* Vendor Entity Selector */}
                  <div>
                    <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '3px' }}>
                      Vendor Entity (Payswiff)
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.375rem' }}>
                      {['RONAV Technologies', 'R.P. Technologies'].map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setManagingChannelsData(prev => ({
                            ...prev,
                            payswiff: { ...prev.payswiff, vendor: v }
                          }))}
                          style={{
                            padding: '0.35rem',
                            fontSize: '0.625rem',
                            fontWeight: 800,
                            borderRadius: '6px',
                            border: managingChannelsData.payswiff.vendor === v ? '2px solid #D97706' : '1px solid #CBD5E1',
                            background: managingChannelsData.payswiff.vendor === v ? '#FEF3C7' : '#FFFFFF',
                            color: managingChannelsData.payswiff.vendor === v ? '#B45309' : '#475569',
                            cursor: 'pointer'
                          }}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '2px' }}>
                        Terminal Serial / TID *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. SWIFF-58201"
                        value={managingChannelsData.payswiff.terminal_id || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setManagingChannelsData(prev => ({
                            ...prev,
                            payswiff: { ...prev.payswiff, terminal_id: val }
                          }));
                        }}
                        style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem', fontWeight: 700, boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '2px' }}>
                        Device Plan
                      </label>
                      <select
                        value={managingChannelsData.payswiff.plan || 'RENTAL'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setManagingChannelsData(prev => ({
                            ...prev,
                            payswiff: { ...prev.payswiff, plan: val, rent: val === 'RENTAL' ? 499 : prev.payswiff.rent }
                          }));
                        }}
                        style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.6875rem', background: '#FFFFFF' }}
                      >
                        <option value="RENTAL">Monthly Rental (₹499/mo)</option>
                        <option value="CUSTOM">Custom Plan</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '2px' }}>
                        T+1 MDR (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={managingChannelsData.payswiff.rate_t1 || 1.50}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 1.50;
                          setManagingChannelsData(prev => ({
                            ...prev,
                            payswiff: { ...prev.payswiff, rate_t1: val }
                          }));
                        }}
                        style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem', fontWeight: 700, boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '2px' }}>
                        Instant MDR (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={managingChannelsData.payswiff.rate_instant || 1.80}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 1.80;
                          setManagingChannelsData(prev => ({
                            ...prev,
                            payswiff: { ...prev.payswiff, rate_instant: val }
                          }));
                        }}
                        style={{ width: '100%', padding: '0.4rem 0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem', fontWeight: 700, boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Active QR Channel Card */}
              {managingChannelsData.qr?.enabled && (
                <div style={{ background: '#FFFFFF', border: '1.5px solid #DDD6FE', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '1rem' }}>📱</span>
                      <strong style={{ fontSize: '0.75rem', color: '#7C3AED' }}>Company QR (UPI) Channel</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => setManagingChannelsData(prev => ({
                        ...prev,
                        qr: { ...prev.qr, enabled: false }
                      }))}
                      style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: '0.625rem', fontWeight: 800, borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}
                    >
                      ✕ Remove
                    </button>
                  </div>

                  <div style={{ fontSize: '0.65625rem', color: '#64748B' }}>
                    <strong>Vendor Entity:</strong> <span style={{ color: '#7C3AED', fontWeight: 700 }}>RONAV Technologies</span> (Corporate HQ QR) • <span style={{ color: '#059669', fontWeight: 700 }}>Strictly Instant Settlement</span>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '2px' }}>
                      Custom Instant MDR Fee (%) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.0"
                      max="4.0"
                      value={managingChannelsData.qr.rate_instant || 1.50}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 1.50;
                        setManagingChannelsData(prev => ({
                          ...prev,
                          qr: { ...prev.qr, rate_instant: val }
                        }));
                      }}
                      placeholder="e.g. 1.20 or 1.50"
                      style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8125rem', fontWeight: 800, color: '#7C3AED', boxSizing: 'border-box' }}
                    />
                    <span style={{ fontSize: '0.625rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                      Configurable Instant fee percentage deducted from customer QR payments.
                    </span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setManagingChannelsMerchant(null)}
                  style={{ flex: 1, padding: '0.5rem', background: '#F1F5F9', border: 'none', borderRadius: '8px', color: '#475569', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveManageChannels}
                  disabled={isSavingChannels}
                  style={{ flex: 2, padding: '0.5rem', background: '#0F52BA', border: 'none', borderRadius: '8px', color: '#FFFFFF', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer' }}
                >
                  {isSavingChannels ? 'Saving...' : 'Save Channel Portfolio'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Partner Details Modal */}
      {editingPartner.isOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(10, 25, 47, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            maxWidth: '400px',
            width: '100%',
            padding: '1.5rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #CBD5E1'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
                  Edit Partner Details
                </h3>
                <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                  {editingPartner.user?.role?.replace('_', ' ')}: {editingPartner.user?.id}
                </span>
              </div>
              <button
                onClick={() => setEditingPartner({ isOpen: false, user: null, name: '', mobile: '' })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            <form onSubmit={handleSavePartnerDetails} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Full Name / Store Name
                </label>
                <input
                  type="text"
                  value={editingPartner.name}
                  onChange={(e) => setEditingPartner(prev => ({ ...prev, name: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.8125rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  10-Digit Mobile Number
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={editingPartner.mobile}
                  onChange={(e) => setEditingPartner(prev => ({ ...prev, mobile: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.8125rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingPartner({ isOpen: false, user: null, name: '', mobile: '' })}
                  style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: '#0F52BA', color: '#FFFFFF', border: 'none', padding: '0.5rem 1.25rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 6px rgba(15,82,186,0.25)' }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Reset Password Modal */}
      {resetPassModal.isOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(10, 25, 47, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            maxWidth: '400px',
            width: '100%',
            padding: '1.5rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #CBD5E1'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Key style={{ width: '16px', height: '16px' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
                    Reset Password
                  </h3>
                  <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                    {resetPassModal.user?.name} ({resetPassModal.user?.id})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetPassModal({ isOpen: false, user: null, newPassword: '', isSubmitting: false, successResult: null })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            {resetPassModal.successResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ padding: '1rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#DCFCE7', color: '#15803D', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '6px' }}>
                    <Check style={{ width: '20px', height: '20px' }} />
                  </div>
                  <strong style={{ display: 'block', fontSize: '0.875rem', color: '#15803D' }}>Password Successfully Updated!</strong>
                  <span style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px', display: 'block' }}>
                    New active password for {resetPassModal.successResult.id}:
                  </span>
                  <div style={{ margin: '0.75rem 0', padding: '0.5rem', background: '#FFFFFF', border: '1px dashed #16A34A', borderRadius: '8px' }}>
                    <code style={{ fontSize: '1.125rem', fontWeight: 900, color: '#0F172A', letterSpacing: '0.05em' }}>
                      {resetPassModal.successResult.password}
                    </code>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <a
                    href={`https://api.whatsapp.com/send?phone=${resetPassModal.successResult.mobile}&text=${encodeURIComponent(`*RONAV Security Alert*\nHello ${resetPassModal.successResult.name},\nYour account password for User ID ${resetPassModal.successResult.id} has been reset by Admin.\n\nNew Password: ${resetPassModal.successResult.password}\nLogin Portal: ${typeof window !== 'undefined' ? window.location.origin : ''}\n\nPlease keep your credentials safe.`)}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ flex: 1, padding: '0.625rem', background: '#25D366', color: '#FFF', textDecoration: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <span>💬 Send on WhatsApp</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      const portalUrl = typeof window !== 'undefined' ? window.location.origin : '';
                      const shareText = `*RONAV Security Alert*\nHello ${resetPassModal.successResult.name},\nYour account password for User ID ${resetPassModal.successResult.id} has been reset.\nNew Password: ${resetPassModal.successResult.password}\nLogin: ${portalUrl}`;
                      copyToClipboard(shareText, 'reset-pass-copy');
                    }}
                    style={{ flex: 1, padding: '0.625rem', background: '#0F52BA', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <Copy style={{ width: '13px', height: '13px' }} />
                    <span>{copiedId['reset-pass-copy'] ? 'Copied!' : 'Copy Info'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setResetPassModal({ isOpen: false, user: null, newPassword: '', isSubmitting: false, successResult: null })}
                  style={{ padding: '0.5rem', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                      Enter New Password *
                    </label>
                    <button
                      type="button"
                      onClick={() => setResetPassModal(prev => ({ ...prev, newPassword: `Ronav@${Math.floor(1000 + Math.random() * 9000)}` }))}
                      style={{ background: 'none', border: 'none', color: '#0F52BA', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      🎲 Generate Random
                    </button>
                  </div>
                  <input
                    type="text"
                    value={resetPassModal.newPassword}
                    onChange={(e) => setResetPassModal(prev => ({ ...prev, newPassword: e.target.value }))}
                    required
                    placeholder="e.g. Ronav@2025"
                    style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.875rem', fontFamily: 'monospace', fontWeight: 700 }}
                  />
                  <span style={{ fontSize: '0.6875rem', color: '#64748B', display: 'block', marginTop: '4px' }}>
                    The user will immediately be able to log in with this new password.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setResetPassModal({ isOpen: false, user: null, newPassword: '', isSubmitting: false, successResult: null })}
                    style={{ flex: 1, padding: '0.625rem', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetPassModal.isSubmitting}
                    style={{ flex: 1, padding: '0.625rem', background: '#0F52BA', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    {resetPassModal.isSubmitting ? 'Updating...' : 'Save & Update'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* T+1 BANK BATCH DISBURSAL MODAL */}
      {batchDisbursalModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 25, 47, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
          overflowY: 'auto'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            border: '1.5px solid #CBD5E1',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              background: '#0A192F',
              color: '#FFFFFF',
              padding: '1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Landmark style={{ width: '18px', height: '18px', color: '#60A5FA' }} />
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                  Mark T+1 Bank Batch as Disbursed
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setBatchDisbursalModal(null)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                background: '#F0FDF4',
                border: '1px solid #86EFAC',
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: '#166534', fontWeight: 700, textTransform: 'uppercase' }}>
                    Batch Disbursal Summary
                  </span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#15803D' }}>
                    ₹{batchDisbursalModal.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.6875rem', color: '#166534', fontWeight: 700 }}>Total Records</span>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0F172A' }}>
                    {batchDisbursalModal.items.length} Payouts
                  </div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '0.35rem' }}>
                  Bank CMS / Batch Reference UTR Number *
                </label>
                <input
                  type="text"
                  placeholder="e.g. CMS-HDFC-991248 or SBI-BULK-20260912"
                  value={batchDisbursalModal.batchUtr}
                  onChange={(e) => setBatchDisbursalModal({ ...batchDisbursalModal, batchUtr: e.target.value.toUpperCase() })}
                  style={{
                    width: '100%',
                    background: '#FFFFFF',
                    border: '1.5px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '0.55rem 0.75rem',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: '#0F172A',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
                <span style={{ fontSize: '0.65rem', color: '#64748B', display: 'block', marginTop: '3px' }}>
                  Enter the batch acknowledgement UTR or reference number generated by your corporate net banking upload.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '0.35rem' }}>
                  Batch Settlement Narration
                </label>
                <input
                  type="text"
                  value={batchDisbursalModal.remark}
                  onChange={(e) => setBatchDisbursalModal({ ...batchDisbursalModal, remark: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.75rem',
                    color: '#0F172A',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{
                fontSize: '0.6875rem',
                color: '#475569',
                background: '#F8FAFC',
                padding: '0.625rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid #E2E8F0'
              }}>
                ℹ️ Clicking <strong>"Confirm &amp; Settle Batch"</strong> will automatically mark all {batchDisbursalModal.items.length} records as <strong>Settled &amp; Disbursed</strong> with the batch UTR and notify merchants.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  disabled={batchDisbursalModal.isSubmitting}
                  onClick={() => setBatchDisbursalModal(null)}
                  style={{
                    background: '#F1F5F9',
                    color: '#475569',
                    border: '1px solid #CBD5E1',
                    padding: '0.55rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={batchDisbursalModal.isSubmitting || !batchDisbursalModal.batchUtr}
                  onClick={() => handleBatchPayoutDisbursal(
                    batchDisbursalModal.items,
                    batchDisbursalModal.batchUtr,
                    batchDisbursalModal.remark
                  )}
                  style={{
                    background: '#059669',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 6px rgba(5,150,105,0.3)'
                  }}
                >
                  <CheckCircle2 style={{ width: '15px', height: '15px' }} />
                  <span>{batchDisbursalModal.isSubmitting ? 'Settling Batch...' : 'Confirm & Settle Batch'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DISBURSAL CONFIRMATION MODAL */}
      {disbursingPayout && disbursingPayout.payout && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 25, 47, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
          overflowY: 'auto'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            border: '1.5px solid #CBD5E1',
            overflow: 'hidden',
            animation: 'slideIn 0.2s ease-out'
          }}>
            {/* Modal Header (Fixed at Top) */}
            <div style={{
              background: '#0A192F',
              color: '#FFFFFF',
              padding: '1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem'
                }}>
                  🏦
                </div>
                <div>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 900, margin: 0, letterSpacing: '-0.01em' }}>
                    Settle Withdrawal Payout
                  </h3>
                  <span style={{ fontSize: '0.6875rem', color: '#94A3B8' }}>
                    Beneficiary details & manual Bank UTR verification
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDisbursingPayout(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            {(() => {
              const p = disbursingPayout.payout;
              const targetAccount = p.account_number || p.account || p.bank_account || 'N/A';
              const targetIfsc = p.ifsc_code || p.ifsc || 'N/A';
              const targetBank = p.bank_name || p.bank || 'Bank Account';
              const targetBeneficiary = p.customer_name || p.holder_name || p.merchant_name || 'Beneficiary';
              const targetAmount = parseFloat(p.amount || 0);
              const statusChoice = disbursingPayout.actionType || 'DISPATCH'; // Default: 'DISPATCH' (Pending/In-Transit)

              // Formatted single line for fast pasting into banking portals
              const allTransferDetails = `Name: ${targetBeneficiary} | Bank: ${targetBank} | A/C: ${targetAccount} | IFSC: ${targetIfsc} | Amount: ₹${targetAmount}`;

              return (
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  {/* 1. Net Disbursal Amount Banner (NO "Copy 2000" BUTTON) */}
                  <div style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '14px',
                    padding: '0.875rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                        Net Disbursal Amount
                      </span>
                      <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0F172A', marginTop: '1px', lineHeight: 1.1 }}>
                        ₹{targetAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      color: '#0F52BA',
                      background: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      padding: '3px 8px',
                      borderRadius: '6px'
                    }}>
                      {p.settlement_mode === 'INSTANT' ? '⚡ Instant IMPS' : '📅 Standard Payout'}
                    </span>
                  </div>

                  {/* 2. Modern Beneficiary Bank Details Card */}
                  <div style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '14px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    boxShadow: '0 1px 3px rgba(15,23,42,0.03)'
                  }}>
                    {/* Header with Minimalist "Copy All Details" Button */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Beneficiary Details
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(allTransferDetails, 'modal_all_details')}
                        style={{
                          background: copiedId['modal_all_details'] ? '#ECFDF5' : '#F8FAFC',
                          color: copiedId['modal_all_details'] ? '#059669' : '#0F52BA',
                          border: copiedId['modal_all_details'] ? '1px solid #A7F3D0' : '1px solid #CBD5E1',
                          padding: '0.3rem 0.65rem',
                          borderRadius: '6px',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Copy style={{ width: '12px', height: '12px' }} />
                        <span>{copiedId['modal_all_details'] ? '✓ Copied All' : 'Copy All Details'}</span>
                      </button>
                    </div>

                    {/* Beneficiary Name & Bank */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.625rem', color: '#64748B', display: 'block' }}>Beneficiary / Holder Name</span>
                        <strong style={{ fontSize: '0.875rem', color: '#0F172A' }}>{targetBeneficiary}</strong>
                        {p.customer_mobile && (
                          <span style={{ fontSize: '0.6875rem', color: '#64748B', marginLeft: '6px' }}>({p.customer_mobile})</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(targetBeneficiary, 'modal_ben_name')}
                        style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569', padding: '3px 7px', borderRadius: '5px', fontSize: '0.625rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                      >
                        <Copy style={{ width: '10px', height: '10px' }} />
                        <span>{copiedId['modal_ben_name'] ? '✓' : 'Copy'}</span>
                      </button>
                    </div>

                    {/* Bank Name */}
                    <div style={{ borderTop: '1px solid #F8FAFC', paddingTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.625rem', color: '#64748B', display: 'block' }}>Destination Bank</span>
                      <strong style={{ fontSize: '0.8125rem', color: '#0F172A' }}>{targetBank}</strong>
                    </div>

                    {/* Account Number with Clean Copy */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                      <div>
                        <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#64748B', display: 'block' }}>
                          Account Number
                        </span>
                        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                          {targetAccount}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(targetAccount, 'modal_acc')}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          color: '#0F172A',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Copy style={{ width: '11px', height: '11px' }} />
                        <span>{copiedId['modal_acc'] ? '✓' : 'Copy'}</span>
                      </button>
                    </div>

                    {/* IFSC Code with Clean Copy */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                      <div>
                        <span style={{ fontSize: '0.625rem', fontWeight: 600, color: '#64748B', display: 'block' }}>
                          IFSC Code
                        </span>
                        <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                          {targetIfsc}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(targetIfsc, 'modal_ifsc')}
                        style={{
                          background: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          color: '#0F172A',
                          padding: '0.3rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Copy style={{ width: '11px', height: '11px' }} />
                        <span>{copiedId['modal_ifsc'] ? '✓' : 'Copy'}</span>
                      </button>
                    </div>

                    <div style={{ fontSize: '0.6875rem', color: '#64748B', display: 'flex', justifyContent: 'space-between', paddingTop: '0.25rem' }}>
                      <span>Originating Merchant:</span>
                      <strong style={{ color: '#334155' }}>{p.merchant_name} ({p.merchant_id})</strong>
                    </div>
                  </div>

                  {/* 3. UTR and Remarks Input Fields (Manual Netbanking Verification) */}
                  <div style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem'
                  }}>
                    {/* Bank UTR Input */}
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span>Bank UTR / Transaction Reference Number</span>
                          <span style={{ color: '#DC2626' }}>*</span>
                        </span>
                        <span style={{ fontSize: '0.65rem', color: '#059669', fontWeight: 700 }}>Required for Complete</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Enter Bank UTR (e.g. 426182947192, CMS-IMPS-9021)"
                        value={disbursingPayout.utr || ''}
                        onChange={(e) => setDisbursingPayout(prev => ({ ...prev, utr: e.target.value.toUpperCase() }))}
                        style={{
                          width: '100%',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '8px',
                          border: '1.5px solid #CBD5E1',
                          fontSize: '0.875rem',
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          color: '#0F172A',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#0F52BA'}
                        onBlur={(e) => e.target.style.borderColor = '#CBD5E1'}
                      />
                      <span style={{ fontSize: '0.6875rem', color: '#64748B', display: 'block', marginTop: '4px' }}>
                        Enter the official UTR or reference number generated by your bank netbanking portal after transferring funds.
                      </span>
                    </div>

                    {/* Admin Remarks Input */}
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '0.35rem' }}>
                        Admin Remarks / Notes (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Cleared via Corporate Netbanking / IMPS"
                        value={disbursingPayout.remark || ''}
                        onChange={(e) => setDisbursingPayout(prev => ({ ...prev, remark: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '0.6rem 0.85rem',
                          borderRadius: '8px',
                          border: '1px solid #CBD5E1',
                          fontSize: '0.8125rem',
                          color: '#0F172A',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Modal Footer: 3 Distinct Actions (Keep Pending, Reject, Complete & Disburse) */}
            <div style={{
              flexShrink: 0,
              background: '#F8FAFC',
              borderTop: '1px solid #E2E8F0',
              padding: '0.875rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              flexWrap: 'wrap'
            }}>
              {/* Left Action: Keep Pending */}
              <button
                type="button"
                disabled={disbursingPayout.isSubmitting}
                onClick={() => {
                  triggerToast(`Withdrawal payout for ${disbursingPayout.payout?.merchant_name || 'Merchant'} kept in pending queue.`, 'info');
                  setDisbursingPayout(null);
                }}
                title="Leave this transaction in Pending status"
                style={{
                  background: '#FFFBEB',
                  color: '#B45309',
                  border: '1px solid #FDE68A',
                  padding: '0.6rem 0.9rem',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                ⏳ Keep Pending
              </button>

              {/* Right Actions: Reject and Complete */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  disabled={disbursingPayout.isSubmitting}
                  onClick={async () => {
                    const p = disbursingPayout.payout;
                    const confirmed = window.confirm(`Reject withdrawal payout of ₹${parseFloat(p.amount).toLocaleString('en-IN')} for ${p.merchant_name}? Funds will be refunded to merchant wallet.`);
                    if (!confirmed) return;
                    setDisbursingPayout(prev => ({ ...prev, isSubmitting: true }));
                    await handlePayoutAction(
                      p.id,
                      'REJECT',
                      p.merchant_name,
                      p.amount,
                      '',
                      disbursingPayout.remark || 'Payout Request Declined by Admin'
                    );
                  }}
                  title="Reject payout and refund wallet balance"
                  style={{
                    background: '#FEF2F2',
                    color: '#DC2626',
                    border: '1px solid #FECACA',
                    padding: '0.6rem 0.9rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  ✕ Reject
                </button>

                <button
                  type="button"
                  disabled={disbursingPayout.isSubmitting}
                  onClick={async () => {
                    const p = disbursingPayout.payout;
                    const cleanUtr = (disbursingPayout.utr || '').trim();
                    if (!cleanUtr) {
                      triggerToast('⚠️ Please enter the Bank UTR / Reference Number before completing.', 'error');
                      return;
                    }
                    setDisbursingPayout(prev => ({ ...prev, isSubmitting: true }));
                    await handlePayoutAction(
                      p.id,
                      'APPROVE',
                      p.merchant_name,
                      p.amount,
                      cleanUtr,
                      disbursingPayout.remark || 'Disbursed via Bank CMS / Netbanking'
                    );
                  }}
                  title="Submit UTR and mark this payout as Complete & Settled"
                  style={{
                    background: '#059669',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '0.6rem 1.25rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: disbursingPayout.isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    boxShadow: '0 2px 6px rgba(5,150,105,0.25)'
                  }}
                >
                  {disbursingPayout.isSubmitting ? 'Processing...' : '✓ Complete & Disburse'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PORTAL VERIFICATION MODAL FOR RECORD SALES (ZERO NESTED BOXES) */}
      {verifyingSwipe && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 25, 47, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
          overflowY: 'auto'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            border: '1.5px solid #CBD5E1',
            overflow: 'hidden',
            animation: 'slideIn 0.2s ease-out'
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #0A192F 0%, #0F52BA 100%)',
              color: '#FFFFFF',
              padding: '1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '1rem'
                }}>
                  🔍
                </div>
                <div>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 900, margin: 0 }}>
                    Verify POS Slip with Portal
                  </h3>
                  <span style={{ fontSize: '0.6875rem', opacity: 0.85 }}>
                    Check slip UTR in Pine Labs / Payswiff portal
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVerifyingSwipe(null)}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              {/* Summary Strip (Clean & Direct) */}
              <div style={{
                background: '#F8FAFC',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '1rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '0.75rem'
              }}>
                <div>
                  <span style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                    Retailer Store
                  </span>
                  <strong style={{ fontSize: '0.9375rem', color: '#0F172A', display: 'block', marginTop: '2px' }}>
                    {verifyingSwipe.txn.merchant_name}
                  </strong>
                  <span style={{ fontSize: '0.6875rem', color: '#64748B', fontFamily: 'monospace' }}>
                    MID: {verifyingSwipe.txn.merchant_id}
                  </span>
                </div>

                <div>
                  <span style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                    Customer
                  </span>
                  <strong style={{ fontSize: '0.9375rem', color: '#0F172A', display: 'block', marginTop: '2px' }}>
                    {verifyingSwipe.txn.customer_name || 'Counter Customer'}
                  </strong>
                  {verifyingSwipe.txn.customer_mobile && (
                    <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                      {verifyingSwipe.txn.customer_mobile}
                    </span>
                  )}
                </div>

                <div>
                  <span style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                    Terminal Slip UTR
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                    <strong style={{ fontSize: '1rem', color: '#0F52BA', fontFamily: 'monospace', fontWeight: 900 }}>
                      {verifyingSwipe.txn.rrn_number}
                    </strong>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(verifyingSwipe.txn.rrn_number, 'modal_rrn')}
                      style={{
                        background: '#EFF6FF',
                        border: '1px solid #BFDBFE',
                        color: '#0F52BA',
                        padding: '2px 8px',
                        borderRadius: '5px',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      {copiedId['modal_rrn'] ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>
                    Terminal & Settlement
                  </span>
                  <strong style={{ fontSize: '0.875rem', color: '#0F172A', display: 'block', marginTop: '2px' }}>
                    {verifyingSwipe.txn.pos_provider || 'Pine Labs'} • {verifyingSwipe.txn.settlement_type || 'Instant'}
                  </strong>
                  <span style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 700 }}>
                    Swipe: ₹{parseFloat(verifyingSwipe.txn.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Invalidation Reason (shown when reject is selected) */}
              {verifyingSwipe.decision === 'REJECT' && (
                <div style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '10px',
                  padding: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#DC2626', display: 'block' }}>
                    Reason for Invalidation:
                  </label>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {[
                      'Slip UTR not found',
                      'Amount mismatch',
                      'Duplicate slip UTR',
                      'Declined on machine'
                    ].map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setVerifyingSwipe(prev => ({ ...prev, rejectReason: chip }))}
                        style={{
                          background: verifyingSwipe.rejectReason === chip ? '#DC2626' : '#FFFFFF',
                          border: `1px solid ${verifyingSwipe.rejectReason === chip ? '#DC2626' : '#FECACA'}`,
                          color: verifyingSwipe.rejectReason === chip ? '#FFFFFF' : '#DC2626',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={verifyingSwipe.rejectReason || ''}
                    onChange={(e) => setVerifyingSwipe(prev => ({ ...prev, rejectReason: e.target.value }))}
                    placeholder="Or type custom reason..."
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid #FECACA',
                      fontSize: '0.75rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}
            </div>

            {/* Modal Footer: 3 DIRECT INSTANT BUTTONS */}
            <div style={{
              flexShrink: 0,
              background: '#F8FAFC',
              borderTop: '1px solid #E2E8F0',
              padding: '0.875rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              flexWrap: 'wrap'
            }}>
              <button
                type="button"
                onClick={() => setVerifyingSwipe(null)}
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {/* 1. Invalid Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (verifyingSwipe.decision !== 'REJECT') {
                      setVerifyingSwipe(prev => ({ ...prev, decision: 'REJECT' }));
                    } else {
                      const t = verifyingSwipe.txn;
                      handleTransactionAction(
                        t.id,
                        'REJECT',
                        t.merchant_name,
                        t.amount,
                        verifyingSwipe.rejectReason || 'Invalid Slip UTR'
                      );
                    }
                  }}
                  style={{
                    background: '#FEF2F2',
                    color: '#DC2626',
                    border: '1px solid #FECACA',
                    padding: '0.5rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  {verifyingSwipe.decision === 'REJECT' ? '✕ Confirm Reject' : '✕ Invalid'}
                </button>

                {/* 2. Keep Pending Button */}
                <button
                  type="button"
                  onClick={() => {
                    triggerToast('Transaction kept in Pending status', 'info');
                    setVerifyingSwipe(null);
                  }}
                  style={{
                    background: '#FFFBEB',
                    color: '#D97706',
                    border: '1px solid #FCD34D',
                    padding: '0.5rem 0.85rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  ⏳ Keep Pending
                </button>

                {/* 3. Approve Button */}
                <button
                  type="button"
                  onClick={() => {
                    const t = verifyingSwipe.txn;
                    handleTransactionAction(
                      t.id,
                      'APPROVE',
                      t.merchant_name,
                      t.amount,
                      'Slip Verified & Credited'
                    );
                  }}
                  style={{
                    background: '#059669',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '0.5rem 1.1rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(5,150,105,0.25)'
                  }}
                >
                  ✓ Approve & Credit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin QR Code Preview Modal */}
      {showAdminQrPreview && (
        <div 
          className="modal-backdrop" 
          onClick={() => setShowAdminQrPreview(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            animation: 'fadeIn 0.2s ease'
          }}
        >
          <div 
            className="modal-dialog" 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              maxWidth: '380px', 
              width: '100%', 
              background: '#FFFFFF',
              borderRadius: '24px',
              padding: '1.25rem',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
              position: 'relative'
            }}
          >
            <button
              type="button"
              onClick={() => setShowAdminQrPreview(false)}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#F1F5F9',
                border: 'none',
                color: '#64748B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: 800,
                zIndex: 10
              }}
            >
              ✕
            </button>

            {companyQrImage && (
              <img
                src={companyQrImage}
                alt="Official Company QR"
                style={{
                  width: '100%',
                  maxHeight: '420px',
                  objectFit: 'contain',
                  borderRadius: '16px',
                  display: 'block'
                }}
              />
            )}

            {/* Payee Name on Scan Confirmation Badge */}
            <div style={{
              marginTop: '0.75rem',
              width: '100%',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '0.5rem 0.75rem',
              textAlign: 'center',
              boxSizing: 'border-box'
            }}>
              <span style={{
                fontSize: '0.625rem',
                color: '#64748B',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                display: 'block',
                marginBottom: '2px'
              }}>
                Payee Name on Scan (PhonePe / GPay)
              </span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px'
              }}>
                <span style={{
                  color: '#059669',
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  borderRadius: '50%',
                  width: '14px',
                  height: '14px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  fontWeight: 900
                }}>
                  ✓
                </span>
                <strong style={{
                  fontSize: '0.875rem',
                  color: '#0F172A',
                  fontWeight: 900,
                  letterSpacing: '0.02em'
                }}>
                  {companyQrPayeeName || 'RONAV TECHNOLOGIES'}
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Animations & Responsive Layout Styles */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateY(-12px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        /* Completely hide scrollbars on date buttons and horizontal bars */
        .admin-date-filter-scroll::-webkit-scrollbar,
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        .admin-date-filter-scroll,
        .no-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }

        /* Mobile-First Defaults */
        .admin-header {
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid #E2E8F0;
          padding: 0.625rem 1rem;
          position: sticky;
          top: 0;
          z-index: 50;
          box-shadow: 0 1px 3px rgba(15,23,42,0.04);
        }

        .admin-header-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }

        .admin-desktop-header-nav {
          display: none !important;
        }

        .admin-desktop-onboard-btn {
          display: none !important;
        }

        .admin-channel-bar-wrapper {
          background: #FFFFFF;
          border-bottom: 1px solid #E2E8F0;
          padding: 0.5rem 0.875rem;
          position: sticky;
          top: 0;
          z-index: 40;
          box-shadow: 0 1px 3px rgba(0,0,0,0.03);
        }

        .admin-channel-bar-inner {
          width: 100%;
        }

        .admin-main-container {
          padding: 1rem;
          flex-grow: 1;
          padding-bottom: 80px;
          width: 100%;
          box-sizing: border-box;
        }

        .admin-kpi-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }

        .admin-network-directory-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.625rem;
        }

        .admin-roster-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .admin-mobile-bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background-color: #0A192F;
          border-top: 1px solid #1E293B;
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          padding: 0.4rem 0;
          z-index: 90;
        }

        /* Dedicated Desktop UI (>= 1024px) */
        @media (min-width: 1024px) {
          .admin-header {
            padding: 0.65rem 1.75rem;
          }

          .admin-header-inner {
            max-width: 1440px;
            margin: 0 auto;
          }

          .admin-desktop-header-nav {
            display: flex !important;
            align-items: center;
            gap: 4px;
            background: #F1F5F9;
            padding: 3px 4px;
            border-radius: 10px;
            border: 1px solid #E2E8F0;
          }

          .admin-desktop-tab-btn {
            position: relative;
            background: transparent;
            color: #475569;
            border: none;
            border-radius: 7px;
            padding: 0.4rem 0.65rem;
            font-size: 0.75rem;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 5px;
            transition: all 0.15s ease;
            white-space: nowrap;
          }

          .admin-desktop-tab-btn:hover {
            color: #0F172A;
            background: rgba(255, 255, 255, 0.6);
          }

          .admin-desktop-tab-btn.is-active {
            background: #0F52BA !important;
            color: #FFFFFF !important;
            font-weight: 800;
            box-shadow: 0 2px 6px rgba(15, 82, 186, 0.25);
          }

          .admin-desktop-tab-badge {
            background: #DC2626;
            color: #FFFFFF;
            font-size: 0.625rem;
            font-weight: 900;
            padding: 1px 5px;
            border-radius: 9999px;
            line-height: 1.2;
          }

          .admin-desktop-tab-btn.is-active .admin-desktop-tab-badge {
            background: #FFFFFF;
            color: #DC2626;
          }

          .admin-desktop-onboard-btn {
            display: inline-flex !important;
            align-items: center;
            gap: 5px;
            background: #0F52BA;
            color: #FFFFFF;
            border: none;
            padding: 0.45rem 0.85rem;
            border-radius: 8px;
            font-size: 0.75rem;
            font-weight: 800;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(15, 82, 186, 0.2);
            transition: all 0.15s ease;
          }

          .admin-desktop-onboard-btn:hover {
            background: #0D47A1;
            transform: translateY(-1px);
          }

          .admin-channel-bar-wrapper {
            top: 57px !important;
            padding: 0.65rem 1.75rem;
          }

          .admin-channel-bar-inner {
            max-width: 1440px;
            margin: 0 auto;
          }

          .admin-main-container {
            max-width: 1440px !important;
            margin: 0 auto !important;
            padding: 1.5rem 1.75rem 3rem !important;
          }

          .admin-kpi-grid {
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 1rem !important;
          }

          .admin-network-directory-grid {
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 1rem !important;
          }

          .admin-roster-grid {
            display: grid !important;
            grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)) !important;
            gap: 1rem !important;
          }

          .admin-mobile-bottom-nav {
            display: none !important;
          }
        }

        /* Spacious Ultra-Wide Layout (>= 1280px) */
        @media (min-width: 1280px) {
          .admin-header-inner,
          .admin-channel-bar-inner,
          .admin-main-container {
            max-width: 1520px !important;
          }

          .admin-desktop-tab-btn {
            padding: 0.45rem 0.75rem;
            font-size: 0.78125rem;
            gap: 6px;
          }

          .admin-kpi-grid {
            grid-template-columns: repeat(6, 1fr) !important;
            gap: 0.875rem !important;
          }
        }
      `}</style>

    </div>
  );
}
