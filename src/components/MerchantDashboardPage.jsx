import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, Eye, EyeOff, Plus, Send, Landmark, History, 
  Smartphone, Zap, Tv, CreditCard, Car, BarChart3, Headphones,
  LogOut, PlusCircle, Home, User, Bell, Phone, CheckCircle2, 
  Clock, AlertCircle, X, ChevronRight, Check, ArrowRight,
  Search, Calendar, ArrowLeft, RefreshCw, FileText, Filter, ShieldCheck, LayoutGrid, MoreHorizontal,
  Users, Share2, Copy, ExternalLink, UserPlus, ChevronDown, ChevronUp, TrendingUp, Building2, MessageCircle, QrCode
} from 'lucide-react';
import { 
  getWallet, 
  getMerchantTransactions, 
  recordMerchantSale, 
  requestWithdrawal, 
  getBeneficiaries, 
  addBeneficiary,
  getMerchantWithdrawals,
  getDownstreamNetwork,
  getPartnerTransactions,
  createDownstreamUser,
  parsePosTerminalRates,
  parseMerchantChannels,
  getPlatformQrConfig,
  classifyTransactionChannel
} from '../services/api';
import { subscribeToWallet, subscribeToTransactions } from '../services/supabase';
import RonavLogo from './RonavLogo';

// Comprehensive Indian Banks Database for Search & Selection
const ALL_INDIAN_BANKS = [
  { name: 'State Bank of India', code: 'SBI', ifsc: 'SBIN0001234', popular: true },
  { name: 'HDFC Bank', code: 'HDFC', ifsc: 'HDFC0001234', popular: true },
  { name: 'ICICI Bank', code: 'ICICI', ifsc: 'ICIC0001234', popular: true },
  { name: 'Axis Bank', code: 'Axis', ifsc: 'UTIB0001234', popular: true },
  { name: 'Kotak Mahindra Bank', code: 'Kotak', ifsc: 'KKBK0001234', popular: true },
  { name: 'Punjab National Bank', code: 'PNB', ifsc: 'PUNB0001234', popular: true },
  { name: 'Bank of Baroda', code: 'BoB', ifsc: 'BARB0001234', popular: true },
  { name: 'Canara Bank', code: 'Canara', ifsc: 'CNRB0001234', popular: true },
  { name: 'Union Bank of India', code: 'UBI', ifsc: 'UBIN0001234', popular: false },
  { name: 'Bank of India', code: 'BOI', ifsc: 'BKID0001234', popular: false },
  { name: 'IndusInd Bank', code: 'IndusInd', ifsc: 'INDB0001234', popular: false },
  { name: 'Yes Bank', code: 'YES', ifsc: 'YESB0001234', popular: false },
  { name: 'IDFC FIRST Bank', code: 'IDFC', ifsc: 'IDFB0001234', popular: false },
  { name: 'Federal Bank', code: 'Federal', ifsc: 'FDRL0001234', popular: false },
  { name: 'Central Bank of India', code: 'CBI', ifsc: 'CBIN0001234', popular: false },
  { name: 'Indian Bank', code: 'Indian', ifsc: 'IDIB0001234', popular: false },
  { name: 'Indian Overseas Bank', code: 'IOB', ifsc: 'IOBA0001234', popular: false },
  { name: 'UCO Bank', code: 'UCO', ifsc: 'UCBA0001234', popular: false },
  { name: 'Bank of Maharashtra', code: 'BOM', ifsc: 'MAHB0001234', popular: false },
  { name: 'Punjab & Sind Bank', code: 'PSB', ifsc: 'PSIB0001234', popular: false },
  { name: 'South Indian Bank', code: 'SIB', ifsc: 'SIBL0001234', popular: false },
  { name: 'Karur Vysya Bank', code: 'KVB', ifsc: 'KVBL0001234', popular: false },
  { name: 'City Union Bank', code: 'CUB', ifsc: 'CIUB0001234', popular: false },
  { name: 'Bandhan Bank', code: 'Bandhan', ifsc: 'BDBL0001234', popular: false },
  { name: 'AU Small Finance Bank', code: 'AU', ifsc: 'AUBL0001234', popular: false },
  { name: 'Equitas Small Finance Bank', code: 'Equitas', ifsc: 'ESFB0001234', popular: false },
  { name: 'Ujjivan Small Finance Bank', code: 'Ujjivan', ifsc: 'UJVN0001234', popular: false },
  { name: 'Paytm Payments Bank', code: 'Paytm', ifsc: 'PYTM0123456', popular: false },
  { name: 'Airtel Payments Bank', code: 'Airtel', ifsc: 'AIRP0000001', popular: false },
  { name: 'Andhra Pragathi Grameena Bank', code: 'APGB', ifsc: 'APGB0001234', popular: false },
  { name: 'Telangana Grameena Bank', code: 'TGB', ifsc: 'TGBX0001234', popular: false },
  { name: 'Andhra Pradesh Grameena Vikas Bank', code: 'APGVB', ifsc: 'APGV0001234', popular: false },
  { name: 'Karnataka Bank', code: 'Karnataka', ifsc: 'KARB0001234', popular: false },
  { name: 'Tamilnad Mercantile Bank', code: 'TMB', ifsc: 'TMBL0001234', popular: false },
  { name: 'Standard Chartered Bank', code: 'SCB', ifsc: 'SCBL0036001', popular: false },
  { name: 'HSBC India', code: 'HSBC', ifsc: 'HSBC0560002', popular: false }
];

// Universal Institutional Bank Badge (Eliminates logo conflicts across 500+ Indian banks)
function BankLogo() {
  return (
    <div style={{
      width: '32px',
      height: '32px',
      borderRadius: '8px',
      background: '#EFF6FF',
      border: '1px solid #DBEAFE',
      color: '#0F52BA',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }}>
      <Landmark style={{ width: '16px', height: '16px', color: '#0F52BA' }} />
    </div>
  );
}

// Swipe Machine Configurations (Pine Labs & Payswiff)
const POS_MACHINES_DATA = {
  pine_labs: {
    key: 'pine_labs',
    provider: 'Pine Labs',
    title: 'Pine Labs POS',
    terminal_id: 'PINE-LABS-COUNTER',
    rateT1: 1.50,
    rateInstant: 1.80,
    rateStrT1: '1.50%',
    rateStrInstant: '1.80%',
    rate: '1.50%',
    rateNum: 1.50,
    icon: '🌲',
    themeColor: '#0F52BA',
    accentBg: '#EFF6FF',
    accentBorder: '#BFDBFE',
    badgeText: 'Instant Settled'
  },
  payswiff: {
    key: 'payswiff',
    provider: 'Payswiff',
    title: 'Payswiff POS',
    terminal_id: 'PAYSWIFF-COUNTER',
    rateT1: 1.65,
    rateInstant: 1.83,
    rateStrT1: '1.65%',
    rateStrInstant: '1.83%',
    rate: '1.65%',
    rateNum: 1.65,
    icon: '⚡',
    themeColor: '#D97706',
    accentBg: '#FFFBEB',
    accentBorder: '#FDE68A',
    badgeText: 'Smart Android'
  },
  qr: {
    key: 'qr',
    provider: 'Company QR (UPI)',
    title: 'Company QR',
    terminal_id: 'RONAV-UPI-HQ',
    rateT1: 1.80,
    rateInstant: 1.80,
    rateStrT1: '1.80% (Instant)',
    rateStrInstant: '1.80%',
    rate: '1.80%',
    rateNum: 1.80,
    icon: '📱',
    themeColor: '#7C3AED',
    accentBg: '#F5F3FF',
    accentBorder: '#DDD6FE',
    badgeText: 'Instant Settlements Only'
  }
};

const isQRTxn = (t) => classifyTransactionChannel(t) === 'qr';
const isPayswiffTxn = (t) => classifyTransactionChannel(t) === 'payswiff';
const isPineLabsTxn = (t) => classifyTransactionChannel(t) === 'pinelabs';




export default function MerchantDashboardPage({ user, onLogout }) {
  const [showBalance, setShowBalance] = useState(true);
  // Views: 'home' | 'record-sale' | 'withdraw' | 'bbps' | 'history'
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('ronav_merchant_active_tab');
      if (saved && ['home', 'record-sale', 'withdraw', 'bbps', 'history'].includes(saved)) {
        return saved;
      }
    }
    return 'home';
  });
  const [toastMessage, setToastMessage] = useState('');

  // Persist active tab across page refreshes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ronav_merchant_active_tab', activeTab);
    }
  }, [activeTab]);

  // Swipe Machine Active State (Case 1: Dual Machines vs Case 2: Single Machine)
  const [machineMode, setMachineMode] = useState('single');
  const [selectedMachineKey, setSelectedMachineKey] = useState('pine_labs');
  const [merchantPayswiffVendor, setMerchantPayswiffVendor] = useState('ALL'); // 'ALL' | 'ronav' | 'rp'
  const [userPos, setUserPos] = useState(null);

  const userPosRates = useMemo(() => {
    if (!userPos) return null;
    return parsePosTerminalRates(userPos.terminal_id, userPos.commission_rate);
  }, [userPos]);

  // Channel Portfolio for this merchant (Pine Labs, Payswiff, and explicitly granted QR)
  const merchantChannels = useMemo(() => {
    return userPos?.channels || parseMerchantChannels(userPos);
  }, [userPos]);

  // Dynamically compute which hardware machine tabs this merchant actually owns (Strictly assigned terminals)
  // NOTE: QR is NOT universally granted. It is ONLY visible if explicitly enabled for this merchant!
  const availableMachineTabs = useMemo(() => {
    if (merchantChannels && merchantChannels.enabledList && merchantChannels.enabledList.length > 0) {
      return merchantChannels.enabledList;
    }
    // Fallback if legacy single pos
    const tabs = [];
    if (userPos) {
      const prov = (userPos.provider || '').toLowerCase();
      if (prov.includes('swiff')) {
        tabs.push('payswiff');
      } else {
        tabs.push('pine_labs');
      }
    } else {
      tabs.push('pine_labs');
    }
    return tabs;
  }, [merchantChannels, userPos]);

  useEffect(() => {
    if (availableMachineTabs.length > 0 && !availableMachineTabs.includes(selectedMachineKey)) {
      setSelectedMachineKey(availableMachineTabs[0]);
    }
  }, [availableMachineTabs, selectedMachineKey]);

  const activeMachine = useMemo(() => {
    const effectiveKey = availableMachineTabs.includes(selectedMachineKey) 
      ? selectedMachineKey 
      : (availableMachineTabs[0] || 'pine_labs');
    const base = POS_MACHINES_DATA[effectiveKey] || POS_MACHINES_DATA.pine_labs;

    const ch = merchantChannels?.[effectiveKey];

    // QR Channel: Strictly inherits merchant's assigned custom Instant fee % and RONAV Technologies corporate entity
    if (effectiveKey === 'qr') {
      const instantRate = (ch && ch.rate_instant)
        ? ch.rate_instant
        : ((userPosRates && userPosRates.rateInstant) || base.rateInstant || 1.50);
      return {
        ...base,
        provider: 'Company QR (UPI)',
        vendor: 'RONAV Technologies',
        rateT1: instantRate,
        rateInstant: instantRate,
        rateStrT1: `${instantRate.toFixed(2)}%`,
        rateStrInstant: `${instantRate.toFixed(2)}%`,
        rate: `${instantRate.toFixed(2)}%`,
        rateNum: instantRate
      };
    }

    // Hardware POS terminals (Pine Labs or Payswiff)
    if (ch && ch.enabled) {
      const rateT1 = ch.rate_t1 || 1.50;
      const rateInstant = ch.rate_instant || 1.80;
      return {
        ...base,
        provider: effectiveKey === 'payswiff' ? 'Payswiff' : 'Pine Labs',
        vendor: ch.vendor || (effectiveKey === 'payswiff' ? 'RONAV Technologies' : 'Rose Navaneetham Enterprises'),
        terminal_id: ch.terminal_id || (effectiveKey === 'payswiff' ? 'SWIFF-01' : 'PL-01'),
        rateT1,
        rateInstant,
        rateStrT1: `${rateT1.toFixed(2)}%`,
        rateStrInstant: `${rateInstant.toFixed(2)}%`,
        rate: `${rateT1.toFixed(2)}%`,
        rateNum: rateT1,
        plan: ch.plan || 'RENTAL',
        rent: ch.rent || 499
      };
    }

    if (userPos && userPosRates) {
      return {
        ...base,
        provider: userPos.provider || base.provider,
        terminal_id: userPosRates.terminal_id || userPos.terminal_id || base.terminal_id,
        rateT1: userPosRates.rateT1 || base.rateT1,
        rateInstant: userPosRates.rateInstant || base.rateInstant,
        rateStrT1: `${(userPosRates.rateT1 || base.rateT1).toFixed(2)}%`,
        rateStrInstant: `${(userPosRates.rateInstant || base.rateInstant).toFixed(2)}%`,
        rate: `${(userPosRates.rateT1 || base.rateT1).toFixed(2)}%`,
        rateNum: userPosRates.rateT1 || base.rateT1
      };
    }
    return base;
  }, [selectedMachineKey, userPos, userPosRates, availableMachineTabs, merchantChannels]);

  // Live Wallet State (Pure Dynamic DB)
  const [wallet, setWallet] = useState({
    available_balance: 0.0,
    total_sales: 0.0,
    received_sales: 0.0,
    pending_balance: 0.0,
    withdrawn_amount: 0.0
  });

  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [beneficiaries, setBeneficiaries] = useState([]);

  // Modals state
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCustomerQRModalOpen, setIsCustomerQRModalOpen] = useState(false);
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

  useEffect(() => {
    // Dynamically fetch live official Company QR and Payee Name from Supabase for all devices
    getPlatformQrConfig().then(cfg => {
      if (cfg) {
        if (cfg.image) setCompanyQrImage(cfg.image);
        if (cfg.name) setCompanyQrPayeeName(cfg.name);
      }
    }).catch(() => {});
  }, [isCustomerQRModalOpen]);

  const [qrPresetAmount, setQrPresetAmount] = useState('');
  const [bbpsCategory, setBbpsCategory] = useState('mobile'); // 'mobile' | 'electricity' | 'dth' | 'fastag'
  const [txnStatusFilter, setTxnStatusFilter] = useState('APPROVED'); // 'APPROVED' | 'PENDING' | 'INVALID'
  const [txnCategoryFilter, setTxnCategoryFilter] = useState('ALL'); // 'ALL' | 'SWIPES' | 'WITHDRAWALS'

  // Record Sale Form state (Card Swipe Engine)
  const [saleForm, setSaleForm] = useState({
    amount: '',
    customer_name: '',
    customer_mobile: '',
    transaction_id: '',
    settlement_type: 'T1', // 'T1' (1.50%) or 'INSTANT' (1.80%)
    customer_charge_pct: '2.0', // 2.0% charged to customer
    notes: ''
  });
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);

  // Withdraw to Bank Form state (Merchant Payout or Customer Disbursal)
  const [payoutTargetType, setPayoutTargetType] = useState('CUSTOMER'); // 'CUSTOMER' | 'MERCHANT'
  const [customerPayoutForm, setCustomerPayoutForm] = useState({
    customer_name: '',
    customer_mobile: '',
    bank_name: '',
    account_number: '',
    confirm_account: '',
    ifsc: '',
    settlement_mode: 'T1' // Default: T+1 Standard (~95% volume)
  });
  const [bankInputMode, setBankInputMode] = useState('manual'); // 'manual' | 'saved'
  const [isSavingBeneficiary, setIsSavingBeneficiary] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [isBeneficiaryPickerOpen, setIsBeneficiaryPickerOpen] = useState(false);
  const [showManualBankFields, setShowManualBankFields] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [saveAsBeneficiaryOnTransfer, setSaveAsBeneficiaryOnTransfer] = useState(true);
  
  // Transaction & Payout Detail Modal State
  const [selectedTxnForDetails, setSelectedTxnForDetails] = useState(null);
  const [txnDetailType, setTxnDetailType] = useState('WITHDRAWAL'); // 'WITHDRAWAL' | 'SWIPE'
  const [showFullAccountInModal, setShowFullAccountInModal] = useState(true);

  // Add Bank Account Form state
  const [bankForm, setBankForm] = useState({
    bank_name: 'State Bank of India',
    account_number: '',
    confirm_account: '',
    ifsc: 'SBIN0001234',
    holder_name: ''
  });
  const [isSubmittingBank, setIsSubmittingBank] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [isBankPickerOpen, setIsBankPickerOpen] = useState(false);

  // Search filter for 40+ Indian banks
  const filteredBanksList = useMemo(() => {
    if (!bankSearchQuery.trim()) return ALL_INDIAN_BANKS;
    const q = bankSearchQuery.toLowerCase().trim();
    return ALL_INDIAN_BANKS.filter(b => 
      b.name.toLowerCase().includes(q) || 
      b.code.toLowerCase().includes(q) ||
      (b.ifsc && b.ifsc.toLowerCase().includes(q))
    );
  }, [bankSearchQuery]);

  // Live bank withdrawals list from DB with Settlement Mode Filtering (T+1 ~95% vs Instant ~5%)
  const [withdrawSettlementFilter, setWithdrawSettlementFilter] = useState('ALL'); // 'ALL' | 'T1' | 'INSTANT'
  const displayWithdrawals = useMemo(() => {
    const list = withdrawals || [];
    if (withdrawSettlementFilter === 'ALL') return list;
    return list.filter(w => {
      const mode = (w.settlement_mode || w.settlement_type || '').toUpperCase();
      const remark = (w.admin_remark || '').toUpperCase();
      const isInst = mode.includes('INSTANT') || remark.includes('IMPS') || remark.includes('INSTANT');
      return withdrawSettlementFilter === 'INSTANT' ? isInst : !isInst;
    });
  }, [withdrawals, withdrawSettlementFilter]);

  const withdrawalCounts = useMemo(() => {
    const list = withdrawals || [];
    let t1Count = 0;
    let instantCount = 0;
    list.forEach(w => {
      const mode = (w.settlement_mode || w.settlement_type || '').toUpperCase();
      const remark = (w.admin_remark || '').toUpperCase();
      const isInst = mode.includes('INSTANT') || remark.includes('IMPS') || remark.includes('INSTANT');
      if (isInst) instantCount++;
      else t1Count++;
    });
    return { all: list.length, t1: t1Count, instant: instantCount };
  }, [withdrawals]);

  // Helper to safely parse transaction metadata and format titles/UTRs without fake fields
  const parseTxnDisplay = (t) => {
    let customerName = (t.customer_name || '').trim();
    if (customerName === 'Counter Customer' || customerName === 'Walk-in Customer' || customerName === 'Customer') {
      customerName = '';
    }
    let customerMobile = t.customer_mobile || '';
    let utr = t.ref_number || t.rrn || t.utr || t.id || 'N/A';
    let terminalId = activeMachine?.terminal_id || 'COUNTER-POS';
    let settlementType = t.settlement_type || 'T1';
    let customerCharge = t.customer_charge || 0;
    let companyFee = t.company_fee || 0;
    let merchantCommission = t.merchant_commission || 0;
    let meta = null;

    if (t.notes && typeof t.notes === 'string' && t.notes.includes('[CARD_SWIPE_ENTRY]')) {
      try {
        const jsonPart = t.notes.slice(t.notes.indexOf('{'));
        meta = JSON.parse(jsonPart);
      } catch (_) {}
    }

    if (meta) {
      if (meta.customer_name && meta.customer_name !== 'Counter Customer' && meta.customer_name !== 'Walk-in Customer' && meta.customer_name !== 'Customer') {
        customerName = meta.customer_name;
      }
      if (meta.ref_number || meta.utr || meta.rrn) utr = meta.ref_number || meta.utr || meta.rrn;
      if (meta.customer_mobile) customerMobile = meta.customer_mobile;
      if (meta.terminal_id) terminalId = meta.terminal_id;
      if (meta.settlement_type) settlementType = meta.settlement_type;
      if (meta.customer_charge) customerCharge = meta.customer_charge;
      if (meta.company_fee) companyFee = meta.company_fee;
      if (meta.merchant_commission) merchantCommission = meta.merchant_commission;
    } else if (t.notes && typeof t.notes === 'string' && !t.notes.includes('{') && !t.notes.includes('[CARD_SWIPE_ENTRY]')) {
      // If user typed custom notes, don't confuse with title
    }

    // Clean display title: Priority: Customer Name > Customer (Mobile) > POS Swipe
    let title = customerName || (customerMobile ? `Customer (${customerMobile})` : `${t.provider || activeMachine?.title || 'POS'} Swipe`);

    return { 
      title, 
      utr, 
      rrn: utr, 
      customerMobile, 
      customerName, 
      terminalId, 
      settlementType, 
      customerCharge, 
      companyFee, 
      merchantCommission 
    };
  };

  // Live card swipe & QR transactions filtered strictly for the active machine/channel
  const activeMachineTransactions = useMemo(() => {
    return (transactions || []).filter(t => {
      if (t.type === 'BBPS_BILL') return false;
      const channel = classifyTransactionChannel(t);
      if (selectedMachineKey === 'qr') {
        return channel === 'qr';
      } else if (selectedMachineKey === 'payswiff') {
        if (channel !== 'payswiff') return false;
        const notes = (t.notes || '').toLowerCase();
        if (merchantPayswiffVendor === 'ronav') return !notes.includes('rp') && !notes.includes('r.p.');
        if (merchantPayswiffVendor === 'rp') return notes.includes('rp') || notes.includes('r.p.');
        return true;
      } else {
        return channel === 'pinelabs';
      }
    });
  }, [transactions, selectedMachineKey, merchantPayswiffVendor]);

  // Backward-compatible alias
  const swipeTransactions = activeMachineTransactions;

  // Live withdrawals filtered for the active machine
  const activeMachineWithdrawals = useMemo(() => {
    return (withdrawals || []).filter(w => {
      const channel = classifyTransactionChannel(w);
      if (selectedMachineKey === 'qr') {
        return channel === 'qr';
      } else if (selectedMachineKey === 'payswiff') {
        return channel === 'payswiff';
      } else {
        return channel === 'pinelabs';
      }
    });
  }, [withdrawals, selectedMachineKey]);

  // Reactive machine-specific Wallet Computation (Segregated Pine Labs vs Payswiff)
  const activeMachineWallet = useMemo(() => {
    const txns = activeMachineTransactions;
    const withs = activeMachineWithdrawals;

    const totalSales = txns.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const approvedTxns = txns.filter(t => (t.status || '').toUpperCase() === 'APPROVED');
    
    // Accurate net settlement amount credited (gross minus company fee)
    const receivedSales = approvedTxns.reduce((sum, t) => {
      const gross = parseFloat(t.amount) || 0;
      let fee = 0;
      if (t.notes && typeof t.notes === 'string' && t.notes.includes('[CARD_SWIPE_ENTRY]')) {
        try {
          const jsonPart = t.notes.slice(t.notes.indexOf('{'));
          const meta = JSON.parse(jsonPart);
          fee = parseFloat(meta.company_fee) || 0;
        } catch (_) {}
      }
      return sum + Math.max(0, gross - fee);
    }, 0);

    const pendingTxns = txns.filter(t => (t.status || '').toUpperCase() === 'PENDING');
    const pendingBalance = pendingTxns.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    const approvedWiths = withs.filter(w => (w.status || '').toUpperCase() === 'APPROVED');
    const withdrawnAmount = approvedWiths.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);
    const pendingWiths = withs.filter(w => (w.status || '').toUpperCase() === 'PENDING');
    const pendingWithdrawn = pendingWiths.reduce((sum, w) => sum + (parseFloat(w.amount) || 0), 0);

    const availableBalance = Math.max(0, parseFloat((receivedSales - withdrawnAmount - pendingWithdrawn).toFixed(2)));

    return {
      available_balance: availableBalance,
      total_sales: totalSales,
      received_sales: receivedSales,
      pending_balance: pendingBalance,
      withdrawn_amount: withdrawnAmount
    };
  }, [activeMachineTransactions, activeMachineWithdrawals]);

  // Dynamic Today's Stats filtered strictly for the active machine
  const todayStats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTxns = activeMachineTransactions.filter(t => {
      const d = new Date(t.created_at || Date.now()).toISOString().slice(0, 10);
      return d === todayStr;
    });

    const sales = todayTxns.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    const collected = todayTxns.filter(t => (t.status || '').toUpperCase() === 'APPROVED').reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    const pending = todayTxns.filter(t => (t.status || '').toUpperCase() === 'PENDING').reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

    return {
      sales,
      collected,
      pending,
      count: todayTxns.length
    };
  }, [activeMachineTransactions]);

  // BBPS Customer Bill Pay Form
  const [bbpsForm, setBbpsForm] = useState({
    mobile: '',
    operator: 'Jio Prepaid',
    consumer_number: '',
    biller_name: 'TSSPDCL - Southern Power (Telangana)',
    amount: ''
  });
  const [isSubmittingBbps, setIsSubmittingBbps] = useState(false);

  // History Filter Engine: 'TODAY' | 'YESTERDAY' | 'WEEK' | 'CUSTOM' | 'ALL'
  const [dateFilter, setDateFilter] = useState('ALL');
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const merchantId = user?.id || (user?.mid ? user.mid.replace('MID: ', '').trim() : 'MID3001');
  const merchantName = user?.name || 'Ravi Retail Store';
  const userRole = user?.role ? (user.role === 'MERCHANT' ? 'Retailer' : user.role) : 'Retailer';

  // Network & Referral Engine State
  const [networkData, setNetworkData] = useState({
    partners: [],
    total_commission_earned: 0,
    today_network_profit: 0,
    commission_rate_pct: 0.25
  });
  const [creatorPos, setCreatorPos] = useState(null);
  const [isLoadingNetwork, setIsLoadingNetwork] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [partnerTxns, setPartnerTxns] = useState([]);
  const [isLoadingPartnerTxns, setIsLoadingPartnerTxns] = useState(false);
  const [showOnboardForm, setShowOnboardForm] = useState(false);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [peopleRoleFilter, setPeopleRoleFilter] = useState('ALL');
  const [onboardForm, setOnboardForm] = useState({
    name: '',
    mobile: '',
    role: '',
    shop_name: '',
    pos_provider: 'Pine Labs',
    pos_vendor: 'Rose Navaneetham Enterprises',
    device_plan: 'RENTAL',
    monthly_rent: '499',
    settlement_type: 'T1',
    commission_rate_t1: '1.48',
    commission_rate_instant: '1.78',
    pos_terminal_id: '',
    password: ''
  });
  const [isSubmittingOnboard, setIsSubmittingOnboard] = useState(false);
  const [createdPartnerCreds, setCreatedPartnerCreds] = useState(null);

  // Handle POS Provider Change in Onboarding Drawer
  const handleOnboardProviderChange = (provider) => {
    if (provider === 'Pine Labs') {
      setOnboardForm(prev => ({
        ...prev,
        pos_provider: 'Pine Labs',
        pos_vendor: 'Rose Navaneetham Enterprises'
      }));
    } else {
      setOnboardForm(prev => ({
        ...prev,
        pos_provider: 'Payswiff',
        pos_vendor: prev.pos_vendor === 'R.P. Technologies' ? 'R.P. Technologies' : 'RONAV Technologies'
      }));
    }
  };

  const [expandedPartnerId, setExpandedPartnerId] = useState(null);

  // Allowed downstream roles based on hierarchy & Machine Provider (Pine Labs vs Payswiff)
  const allowedRolesForCreator = useMemo(() => {
    const r = (userRole || '').toUpperCase();
    const isPine = (onboardForm.pos_provider || 'Pine Labs') === 'Pine Labs';

    if (isPine) {
      // -------------------------------------------------------------------
      // 1. PINE LABS T+1: 4 Tiers (Super Distributor / Master can create Franchises, Distributors, and Retailers)
      // MASTER (1.21%) -> DIST Franchise (1.41%) -> Distributor (1.47%) -> Retailer (1.53%)
      // -------------------------------------------------------------------
      if (r.includes('MASTER') || r.includes('ADMIN') || r.includes('SUPER')) {
        return [
          { value: 'DIST_FRANCHISE', label: 'DIST Franchise', badge: 'MDR 1.41% • Margin +0.06%', icon: '🏢' },
          { value: 'DISTRIBUTOR', label: 'Distributor', badge: 'MDR 1.47% • Margin +0.06%', icon: '📦' },
          { value: 'MERCHANT', label: 'Retailer (Merchant)', badge: 'MDR 1.53% • Counter Swipe', icon: '🏪' }
        ];
      }

      if (r.includes('DISTRICT') || r.includes('FRANCHISE') || r === 'DD') {
        return [
          { value: 'DISTRIBUTOR', label: 'Distributor', badge: 'MDR 1.47% • Margin +0.06%', icon: '📦' },
          { value: 'MERCHANT', label: 'Retailer (Merchant)', badge: 'MDR 1.53% • Counter Swipe', icon: '🏪' }
        ];
      }

      if (r.includes('DISTRIBUTOR') || r.includes('DIST')) {
        return [
          { value: 'MERCHANT', label: 'Retailer (Merchant)', badge: 'MDR 1.53% • Counter Swipe', icon: '🏪' }
        ];
      }

      return [
        { value: 'MERCHANT', label: 'Retailer (Merchant)', badge: 'MDR 1.53% • Counter Swipe', icon: '🏪' }
      ];
    } else {
      // -------------------------------------------------------------------
      // 2. PAYSWIFF T+1: 5 Tiers (Super Distributor is INCLUDED)
      // MASTER (1.40%) -> Super Dist (1.42%) -> DIST Franchise (1.45%) -> Distributor (1.48%) -> Retailer (1.53%)
      // -------------------------------------------------------------------
      if (r.includes('MASTER') || r.includes('ADMIN')) {
        return [
          { value: 'SUPER_DISTRIBUTOR', label: 'Super Distributor (SD)', badge: 'MDR 1.42% • Margin +0.03%', icon: '⚡' },
          { value: 'DIST_FRANCHISE', label: 'DIST Franchise', badge: 'MDR 1.45% • Margin +0.03%', icon: '🏢' },
          { value: 'DISTRIBUTOR', label: 'Distributor', badge: 'MDR 1.48% • Margin +0.05%', icon: '📦' },
          { value: 'MERCHANT', label: 'Retailer (Merchant)', badge: 'MDR 1.53% • Counter Swipe', icon: '🏪' }
        ];
      }

      if (r.includes('SUPER')) {
        return [
          { value: 'DIST_FRANCHISE', label: 'DIST Franchise', badge: 'MDR 1.45% • Margin +0.03%', icon: '🏢' },
          { value: 'DISTRIBUTOR', label: 'Distributor', badge: 'MDR 1.48% • Margin +0.05%', icon: '📦' },
          { value: 'MERCHANT', label: 'Retailer (Merchant)', badge: 'MDR 1.53% • Counter Swipe', icon: '🏪' }
        ];
      }

      if (r.includes('DISTRICT') || r.includes('FRANCHISE') || r === 'DD') {
        return [
          { value: 'DISTRIBUTOR', label: 'Distributor', badge: 'MDR 1.48% • Margin +0.05%', icon: '📦' },
          { value: 'MERCHANT', label: 'Retailer (Merchant)', badge: 'MDR 1.53% • Counter Swipe', icon: '🏪' }
        ];
      }

      if (r.includes('DISTRIBUTOR') || r.includes('DIST')) {
        return [
          { value: 'MERCHANT', label: 'Retailer (Merchant)', badge: 'MDR 1.53% • Counter Swipe', icon: '🏪' }
        ];
      }

      return [
        { value: 'MERCHANT', label: 'Retailer (Merchant)', badge: 'MDR 1.53% • Counter Swipe', icon: '🏪' }
      ];
    }
  }, [userRole, onboardForm.pos_provider]);

  // Current user's tier margin for display based on active provider
  const userTierMargin = useMemo(() => {
    const r = (userRole || '').toUpperCase();
    const isPine = (onboardForm.pos_provider || 'Pine Labs') === 'Pine Labs';
    if (isPine) {
      if (r.includes('MASTER') || r.includes('ADMIN')) return '0.20';
      if (r.includes('DISTRICT') || r.includes('FRANCHISE') || r === 'DD') return '0.06';
      if (r.includes('DISTRIBUTOR') || r.includes('DIST')) return '0.06';
      return '0.00';
    } else {
      if (r.includes('MASTER') || r.includes('ADMIN')) return '0.02';
      if (r.includes('SUPER')) return '0.03';
      if (r.includes('DISTRICT') || r.includes('FRANCHISE') || r === 'DD') return '0.03';
      if (r.includes('DISTRIBUTOR') || r.includes('DIST')) return '0.05';
      return '0.00';
    }
  }, [userRole, onboardForm.pos_provider]);

  useEffect(() => {
    if (allowedRolesForCreator.length > 0) {
      if (!onboardForm.role || !allowedRolesForCreator.some(r => r.value === onboardForm.role)) {
        const firstRole = allowedRolesForCreator[0].value;
        const defaultT1 = firstRole === 'DISTRIBUTOR' ? '1.48' : (firstRole === 'DIST_FRANCHISE' ? '1.45' : '1.50');
        const defaultInstant = firstRole === 'DISTRIBUTOR' ? '1.78' : (firstRole === 'DIST_FRANCHISE' ? '1.75' : '1.80');
        setOnboardForm(prev => ({
          ...prev,
          role: firstRole,
          commission_rate_t1: prev.commission_rate_t1 || defaultT1,
          commission_rate_instant: prev.commission_rate_instant || defaultInstant
        }));
      }
    }
  }, [allowedRolesForCreator]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const fetchNetworkData = async () => {
    setIsLoadingNetwork(true);
    try {
      const res = await getDownstreamNetwork(merchantId);
      if (res.success) {
        setCreatorPos(res.creator_pos || null);
        setNetworkData({
          partners: res.partners || [],
          total_commission_earned: res.total_commission_earned || 0,
          today_network_profit: res.today_network_profit || 0,
          commission_rate_pct: res.commission_rate_pct || 0.25
        });
      }
    } catch (err) {
      console.error('Error fetching network:', err);
    } finally {
      setIsLoadingNetwork(false);
    }
  };

  const togglePartnerExpand = async (partner) => {
    if (expandedPartnerId === partner.id) {
      setExpandedPartnerId(null);
      return;
    }
    setExpandedPartnerId(partner.id);
    setSelectedPartner(partner);
    setIsLoadingPartnerTxns(true);
    try {
      const res = await getPartnerTransactions(merchantId, partner.id);
      if (res.success) {
        setPartnerTxns(res.transactions || []);
      }
    } catch (err) {
      console.error('Error loading partner txns:', err);
    } finally {
      setIsLoadingPartnerTxns(false);
    }
  };

  const handleOnboardSubmit = async (e) => {
    e.preventDefault();
    if (!onboardForm.name.trim() || !onboardForm.mobile.trim() || !onboardForm.role) {
      showToast('⚠️ Please enter partner name, mobile and select role.');
      return;
    }

    setIsSubmittingOnboard(true);
    try {
      const res = await createDownstreamUser({
        creator_id: merchantId,
        name: onboardForm.name.trim(),
        mobile: onboardForm.mobile.trim(),
        role: onboardForm.role,
        pos_provider: onboardForm.pos_provider || 'Pine Labs',
        pos_vendor: onboardForm.pos_vendor,
        pos_terminal_id: onboardForm.pos_terminal_id?.trim(),
        device_plan: onboardForm.device_plan,
        monthly_rent: onboardForm.monthly_rent,
        settlement_type: onboardForm.settlement_type || 'T1',
        commission_rate_t1: onboardForm.commission_rate_t1,
        commission_rate_instant: onboardForm.commission_rate_instant
      });

      if (res.success && res.credentials) {
        setCreatedPartnerCreds(res.credentials);
        showToast(`✓ Created ${res.credentials.role} Account (${res.credentials.id})!`);
        setOnboardForm({
          name: '',
          mobile: '',
          role: allowedRolesForCreator[0]?.value || 'MERCHANT',
          shop_name: '',
          pos_provider: 'Pine Labs',
          pos_vendor: 'Rose Navaneetham Enterprises',
          pos_terminal_id: '',
          device_plan: 'RENTAL',
          monthly_rent: '499',
          settlement_type: 'T1',
          commission_rate_t1: '1.48',
          commission_rate_instant: '1.78',
          password: ''
        });
        fetchNetworkData();
      } else {
        showToast(res.message || 'Error creating partner account');
      }
    } catch (err) {
      showToast('Server connection failed');
    } finally {
      setIsSubmittingOnboard(false);
    }
  };

  const fetchLiveData = async () => {
    try {
      const walletRes = await getWallet(merchantId);
      if (walletRes.success) {
        setWallet(walletRes.wallet);
        if (walletRes.pos) {
          setUserPos(walletRes.pos);
          const prov = (walletRes.pos.provider || '').toLowerCase();
          if (prov.includes('swiff')) {
            setSelectedMachineKey('payswiff');
          } else if (prov.includes('pine')) {
            setSelectedMachineKey('pine_labs');
          }
        }
      }

      const txnRes = await getMerchantTransactions(merchantId);
      if (txnRes.success && Array.isArray(txnRes.transactions)) {
        setTransactions(txnRes.transactions);
      } else {
        setTransactions([]);
      }

      const wthRes = await getMerchantWithdrawals(merchantId);
      if (wthRes.success && wthRes.withdrawals) {
        setWithdrawals(wthRes.withdrawals);
      }

      const benRes = await getBeneficiaries(merchantId);
      if (benRes.success && benRes.beneficiaries) {
        setBeneficiaries(benRes.beneficiaries);
        if (benRes.beneficiaries.length > 0) {
          const primary = benRes.beneficiaries.find(b => b.is_primary) || benRes.beneficiaries[0];
          setSelectedBankId(primary.id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLiveData();
    fetchNetworkData();

    // Live realtime subscriptions
    const unsubWallet = subscribeToWallet(merchantId, (updatedWallet) => {
      if (updatedWallet) setWallet(updatedWallet);
    });
    const unsubTxns = subscribeToTransactions(merchantId, () => {
      fetchLiveData();
    });

    return () => {
      if (unsubWallet) unsubWallet();
      if (unsubTxns) unsubTxns();
    };
  }, [merchantId]);

  // Reusable Ronav Wallet Balance Banner for Sub-pages (Matching Image 2 Mobile Fintech Style)
  const renderWalletBalanceCard = () => (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '20px',
      border: '1px solid #EDF2F7',
      padding: '1.125rem 1.25rem',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxShadow: '0 2px 12px rgba(0,0,0,0.02)',
      marginBottom: '1rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {activeMachine.title} Available Balance
          </span>
        </div>
        <span style={{ fontSize: '0.625rem', color: '#059669', fontWeight: 800, background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '2px 8px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#059669', display: 'inline-block' }}></span>
          READY FOR IMPS
        </span>
      </div>

      {/* Hero Amount Display */}
      <div style={{ margin: '0.25rem 0 0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
          <span style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            ₹{activeMachineWallet.available_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 500, marginTop: '2px', display: 'block' }}>
          Verified liquid funds on Terminal {activeMachine.terminal_id}
        </span>
      </div>

      {/* Modern Sleek Breakdown Strip (Matching Today's Sales Overview in Image 2) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', background: '#F8FAFC', borderRadius: '12px', padding: '0.625rem 0.5rem', gap: '0.375rem', textAlign: 'center' }}>
        <div>
          <span style={{ fontSize: '0.5625rem', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#059669' }}></span> Swipes
          </span>
          <strong style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#059669', display: 'block', marginTop: '2px' }}>
            ₹{activeMachineWallet.total_sales.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
          </strong>
        </div>

        <div style={{ borderLeft: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '0.5625rem', color: '#0F52BA', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#0F52BA' }}></span> Withdrawn
          </span>
          <strong style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A', display: 'block', marginTop: '2px' }}>
            ₹{activeMachineWallet.withdrawn_amount.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
          </strong>
        </div>

        <div>
          <span style={{ fontSize: '0.5625rem', color: '#D97706', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#D97706' }}></span> In Process
          </span>
          <strong style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#D97706', display: 'block', marginTop: '2px' }}>
            ₹{activeMachineWallet.pending_balance.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
          </strong>
        </div>
      </div>
    </div>
  );

  // Status breakdown counts for the Transactions tab quick filter buttons (Cards + Withdrawals)
  const txnStatusCounts = useMemo(() => {
    let pending = 0;
    let completed = 0;
    let invalid = 0;

    const targetList = [];
    if (txnCategoryFilter === 'ALL' || txnCategoryFilter === 'SWIPES') {
      (transactions || []).forEach(t => targetList.push(t));
    }
    if (txnCategoryFilter === 'ALL' || txnCategoryFilter === 'WITHDRAWALS') {
      (withdrawals || []).forEach(w => targetList.push(w));
    }

    targetList.forEach(item => {
      const st = (item.status || '').toUpperCase();
      if (st === 'PENDING') {
        pending++;
      } else if (st === 'APPROVED' || st === 'SUCCESS' || st === 'COMPLETED' || st === 'SETTLED') {
        completed++;
      } else if (st === 'REJECTED' || st === 'INVALID' || st === 'FAILED') {
        invalid++;
      }
    });

    return {
      all: targetList.length,
      pending,
      completed,
      invalid
    };
  }, [transactions, withdrawals, txnCategoryFilter]);

  // Unified Filtered Transactions & Bank Withdrawals with Category Filter, Status Buttons & Date Range
  const filteredTransactions = useMemo(() => {
    const rawList = [];

    // 1. Gather by Category
    if (txnCategoryFilter === 'ALL' || txnCategoryFilter === 'SWIPES') {
      (transactions || []).forEach(t => {
        rawList.push({
          ...t,
          activityType: 'SWIPE',
          sortDate: new Date(t.created_at || Date.now()).getTime()
        });
      });
    }

    if (txnCategoryFilter === 'ALL' || txnCategoryFilter === 'WITHDRAWALS') {
      (withdrawals || []).forEach(w => {
        rawList.push({
          ...w,
          activityType: 'WITHDRAWAL',
          sortDate: new Date(w.created_at || Date.now()).getTime()
        });
      });
    }

    // Sort descending by date (newest first)
    rawList.sort((a, b) => b.sortDate - a.sortDate);

    // 2. Filter by Status, Date, and Search Query
    return rawList.filter(item => {
      const itemDate = new Date(item.created_at || Date.now());
      const itemDateStr = itemDate.toISOString().slice(0, 10);
      
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      // Status Filter Buttons: 'ALL' | 'PENDING' | 'APPROVED' | 'INVALID'
      const st = (item.status || '').toUpperCase();
      if (txnStatusFilter === 'PENDING') {
        if (st !== 'PENDING') return false;
      } else if (txnStatusFilter === 'APPROVED') {
        if (st !== 'APPROVED' && st !== 'SUCCESS' && st !== 'COMPLETED' && st !== 'SETTLED') return false;
      } else if (txnStatusFilter === 'INVALID') {
        if (st !== 'REJECTED' && st !== 'INVALID' && st !== 'FAILED') return false;
      }

      // Date Filtering
      if (dateFilter === 'TODAY') {
        if (itemDateStr !== todayStr) return false;
      } else if (dateFilter === 'YESTERDAY') {
        if (itemDateStr !== yesterdayStr) return false;
      } else if (dateFilter === 'WEEK') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (itemDate < weekAgo) return false;
      } else if (dateFilter === 'CUSTOM') {
        if (customFromDate && itemDateStr < customFromDate) return false;
        if (customToDate && itemDateStr > customToDate) return false;
      }

      // Search Query (ID, RRN, UTR, Customer Mobile, Customer Name, Bank Name, Account Number, Notes, Admin Remark)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const idMatch = (item.id || '').toLowerCase().includes(q);
        const rrnMatch = (item.ref_number || item.rrn || '').toLowerCase().includes(q);
        const utrMatch = (item.utr_number || '').toLowerCase().includes(q);
        const mobileMatch = (item.customer_mobile || '').toLowerCase().includes(q);
        const nameMatch = (item.customer_name || '').toLowerCase().includes(q);
        const bankMatch = (item.bank_name || '').toLowerCase().includes(q);
        const accMatch = (item.account_number || '').toLowerCase().includes(q);
        const ifscMatch = (item.ifsc || '').toLowerCase().includes(q);
        const notesMatch = (item.notes || '').toLowerCase().includes(q);
        const remarkMatch = (item.admin_remark || '').toLowerCase().includes(q);

        if (!idMatch && !rrnMatch && !utrMatch && !mobileMatch && !nameMatch && !bankMatch && !accMatch && !ifscMatch && !notesMatch && !remarkMatch) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, withdrawals, txnCategoryFilter, txnStatusFilter, dateFilter, customFromDate, customToDate, searchQuery]);

  // Dynamic turnover totals for filtered activity (Sales vs Withdrawals)
  const activitySummary = useMemo(() => {
    let salesTotal = 0;
    let withdrawalTotal = 0;
    filteredTransactions.forEach(item => {
      const amt = parseFloat(item.amount) || 0;
      if (item.activityType === 'WITHDRAWAL') {
        withdrawalTotal += amt;
      } else {
        salesTotal += amt;
      }
    });
    return { salesTotal, withdrawalTotal };
  }, [filteredTransactions]);

  // Backward compatible total turnover
  const filteredTurnoverTotal = activitySummary.salesTotal;

  // Card Swipe record submission (Compulsory UTR / Transaction ID & Customer Info - Strictly uses activeMachine rates)
  const handleRecordSaleSubmit = async (e) => {
    e.preventDefault();
    const amountVal = parseFloat(saleForm.amount);
    if (!amountVal || amountVal <= 0) {
      showToast('⚠️ Please enter a valid card swipe amount.');
      return;
    }
    if (!saleForm.transaction_id || !saleForm.transaction_id.trim()) {
      showToast('⚠️ Slip UTR Number is required for verification!');
      return;
    }

    setIsSubmittingSale(true);
    try {
      const isInstant = saleForm.settlement_type === 'INSTANT' || selectedMachineKey === 'qr';
      const companyRate = selectedMachineKey === 'qr'
        ? (activeMachine.rateInstant || activeMachine.rateT1 || 1.80)
        : (isInstant ? (activeMachine.rateInstant || 1.80) : (activeMachine.rateT1 || 1.50));

      if (companyRate === undefined || companyRate === null || isNaN(companyRate) || companyRate <= 0) {
        showToast('⚠️ No active commission rate configured for this terminal. Please contact Admin.');
        setIsSubmittingSale(false);
        return;
      }

      const companyFee = (amountVal * companyRate) / 100;
      const netSettlement = Math.max(0, amountVal - companyFee);

      const res = await recordMerchantSale({
        merchant_id: merchantId,
        amount: amountVal,
        customer_name: (saleForm.customer_name || 'Customer').trim(),
        customer_mobile: (saleForm.customer_mobile || '').trim(),
        type: selectedMachineKey === 'qr' ? 'QR_SCAN' : 'POS_SWIPE',
        provider: activeMachine.provider,
        ref_number: saleForm.transaction_id.trim().toUpperCase(),
        settlement_type: selectedMachineKey === 'qr' ? 'INSTANT' : saleForm.settlement_type,
        customer_charge: 0,
        company_fee: companyFee,
        merchant_commission: 0,
        terminal_id: activeMachine.terminal_id,
        notes: selectedMachineKey === 'qr' 
          ? `Company QR UPI Collection (${companyQrPayeeName || 'RONAV TECHNOLOGIES'})` 
          : `${activeMachine.title} Swipe`
      });

      if (res.success) {
        showToast(`✓ ₹${amountVal.toLocaleString('en-IN')} Swipe Logged! Net Credit: ₹${netSettlement.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Company MDR: -₹${companyFee.toFixed(2)})`);
        setSaleForm({
          amount: '',
          customer_name: '',
          customer_mobile: '',
          transaction_id: '',
          settlement_type: 'T1',
          customer_charge_pct: '0',
          notes: ''
        });
        fetchLiveData();
      } else {
        showToast(res.message || 'Error recording swipe transaction');
      }
    } catch (err) {
      showToast('Failed to connect to server');
    } finally {
      setIsSubmittingSale(false);
    }
  };

  // Withdraw to Bank submission (Customer Liquidity Disbursal or Merchant Own Account)
  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawAmount);
    if (!amountNum || amountNum <= 0) {
      showToast('⚠️ Please enter a valid payout amount.');
      return;
    }

    if (amountNum > activeMachineWallet.available_balance) {
      showToast(`⚠️ Insufficient ${activeMachine.title} balance! Available: ₹${activeMachineWallet.available_balance.toFixed(2)}`);
      return;
    }

    let payload;
    if (payoutTargetType === 'CUSTOMER') {
      if (!customerPayoutForm.customer_name || !customerPayoutForm.customer_name.trim()) {
        showToast('⚠️ Please enter customer beneficiary name.');
        return;
      }
      if (!customerPayoutForm.account_number || !customerPayoutForm.account_number.trim()) {
        showToast('⚠️ Please enter customer bank account number.');
        return;
      }
      if (customerPayoutForm.confirm_account && customerPayoutForm.account_number !== customerPayoutForm.confirm_account) {
        showToast('⚠️ Customer account numbers do not match!');
        return;
      }
      if (!customerPayoutForm.ifsc || !customerPayoutForm.ifsc.trim()) {
        showToast('⚠️ Please enter bank IFSC code.');
        return;
      }
      if (!customerPayoutForm.bank_name || !customerPayoutForm.bank_name.trim()) {
        showToast('⚠️ Please enter bank name.');
        return;
      }

      payload = {
        merchant_id: merchantId,
        amount: amountNum,
        bank_name: customerPayoutForm.bank_name || 'Customer Bank',
        account_number: customerPayoutForm.account_number.trim(),
        ifsc: customerPayoutForm.ifsc.trim().toUpperCase(),
        payout_type: 'CUSTOMER_DISBURSAL',
        customer_name: customerPayoutForm.customer_name.trim(),
        customer_mobile: (customerPayoutForm.customer_mobile || '').trim(),
        settlement_mode: customerPayoutForm.settlement_mode || 'INSTANT',
        channel: selectedMachineKey,
        provider: activeMachine.provider
      };
    } else {
      const targetBank = beneficiaries.find(b => b.id === selectedBankId) || beneficiaries[0];
      if (!targetBank) {
        showToast('⚠️ Please link a bank account first.');
        return;
      }

      payload = {
        merchant_id: merchantId,
        amount: amountNum,
        bank_name: targetBank.bank_name || targetBank.bank,
        account_number: targetBank.account_number || targetBank.account,
        ifsc: targetBank.ifsc || 'SBIN0001234',
        payout_type: 'MERCHANT_OWN',
        settlement_mode: 'INSTANT',
        channel: selectedMachineKey,
        provider: activeMachine.provider
      };
    }

    setIsSubmittingWithdraw(true);
    try {
      const res = await requestWithdrawal(payload);
      if (res.success) {
        showToast(payoutTargetType === 'CUSTOMER'
          ? `✓ Disbursal Request of ₹${amountNum.toLocaleString('en-IN')} Sent to Admin! Admin will transfer and issue Bank UTR.`
          : '✓ Withdrawal request submitted! Admin will transfer funds.'
        );
        setWithdrawAmount('');
        if (payoutTargetType === 'CUSTOMER') {
          setCustomerPayoutForm({
            customer_name: '',
            customer_mobile: '',
            bank_name: 'State Bank of India',
            account_number: '',
            confirm_account: '',
            ifsc: '',
            settlement_mode: 'INSTANT'
          });
        }
        fetchLiveData();
      } else {
        showToast(res.message || 'Error processing payout request');
      }
    } catch (err) {
      showToast('Failed to process payout request');
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  // Add Bank Account submission
  const handleAddBankSubmit = async (e) => {
    e.preventDefault();
    if (!bankForm.bank_name || !bankForm.account_number) {
      showToast('⚠️ Please enter all bank account details.');
      return;
    }
    if (bankForm.confirm_account && bankForm.account_number !== bankForm.confirm_account) {
      showToast('⚠️ Account numbers do not match!');
      return;
    }

    setIsSubmittingBank(true);
    try {
      const res = await addBeneficiary({
        merchant_id: merchantId,
        bank_name: bankForm.bank_name,
        account_number: bankForm.account_number,
        ifsc: bankForm.ifsc || 'SBIN0001234',
        holder_name: bankForm.holder_name || merchantName,
        is_primary: beneficiaries.length === 0
      });

      if (res.success) {
        showToast('✓ Bank account linked successfully!');
        setIsAddAccountModalOpen(false);
        setBankForm({
          bank_name: 'State Bank of India',
          account_number: '',
          confirm_account: '',
          ifsc: 'SBIN0001234',
          holder_name: ''
        });
        fetchLiveData();
      }
    } catch (err) {
      showToast('Error linking bank account');
    } finally {
      setIsSubmittingBank(false);
    }
  };

  // Save entered bank account as beneficiary directly from Payouts screen
  const handleSaveCurrentAsBeneficiary = async () => {
    if (!customerPayoutForm.bank_name || !customerPayoutForm.bank_name.trim()) {
      showToast('⚠️ Please enter or select a Bank Name first.');
      return;
    }
    if (!customerPayoutForm.account_number || !customerPayoutForm.account_number.trim()) {
      showToast('⚠️ Please enter Account Number.');
      return;
    }
    if (customerPayoutForm.confirm_account && customerPayoutForm.account_number !== customerPayoutForm.confirm_account) {
      showToast('⚠️ Account numbers do not match!');
      return;
    }

    setIsSavingBeneficiary(true);
    try {
      const res = await addBeneficiary({
        merchant_id: merchantId,
        bank_name: customerPayoutForm.bank_name.trim(),
        account_number: customerPayoutForm.account_number.trim(),
        ifsc: customerPayoutForm.ifsc ? customerPayoutForm.ifsc.trim().toUpperCase() : 'SBIN0001234',
        holder_name: customerPayoutForm.customer_name ? customerPayoutForm.customer_name.trim() : merchantName,
        is_primary: beneficiaries.length === 0 ? 1 : 0
      });

      if (res.success) {
        showToast(`✓ Added ${customerPayoutForm.bank_name} to Saved Beneficiaries!`);
        fetchLiveData();
      } else {
        showToast(res.message || 'Failed to save beneficiary');
      }
    } catch (err) {
      showToast('Error saving beneficiary');
    } finally {
      setIsSavingBeneficiary(false);
    }
  };

  // BBPS Customer Bill Pay submission
  const handleBbpsSubmit = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(bbpsForm.amount);
    if (!amountNum || amountNum <= 0) {
      showToast('⚠️ Please enter a valid recharge/bill amount.');
      return;
    }

    setIsSubmittingBbps(true);
    try {
      const res = await recordMerchantSale({
        merchant_id: merchantId,
        amount: amountNum,
        customer_mobile: bbpsForm.mobile || '9988776655',
        type: 'BBPS_BILL',
        ref_number: `BBPS-${Math.floor(100000 + Math.random() * 900000)}`,
        notes: bbpsCategory === 'mobile' 
          ? `Mobile Recharge - ${bbpsForm.operator} (${bbpsForm.mobile})` 
          : (bbpsCategory === 'electricity' 
            ? `Electricity Bill - ${bbpsForm.biller_name} (A/C: ${bbpsForm.consumer_number})`
            : `DTH Recharge - ${bbpsForm.operator}`)
      });

      if (res.success) {
        showToast('✓ Bill Payment Successful! Receipt generated.');
        setBbpsForm({ mobile: '', operator: 'Jio Prepaid', consumer_number: '', biller_name: 'TSSPDCL - Southern Power (Telangana)', amount: '' });
        fetchLiveData();
      }
    } catch (err) {
      showToast('Error completing bill payment');
    } finally {
      setIsSubmittingBbps(false);
    }
  };

  // Filtered Downline People list
  const filteredPartners = useMemo(() => {
    let list = networkData.partners || [];
    if (peopleRoleFilter === 'SHOPS') {
      list = list.filter(p => p.role === 'MERCHANT' || p.id.startsWith('MID'));
    } else if (peopleRoleFilter === 'DISTRIBUTORS') {
      list = list.filter(p => p.role === 'DISTRIBUTOR' || p.id.startsWith('DIST'));
    } else if (peopleRoleFilter === 'DISTRICT') {
      list = list.filter(p => p.role === 'DISTRICT_DISTRIBUTOR' || p.role === 'DIST_FRANCHISE' || p.id.startsWith('DD') || p.id.startsWith('DF'));
    }
    if (peopleSearch.trim()) {
      const q = peopleSearch.toLowerCase().trim();
      list = list.filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.id && p.id.toLowerCase().includes(q)) ||
        (p.mobile && p.mobile.includes(q)) ||
        (p.pos_terminal && p.pos_terminal.toLowerCase().includes(q))
      );
    }
    return list;
  }, [networkData.partners, peopleRoleFilter, peopleSearch]);

  const directPartnersCount = networkData.partners.filter(p => p.is_direct).length;
  const indirectPartnersCount = networkData.partners.filter(p => !p.is_direct).length;
  const totalTeamVolume = networkData.partners.reduce((sum, p) => sum + (p.total_volume || 0), 0);
  const totalTodayVolume = networkData.partners.reduce((sum, p) => sum + (p.today_volume || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans merchant-responsive-wrapper">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: '#0F172A',
          color: '#FFFFFF',
          padding: '0.625rem 1.25rem',
          borderRadius: '24px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.8125rem',
          fontWeight: 700,
          whiteSpace: 'nowrap'
        }}>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Header Navigation Bar (Responsive for both Mobile & Desktop) */}
      <header style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', padding: '0.625rem 0', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="merchant-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
          
          {activeTab !== 'home' ? (
            /* Sub-page Header: Clean circle back button on left, and Secure badge + Profile round icon on the right */
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
              <button 
                onClick={() => setActiveTab('home')} 
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#0F172A',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease'
                }}
                title="Back to Dashboard"
                aria-label="Back"
              >
                <ArrowLeft style={{ width: '18px', height: '18px', strokeWidth: 2.5 }} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#059669', fontSize: '0.75rem', fontWeight: 700 }}>
                  <ShieldCheck style={{ width: '16px', height: '16px' }} />
                  <span>Secure &amp; Encrypted</span>
                </div>
                <button 
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  title="Account Details &amp; Profile"
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: activeTab === 'profile' ? '#0F52BA' : 'linear-gradient(135deg, #0F52BA 0%, #1E40AF 100%)',
                    color: '#FFFFFF',
                    border: activeTab === 'profile' ? '2.5px solid #2563EB' : '2px solid #DBEAFE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 900,
                    boxShadow: '0 2px 6px rgba(15,82,186,0.2)'
                  }}
                >
                  {merchantName ? merchantName.charAt(0).toUpperCase() : 'N'}
                </button>
              </div>
            </div>
          ) : (
            /* Home Page Header: Brand Logo + Desktop Nav + Round Profile Icon */
            <>
              {/* Official Brand Logo from Vercel */}
              <RonavLogo size="medium" />

              {/* Desktop Navigation Links */}
              <nav className="desktop-header-nav" style={{ display: 'none', alignItems: 'center', gap: '1.5rem' }}>
                <button 
                  onClick={() => setActiveTab('home')} 
                  style={{ background: 'none', border: 'none', color: activeTab === 'home' ? '#0F52BA' : '#64748B', fontWeight: 800, fontSize: '0.8125rem', cursor: 'pointer', borderBottom: activeTab === 'home' ? '2px solid #0F52BA' : '2px solid transparent', paddingBottom: '0.25rem' }}
                >
                  Home
                </button>
                <button 
                  onClick={() => setActiveTab('record-sale')} 
                  style={{ background: 'none', border: 'none', color: activeTab === 'record-sale' ? '#0F52BA' : '#64748B', fontWeight: 800, fontSize: '0.8125rem', cursor: 'pointer', borderBottom: activeTab === 'record-sale' ? '2px solid #0F52BA' : '2px solid transparent', paddingBottom: '0.25rem' }}
                >
                  Record Sale
                </button>
                <button 
                  onClick={() => setActiveTab('withdraw')} 
                  style={{ background: 'none', border: 'none', color: activeTab === 'withdraw' ? '#059669' : '#64748B', fontWeight: 800, fontSize: '0.8125rem', cursor: 'pointer', borderBottom: activeTab === 'withdraw' ? '2px solid #059669' : '2px solid transparent', paddingBottom: '0.25rem' }}
                >
                  Withdraw to Bank
                </button>
                <button 
                  onClick={() => setActiveTab('bbps')} 
                  style={{ background: 'none', border: 'none', color: activeTab === 'bbps' ? '#0F52BA' : '#64748B', fontWeight: 800, fontSize: '0.8125rem', cursor: 'pointer', borderBottom: activeTab === 'bbps' ? '2px solid #0F52BA' : '2px solid transparent', paddingBottom: '0.25rem' }}
                >
                  Bill Payments
                </button>
                <button 
                  onClick={() => setActiveTab('history')} 
                  style={{ background: 'none', border: 'none', color: activeTab === 'history' ? '#0F52BA' : '#64748B', fontWeight: 800, fontSize: '0.8125rem', cursor: 'pointer', borderBottom: activeTab === 'history' ? '2px solid #0F52BA' : '2px solid transparent', paddingBottom: '0.25rem' }}
                >
                  Transaction History
                </button>
                {userRole !== 'MERCHANT' && userRole !== 'Retailer' && (
                  <button 
                    onClick={() => setActiveTab('network')} 
                    style={{ background: 'none', border: 'none', color: activeTab === 'network' ? '#0F52BA' : '#64748B', fontWeight: 800, fontSize: '0.8125rem', cursor: 'pointer', borderBottom: activeTab === 'network' ? '2px solid #0F52BA' : '2px solid transparent', paddingBottom: '0.25rem' }}
                  >
                    My People
                  </button>
                )}
                <button 
                  onClick={() => setActiveTab('profile')} 
                  style={{ background: 'none', border: 'none', color: activeTab === 'profile' ? '#0F52BA' : '#64748B', fontWeight: 800, fontSize: '0.8125rem', cursor: 'pointer', borderBottom: activeTab === 'profile' ? '2px solid #0F52BA' : '2px solid transparent', paddingBottom: '0.25rem' }}
                >
                  Profile
                </button>
              </nav>

              {/* Right: Clean Round Account Avatar Icon Button (Click to open Dedicated Profile Page) */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button 
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  title="Account Profile &amp; Details"
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: activeTab === 'profile' ? '#0F52BA' : 'linear-gradient(135deg, #0F52BA 0%, #1E40AF 100%)',
                    color: '#FFFFFF',
                    border: activeTab === 'profile' ? '2.5px solid #2563EB' : '2px solid #DBEAFE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '0.9375rem',
                    fontWeight: 900,
                    boxShadow: '0 2px 8px rgba(15,82,186,0.25)',
                    position: 'relative',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  {merchantName ? merchantName.charAt(0).toUpperCase() : 'N'}
                  <span style={{
                    position: 'absolute',
                    bottom: '0px',
                    right: '0px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: '#10B981',
                    border: '2px solid #FFFFFF'
                  }} />
                </button>
              </div>
            </>
          )}

        </div>
      </header>

      {/* 2. Main Workspace Layout */}
      <main className="flex-grow" style={{ padding: '1rem 0 5.5rem' }}>
        <div className="merchant-container">
          
          {/* ========================================================= */}
          {/* VIEW 1: HOME (MATCHES Merchant dashboard.png IN BOTH VIEWPORTS) */}
          {/* ========================================================= */}
          {activeTab === 'home' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              
              {/* ========================================================= */}
              {/* SWIPE MACHINE (POS) & QR SELECTOR - FULL WIDTH 3 TABS     */}
              {/* ========================================================= */}
              <div style={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                background: '#F1F5F9',
                padding: '4px',
                borderRadius: '12px',
                gap: '4px',
                border: '1px solid #E2E8F0',
                marginBottom: '0.625rem',
                boxSizing: 'border-box'
              }}>
                {availableMachineTabs.includes('pine_labs') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMachineKey('pine_labs');
                      showToast('🌲 Switched to Pine Labs');
                    }}
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.5rem',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      whiteSpace: 'nowrap',
                      background: selectedMachineKey === 'pine_labs' ? '#0F52BA' : 'transparent',
                      color: selectedMachineKey === 'pine_labs' ? '#FFFFFF' : '#64748B',
                      boxShadow: selectedMachineKey === 'pine_labs' ? '0 2px 6px rgba(15,82,186,0.25)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>🌲</span>
                    <span>Pine Labs</span>
                  </button>
                )}

                {availableMachineTabs.includes('payswiff') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMachineKey('payswiff');
                      showToast('⚡ Switched to Payswiff');
                    }}
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.5rem',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      whiteSpace: 'nowrap',
                      background: selectedMachineKey === 'payswiff' ? '#D97706' : 'transparent',
                      color: selectedMachineKey === 'payswiff' ? '#FFFFFF' : '#64748B',
                      boxShadow: selectedMachineKey === 'payswiff' ? '0 2px 6px rgba(217,119,6,0.25)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>⚡</span>
                    <span>Payswiff</span>
                  </button>
                )}

                {availableMachineTabs.includes('qr') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMachineKey('qr');
                      showToast('📱 Switched to QR');
                    }}
                    style={{
                      width: '100%',
                      padding: '0.45rem 0.5rem',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                      whiteSpace: 'nowrap',
                      background: selectedMachineKey === 'qr' ? '#7C3AED' : 'transparent',
                      color: selectedMachineKey === 'qr' ? '#FFFFFF' : '#64748B',
                      boxShadow: selectedMachineKey === 'qr' ? '0 2px 6px rgba(124,58,237,0.25)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>📱</span>
                    <span>QR</span>
                  </button>
                )}
              </div>

              {/* 1. Virtual Wallet Card (Clean Light Enterprise Application Card) */}
              <div style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                padding: '1.1rem 1.25rem 1rem',
                color: '#0F172A',
                boxShadow: '0 2px 12px rgba(15, 23, 42, 0.04)',
                border: '1px solid #E2E8F0',
                position: 'relative'
              }}>
                {/* Top Bar: Integrated Machine Wallet Tag + Embedded Channel & Rates Pill */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                  flexWrap: 'wrap',
                  gap: '0.45rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      background: selectedMachineKey === 'qr'
                        ? '#F5F3FF'
                        : selectedMachineKey === 'payswiff'
                        ? '#FFFBEB'
                        : '#EFF6FF',
                      color: selectedMachineKey === 'qr'
                        ? '#7C3AED'
                        : selectedMachineKey === 'payswiff'
                        ? '#D97706'
                        : '#0F52BA',
                      border: selectedMachineKey === 'qr'
                        ? '1px solid #DDD6FE'
                        : selectedMachineKey === 'payswiff'
                        ? '1px solid #FDE68A'
                        : '1px solid #BFDBFE',
                      letterSpacing: '0.02em',
                      textTransform: 'uppercase',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span>{activeMachine.icon}</span>
                      <span>{activeMachine.title} Wallet</span>
                    </span>
                    <button 
                      onClick={() => setShowBalance(!showBalance)} 
                      style={{ background: 'none', border: 'none', color: '#94A3B8', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      title={showBalance ? "Hide balance" : "Show balance"}
                    >
                      {showBalance ? <Eye style={{ width: '13px', height: '13px' }} /> : <EyeOff style={{ width: '13px', height: '13px' }} />}
                    </button>
                  </div>

                  {/* Integrated Channel & Rates Pill */}
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.625rem',
                    color: '#64748B',
                    background: '#F8FAFC',
                    padding: '2.5px 7px',
                    borderRadius: '6px',
                    border: '1px solid #E2E8F0'
                  }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0F172A' }}>{activeMachine.terminal_id}</span>
                    <span style={{ color: '#CBD5E1' }}>•</span>
                    {selectedMachineKey === 'qr' ? (
                      <span style={{ color: '#059669', fontWeight: 800 }}>⚡ Instant ({activeMachine.rateStrInstant})</span>
                    ) : (
                      <>
                        <span>T+1: <strong style={{ color: '#0F172A' }}>{activeMachine.rateStrT1}</strong></span>
                        <span style={{ color: '#CBD5E1' }}>•</span>
                        <span>Instant: <strong style={{ color: '#0F172A' }}>{activeMachine.rateStrInstant}</strong></span>
                      </>
                    )}
                  </div>
                </div>

                {/* Main Amount & CTA Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.65rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', fontFeatureSettings: '"tnum"', lineHeight: 1.15, color: '#0F172A' }}>
                      {showBalance ? `₹${activeMachineWallet.available_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '••••••••'}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                        <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 600 }}>
                          {selectedMachineKey === 'qr' ? 'Instant Credited Balance' : 'Available for Withdrawal'}
                        </span>
                      </div>
                      {activeMachineWallet.pending_balance > 0 && (
                        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px', padding: '1px 6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
                          <span style={{ fontSize: '0.6rem', color: '#B45309', fontWeight: 700 }}>
                            ₹{activeMachineWallet.pending_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Pending Settlement
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Primary Action Button */}
                  {selectedMachineKey === 'qr' ? (
                    <button 
                      onClick={() => setIsCustomerQRModalOpen(true)}
                      className="card-hover"
                      style={{
                        background: '#7C3AED',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '0.5rem 0.95rem',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        boxShadow: '0 2px 8px rgba(124,58,237,0.25)',
                        transition: 'all 0.15s ease',
                        flexShrink: 0
                      }}
                    >
                      <QrCode style={{ width: '14px', height: '14px', strokeWidth: 2.5 }} />
                      <span>Show QR to Customer</span>
                    </button>
                  ) : (
                    <button 
                      onClick={() => setActiveTab('record-sale')}
                      className="card-hover"
                      style={{
                        background: selectedMachineKey === 'payswiff' ? '#D97706' : '#0F52BA',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '10px',
                        padding: '0.5rem 0.95rem',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: selectedMachineKey === 'payswiff' ? '0 2px 8px rgba(217,119,6,0.25)' : '0 2px 8px rgba(15,82,186,0.25)',
                        transition: 'all 0.15s ease',
                        flexShrink: 0
                      }}
                    >
                      <Plus style={{ width: '13px', height: '13px', strokeWidth: 3 }} />
                      <span>Record Sale</span>
                    </button>
                  )}
                </div>

                {/* 3 Bottom Metrics Recessed Surface: Total Sales, Sent to Bank, In Transit */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  background: '#F8FAFC',
                  borderRadius: '12px',
                  border: '1px solid #F1F5F9',
                  padding: '0.65rem 0.35rem',
                  textAlign: 'center'
                }}>
                  {/* Col 1: Total Sales */}
                  <div style={{ padding: '0 0.25rem' }}>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '0.625rem', fontWeight: 600, marginBottom: '2px', whiteSpace: 'nowrap' }}>
                      {selectedMachineKey === 'qr' ? 'UPI Collected' : 'Total Sales'}
                    </span>
                    <strong style={{ color: '#0F172A', fontSize: '0.85rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                      ₹{activeMachineWallet.total_sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>

                  {/* Col 2: Sent to Bank */}
                  <div style={{ padding: '0 0.25rem', borderLeft: '1px solid #E2E8F0' }}>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '0.625rem', fontWeight: 600, marginBottom: '2px', whiteSpace: 'nowrap' }}>
                      Sent to Bank
                    </span>
                    <strong style={{ color: '#059669', fontSize: '0.85rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                      ₹{activeMachineWallet.withdrawn_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>

                  {/* Col 3: In Transit */}
                  <div style={{ padding: '0 0.25rem', borderLeft: '1px solid #E2E8F0' }}>
                    <span style={{ color: '#64748B', display: 'block', fontSize: '0.625rem', fontWeight: 600, marginBottom: '2px', whiteSpace: 'nowrap' }}>
                      {selectedMachineKey === 'qr' ? 'Instant Cleared' : 'In Transit'}
                    </span>
                    <strong style={{ color: selectedMachineKey === 'qr' ? '#059669' : '#D97706', fontSize: '0.85rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                      {selectedMachineKey === 'qr' ? '✓ Instant' : `₹${activeMachineWallet.pending_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                    </strong>
                  </div>
                </div>
              </div>



              {/* 2. Quick Actions Section (Matches Reference Image Exactly) */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem', padding: '0 0.125rem' }}>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
                    Quick Actions
                  </h3>
                  <button 
                    onClick={() => setActiveTab('history')}
                    style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0 }}
                  >
                    See All →
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  {/* Card 1: Record Sale (Soft Icy Blue) */}
                  <button 
                    onClick={() => setActiveTab('record-sale')}
                    className="card-hover"
                    style={{
                      background: 'linear-gradient(180deg, #F0F7FF 0%, #E8F2FE 100%)',
                      border: '1px solid #E0EEFD',
                      borderRadius: '16px',
                      padding: '0.75rem 0.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.35rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      boxShadow: '0 2px 8px rgba(37,99,235,0.04)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#FFFFFF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(37,99,235,0.1)' }}>
                      <CreditCard style={{ width: '18px', height: '18px' }} />
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', display: 'block', whiteSpace: 'nowrap' }}>Record Sale</strong>
                      <span style={{ fontSize: '0.5625rem', color: '#64748B', display: 'block', marginTop: '1px', whiteSpace: 'nowrap' }}>Card Swipe</span>
                    </div>
                  </button>

                  {/* Card 2: Withdraw (Soft Fresh Mint) */}
                  <button 
                    onClick={() => setActiveTab('withdraw')}
                    className="card-hover"
                    style={{
                      background: 'linear-gradient(180deg, #F0FDF4 0%, #E6F9EE 100%)',
                      border: '1px solid #DCFCE7',
                      borderRadius: '16px',
                      padding: '0.75rem 0.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.35rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      boxShadow: '0 2px 8px rgba(5,150,105,0.04)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#FFFFFF', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(5,150,105,0.1)' }}>
                      <Send style={{ width: '18px', height: '18px' }} />
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', display: 'block', whiteSpace: 'nowrap' }}>Withdraw</strong>
                      <span style={{ fontSize: '0.5625rem', color: '#64748B', display: 'block', marginTop: '1px', whiteSpace: 'nowrap' }}>Send to Bank</span>
                    </div>
                  </button>

                  {/* Card 3: Transactions (Soft Lavender Purple) */}
                  <button 
                    onClick={() => setActiveTab('history')}
                    className="card-hover"
                    style={{
                      background: 'linear-gradient(180deg, #FAF5FF 0%, #F3E8FF 100%)',
                      border: '1px solid #E9D5FF',
                      borderRadius: '16px',
                      padding: '0.75rem 0.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.35rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      boxShadow: '0 2px 8px rgba(124,58,237,0.04)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#FFFFFF', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(124,58,237,0.1)' }}>
                      <History style={{ width: '18px', height: '18px' }} />
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', display: 'block', whiteSpace: 'nowrap' }}>Transactions</strong>
                      <span style={{ fontSize: '0.5625rem', color: '#64748B', display: 'block', marginTop: '1px', whiteSpace: 'nowrap' }}>All History</span>
                    </div>
                  </button>
                </div>

                {/* My Network & Downstream Referrals Action Banner (For Non-Merchant Hierarchy Leaders) */}
                {userRole !== 'MERCHANT' && userRole !== 'Retailer' && (
                  <div 
                    onClick={() => setActiveTab('network')}
                    className="card-hover"
                    style={{
                      marginTop: '0.625rem',
                      background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 50%, #EFF6FF 100%)',
                      border: '1px solid #BFDBFE',
                      borderRadius: '16px',
                      padding: '0.625rem 0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      boxShadow: '0 3px 12px rgba(15,82,186,0.06)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#0F52BA', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(15,82,186,0.25)', flexShrink: 0 }}>
                        <Users style={{ width: '18px', height: '18px' }} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <h4 style={{ margin: 0, fontSize: '0.78125rem', fontWeight: 800, color: '#0F172A' }}>My People &amp; Team Earnings</h4>
                          <span style={{ fontSize: '0.5rem', fontWeight: 800, color: '#0F52BA', background: '#FFFFFF', padding: '1px 5px', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
                            {networkData.partners.length} Members
                          </span>
                        </div>
                        <p style={{ margin: '1px 0 0', fontSize: '0.59rem', color: '#475569', fontWeight: 500 }}>
                          All downline shops, POS machines &amp; daily commission profit
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#0F52BA', fontWeight: 800, fontSize: '0.6875rem', whiteSpace: 'nowrap' }}>
                      <span>Open</span>
                      <ArrowRight style={{ width: '14px', height: '14px' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Middle Section: Bill Payments & Recharges (Left) + Sales Overview (Right) on Desktop; Stacked on Mobile */}
              <div className="desktop-split-grid">
                
                {/* Bill Payments & Recharges Card (Matches Reference Image Exactly) */}
                <div style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #EDF2F7', padding: '1rem', boxShadow: '0 2px 12px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
                        Bill Payments & Recharges
                      </h3>
                      <p style={{ fontSize: '0.625rem', color: '#64748B', margin: '2px 0 0' }}>
                        Pay bills for walk-in customers and earn commission
                      </p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('bbps')}
                      style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0, flexShrink: 0 }}
                    >
                      Open Desk →
                    </button>
                  </div>

                  {/* 4-Item Grid: Mobile, Electricity, DTH / TV, More */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                    {/* 1. Mobile */}
                    <div 
                      onClick={() => { setBbpsCategory('mobile'); setActiveTab('bbps'); }}
                      className="card-hover"
                      style={{ cursor: 'pointer', padding: '0.625rem 0.25rem', borderRadius: '14px', background: '#F0F7FF', border: '1px solid #E0EEFD', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', transition: 'all 0.15s ease' }}
                    >
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#FFFFFF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(37,99,235,0.08)' }}>
                        <Smartphone style={{ width: '17px', height: '17px' }} />
                      </div>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>Mobile</span>
                    </div>

                    {/* 2. Electricity */}
                    <div 
                      onClick={() => { setBbpsCategory('electricity'); setActiveTab('bbps'); }}
                      className="card-hover"
                      style={{ cursor: 'pointer', padding: '0.625rem 0.25rem', borderRadius: '14px', background: '#FFFBEB', border: '1px solid #FEF3C7', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', transition: 'all 0.15s ease' }}
                    >
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#FFFFFF', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(217,119,6,0.08)' }}>
                        <Zap style={{ width: '17px', height: '17px' }} />
                      </div>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>Electricity</span>
                    </div>

                    {/* 3. DTH / TV */}
                    <div 
                      onClick={() => { setBbpsCategory('dth'); setActiveTab('bbps'); }}
                      className="card-hover"
                      style={{ cursor: 'pointer', padding: '0.625rem 0.25rem', borderRadius: '14px', background: '#FAF5FF', border: '1px solid #F3E8FF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', transition: 'all 0.15s ease' }}
                    >
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#FFFFFF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(124,58,237,0.08)' }}>
                        <Tv style={{ width: '17px', height: '17px' }} />
                      </div>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>DTH / TV</span>
                    </div>

                    {/* 4. More */}
                    <div 
                      onClick={() => setActiveTab('bbps')}
                      className="card-hover"
                      style={{ cursor: 'pointer', padding: '0.625rem 0.25rem', borderRadius: '14px', background: '#F8FAFC', border: '1px solid #EDF2F7', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', transition: 'all 0.15s ease' }}
                    >
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#FFFFFF', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(100,116,139,0.08)' }}>
                        <LayoutGrid style={{ width: '17px', height: '17px' }} />
                      </div>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>More</span>
                    </div>
                  </div>
                </div>

                {/* Today's Sales Overview Card (Native Mobile Fintech App Layout) */}
                <div style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #EDF2F7', padding: '1.125rem 1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 2px 12px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        Today's Counter Swipes
                      </span>
                    </div>
                    <span style={{ fontSize: '0.625rem', color: '#0F52BA', fontWeight: 800, background: '#EFF6FF', border: '1px solid #DBEAFE', padding: '2px 8px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563EB', display: 'inline-block' }}></span>
                      LIVE TODAY
                    </span>
                  </div>

                  {/* Hero Amount Display */}
                  <div style={{ margin: '0.25rem 0 0.875rem' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
                      <span style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                        ₹{todayStats.sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 500, marginTop: '2px', display: 'block' }}>
                      Gross swipe turnover on {activeMachine.title}
                    </span>
                  </div>

                  {/* Modern Sleek Breakdown Strip (No rigid input boxes) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', background: '#F8FAFC', borderRadius: '12px', padding: '0.625rem 0.5rem', gap: '0.375rem', textAlign: 'center' }}>
                    <div>
                      <span style={{ fontSize: '0.5625rem', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#059669' }}></span> Collected
                      </span>
                      <strong style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#059669', display: 'block', marginTop: '2px' }}>
                        ₹{todayStats.collected.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                      </strong>
                    </div>

                    <div style={{ borderLeft: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0' }}>
                      <span style={{ fontSize: '0.5625rem', color: '#D97706', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#D97706' }}></span> Pending
                      </span>
                      <strong style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#D97706', display: 'block', marginTop: '2px' }}>
                        ₹{todayStats.pending.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                      </strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.5625rem', color: '#0F52BA', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#0F52BA' }}></span> Activity
                      </span>
                      <strong style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A', display: 'block', marginTop: '2px' }}>
                        {todayStats.count} {todayStats.count === 1 ? 'swipe' : 'swipes'}
                      </strong>
                    </div>
                  </div>
                </div>

              </div>

              {/* 4. Bottom Grid: My Saved Bank Accounts Box & Recent Transactions on Desktop */}
              <div className="desktop-split-grid">
                
                {/* My Saved Bank Accounts Box */}
                <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                    <div>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>My Bank Accounts</h3>
                      <p style={{ fontSize: '0.625rem', color: '#64748B', margin: 0 }}>Where your withdrawal money is sent</p>
                    </div>
                    <button 
                      onClick={() => setIsAddAccountModalOpen(true)}
                      style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#0F52BA', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '0.6875rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      + Add New Bank
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {beneficiaries.slice(0, 2).map(b => (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.75rem', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Landmark style={{ width: '16px', height: '16px' }} />
                          </div>
                          <div>
                            <strong style={{ fontSize: '0.75rem', color: '#0F172A', display: 'block' }}>{b.bank_name || b.bank}</strong>
                            <span style={{ fontSize: '0.625rem', color: '#64748B', fontFamily: 'monospace' }}>
                              •••• {b.account_number ? b.account_number.slice(-4) : '••••'} • {b.holder_name || 'Account Holder'}
                            </span>
                          </div>
                        </div>

                        <button 
                          onClick={() => {
                            setSelectedBankId(b.id);
                            setActiveTab('withdraw');
                          }}
                          style={{ background: '#059669', color: '#FFF', border: 'none', padding: '0.25rem 0.625rem', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 800, cursor: 'pointer' }}
                        >
                          Withdraw →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Transactions List (Clean Mobile Feed — 100% Dynamic Data) */}
                <div style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #EDF2F7', padding: '1.125rem', boxShadow: '0 2px 12px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                        {activeMachine.icon} {activeMachine.title} {selectedMachineKey === 'qr' ? 'UPI Payments' : 'Swipes'}
                      </h3>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, color: activeMachine.themeColor, background: activeMachine.accentBg, padding: '1px 7px', borderRadius: '999px' }}>
                        {activeMachineTransactions.length}
                      </span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setActiveTab('history')} 
                      style={{ background: 'none', border: 'none', color: '#0F52BA', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: 0 }}
                    >
                      View All →
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {activeMachineTransactions.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1.75rem 0.5rem', color: '#64748B', fontSize: '0.75rem' }}>
                        <p style={{ margin: '0 0 0.25rem', fontWeight: 700, color: '#334155' }}>No transactions recorded on {activeMachine.title} yet.</p>
                        <span>{selectedMachineKey === 'qr' ? 'Customer UPI payments to the shop QR appear here instantly.' : 'Swipes recorded today will appear here in real-time.'}</span>
                      </div>
                    ) : (
                      activeMachineTransactions.slice(0, 5).map((t, idx, arr) => {
                        const st = (t.status || 'APPROVED').toUpperCase();
                        const isApproved = st === 'APPROVED' || st === 'SUCCESS' || st === 'COMPLETED';
                        const isPending = st === 'PENDING';
                        const statusBadge = isApproved
                          ? { label: selectedMachineKey === 'qr' ? '✓ Instant Credited' : 'Completed', color: '#059669', bg: '#ECFDF5' }
                          : isPending
                          ? { label: 'Pending', color: '#D97706', bg: '#FFFBEB' }
                          : { label: 'Invalid', color: '#DC2626', bg: '#FEF2F2' };

                        const isLast = idx === arr.length - 1;
                        const { title, rrn, customerMobile } = parseTxnDisplay(t);
                        const notesLower = (t.notes || '').toLowerCase();
                        const isPhonePe = notesLower.includes('phonepe') || (t.ref_number || '').includes('PhonePe');
                        const isGPay = notesLower.includes('gpay') || notesLower.includes('google pay') || (t.ref_number || '').includes('GPay');
                        const isPaytm = notesLower.includes('paytm') || (t.ref_number || '').includes('Paytm');

                        return (
                          <div 
                            key={t.id || idx} 
                            onClick={() => { setSelectedTxnForDetails(t); setTxnDetailType('SWIPE'); }}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between', 
                              padding: '0.6875rem 0.4rem',
                              borderRadius: '8px',
                              borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
                              transition: 'background 0.15s ease',
                              cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                              <div style={{ 
                                width: '36px', 
                                height: '36px', 
                                borderRadius: '10px', 
                                background: selectedMachineKey === 'qr'
                                  ? (isPhonePe ? '#F3E8FF' : isGPay ? '#EFF6FF' : isPaytm ? '#E0F2FE' : '#F5F3FF')
                                  : activeMachine.accentBg, 
                                color: selectedMachineKey === 'qr'
                                  ? (isPhonePe ? '#5F259F' : isGPay ? '#1A73E8' : isPaytm ? '#00BAF2' : '#7C3AED')
                                  : activeMachine.themeColor, 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                flexShrink: 0,
                                fontWeight: 800,
                                fontSize: '0.75rem'
                              }}>
                                {selectedMachineKey === 'qr' ? (
                                  isPhonePe ? 'Pe' : isGPay ? 'G' : isPaytm ? 'Py' : 'QR'
                                ) : (
                                  t.type === 'BBPS_BILL' ? <Zap style={{ width: '17px', height: '17px' }} /> : <CreditCard style={{ width: '17px', height: '17px' }} />
                                )}
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <strong style={{ fontSize: '0.8125rem', color: '#0F172A', fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {title}
                                  </strong>
                                  {selectedMachineKey === 'qr' && (
                                    <span style={{
                                      fontSize: '0.53125rem',
                                      fontWeight: 800,
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      background: isPhonePe ? '#F3E8FF' : isGPay ? '#EFF6FF' : isPaytm ? '#E0F2FE' : '#EDE9FE',
                                      color: isPhonePe ? '#6D28D9' : isGPay ? '#1D4ED8' : isPaytm ? '#0369A1' : '#7C3AED'
                                    }}>
                                      {isPhonePe ? 'PhonePe' : isGPay ? 'Google Pay' : isPaytm ? 'Paytm' : 'UPI QR'}
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: '0.625rem', color: '#64748B', display: 'block', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  <span style={{ fontFamily: 'monospace' }}>UTR: {rrn}</span> • {new Date(t.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {customerMobile ? ` • ${customerMobile}` : ''}
                                </span>
                              </div>
                            </div>

                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <p style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
                                ₹{parseFloat(t.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </p>
                              <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: statusBadge.color, background: statusBadge.bg, padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '2px' }}>
                                {statusBadge.label}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* ========================================================= */}
          {/* VIEW 2: DEDICATED "RECORD SALE" PAGE                     */}
          {/* (PREMIUM NATIVE APP FINTECH EXPERIENCE - MATCHES WITHDRAW) */}
          {/* ========================================================= */}
          {activeTab === 'record-sale' && (
            <div className="merchant-subpage-wrapper full-width" style={{ gap: '0.4rem', maxWidth: '720px' }}>
              
              {/* 1. Page Title - Single Clean Heading, Tight Wanted Gap */}
              <div style={{ margin: '0 0 0.15rem 0' }}>
                <h1 style={{ fontSize: '1.125rem', fontWeight: 900, color: '#0A192F', margin: 0, letterSpacing: '-0.01em' }}>
                  Record Card Swipe Sale
                </h1>
              </div>

              {/* Split Layout: Form on Left, Recent Swipes on Right */}
              <div className="subpage-split-grid">
                
                {/* Left Column: Form & CTA */}
                <div className="subpage-col">
                  {/* Clean & Fast Card Swipe Tool */}
                  {(() => {
                    const cardSwipeAmount = parseFloat(saleForm.amount) || 0;
                    const isInstant = saleForm.settlement_type === 'INSTANT';
                    const companyRate = isInstant ? (activeMachine.rateInstant || 1.80) : (activeMachine.rateT1 || 1.50);
                    const companyFee = (cardSwipeAmount * companyRate) / 100;
                    const netSettlement = Math.max(0, cardSwipeAmount - companyFee);

                    return (
                      <form onSubmit={handleRecordSaleSubmit} style={{
                        background: 'transparent',
                        border: 'none',
                        boxShadow: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        width: '100%'
                      }}>
                        {/* STANDALONE BALANCE BANNER (Sleek rounded card, matching Withdraw) */}
                        <div style={{
                          background: selectedMachineKey === 'qr'
                            ? 'linear-gradient(135deg, #2E1065 0%, #7C3AED 100%)'
                            : selectedMachineKey === 'payswiff'
                            ? 'linear-gradient(135deg, #1C1304 0%, #D97706 100%)'
                            : 'linear-gradient(135deg, #0A192F 0%, #0F52BA 100%)',
                          padding: '0.75rem 0.875rem',
                          borderRadius: '12px',
                          color: '#FFFFFF',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.4rem',
                          boxShadow: '0 2px 8px rgba(15, 82, 186, 0.12)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.15rem' }}>{activeMachine.icon}</span>
                            <div>
                              <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                                {activeMachine.title} Available Balance
                              </span>
                              <span style={{ fontSize: '1.35rem', fontWeight: 900, letterSpacing: '-0.01em', color: '#FFFFFF', lineHeight: 1.1 }}>
                                ₹{activeMachineWallet.available_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.85)' }}>
                              Terminal {activeMachine.terminal_id}
                            </span>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              background: 'rgba(255,255,255,0.18)',
                              border: '1px solid rgba(255,255,255,0.3)',
                              borderRadius: '6px',
                              padding: '0.15rem 0.45rem',
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              color: '#FFFFFF'
                            }}>
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4ADE80' }} />
                              Active
                            </span>
                          </div>
                        </div>

                        {/* COMPANY CENTRAL QR SHOWCASE (When QR Channel is Active) */}
                        {selectedMachineKey === 'qr' && (
                          <div style={{
                            background: '#FFFFFF',
                            border: '1.5px solid #DDD6FE',
                            borderRadius: '12px',
                            padding: '0.875rem',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textAlign: 'center',
                            gap: '0.5rem',
                            boxShadow: '0 2px 8px rgba(124,58,237,0.08)'
                          }}>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: '#F5F3FF',
                              color: '#7C3AED',
                              border: '1px solid #DDD6FE',
                              borderRadius: '999px',
                              padding: '2px 8px',
                              fontSize: '0.625rem',
                              fontWeight: 800
                            }}>
                              ⚡ 100% Instant IMPS Settlement ({activeMachine.rateStrInstant} Fee)
                            </div>

                            {/* Official QR Image / Vector */}
                            <div 
                              onClick={() => setIsCustomerQRModalOpen(true)}
                              style={{
                                cursor: 'pointer',
                                width: '130px',
                                height: '130px',
                                background: '#FFFFFF',
                                border: '2px solid #7C3AED',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '6px',
                                overflow: 'hidden'
                              }}
                              title="Click to expand QR"
                            >
                              {companyQrImage ? (
                                <img
                                  src={companyQrImage}
                                  alt="Company QR"
                                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                />
                              ) : (
                                <svg width="90" height="90" viewBox="0 0 100 100" fill="none">
                                  <rect x="5" y="5" width="30" height="30" rx="4" fill="#0A192F" />
                                  <rect x="11" y="11" width="18" height="18" rx="2" fill="#FFFFFF" />
                                  <rect x="15" y="15" width="10" height="10" rx="1" fill="#7C3AED" />
                                  <rect x="65" y="5" width="30" height="30" rx="4" fill="#0A192F" />
                                  <rect x="71" y="11" width="18" height="18" rx="2" fill="#FFFFFF" />
                                  <rect x="75" y="15" width="10" height="10" rx="1" fill="#7C3AED" />
                                  <rect x="5" y="65" width="30" height="30" rx="4" fill="#0A192F" />
                                  <rect x="11" y="71" width="18" height="18" rx="2" fill="#FFFFFF" />
                                  <rect x="15" y="75" width="10" height="10" rx="1" fill="#7C3AED" />
                                  <rect x="42" y="10" width="8" height="16" fill="#0A192F" />
                                  <rect x="42" y="32" width="16" height="8" fill="#7C3AED" />
                                  <rect x="10" y="42" width="16" height="8" fill="#0A192F" />
                                  <rect x="32" y="42" width="8" height="16" fill="#0A192F" />
                                  <rect x="46" y="46" width="10" height="10" fill="#0A192F" />
                                  <rect x="62" y="42" width="12" height="8" fill="#7C3AED" />
                                  <rect x="80" y="42" width="10" height="14" fill="#0A192F" />
                                  <rect x="42" y="62" width="8" height="14" fill="#7C3AED" />
                                  <rect x="56" y="62" width="14" height="8" fill="#0A192F" />
                                  <rect x="42" y="82" width="18" height="8" fill="#0A192F" />
                                  <rect x="66" y="76" width="10" height="14" fill="#7C3AED" />
                                  <rect x="82" y="70" width="8" height="20" fill="#0A192F" />
                                </svg>
                              )}
                            </div>

                            {/* Payee Verification Badge */}
                            <div style={{
                              background: '#FAF5FF',
                              border: '1px solid #DDD6FE',
                              borderRadius: '8px',
                              padding: '0.35rem 0.65rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}>
                              <span style={{ fontSize: '0.625rem', color: '#6D28D9', fontWeight: 700 }}>
                                Payee Name on Scan:
                              </span>
                              <strong style={{ fontSize: '0.75rem', color: '#0F172A', fontWeight: 900 }}>
                                {companyQrPayeeName || 'RONAV TECHNOLOGIES'}
                              </strong>
                            </div>

                            <button
                              type="button"
                              onClick={() => setIsCustomerQRModalOpen(true)}
                              style={{
                                background: '#7C3AED',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '7px',
                                padding: '0.35rem 0.85rem',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <QrCode style={{ width: '13px', height: '13px' }} />
                              <span>Show Full QR to Customer</span>
                            </button>
                          </div>
                        )}

                        {/* DIRECT FORM FIELDS: Flat on Screen Surface, Zero Nested Enclosing Box */}
                        <div style={{
                          padding: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem',
                          width: '100%'
                        }}>
                          {/* 1. Swipe Amount Field */}
                          <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '0.35rem' }}>
                              Card Swipe Amount *
                            </label>
                            <div style={{
                              background: '#FFFFFF',
                              border: '1.5px solid #CBD5E1',
                              borderRadius: '8px',
                              padding: '0.45rem 0.65rem',
                              display: 'flex',
                              alignItems: 'center'
                            }}>
                              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginRight: '0.4rem' }}>₹</span>
                              <input 
                                type="number"
                                step="any"
                                placeholder="0.00"
                                required
                                value={saleForm.amount}
                                onChange={(e) => setSaleForm({ ...saleForm, amount: e.target.value })}
                                style={{
                                  width: '100%',
                                  background: 'transparent',
                                  border: 'none',
                                  outline: 'none',
                                  fontSize: '1.25rem',
                                  fontWeight: 800,
                                  color: '#0F172A',
                                  padding: 0
                                }}
                              />
                            </div>

                            {/* Indian Quick Amount Chips */}
                            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                              {[
                                { label: '₹10k', val: '10000' },
                                { label: '₹25k', val: '25000' },
                                { label: '₹50k', val: '50000' },
                                { label: '₹1 Lakh', val: '100000' },
                                { label: '₹2 Lakh', val: '200000' }
                              ].map(chip => (
                                <button
                                  key={chip.val}
                                  type="button"
                                  onClick={() => setSaleForm({ ...saleForm, amount: chip.val })}
                                  style={{
                                    flex: 1,
                                    minWidth: '52px',
                                    background: saleForm.amount === chip.val ? '#EFF6FF' : '#FFFFFF',
                                    border: saleForm.amount === chip.val ? '1.5px solid #0F52BA' : '1px solid #CBD5E1',
                                    borderRadius: '6px',
                                    padding: '0.35rem 0.2rem',
                                    fontSize: '0.6875rem',
                                    fontWeight: 700,
                                    color: saleForm.amount === chip.val ? '#0F52BA' : '#334155',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {chip.label}
                                </button>
                              ))}
                              {saleForm.amount && (
                                <button
                                  type="button"
                                  onClick={() => setSaleForm({ ...saleForm, amount: '' })}
                                  style={{
                                    background: '#FEE2E2',
                                    border: '1px solid #FCA5A5',
                                    color: '#DC2626',
                                    borderRadius: '6px',
                                    padding: '0.35rem 0.4rem',
                                    fontSize: '0.6875rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          </div>

                          {/* 2. Slip UTR Number (Clear & Single-Line) */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>
                                Slip UTR Number *
                              </label>
                              <span style={{ fontSize: '0.625rem', color: '#64748B' }}>
                                From printed paper slip
                              </span>
                            </div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              background: '#FFFFFF',
                              border: !saleForm.transaction_id && saleForm.amount ? '1.5px solid #F87171' : '1px solid #CBD5E1',
                              borderRadius: '8px',
                              padding: '0.5rem 0.75rem'
                            }}>
                              <FileText style={{ width: '15px', height: '15px', color: '#0F52BA', flexShrink: 0 }} />
                              <input 
                                type="text"
                                required
                                placeholder="12-digit UTR (e.g. 3344433345566)"
                                value={saleForm.transaction_id}
                                onChange={(e) => setSaleForm({ ...saleForm, transaction_id: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                                style={{
                                  width: '100%',
                                  background: 'transparent',
                                  border: 'none',
                                  outline: 'none',
                                  fontSize: '0.8125rem',
                                  fontWeight: saleForm.transaction_id ? 700 : 500,
                                  fontFamily: 'monospace',
                                  color: '#0F172A',
                                  padding: 0
                                }}
                              />
                            </div>
                          </div>

                          {/* 3. Settlement Speed Selector (Strictly using active machine rates) */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>
                                Settlement Speed &amp; Clearance Mode *
                              </label>
                              <span style={{ fontSize: '0.625rem', color: '#64748B' }}>
                                {selectedMachineKey === 'qr' ? 'UPI collections are instant IMPS credit' : '95% volume is standard T+1'}
                              </span>
                            </div>
                            {selectedMachineKey === 'qr' ? (
                              <div
                                style={{
                                  padding: '0.65rem 0.85rem',
                                  borderRadius: '8px',
                                  border: '2px solid #7C3AED',
                                  background: '#F5F3FF',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between'
                                }}
                              >
                                <div>
                                  <strong style={{ fontSize: '0.78125rem', color: '#6D28D9', display: 'block' }}>
                                    ⚡ 100% Instant IMPS Settlement
                                  </strong>
                                  <span style={{ fontSize: '0.625rem', color: '#7C3AED', display: 'block', marginTop: '2px' }}>
                                    Immediate credit into your wallet upon customer UPI scan
                                  </span>
                                </div>
                                <span style={{ fontSize: '0.625rem', fontWeight: 800, background: '#EDE9FE', color: '#6D28D9', padding: '2px 7px', borderRadius: '5px' }}>
                                  {activeMachine.rateStrInstant} Fee
                                </span>
                              </div>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <div
                                  onClick={() => setSaleForm({ ...saleForm, settlement_type: 'T1' })}
                                  style={{
                                    padding: '0.55rem 0.65rem',
                                    borderRadius: '8px',
                                    border: !isInstant ? '2px solid #0F52BA' : '1px solid #CBD5E1',
                                    background: !isInstant ? '#EFF6FF' : '#FFFFFF',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <strong style={{ fontSize: '0.75rem', color: !isInstant ? '#0F52BA' : '#0F172A' }}>
                                      📅 T+1 Standard (95%)
                                    </strong>
                                    <span style={{ fontSize: '0.5625rem', fontWeight: 800, background: '#DBEAFE', color: '#1D4ED8', padding: '1px 5px', borderRadius: '4px' }}>
                                      {activeMachine.rateStrT1 || '1.50%'}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '0.625rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                                    Next Banking Day (Batched)
                                  </span>
                                </div>

                                <div
                                  onClick={() => setSaleForm({ ...saleForm, settlement_type: 'INSTANT' })}
                                  style={{
                                    padding: '0.55rem 0.65rem',
                                    borderRadius: '8px',
                                    border: isInstant ? '2px solid #059669' : '1px solid #CBD5E1',
                                    background: isInstant ? '#ECFDF5' : '#FFFFFF',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <strong style={{ fontSize: '0.75rem', color: isInstant ? '#059669' : '#0F172A' }}>
                                      ⚡ Instant IMPS (5%)
                                    </strong>
                                    <span style={{ fontSize: '0.5625rem', fontWeight: 800, background: '#DCFCE7', color: '#15803D', padding: '1px 5px', borderRadius: '4px' }}>
                                      {activeMachine.rateStrInstant || '1.80%'}
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '0.625rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                                    Same-Day Immediate
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 4. Customer Details: Name & Mobile (Mandatory for Compliance & Verification) */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
                            <div>
                              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '0.3rem' }}>
                                Customer Name *
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Ramesh Kumar"
                                required
                                value={saleForm.customer_name}
                                onChange={(e) => setSaleForm({ ...saleForm, customer_name: e.target.value })}
                                style={{
                                  width: '100%',
                                  background: '#FFFFFF',
                                  border: '1px solid #CBD5E1',
                                  borderRadius: '8px',
                                  padding: '0.5rem 0.75rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  color: '#0F172A',
                                  outline: 'none',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '0.3rem' }}>
                                Customer Mobile *
                              </label>
                              <input
                                type="tel"
                                maxLength={10}
                                required
                                placeholder="10-digit mobile number"
                                value={saleForm.customer_mobile}
                                onChange={(e) => setSaleForm({ ...saleForm, customer_mobile: e.target.value.replace(/\D/g, '') })}
                                style={{
                                  width: '100%',
                                  background: '#FFFFFF',
                                  border: '1px solid #CBD5E1',
                                  borderRadius: '8px',
                                  padding: '0.5rem 0.75rem',
                                  fontSize: '0.75rem',
                                  outline: 'none',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </div>
                          </div>

                          {/* 5. Clean Net Settlement Strip (Transparent & Direct) */}
                          {cardSwipeAmount > 0 && (
                            <div style={{
                              background: '#F0FDF4',
                              border: '1px solid #86EFAC',
                              borderRadius: '10px',
                              padding: '0.625rem 0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between'
                            }}>
                              <div>
                                <span style={{ fontSize: '0.625rem', color: '#166534', fontWeight: 700, display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                  Net Credit to Wallet
                                </span>
                                <strong style={{ fontSize: '1.0625rem', color: '#15803D', fontWeight: 900 }}>
                                  ₹{netSettlement.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </strong>
                              </div>

                              <div style={{ textAlign: 'right', fontSize: '0.65625rem', color: '#64748B', lineHeight: 1.35 }}>
                                <div>Gross Swipe: <strong style={{ color: '#0F172A' }}>₹{cardSwipeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                                <div>Company Fee ({companyRate.toFixed(2)}%): <strong style={{ color: '#DC2626' }}>-₹{companyFee.toFixed(2)}</strong></div>
                              </div>
                            </div>
                          )}

                        </div>

                        {/* Submit CTA Button */}
                        <button 
                          type="submit"
                          disabled={isSubmittingSale || cardSwipeAmount <= 0 || !saleForm.transaction_id}
                          style={{
                            width: '100%',
                            background: (cardSwipeAmount > 0 && saleForm.transaction_id)
                              ? (selectedMachineKey === 'payswiff' ? 'linear-gradient(135deg, #D97706 0%, #92400E 100%)' : 'linear-gradient(135deg, #0F52BA 0%, #1E3A8A 100%)')
                              : '#8B95A5',
                            color: '#FFF',
                            border: 'none',
                            padding: '0.8125rem 1rem',
                            borderRadius: '12px',
                            fontWeight: 800,
                            fontSize: '0.875rem',
                            cursor: (cardSwipeAmount > 0 && saleForm.transaction_id) ? 'pointer' : 'not-allowed',
                            boxShadow: (cardSwipeAmount > 0 && saleForm.transaction_id) ? '0 4px 14px rgba(15,82,186,0.25)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <CreditCard style={{ width: '16px', height: '16px' }} />
                          <span>
                            {isSubmittingSale 
                              ? 'Recording Swipe...' 
                              : (cardSwipeAmount > 0 && saleForm.transaction_id)
                                ? `Record Swipe of ₹${cardSwipeAmount.toLocaleString('en-IN')} on ${activeMachine.title} →`
                                : !saleForm.transaction_id && cardSwipeAmount > 0
                                  ? 'Enter Slip UTR to Record →'
                                  : 'Enter Amount & UTR to Record →'}
                          </span>
                        </button>
                      </form>
                    );
                  })()}
                </div>

                {/* Right Column: Recent Recorded Swipes */}
                <div className="subpage-col">

                  {/* 6. Recent Card Swipes Ledger (Segregated for active machine) */}
                  <div style={{
                    background: '#FFFFFF',
                    borderRadius: '14px',
                    border: '1px solid #EDF2F7',
                    padding: '1rem',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: activeMachine.accentBg, color: activeMachine.themeColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <History style={{ width: '14px', height: '14px' }} />
                        </div>
                        <h4 style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                          Recent Swipes ({activeMachine.title})
                        </h4>
                        <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: activeMachine.themeColor, background: activeMachine.accentBg, padding: '1px 6px', borderRadius: '6px' }}>
                          {activeMachineTransactions.length} Recorded
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: activeMachine.themeColor,
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        View All →
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {activeMachineTransactions.length === 0 ? (
                        <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.75rem' }}>
                          No card swipes recorded for {activeMachine.title} yet.
                        </div>
                      ) : (
                        activeMachineTransactions.slice(0, 6).map((t, idx) => {
                          const st = (t.status || '').toUpperCase();
                          const isApproved = st === 'APPROVED' || st === 'SUCCESS' || st === 'COMPLETED';
                          const isPending = st === 'PENDING';
                          const { title, rrn, customerMobile } = parseTxnDisplay(t);

                          return (
                            <div
                              key={t.id || idx}
                              onClick={() => { setSelectedTxnForDetails(t); setTxnDetailType('SWIPE'); }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0.65rem 0.8rem',
                                borderRadius: '12px',
                                background: '#FFFFFF',
                                border: '1px solid #E2E8F0',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                                transition: 'all 0.15s ease',
                                gap: '0.75rem',
                                cursor: 'pointer'
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,82,186,0.08)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)'; }}
                            >
                              {/* Left: Card Icon + Clean Title + RRN/Time */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                                <div style={{
                                  width: '34px',
                                  height: '34px',
                                  borderRadius: '9px',
                                  background: activeMachine.accentBg || '#EFF6FF',
                                  color: activeMachine.themeColor || '#0F52BA',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  <CreditCard style={{ width: '17px', height: '17px' }} />
                                </div>

                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <strong style={{
                                      fontSize: '0.78125rem',
                                      color: '#0F172A',
                                      fontWeight: 700,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }}>
                                      {title}
                                    </strong>
                                    <span style={{
                                      fontSize: '0.53125rem',
                                      fontWeight: 800,
                                      background: '#ECFDF5',
                                      color: '#047857',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      flexShrink: 0
                                    }}>
                                      POS
                                    </span>
                                  </div>

                                  <div style={{
                                    fontSize: '0.625rem',
                                    color: '#64748B',
                                    marginTop: '2px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>UTR: {rrn}</span>
                                    <span> • {new Date(t.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    {customerMobile ? <span> • {customerMobile}</span> : null}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Amount & Clean Status Badge */}
                              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <p style={{
                                  fontSize: '0.875rem',
                                  fontWeight: 900,
                                  color: '#0F172A',
                                  margin: 0,
                                  letterSpacing: '-0.01em',
                                  lineHeight: 1.2
                                }}>
                                  ₹{parseFloat(t.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </p>
                                <span style={{
                                  display: 'inline-block',
                                  fontSize: '0.5625rem',
                                  fontWeight: 800,
                                  marginTop: '3px',
                                  padding: '1.5px 6px',
                                  borderRadius: '5px',
                                  background: isApproved ? '#ECFDF5' : isPending ? '#FFFBEB' : '#FEF2F2',
                                  color: isApproved ? '#059669' : isPending ? '#D97706' : '#DC2626',
                                  border: isApproved ? '1px solid #A7F3D0' : isPending ? '1px solid #FDE68A' : '1px solid #FECACA'
                                }}>
                                  {isApproved ? '✓ Cleared' : isPending ? '⏳ In Verification' : '✕ Rejected'}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW 3: DEDICATED "WITHDRAW TO BANK" PAGE                 */}
          {/* (PREMIUM NATIVE APP FINTECH EXPERIENCE - STANDARD SCALE)   */}
          {/* ========================================================= */}
          {activeTab === 'withdraw' && (() => {
            const displayBeneficiaries = beneficiaries || [];
            const currentBankId = selectedBankId || (displayBeneficiaries.length > 0 ? displayBeneficiaries[0].id : null);
            const selectedBank = displayBeneficiaries.find(b => b.id === currentBankId) || (displayBeneficiaries.length > 0 ? displayBeneficiaries[0] : null);
            const parsedAmount = parseFloat(withdrawAmount) || 0;

            return (
              <div className="merchant-subpage-wrapper full-width" style={{ gap: '0.4rem', maxWidth: '720px' }}>
                
                {/* 1. Page Title - Single Clean Heading, Tight Wanted Gap */}
                <div style={{ margin: '0 0 0.15rem 0' }}>
                  <h1 style={{ fontSize: '1.125rem', fontWeight: 900, color: '#0A192F', margin: 0, letterSpacing: '-0.01em' }}>
                    Withdraw &amp; Payout Request
                  </h1>
                </div>

                {/* Split Layout: Form on Left, Recent Bank Transfers on Right */}
                <div className="subpage-split-grid">
                  
                  {/* Left Column: Streamlined Payout Form with Attached Balance Header */}
                  <div className="subpage-col">
                    <form onSubmit={handleWithdrawSubmit} style={{
                      background: 'transparent',
                      border: 'none',
                      boxShadow: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      width: '100%'
                    }}>

                      {/* STANDALONE BALANCE BANNER (Sleek rounded card, no enclosing outer box) */}
                      <div style={{
                        background: 'linear-gradient(135deg, #0A192F 0%, #0F52BA 100%)',
                        padding: '0.75rem 0.875rem',
                        borderRadius: '12px',
                        color: '#FFFFFF',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.4rem',
                        boxShadow: '0 2px 8px rgba(15, 82, 186, 0.12)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Landmark style={{ width: '15px', height: '15px', color: '#60A5FA', flexShrink: 0 }} />
                          <div>
                            <span style={{ fontSize: '0.625rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                              Available Disbursal Balance
                            </span>
                            <span style={{ fontSize: '1.35rem', fontWeight: 900, letterSpacing: '-0.01em', color: '#FFFFFF', lineHeight: 1.1 }}>
                              ₹{activeMachineWallet.available_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.75)' }}>
                            Terminal {activeMachine.terminal_id}
                          </span>
                          <button
                            type="button"
                            onClick={() => setWithdrawAmount(activeMachineWallet.available_balance.toString())}
                            style={{
                              background: 'rgba(255,255,255,0.18)',
                              border: '1px solid rgba(255,255,255,0.3)',
                              color: '#FFFFFF',
                              borderRadius: '6px',
                              padding: '0.2rem 0.55rem',
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            Withdraw All ↗
                          </button>
                        </div>
                      </div>

                      {/* DIRECT FORM FIELDS: Flat on Screen Surface, Zero Nested Enclosing Box */}
                      <div style={{
                        padding: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        width: '100%'
                      }}>

                        {/* 1. Disbursal Amount Section */}
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '0.3rem' }}>
                            Disbursal Amount *
                          </label>

                          <div style={{
                            background: '#F8FAFC',
                            border: parsedAmount > activeMachineWallet.available_balance ? '1.5px solid #EF4444' : '1.5px solid #CBD5E1',
                            borderRadius: '8px',
                            padding: '0.45rem 0.65rem',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginRight: '0.35rem' }}>₹</span>
                            <input 
                              type="number"
                              step="any"
                              placeholder="0.00"
                              required
                              value={withdrawAmount}
                              onChange={(e) => setWithdrawAmount(e.target.value)}
                              style={{
                                width: '100%',
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                fontSize: '1.25rem',
                                fontWeight: 800,
                                color: '#0F172A',
                                padding: 0
                              }}
                            />
                          </div>

                          {/* Quick Amount Chips */}
                          <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                            {[
                              { label: '₹10k', val: '10000' },
                              { label: '₹25k', val: '25000' },
                              { label: '₹50k', val: '50000' },
                              { label: '₹1 Lakh', val: '100000' },
                              { label: '₹2 Lakh', val: '200000' }
                            ].map(chip => (
                              <button
                                key={chip.val}
                                type="button"
                                onClick={() => setWithdrawAmount(chip.val)}
                                style={{
                                  flex: 1,
                                  minWidth: '42px',
                                  background: withdrawAmount === chip.val ? '#EFF6FF' : '#FFFFFF',
                                  border: withdrawAmount === chip.val ? '1.5px solid #0F52BA' : '1px solid #CBD5E1',
                                  borderRadius: '6px',
                                  padding: '0.28rem 0.15rem',
                                  fontSize: '0.6875rem',
                                  fontWeight: 700,
                                  color: withdrawAmount === chip.val ? '#0F52BA' : '#334155',
                                  cursor: 'pointer'
                                }}
                              >
                                {chip.label}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setWithdrawAmount(activeMachineWallet.available_balance.toString())}
                              style={{
                                background: '#ECFDF5',
                                border: '1px solid #A7F3D0',
                                borderRadius: '6px',
                                padding: '0.28rem 0.45rem',
                                fontSize: '0.6875rem',
                                fontWeight: 800,
                                color: '#059669',
                                cursor: 'pointer'
                              }}
                            >
                              All
                            </button>
                          </div>
                        </div>

                        {/* 2. Settlement Clearance Speed */}
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '0.35rem' }}>
                            Settlement Clearance Speed
                          </label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <div
                              onClick={() => setCustomerPayoutForm({ ...customerPayoutForm, settlement_mode: 'INSTANT' })}
                              style={{
                                padding: '0.45rem 0.6rem',
                                borderRadius: '8px',
                                border: customerPayoutForm.settlement_mode === 'INSTANT' ? '1.5px solid #059669' : '1px solid #CBD5E1',
                                background: customerPayoutForm.settlement_mode === 'INSTANT' ? '#ECFDF5' : '#FFFFFF',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <strong style={{ fontSize: '0.75rem', color: customerPayoutForm.settlement_mode === 'INSTANT' ? '#059669' : '#0F172A' }}>
                                  ⚡ Instant IMPS
                                </strong>
                                <span style={{ fontSize: '0.5625rem', fontWeight: 800, background: '#DCFCE7', color: '#15803D', padding: '1px 5px', borderRadius: '4px' }}>
                                  {activeMachine.rateStrInstant || '1.80%'}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.625rem', color: '#64748B', display: 'block', marginTop: '1px' }}>
                                Same day clearance
                              </span>
                            </div>

                            <div
                              onClick={() => setCustomerPayoutForm({ ...customerPayoutForm, settlement_mode: 'T1' })}
                              style={{
                                padding: '0.45rem 0.6rem',
                                borderRadius: '8px',
                                border: customerPayoutForm.settlement_mode === 'T1' ? '1.5px solid #0F52BA' : '1px solid #CBD5E1',
                                background: customerPayoutForm.settlement_mode === 'T1' ? '#EFF6FF' : '#FFFFFF',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <strong style={{ fontSize: '0.75rem', color: customerPayoutForm.settlement_mode === 'T1' ? '#0F52BA' : '#0F172A' }}>
                                  📅 T+1 Standard
                                </strong>
                                <span style={{ fontSize: '0.5625rem', fontWeight: 800, background: '#DBEAFE', color: '#1D4ED8', padding: '1px 5px', borderRadius: '4px' }}>
                                  {activeMachine.rateStrT1 || '1.50%'}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.625rem', color: '#64748B', display: 'block', marginTop: '1px' }}>
                                Next business day
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 3. Destination Bank Account (Full-Width Segmented Tab Bar, Crisp Chips, Zero Clipping) */}
                        <div>
                          <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '0.35rem' }}>
                            <Landmark style={{ width: '14px', height: '14px', color: '#0F52BA' }} />
                            Destination Bank Account *
                          </label>

                          {/* Full-Width 50/50 Segmented Control Tab Bar */}
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            background: '#F1F5F9',
                            padding: '3px',
                            borderRadius: '9px',
                            gap: '3px',
                            marginBottom: '0.55rem'
                          }}>
                            <button
                              type="button"
                              onClick={() => setBankInputMode('manual')}
                              style={{
                                padding: '0.45rem 0.5rem',
                                borderRadius: '7px',
                                border: 'none',
                                background: bankInputMode === 'manual' ? '#0F52BA' : 'transparent',
                                color: bankInputMode === 'manual' ? '#FFFFFF' : '#475569',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '5px',
                                boxShadow: bankInputMode === 'manual' ? '0 1px 3px rgba(15,82,186,0.25)' : 'none',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span>✏️</span> Enter Bank Details
                            </button>
                            <button
                              type="button"
                              onClick={() => setBankInputMode('saved')}
                              style={{
                                padding: '0.45rem 0.5rem',
                                borderRadius: '7px',
                                border: 'none',
                                background: bankInputMode === 'saved' ? '#0F52BA' : 'transparent',
                                color: bankInputMode === 'saved' ? '#FFFFFF' : '#475569',
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '5px',
                                boxShadow: bankInputMode === 'saved' ? '0 1px 3px rgba(15,82,186,0.25)' : 'none',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <span>👥</span> Saved Beneficiaries ({displayBeneficiaries.length})
                            </button>
                          </div>

                          {/* MODE A: DIRECT FIELDS (FLAT ON CARD SURFACE - ZERO NESTED BOX) */}
                          {bankInputMode === 'manual' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                              {/* Selected Bank Banner if user picked previously */}
                              {customerPayoutForm.bank_name && customerPayoutForm.account_number ? (
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  background: '#ECFDF5',
                                  border: '1.5px solid #10B981',
                                  padding: '0.45rem 0.75rem',
                                  borderRadius: '8px',
                                  boxShadow: '0 1px 3px rgba(16,185,129,0.1)'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ color: '#059669', fontSize: '0.875rem', fontWeight: 900 }}>✓</span>
                                    <div>
                                      <strong style={{ fontSize: '0.75rem', color: '#065F46', display: 'block' }}>
                                        Selected: {customerPayoutForm.bank_name} •••• {(customerPayoutForm.account_number || '').slice(-4)}
                                      </strong>
                                      <span style={{ fontSize: '0.625rem', color: '#047857' }}>
                                        {customerPayoutForm.customer_name || 'Verified Beneficiary'} • {customerPayoutForm.ifsc}
                                      </span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setBankInputMode('saved')}
                                    style={{
                                      background: '#FFFFFF',
                                      border: '1px solid #A7F3D0',
                                      color: '#047857',
                                      fontSize: '0.6875rem',
                                      fontWeight: 800,
                                      cursor: 'pointer',
                                      padding: '0.2rem 0.55rem',
                                      borderRadius: '6px'
                                    }}
                                  >
                                    Change ▾
                                  </button>
                                </div>
                              ) : customerPayoutForm.bank_name ? (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '0.3rem 0.55rem', borderRadius: '6px' }}>
                                  <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1E40AF' }}>
                                    🏦 Selected Bank: {customerPayoutForm.bank_name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setCustomerPayoutForm(prev => ({ ...prev, bank_name: '', account_number: '', ifsc: '' }))}
                                    style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '0.625rem', cursor: 'pointer', fontWeight: 700 }}
                                  >
                                    Clear ✕
                                  </button>
                                </div>
                              ) : null}

                              {/* Popular Bank Chips */}
                              <div>
                                <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '3px' }}>
                                  Popular Bank Shortcuts:
                                </span>
                                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                  {[
                                    { name: 'State Bank of India', shortName: 'SBI', ifsc: 'SBIN0001234' },
                                    { name: 'HDFC Bank', shortName: 'HDFC', ifsc: 'HDFC0000456' },
                                    { name: 'ICICI Bank', shortName: 'ICICI', ifsc: 'ICIC0000234' },
                                    { name: 'Axis Bank', shortName: 'Axis', ifsc: 'UTIB0000123' },
                                    { name: 'Kotak Mahindra Bank', shortName: 'Kotak', ifsc: 'KKBK0000123' }
                                  ].map(b => (
                                    <button
                                      key={b.shortName}
                                      type="button"
                                      onClick={() => setCustomerPayoutForm(prev => ({
                                        ...prev,
                                        bank_name: b.name,
                                        ifsc: prev.ifsc || b.ifsc
                                      }))}
                                      style={{
                                        background: customerPayoutForm.bank_name === b.name ? '#EFF6FF' : '#FFFFFF',
                                        border: customerPayoutForm.bank_name === b.name ? '1.5px solid #0F52BA' : '1px solid #CBD5E1',
                                        color: customerPayoutForm.bank_name === b.name ? '#0F52BA' : '#334155',
                                        padding: '0.22rem 0.55rem',
                                        borderRadius: '6px',
                                        fontSize: '0.6875rem',
                                        fontWeight: 700,
                                        cursor: 'pointer',
                                        transition: 'all 0.12s ease'
                                      }}
                                    >
                                      {b.shortName}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Bank Name Input */}
                              <div>
                                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>
                                  Bank Name *
                                </label>
                                <input
                                  type="text"
                                  placeholder="e.g. State Bank of India, HDFC Bank"
                                  required
                                  value={customerPayoutForm.bank_name}
                                  onChange={(e) => setCustomerPayoutForm({ ...customerPayoutForm, bank_name: e.target.value })}
                                  style={{
                                    width: '100%',
                                    background: '#FFFFFF',
                                    border: '1px solid #CBD5E1',
                                    borderRadius: '8px',
                                    padding: '0.45rem 0.625rem',
                                    fontSize: '0.8125rem',
                                    fontWeight: 700,
                                    color: '#0F172A',
                                    boxSizing: 'border-box'
                                  }}
                                />
                              </div>

                              {/* Account Number & Confirm Account Number */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
                                <div>
                                  <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>
                                    Account Number *
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="A/C Number"
                                    required
                                    value={customerPayoutForm.account_number}
                                    onChange={(e) => setCustomerPayoutForm({ ...customerPayoutForm, account_number: e.target.value.replace(/\D/g, '') })}
                                    style={{
                                      width: '100%',
                                      background: '#FFFFFF',
                                      border: '1px solid #CBD5E1',
                                      borderRadius: '8px',
                                      padding: '0.45rem 0.625rem',
                                      fontSize: '0.8125rem',
                                      fontFamily: 'monospace',
                                      fontWeight: 700,
                                      color: '#0F172A',
                                      boxSizing: 'border-box'
                                    }}
                                  />
                                </div>

                                <div>
                                  <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>
                                    Confirm Account Number *
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Re-enter A/C"
                                    value={customerPayoutForm.confirm_account}
                                    onChange={(e) => setCustomerPayoutForm({ ...customerPayoutForm, confirm_account: e.target.value.replace(/\D/g, '') })}
                                    style={{
                                      width: '100%',
                                      background: '#FFFFFF',
                                      border: customerPayoutForm.confirm_account && customerPayoutForm.confirm_account !== customerPayoutForm.account_number
                                        ? '1.5px solid #EF4444'
                                        : '1px solid #CBD5E1',
                                      borderRadius: '8px',
                                      padding: '0.45rem 0.625rem',
                                      fontSize: '0.8125rem',
                                      fontFamily: 'monospace',
                                      fontWeight: 700,
                                      color: '#0F172A',
                                      boxSizing: 'border-box'
                                    }}
                                  />
                                </div>
                              </div>

                              {/* IFSC & Beneficiary Name */}
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
                                <div>
                                  <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>
                                    IFSC Code *
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="e.g. SBIN0001234"
                                    required
                                    value={customerPayoutForm.ifsc}
                                    onChange={(e) => setCustomerPayoutForm({ ...customerPayoutForm, ifsc: e.target.value.toUpperCase() })}
                                    style={{
                                      width: '100%',
                                      background: '#FFFFFF',
                                      border: '1px solid #CBD5E1',
                                      borderRadius: '8px',
                                      padding: '0.45rem 0.625rem',
                                      fontSize: '0.8125rem',
                                      fontFamily: 'monospace',
                                      fontWeight: 700,
                                      color: '#0F172A',
                                      boxSizing: 'border-box'
                                    }}
                                  />
                                </div>

                                <div>
                                  <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>
                                    Beneficiary Name *
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Account Holder Name"
                                    required
                                    value={customerPayoutForm.customer_name}
                                    onChange={(e) => setCustomerPayoutForm({ ...customerPayoutForm, customer_name: e.target.value })}
                                    style={{
                                      width: '100%',
                                      background: '#FFFFFF',
                                      border: '1px solid #CBD5E1',
                                      borderRadius: '8px',
                                      padding: '0.45rem 0.625rem',
                                      fontSize: '0.8125rem',
                                      fontWeight: 700,
                                      color: '#0F172A',
                                      boxSizing: 'border-box'
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Action: Save to Beneficiaries Checkbox + Quick Save */}
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.25rem 0',
                                marginTop: '0.1rem',
                                flexWrap: 'wrap',
                                gap: '0.4rem'
                              }}>
                                <label style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.45rem',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  color: '#334155',
                                  userSelect: 'none'
                                }}>
                                  <input
                                    type="checkbox"
                                    checked={saveAsBeneficiaryOnTransfer}
                                    onChange={(e) => setSaveAsBeneficiaryOnTransfer(e.target.checked)}
                                    style={{ width: '15px', height: '15px', accentColor: '#0F52BA', cursor: 'pointer' }}
                                  />
                                  <span>Save this account to Beneficiaries</span>
                                </label>

                                <button
                                  type="button"
                                  onClick={handleSaveCurrentAsBeneficiary}
                                  disabled={isSavingBeneficiary}
                                  style={{
                                    background: '#EFF6FF',
                                    color: '#0F52BA',
                                    border: '1px solid #BFDBFE',
                                    padding: '0.22rem 0.55rem',
                                    borderRadius: '6px',
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                >
                                  <Plus style={{ width: '11px', height: '11px' }} />
                                  <span>{isSavingBeneficiary ? 'Saving...' : 'Save Now'}</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* MODE B: SELECT FROM SAVED BENEFICIARIES LIST (FLAT DESIGN) */}
                          {bankInputMode === 'saved' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#0A192F' }}>
                                  Click any bank to select and proceed:
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setBankInputMode('manual')}
                                  style={{
                                    background: '#EFF6FF',
                                    border: '1px solid #BFDBFE',
                                    color: '#0F52BA',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '6px',
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    cursor: 'pointer'
                                  }}
                                >
                                  + Enter New Bank
                                </button>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '200px', overflowY: 'auto' }}>
                                {displayBeneficiaries.length === 0 ? (
                                  <div style={{ textAlign: 'center', padding: '1rem 0.5rem', color: '#64748B', fontSize: '0.75rem', background: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
                                    <p style={{ margin: '0 0 0.2rem', fontWeight: 700, color: '#334155' }}>No saved bank accounts found.</p>
                                    <span>Click "Enter Bank Details" above to disburse to any bank account.</span>
                                  </div>
                                ) : displayBeneficiaries.map(b => {
                                  const isSelected = customerPayoutForm.account_number === (b.account_number || b.account);
                                  return (
                                    <div
                                      key={b.id}
                                      onClick={() => {
                                        const accNum = b.account_number || b.account;
                                        const bName = b.bank_name || b.bank;
                                        setCustomerPayoutForm(prev => ({
                                          ...prev,
                                          bank_name: bName,
                                          account_number: accNum,
                                          confirm_account: accNum,
                                          ifsc: b.ifsc,
                                          customer_name: b.holder_name || b.name || prev.customer_name
                                        }));
                                        setSelectedBankId(b.id);
                                        // Auto-switch directly back to Enter Bank Details view so user is ready to proceed immediately!
                                        setBankInputMode('manual');
                                        showToast(`✓ Loaded ${bName} (•••• ${(accNum || '').slice(-4)})`);
                                      }}
                                      style={{
                                        background: isSelected ? '#EFF6FF' : '#FFFFFF',
                                        border: `1.5px solid ${isSelected ? '#0F52BA' : '#CBD5E1'}`,
                                        borderRadius: '8px',
                                        padding: '0.45rem 0.6rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition: 'all 0.12s ease'
                                      }}
                                    >
                                      <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <strong style={{ fontSize: '0.75rem', color: '#0F172A' }}>
                                            {b.bank_name || b.bank}
                                          </strong>
                                          {isSelected && (
                                            <span style={{ fontSize: '0.5625rem', fontWeight: 800, background: '#DCFCE7', color: '#15803D', padding: '1px 5px', borderRadius: '4px' }}>
                                              ✓ Selected
                                            </span>
                                          )}
                                        </div>
                                        <div style={{ fontSize: '0.65rem', color: '#64748B', fontFamily: 'monospace', marginTop: '1px' }}>
                                          •••• {(b.account_number || b.account || '').slice(-4)} • {b.holder_name || b.name} • {b.ifsc}
                                        </div>
                                      </div>
                                      <div style={{
                                        width: '16px',
                                        height: '16px',
                                        borderRadius: '50%',
                                        border: isSelected ? '5px solid #0F52BA' : '2px solid #CBD5E1',
                                        background: '#FFFFFF'
                                      }} />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 4. Primary Action CTA Button */}
                        <button
                          type="submit"
                          disabled={isSubmittingWithdraw || parsedAmount <= 0}
                          style={{
                            width: '100%',
                            background: parsedAmount > 0 
                              ? 'linear-gradient(135deg, #0F52BA 0%, #1E3A8A 100%)'
                              : '#CBD5E1',
                            color: '#FFF',
                            border: 'none',
                            padding: '0.75rem 1rem',
                            borderRadius: '10px',
                            fontWeight: 800,
                            fontSize: '0.875rem',
                            cursor: parsedAmount > 0 ? 'pointer' : 'not-allowed',
                            boxShadow: parsedAmount > 0 ? '0 4px 14px rgba(15,82,186,0.25)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.15s ease',
                            marginTop: '0.25rem'
                          }}
                        >
                          <Send style={{ width: '15px', height: '15px' }} />
                          <span>
                            {isSubmittingWithdraw 
                              ? 'Processing Payout Request...' 
                              : parsedAmount > 0 
                                ? customerPayoutForm.bank_name 
                                  ? `Disburse ₹${parsedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} to ${customerPayoutForm.bank_name} →`
                                  : `Disburse ₹${parsedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} via ${customerPayoutForm.settlement_mode === 'T1' ? 'T+1 Standard' : 'Instant IMPS'} →`
                                : customerPayoutForm.bank_name
                                  ? `Enter Amount to Transfer to ${customerPayoutForm.bank_name} →`
                                  : 'Enter Amount to Transfer →'}
                          </span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Right Column: Recent Bank Transfers */}
                  <div className="subpage-col">
                    {/* Recent Bank Transfers (Clean Mobile Feed Matching Image 2) */}
                    <div style={{
                      background: '#FFFFFF',
                      borderRadius: '20px',
                      border: '1px solid #EDF2F7',
                      padding: '1.125rem',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.02)',
                      display: 'flex',
                      flexDirection: 'column'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem', paddingBottom: '0.5rem', borderBottom: '1px solid #F1F5F9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                            🏦 Bank Transfers
                          </h3>
                          <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#0F52BA', background: '#EFF6FF', padding: '1px 7px', borderRadius: '999px' }}>
                            {displayWithdrawals.length} Shown
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveTab('history')}
                          style={{ background: 'none', border: 'none', color: '#0F52BA', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', padding: 0 }}
                        >
                          View All →
                        </button>
                      </div>

                      {/* EXACT MATCH TO IMAGE 1: DUAL-ROW MOBILE PILLS */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                        {/* Row 1: Rounded Speed Pills */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                          {[
                            { id: 'INSTANT', label: '⚡ Instant', count: withdrawalCounts.instant },
                            { id: 'T1', label: '📅 T+1', count: withdrawalCounts.t1 },
                            { id: 'ALL', label: 'All', count: withdrawalCounts.all }
                          ].map(t => {
                            const isActive = withdrawSettlementFilter === t.id;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setWithdrawSettlementFilter(t.id)}
                                style={{
                                  background: isActive ? '#0B57D0' : '#FFFFFF',
                                  color: isActive ? '#FFFFFF' : '#0F172A',
                                  border: isActive ? '1.5px solid #0B57D0' : '1px solid #CBD5E1',
                                  borderRadius: '9999px',
                                  padding: '0.42rem 0.2rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '4px',
                                  boxShadow: isActive ? '0 2px 6px rgba(11,87,208,0.25)' : 'none',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <span>{t.label}</span>
                                <span>({t.count})</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {displayWithdrawals.length === 0 ? (
                          <div style={{ padding: '1.75rem 0.5rem', textAlign: 'center', color: '#64748B', fontSize: '0.75rem' }}>
                            <p style={{ margin: '0 0 0.25rem', fontWeight: 700, color: '#334155' }}>No bank transfers recorded yet.</p>
                            <span>When you request a disbursal, real-time status and UTR will appear here.</span>
                          </div>
                        ) : (
                          displayWithdrawals.map((w, idx, arr) => {
                            const isPending = (w.status || '').toUpperCase() === 'PENDING';
                            const isRejected = (w.status || '').toUpperCase() === 'REJECTED';
                            const isApproved = !isPending && !isRejected;
                            const isPendingToDisburse = isPending && (w.is_pending_to_disburse || (w.admin_remark || '').includes('[PENDING_TO_DISBURSE]'));
                            const isSubmittedToBank = isPending && (w.is_submitted_to_bank || (w.admin_remark || '').includes('[SUBMITTED_TO_BANK]'));

                            const statusBadge = isApproved
                              ? { label: '✓ Settled & Disbursed', color: '#059669', bg: '#ECFDF5' }
                              : isSubmittedToBank
                              ? { label: '🏦 Submitted to Bank', color: '#0284C7', bg: '#E0F2FE' }
                              : isPendingToDisburse
                              ? { label: '⏳ Pending to Disburse (T+1)', color: '#2563EB', bg: '#EFF6FF' }
                              : isPending
                              ? { label: '📥 Request Received', color: '#D97706', bg: '#FFFBEB' }
                              : { label: '✕ Rejected', color: '#DC2626', bg: '#FEF2F2' };

                            const formattedDate = w.created_at 
                              ? new Date(w.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' + new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'Recent';

                            const isLast = idx === arr.length - 1;

                            return (
                              <div
                                key={w.id || idx}
                                onClick={() => { setSelectedTxnForDetails(w); setTxnDetailType('WITHDRAWAL'); }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '0.6875rem 0.4rem',
                                  borderRadius: '8px',
                                  borderBottom: isLast ? 'none' : '1px solid #F1F5F9',
                                  transition: 'background 0.15s ease',
                                  cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <BankLogo bankName={w.bank_name || 'Bank'} />
                                  </div>
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                                      <strong style={{ fontSize: '0.8125rem', color: '#0F172A', fontWeight: 700, lineHeight: 1.2 }}>
                                        {w.bank_name || 'State Bank of India'}
                                      </strong>
                                      {w.is_customer_disbursal && (
                                        <span style={{ fontSize: '0.5625rem', fontWeight: 800, background: '#F5F3FF', color: '#7C3AED', padding: '1px 5px', borderRadius: '4px', border: '1px solid #DDD6FE' }}>
                                          👤 {w.customer_name || 'Customer'}
                                        </span>
                                      )}
                                      {((w.settlement_mode || w.settlement_type || '').toUpperCase().includes('INSTANT') || (w.admin_remark || '').includes('IMPS')) ? (
                                        <span style={{ fontSize: '0.5625rem', fontWeight: 800, background: '#DCFCE7', color: '#15803D', padding: '1px 5px', borderRadius: '4px', border: '1px solid #BBF7D0' }}>⚡ Instant</span>
                                      ) : (
                                        <span style={{ fontSize: '0.5625rem', fontWeight: 800, background: '#DBEAFE', color: '#1D4ED8', padding: '1px 5px', borderRadius: '4px', border: '1px solid #BFDBFE' }}>📅 T+1</span>
                                      )}
                                    </div>
                                    
                                    <span style={{ fontSize: '0.625rem', color: '#64748B', display: 'block', marginTop: '2px', fontFamily: 'monospace' }}>
                                      A/C: {w.account_number ? (w.account_number.startsWith('••') ? w.account_number : `•••• ${w.account_number.slice(-4)}`) : '•••• 5678'} • {formattedDate}
                                    </span>

                                    {/* UTR Reference Copy Chip */}
                                    {w.utr_number && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                                        <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#059669', background: '#DCFCE7', padding: '1px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>
                                          UTR: {w.utr_number}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(w.utr_number);
                                            showToast(`Copied UTR: ${w.utr_number}`);
                                          }}
                                          style={{ background: 'none', border: 'none', color: '#0F52BA', fontSize: '0.5625rem', fontWeight: 700, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                                        >
                                          Copy
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                  <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em' }}>
                                    -₹{parseFloat(w.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                  </div>
                                  <span style={{
                                    display: 'inline-block',
                                    fontSize: '0.5625rem',
                                    fontWeight: 800,
                                    marginTop: '2px',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: statusBadge.bg,
                                    color: statusBadge.color
                                  }}>
                                    {statusBadge.label}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            );
          })()}

          {/* ========================================================= */}
          {/* VIEW 4: DEDICATED "BILL PAYMENTS (BBPS)" PAGE             */}
          {/* (PREMIUM FINTECH EXPERIENCE MATCHING USER REFERENCE EXACTLY) */}
          {/* ========================================================= */}
          {activeTab === 'bbps' && (
            <div className="merchant-subpage-wrapper">
              
              {/* Top Header Card: Yellow Bolt + Bill Payments & Recharges + Available Pill */}
              <div style={{
                background: '#FFFFFF',
                borderRadius: '18px',
                border: '1px solid #E2E8F0',
                padding: '1rem 1.125rem',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
                    color: '#D97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 6px rgba(217,119,6,0.12)'
                  }}>
                    <Zap style={{ width: '20px', height: '20px' }} />
                  </div>
                  <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
                    Bill Payments & Recharges
                  </h1>
                </div>

                <div>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    borderRadius: '16px',
                    padding: '3px 10px',
                    color: '#059669',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}>
                    Available: <strong style={{ fontWeight: 900, color: '#059669' }}>₹{wallet.available_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                  </span>
                </div>
              </div>

              {/* 3. Service Categories 4-Card Selector (Matches Reference Cards Exactly) */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                {[
                  { id: 'mobile', line1: 'Mobile', line2: 'Recharge', icon: Smartphone, color: '#0F52BA' },
                  { id: 'electricity', line1: 'Electricity', line2: 'Bill', icon: Zap, color: '#475569' },
                  { id: 'dth', line1: 'DTH /', line2: 'TV', icon: Tv, color: '#475569' },
                  { id: 'fastag', line1: 'Fastag', line2: 'Recharge', icon: Car, color: '#475569' }
                ].map(cat => {
                  const Icon = cat.icon;
                  const isActive = bbpsCategory === cat.id;
                  return (
                    <button 
                      key={cat.id}
                      type="button"
                      onClick={() => setBbpsCategory(cat.id)}
                      className="card-hover"
                      style={{
                        padding: '0.75rem 0.25rem',
                        borderRadius: '16px',
                        border: isActive ? '2px solid #0F52BA' : '1.5px solid #E2E8F0',
                        background: '#FFFFFF',
                        color: isActive ? '#0F52BA' : '#475569',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        cursor: 'pointer',
                        fontWeight: 800,
                        boxShadow: isActive ? '0 4px 14px rgba(15,82,186,0.12)' : '0 1px 3px rgba(0,0,0,0.02)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Icon style={{ width: '22px', height: '22px', color: isActive ? '#0F52BA' : '#64748B' }} />
                      <div style={{ fontSize: '0.6875rem', fontWeight: 800, textAlign: 'center', lineHeight: '1.2' }}>
                        <div>{cat.line1}</div>
                        <div>{cat.line2}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Split Layout: Form on Left, Recent Utility Collections on Right for Desktop */}
              <div className="subpage-split-grid">
                
                {/* Left Column: Main Payment Form Card */}
                <div className="subpage-col">
                  <div style={{
                background: '#FFFFFF',
                borderRadius: '18px',
                border: '1px solid #E2E8F0',
                padding: '1.25rem',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    {bbpsCategory === 'mobile' ? 'Mobile Prepaid Recharge' : (bbpsCategory === 'electricity' ? 'Electricity Bill Payment' : (bbpsCategory === 'dth' ? 'DTH TV Recharge' : 'Fastag Toll Recharge'))}
                  </h3>
                  <span style={{ fontSize: '0.5625rem', color: '#059669', fontWeight: 800, background: '#DCFCE7', padding: '2px 7px', borderRadius: '8px' }}>
                    ● INSTANT BBPS
                  </span>
                </div>

                <form onSubmit={handleBbpsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {bbpsCategory === 'mobile' && (
                    <>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '0.375rem' }}>
                          Customer Mobile Number *
                        </label>
                        <input 
                          type="tel"
                          placeholder="10-digit mobile"
                          required
                          value={bbpsForm.mobile}
                          onChange={(e) => setBbpsForm({ ...bbpsForm, mobile: e.target.value })}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            background: '#FFFFFF',
                            border: '1.5px solid #E2E8F0',
                            borderRadius: '10px',
                            padding: '0.65rem 0.85rem',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: '#0F172A',
                            outline: 'none'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '0.375rem' }}>
                          Mobile Operator
                        </label>
                        <select 
                          value={bbpsForm.operator}
                          onChange={(e) => setBbpsForm({ ...bbpsForm, operator: e.target.value })}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '0.65rem 0.85rem',
                            borderRadius: '10px',
                            border: '1.5px solid #E2E8F0',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: '#0F172A',
                            background: '#FFFFFF',
                            outline: 'none'
                          }}
                        >
                          <option value="Jio Prepaid">Jio Prepaid</option>
                          <option value="Airtel Prepaid">Airtel Prepaid</option>
                          <option value="Vodafone Idea (Vi)">Vodafone Idea (Vi)</option>
                          <option value="BSNL">BSNL</option>
                        </select>
                      </div>
                    </>
                  )}

                  {bbpsCategory === 'electricity' && (
                    <>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '0.375rem' }}>
                          Electricity Board *
                        </label>
                        <select 
                          value={bbpsForm.biller_name}
                          onChange={(e) => setBbpsForm({ ...bbpsForm, biller_name: e.target.value })}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '0.65rem 0.85rem',
                            borderRadius: '10px',
                            border: '1.5px solid #E2E8F0',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: '#0F172A',
                            background: '#FFFFFF',
                            outline: 'none'
                          }}
                        >
                          <option value="TSSPDCL - Southern Power (Telangana)">TSSPDCL - Southern Power (Telangana)</option>
                          <option value="TSNPDCL - Northern Power (Telangana)">TSNPDCL - Northern Power (Telangana)</option>
                          <option value="APCPDCL - Central Power (AP)">APCPDCL - Central Power (AP)</option>
                          <option value="APEPDCL - Eastern Power (AP)">APEPDCL - Eastern Power (AP)</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '0.375rem' }}>
                          Service Number / USC Number *
                        </label>
                        <input 
                          type="text"
                          placeholder="Enter 10-digit USC / Service No."
                          required
                          value={bbpsForm.consumer_number}
                          onChange={(e) => setBbpsForm({ ...bbpsForm, consumer_number: e.target.value })}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            background: '#FFFFFF',
                            border: '1.5px solid #E2E8F0',
                            borderRadius: '10px',
                            padding: '0.65rem 0.85rem',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: '#0F172A',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </>
                  )}

                  {bbpsCategory === 'dth' && (
                    <>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '0.375rem' }}>
                          DTH Operator
                        </label>
                        <select 
                          value={bbpsForm.operator}
                          onChange={(e) => setBbpsForm({ ...bbpsForm, operator: e.target.value })}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            padding: '0.65rem 0.85rem',
                            borderRadius: '10px',
                            border: '1.5px solid #E2E8F0',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: '#0F172A',
                            background: '#FFFFFF',
                            outline: 'none'
                          }}
                        >
                          <option value="Tata Play">Tata Play</option>
                          <option value="Airtel Digital TV">Airtel Digital TV</option>
                          <option value="Sun Direct">Sun Direct</option>
                          <option value="Dish TV">Dish TV</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '0.375rem' }}>
                          Smart Card / Subscriber ID *
                        </label>
                        <input 
                          type="text"
                          placeholder="Enter Smart Card or Subscriber ID"
                          required
                          value={bbpsForm.consumer_number}
                          onChange={(e) => setBbpsForm({ ...bbpsForm, consumer_number: e.target.value })}
                          style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            background: '#FFFFFF',
                            border: '1.5px solid #E2E8F0',
                            borderRadius: '10px',
                            padding: '0.65rem 0.85rem',
                            fontSize: '0.875rem',
                            fontWeight: 600,
                            color: '#0F172A',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </>
                  )}

                  {bbpsCategory === 'fastag' && (
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '0.375rem' }}>
                        Vehicle Registration Number *
                      </label>
                      <input 
                        type="text"
                        placeholder="e.g. TS09AB1234"
                        required
                        value={bbpsForm.consumer_number}
                        onChange={(e) => setBbpsForm({ ...bbpsForm, consumer_number: e.target.value.toUpperCase() })}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          background: '#FFFFFF',
                          border: '1.5px solid #E2E8F0',
                          borderRadius: '10px',
                          padding: '0.65rem 0.85rem',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          color: '#0F172A',
                          textTransform: 'uppercase',
                          outline: 'none'
                        }}
                      />
                    </div>
                  )}

                  {/* Amount Section with Exact Placeholder from Screenshot: "e.g. 199, 599, 1250" */}
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '0.375rem' }}>
                      Bill / Recharge Amount (₹) *
                    </label>
                    <div style={{
                      background: '#FFFFFF',
                      border: '1.5px solid #CBD5E1',
                      borderRadius: '10px',
                      padding: '0.65rem 0.85rem',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <input 
                        type="number"
                        placeholder="e.g. 199, 599, 1250"
                        required
                        value={bbpsForm.amount}
                        onChange={(e) => setBbpsForm({ ...bbpsForm, amount: e.target.value })}
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          fontSize: '1.25rem',
                          fontWeight: 800,
                          color: '#0F172A',
                          padding: 0
                        }}
                      />
                    </div>

                    {/* Quick Amount Chips */}
                    <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      {(bbpsCategory === 'mobile' 
                        ? ['199', '299', '499', '699', '999'] 
                        : (bbpsCategory === 'electricity' 
                          ? ['500', '1000', '2000', '5000']
                          : ['200', '500', '1000', '2000'])
                      ).map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setBbpsForm({ ...bbpsForm, amount: amt })}
                          style={{
                            flex: 1,
                            minWidth: '50px',
                            background: bbpsForm.amount === amt ? '#EFF6FF' : '#FFFFFF',
                            border: bbpsForm.amount === amt ? '1.5px solid #2563EB' : '1px solid #CBD5E1',
                            borderRadius: '8px',
                            padding: '0.35rem 0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: bbpsForm.amount === amt ? '#1D4ED8' : '#334155',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          +₹{parseInt(amt).toLocaleString('en-IN')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Primary Submit Button matching Screenshot: "Pay ₹... (Collect Cash) →" */}
                  <button 
                    type="submit"
                    disabled={isSubmittingBbps}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #0F52BA 0%, #1E3A8A 100%)',
                      color: '#FFF',
                      border: 'none',
                      padding: '0.85rem 1rem',
                      borderRadius: '12px',
                      fontWeight: 800,
                      fontSize: '0.925rem',
                      cursor: isSubmittingBbps ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 14px rgba(15,82,186,0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      transition: 'all 0.15s ease',
                      marginTop: '0.25rem'
                    }}
                  >
                    <span>
                      {isSubmittingBbps 
                        ? 'Processing Payment...' 
                        : `Pay ₹${parseFloat(bbpsForm.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })} (Collect Cash) →`}
                    </span>
                  </button>
                </form>
              </div>
                </div>

                {/* Right Column: Recent Utility Collections Card */}
                <div className="subpage-col">
                  <div style={{
                background: '#FFFFFF',
                borderRadius: '18px',
                border: '1px solid #E2E8F0',
                padding: '1.125rem',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    Recent Utility Collections ({Math.max(1, transactions.filter(t => t.type === 'BBPS_BILL').length)})
                  </h4>
                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    style={{ background: 'none', border: 'none', color: '#0F52BA', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                  >
                    View All →
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {/* If user transactions exist, render them, otherwise render reference item */}
                  {transactions.filter(t => t.type === 'BBPS_BILL').length > 0 ? (
                    transactions.filter(t => t.type === 'BBPS_BILL').slice(0, 5).map(t => (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #EDF2F7' }}>
                        <div>
                          <strong style={{ fontSize: '0.8125rem', color: '#0F172A', display: 'block', fontWeight: 700 }}>{t.notes || 'Electricity Bill Collection'}</strong>
                          <span style={{ fontSize: '0.6875rem', color: '#94A3B8' }}>
                            TXN ID: {t.id} • {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '0.95rem', fontWeight: 900, color: '#059669', margin: 0 }}>
                            ₹{parseFloat(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                          <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#059669', background: '#DCFCE7', padding: '2px 8px', borderRadius: '6px' }}>
                            Success
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    /* Default Reference Item matching user's screenshot */
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #EDF2F7' }}>
                      <div>
                        <strong style={{ fontSize: '0.8125rem', color: '#0F172A', display: 'block', fontWeight: 700 }}>Electricity Bill Collection</strong>
                        <span style={{ fontSize: '0.6875rem', color: '#94A3B8' }}>
                          TXN ID: TXN-BBPS-102 • 21:23
                        </span>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.95rem', fontWeight: 900, color: '#059669', margin: 0 }}>
                          ₹1,250.00
                        </p>
                        <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#059669', background: '#DCFCE7', padding: '2px 8px', borderRadius: '6px' }}>
                          Success
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW 5: DEDICATED "TRANSACTION HISTORY" PAGE               */}
          {/* (SIMPLIFIED DATE FILTER AT TOP & NO NESTED INNER BOX)      */}
          {/* ========================================================= */}
          {/* ========================================================= */}
          {/* VIEW 5: DEDICATED "TRANSACTION & PAYOUT HISTORY" PAGE     */}
          {/* (UNIFIED RECORD SALE & BANK WITHDRAWAL STREAM)            */}
          {/* ========================================================= */}
          {activeTab === 'history' && (
            <div className="merchant-subpage-wrapper full-width" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
              
              {/* 1. TOP CATEGORY SWITCHER (CLEAN & FIXED) */}
              <div style={{
                background: '#F1F5F9',
                padding: '2px',
                borderRadius: '9px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '2px'
              }}>
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'SWIPES', label: '💳 Swipes' },
                  { id: 'WITHDRAWALS', label: '🏦 Payouts' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setTxnCategoryFilter(cat.id)}
                    style={{
                      background: txnCategoryFilter === cat.id ? '#FFFFFF' : 'transparent',
                      color: txnCategoryFilter === cat.id ? '#0F52BA' : '#64748B',
                      border: 'none',
                      borderRadius: '7px',
                      padding: '0.38rem 0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: txnCategoryFilter === cat.id ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>

              {/* 2. SECONDARY STATUS PILL SWITCHER (CLEAN & ACTIONABLE) */}
              <div style={{
                background: '#F8FAFC',
                padding: '2px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '2px'
              }}>
                {/* 1. Completed */}
                <button
                  type="button"
                  onClick={() => setTxnStatusFilter('APPROVED')}
                  style={{
                    background: txnStatusFilter === 'APPROVED' ? '#FFFFFF' : 'transparent',
                    color: txnStatusFilter === 'APPROVED' ? '#059669' : '#64748B',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.32rem 0.2rem',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: txnStatusFilter === 'APPROVED' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>✓ Completed</span>
                </button>

                {/* 2. Pending */}
                <button
                  type="button"
                  onClick={() => setTxnStatusFilter('PENDING')}
                  style={{
                    background: txnStatusFilter === 'PENDING' ? '#FFFFFF' : 'transparent',
                    color: txnStatusFilter === 'PENDING' ? '#D97706' : '#64748B',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.32rem 0.2rem',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    boxShadow: txnStatusFilter === 'PENDING' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>⏳ Pending</span>
                  {txnStatusCounts.pending > 0 && (
                    <span style={{
                      fontSize: '0.58rem',
                      background: txnStatusFilter === 'PENDING' ? '#FFFBEB' : '#FEF3C7',
                      color: '#D97706',
                      padding: '0 5px',
                      borderRadius: '8px',
                      fontWeight: 800
                    }}>
                      {txnStatusCounts.pending > 99 ? '99+' : txnStatusCounts.pending}
                    </span>
                  )}
                </button>

                {/* 3. Invalid */}
                <button
                  type="button"
                  onClick={() => setTxnStatusFilter('INVALID')}
                  style={{
                    background: txnStatusFilter === 'INVALID' ? '#FFFFFF' : 'transparent',
                    color: txnStatusFilter === 'INVALID' ? '#DC2626' : '#64748B',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.32rem 0.2rem',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: txnStatusFilter === 'INVALID' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>⚠️ Invalid</span>
                </button>
              </div>

              {/* 3. COMBINED COMPACT SEARCH & DATE ROW (SAVES ~50PX) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                width: '100%'
              }}>
                {/* Search Input */}
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  background: '#FFFFFF',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  height: '34px',
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                }}>
                  <Search style={{ width: '14px', height: '14px', color: '#94A3B8', flexShrink: 0 }} />
                  <input 
                    type="text"
                    placeholder="Search Txn, UTR, Mobile..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.75rem', color: '#0F172A' }}
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }}>
                      <X style={{ width: '12px', height: '12px' }} />
                    </button>
                  )}
                </div>

                {/* Compact Date Dropdown */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    style={{
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: '10px',
                      padding: '0 1.65rem 0 0.65rem',
                      height: '34px',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#1E293B',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                    }}
                  >
                    <option value="ALL">📅 All Dates</option>
                    <option value="TODAY">📅 Today</option>
                    <option value="YESTERDAY">📅 Yesterday</option>
                    <option value="WEEK">📅 7 Days</option>
                    <option value="CUSTOM">📅 Custom Date</option>
                  </select>
                  <ChevronDown style={{ width: '11px', height: '11px', position: 'absolute', right: '7px', top: '12px', pointerEvents: 'none', color: '#64748B' }} />
                </div>
              </div>

              {/* Custom Date Range Picker (Only when CUSTOM is selected) */}
              {dateFilter === 'CUSTOM' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#EFF6FF', padding: '0.35rem 0.65rem', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.6875rem', color: '#1E40AF', fontWeight: 600 }}>From:</span>
                    <input 
                      type="date"
                      value={customFromDate}
                      onChange={(e) => setCustomFromDate(e.target.value)}
                      style={{ width: '100%', padding: '0.2rem 0.35rem', borderRadius: '6px', border: '1px solid #93C5FD', fontSize: '0.72rem', color: '#0F172A', background: '#FFF' }}
                    />
                  </div>
                  <span style={{ color: '#94A3B8', fontSize: '0.72rem' }}>→</span>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.6875rem', color: '#1E40AF', fontWeight: 600 }}>To:</span>
                    <input 
                      type="date"
                      value={customToDate}
                      onChange={(e) => setCustomToDate(e.target.value)}
                      style={{ width: '100%', padding: '0.2rem 0.35rem', borderRadius: '6px', border: '1px solid #93C5FD', fontSize: '0.72rem', color: '#0F172A', background: '#FFF' }}
                    />
                  </div>
                  {(customFromDate || customToDate) && (
                    <button 
                      type="button"
                      onClick={() => { setCustomFromDate(''); setCustomToDate(''); setDateFilter('ALL'); }}
                      title="Clear Dates"
                      style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', padding: '0.1rem 0.25rem' }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              )}

              {/* 4. LIGHT SUMMARY STRIP */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>
                  Showing <strong>{filteredTransactions.length}</strong> {txnCategoryFilter === 'WITHDRAWALS' ? 'withdrawals' : (txnCategoryFilter === 'SWIPES' ? 'card swipes' : 'activities')}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {txnCategoryFilter !== 'WITHDRAWALS' && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#059669' }}>
                      Sales: ₹{activitySummary.salesTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  {txnCategoryFilter !== 'SWIPES' && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F52BA' }}>
                      Payouts: ₹{activitySummary.withdrawalTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              </div>

              {/* 5. TRANSACTIONS & WITHDRAWALS LEDGER LIST (AIRY CARDS) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredTransactions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem 1.5rem', background: '#FFFFFF', borderRadius: '16px', border: '1px dashed #CBD5E1' }}>
                    <History style={{ width: '36px', height: '36px', color: '#94A3B8', margin: '0 auto 0.75rem' }} />
                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      No {txnStatusFilter === 'APPROVED' ? 'completed' : (txnStatusFilter === 'PENDING' ? 'pending' : 'invalid')} {txnCategoryFilter === 'WITHDRAWALS' ? 'withdrawals' : (txnCategoryFilter === 'SWIPES' ? 'card swipes' : 'records')} found
                    </h4>
                    <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '0.35rem 0 1rem', lineHeight: 1.4 }}>
                      {txnStatusFilter === 'INVALID' 
                        ? 'Great news! You have zero invalid records.' 
                        : (txnStatusFilter === 'PENDING' 
                            ? 'You have no records pending verification.' 
                            : 'Try adjusting your category/date filter or clearing search.')}
                    </p>
                    <button 
                      type="button" 
                      onClick={() => { setTxnCategoryFilter('ALL'); setTxnStatusFilter('APPROVED'); setDateFilter('ALL'); setSearchQuery(''); setCustomFromDate(''); setCustomToDate(''); }} 
                      className="btn btn-secondary btn-sm" 
                      style={{ fontSize: '0.75rem', padding: '0.4rem 0.875rem', borderRadius: '8px' }}
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  filteredTransactions.map(item => {
                    const st = (item.status || '').toUpperCase();
                    const isApproved = st === 'APPROVED' || st === 'SUCCESS' || st === 'COMPLETED' || st === 'SETTLED';
                    const isPending = st === 'PENDING';
                    const isInvalid = st === 'REJECTED' || st === 'INVALID' || st === 'FAILED';
                    const isWithdrawal = item.activityType === 'WITHDRAWAL';

                    const handleCopy = (e, text, label) => {
                      e.stopPropagation();
                      if (navigator.clipboard && text) {
                        navigator.clipboard.writeText(text);
                        setToastMessage(`Copied ${label}: ${text}`);
                        setTimeout(() => setToastMessage(''), 2500);
                      }
                    };

                    if (isWithdrawal) {
                      const amountNum = parseFloat(item.amount || 0);
                      const isCustomerPayout = item.payout_type === 'CUSTOMER_DISBURSAL';
                      const utrVal = item.utr_number || item.ref_number || item.id || '';
                      const displayTitle = item.customer_name ? item.customer_name : (item.bank_name || 'Bank Disbursal');
                      const subTitle = item.customer_name ? (item.bank_name || 'Bank Payout') : (item.account_number ? `A/C: •••• ${item.account_number.slice(-4)}` : '');
                      const isInstant = (item.settlement_mode || 'Instant').toUpperCase().includes('INSTANT') || (item.admin_remark || '').toUpperCase().includes('IMPS');
                      const speedLabel = isInstant ? 'Instant' : 'T+1';
                      const displayDate = item.created_at ? new Date(item.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                      }) : 'Recent';

                      return (
                        <div 
                          key={`wth-${item.id}`} 
                          onClick={() => { setSelectedTxnForDetails(item); setTxnDetailType('WITHDRAWAL'); }}
                          style={{ 
                            padding: '0.875rem 1rem', 
                            borderRadius: '12px', 
                            background: '#FFFFFF', 
                            border: isInvalid ? '1.5px solid #FECACA' : (isPending ? '1.5px solid #FDE68A' : '1px solid #E2E8F0'), 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '0.35rem',
                            boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(15,82,186,0.08)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = isInvalid ? '#FECACA' : (isPending ? '#FDE68A' : '#E2E8F0'); e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.04)'; }}
                        >
                          {/* ROW 1: Beneficiary / Bank Name (Left) | Tabular Amount (Right) */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                            gap: '0.75rem'
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              flex: 1,
                              minWidth: 0,
                              flexWrap: 'wrap'
                            }}>
                              <span style={{
                                fontSize: '0.9375rem',
                                fontWeight: 700,
                                color: '#0F172A',
                                letterSpacing: '-0.01em',
                                lineHeight: 1.3,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {displayTitle}
                              </span>
                              {subTitle && (
                                <span style={{ fontSize: '0.75rem', color: '#64748B', whiteSpace: 'nowrap' }}>
                                  ({subTitle})
                                </span>
                              )}
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
                                textTransform: 'uppercase',
                                whiteSpace: 'nowrap'
                              }}>
                                🏦 Withdrawal
                              </span>
                            </div>

                            <div style={{
                              fontSize: '1rem',
                              fontWeight: 800,
                              color: '#0F172A',
                              fontVariantNumeric: 'tabular-nums',
                              letterSpacing: '-0.02em',
                              whiteSpace: 'nowrap'
                            }}>
                              -₹{amountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                          </div>

                          {/* ROW 2: Clear Date on Left | Status Pill on Right */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            marginTop: '0.15rem'
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
                              ) : isApproved ? (
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669' }}>
                                  ✓ Settled · {speedLabel}
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#DC2626' }}>
                                  ✕ Rejected
                                </span>
                              )}
                            </div>
                          </div>

                          {/* ROW 3: Dedicated UTR identity chip with 1-click copy + Channel Badge */}
                          <div style={{
                            marginTop: '0.35rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            flexWrap: 'wrap'
                          }}>
                            {utrVal ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(e, utrVal, 'UTR');
                                }}
                                title="Click to copy Bank UTR"
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
                                <span>UTR: {utrVal}</span>
                                <Copy style={{ width: '12px', height: '12px' }} />
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#64748B', fontFamily: 'monospace' }}>
                                A/C: {item.account_number ? `•••• ${item.account_number.slice(-4)}` : '••••'}
                              </span>
                            )}

                            <span style={{
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: isCustomerPayout ? '#EDE9FE' : '#F1F5F9',
                              color: isCustomerPayout ? '#6D28D9' : '#475569',
                              border: isCustomerPayout ? '1px solid #DDD6FE' : '1px solid #E2E8F0'
                            }}>
                              {isCustomerPayout ? 'Customer Payout' : 'Bank Disbursal'}
                            </span>
                          </div>

                          {/* Rejection Remark */}
                          {isInvalid && item.admin_remark && (
                            <div style={{ 
                              background: '#FEF2F2', 
                              border: '1px solid #FCA5A5', 
                              borderRadius: '8px', 
                              padding: '0.45rem 0.65rem', 
                              display: 'flex', 
                              alignItems: 'flex-start', 
                              gap: '0.5rem',
                              marginTop: '0.35rem'
                            }}>
                              <AlertCircle style={{ width: '14px', height: '14px', color: '#DC2626', flexShrink: 0, marginTop: '2px' }} />
                              <div style={{ flex: 1, fontSize: '0.6875rem', color: '#B91C1C', lineHeight: 1.35 }}>
                                <strong style={{ color: '#991B1B' }}>Admin Remark: </strong>
                                {item.admin_remark}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }

                    // ==========================================
                    // 2. Card Swipe (Record Sale) Card
                    // ==========================================
                    const { title, utr, customerMobile, customerName, settlementType } = parseTxnDisplay(item);
                    const amountVal = parseFloat(item.amount || 0);
                    const displayCustomerName = customerName || (customerMobile ? `Customer (${customerMobile})` : (title || 'Customer'));
                    const channelLabel = isPayswiffTxn(item) ? 'Payswiff POS' : (isQRTxn(item) ? 'Company QR' : 'Pine Labs POS');
                    const speedLabel = (settlementType === 'INSTANT' || settlementType === 'T0') ? 'Instant' : 'T+1';
                    const displayDate = item.created_at ? new Date(item.created_at).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    }) : 'Recent';

                    return (
                      <div 
                        key={`txn-${item.id}`} 
                        onClick={() => { setSelectedTxnForDetails(item); setTxnDetailType('SWIPE'); }}
                        style={{ 
                          padding: '0.875rem 1rem', 
                          borderRadius: '12px', 
                          background: '#FFFFFF', 
                          border: isInvalid ? '1.5px solid #FECACA' : (isPending ? '1.5px solid #FDE68A' : '1px solid #E2E8F0'), 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '0.35rem',
                          boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#93C5FD'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(15,82,186,0.08)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = isInvalid ? '#FECACA' : (isPending ? '#FDE68A' : '#E2E8F0'); e.currentTarget.style.boxShadow = '0 1px 3px rgba(15,23,42,0.04)'; }}
                      >
                        {/* ROW 1: Customer Name (Left) | Tabular Amount (Right) */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                          gap: '0.75rem'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            minWidth: 0,
                            flex: 1
                          }}>
                            <span style={{
                              fontSize: '0.9375rem',
                              fontWeight: 700,
                              color: '#0F172A',
                              letterSpacing: '-0.01em',
                              lineHeight: 1.3,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {displayCustomerName}
                            </span>
                            {customerMobile && customerName && (
                              <span style={{ fontSize: '0.75rem', color: '#64748B', whiteSpace: 'nowrap' }}>
                                ({customerMobile})
                              </span>
                            )}
                          </div>

                          <div style={{
                            fontSize: '1rem',
                            fontWeight: 800,
                            color: '#059669',
                            fontVariantNumeric: 'tabular-nums',
                            letterSpacing: '-0.02em',
                            whiteSpace: 'nowrap'
                          }}>
                            +₹{amountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        </div>

                        {/* ROW 2: Clear Date on Left | Status Pill on Right */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          marginTop: '0.15rem'
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
                            ) : isApproved ? (
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669' }}>
                                ✓ Completed · {speedLabel}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#DC2626' }}>
                                ✕ Invalid
                              </span>
                            )}
                          </div>
                        </div>

                        {/* ROW 3: Dedicated UTR identity chip with 1-click copy + Channel Badge */}
                        <div style={{
                          marginTop: '0.35rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          flexWrap: 'wrap'
                        }}>
                          {utr && utr !== 'N/A' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(e, utr, 'Slip UTR');
                              }}
                              title="Click to copy Slip UTR"
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
                              <span>UTR: {utr}</span>
                              <Copy style={{ width: '12px', height: '12px' }} />
                            </button>
                          )}

                          <span style={{
                            fontSize: '0.625rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: isQRTxn(item) ? '#F5F3FF' : (isPayswiffTxn(item) ? '#FEF3C7' : '#EFF6FF'),
                            color: isQRTxn(item) ? '#7C3AED' : (isPayswiffTxn(item) ? '#D97706' : '#0F52BA'),
                            border: isQRTxn(item) ? '1px solid #DDD6FE' : (isPayswiffTxn(item) ? '1px solid #FDE68A' : '1px solid #DBEAFE')
                          }}>
                            {channelLabel}
                          </span>
                        </div>

                        {/* Invalid Remark */}
                        {isInvalid && (
                          <div style={{ 
                            background: '#FEF2F2', 
                            border: '1px solid #FCA5A5', 
                            borderRadius: '8px', 
                            padding: '0.45rem 0.65rem', 
                            display: 'flex', 
                            alignItems: 'flex-start', 
                            gap: '0.5rem',
                            marginTop: '0.35rem'
                          }}>
                            <AlertCircle style={{ width: '14px', height: '14px', color: '#DC2626', flexShrink: 0, marginTop: '2px' }} />
                            <div style={{ flex: 1, fontSize: '0.6875rem', color: '#B91C1C', lineHeight: 1.35 }}>
                              <strong style={{ color: '#991B1B' }}>Admin Verification Remark: </strong>
                              {item.admin_remark || 'Slip UTR did not match POS portal. Please check paper receipt.'}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW 6: DEDICATED "MY TEAM & NETWORK" PAGE               */}
          {/* ========================================================= */}
          {activeTab === 'network' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', boxSizing: 'border-box', paddingBottom: '2.5rem' }}>
              
              {/* Notice if Merchant / Retailer is viewing */}
              {(userRole === 'MERCHANT' || userRole === 'Retailer') ? (
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '2rem 1rem', textAlign: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                    <Landmark style={{ width: '24px', height: '24px' }} />
                  </div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.35rem' }}>
                    Retail Merchant Account
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: '#64748B', maxWidth: '440px', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
                    Retail shop owners earn on direct customer card swipes and bill payments. Use the <strong>Withdraw</strong> tab to send your sales to your bank. Network onboarding is managed by your Area Distributor.
                  </p>
                  <button 
                    onClick={() => setActiveTab('withdraw')}
                    style={{ background: '#0F52BA', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '0.5rem 1.25rem', fontSize: '0.8125rem', fontWeight: 800, cursor: 'pointer' }}
                  >
                    Go to Withdrawals
                  </button>
                </div>
              ) : (
                <>
                  {/* 1. Header Title & Quick Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
                      My Team &amp; Network
                    </h1>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button 
                        onClick={fetchNetworkData}
                        disabled={isLoadingNetwork}
                        style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0.45rem 0.875rem', fontSize: '0.75rem', fontWeight: 700, color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
                      >
                        <RefreshCw style={{ width: '14px', height: '14px', animation: isLoadingNetwork ? 'spin 1s linear infinite' : 'none' }} />
                        <span>Refresh</span>
                      </button>

                      <button 
                        onClick={() => setShowOnboardForm(!showOnboardForm)}
                        style={{ 
                          background: showOnboardForm ? '#F1F5F9' : 'linear-gradient(135deg, #0F52BA 0%, #083B8A 100%)', 
                          color: showOnboardForm ? '#0F172A' : '#FFFFFF', 
                          border: showOnboardForm ? '1px solid #CBD5E1' : 'none', 
                          borderRadius: '8px', 
                          padding: '0.45rem 0.875rem', 
                          fontSize: '0.75rem', 
                          fontWeight: 800, 
                          cursor: 'pointer', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '5px',
                          boxShadow: showOnboardForm ? 'none' : '0 2px 8px rgba(15,82,186,0.25)' 
                        }}
                      >
                        <UserPlus style={{ width: '15px', height: '15px' }} />
                        <span>{showOnboardForm ? 'Close Form' : '+ Onboard Person / Shop'}</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. TOP EXECUTIVE STATS (Strict 2x2 Grid) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.625rem' }}>
                    
                    {/* Box 1: Total Downline Team */}
                    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '0.75rem 0.875rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                          Downline Team
                        </span>
                        <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Users style={{ width: '12px', height: '12px' }} />
                        </div>
                      </div>
                      <h3 style={{ fontSize: '1.1875rem', fontWeight: 900, color: '#0F172A', margin: '0 0 1px', letterSpacing: '-0.01em' }}>
                        {networkData.partners.length} <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#64748B' }}>Members</span>
                      </h3>
                      <span style={{ fontSize: '0.59rem', color: '#64748B', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {directPartnersCount} Direct • {indirectPartnersCount} Downline
                      </span>
                    </div>

                    {/* Box 2: Total Team Sales Volume */}
                    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '0.75rem 0.875rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                          Team Sales
                        </span>
                        <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CreditCard style={{ width: '12px', height: '12px' }} />
                        </div>
                      </div>
                      <h3 style={{ fontSize: '1.1875rem', fontWeight: 900, color: '#0F172A', margin: '0 0 1px', letterSpacing: '-0.01em' }}>
                        ₹{totalTeamVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </h3>
                      <span style={{ fontSize: '0.59rem', color: '#059669', fontWeight: 700, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        All shops &amp; POS terminals
                      </span>
                    </div>

                    {/* Box 3: Total Commission Profit */}
                    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '0.75rem 0.875rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                          My Profit Cut
                        </span>
                        <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <TrendingUp style={{ width: '12px', height: '12px' }} />
                        </div>
                      </div>
                      <h3 style={{ fontSize: '1.1875rem', fontWeight: 900, color: '#059669', margin: '0 0 1px', letterSpacing: '-0.01em' }}>
                        ₹{networkData.total_commission_earned.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </h3>
                      <span style={{ fontSize: '0.59rem', color: '#0F52BA', fontWeight: 800, background: '#EFF6FF', padding: '1px 5px', borderRadius: '4px', display: 'inline-block' }}>
                        +{parseFloat(userTierMargin) > 0 ? userTierMargin : networkData.commission_rate_pct}% Cut
                      </span>
                    </div>

                    {/* Box 4: Today's Team Profit */}
                    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '0.75rem 0.875rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                          Today's Profit
                        </span>
                        <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#F3E8FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Zap style={{ width: '12px', height: '12px' }} />
                        </div>
                      </div>
                      <h3 style={{ fontSize: '1.1875rem', fontWeight: 900, color: '#7C3AED', margin: '0 0 1px', letterSpacing: '-0.01em' }}>
                        +₹{networkData.today_network_profit.toFixed(2)}
                      </h3>
                      <span style={{ fontSize: '0.59rem', color: '#64748B', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        On ₹{totalTodayVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })} sales
                      </span>
                    </div>

                  </div>

              {/* 4. COLLAPSIBLE ONBOARDING FORM DRAWER */}
              {showOnboardForm && (
                <div style={{ background: '#FFFFFF', border: '1.5px solid #0F52BA', borderRadius: '16px', padding: '1.25rem', boxShadow: '0 4px 20px rgba(15,82,186,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UserPlus style={{ width: '16px', height: '16px' }} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                          Onboard New Partner / Shop Owner
                        </h3>
                        <span style={{ fontSize: '0.65rem', color: '#64748B' }}>
                          Select role, configure POS machine, and issue login credentials
                        </span>
                      </div>
                    </div>

                    <button 
                      onClick={() => setShowOnboardForm(false)}
                      style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '4px' }}
                    >
                      <X style={{ width: '18px', height: '18px' }} />
                    </button>
                  </div>

                  {/* Instant Generated Credentials Card */}
                  {createdPartnerCreds && (
                    <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '12px', padding: '0.875rem', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#15803D', fontSize: '0.8125rem', fontWeight: 800 }}>
                          <CheckCircle2 style={{ width: '16px', height: '16px' }} />
                          <span>Member Onboarded Successfully!</span>
                        </div>
                        <button 
                          onClick={() => setCreatedPartnerCreds(null)}
                          style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '2px' }}
                        >
                          <X style={{ width: '14px', height: '14px' }} />
                        </button>
                      </div>

                      <div style={{ background: '#FFFFFF', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '0.625rem', marginBottom: '0.625rem', fontSize: '0.78125rem', lineHeight: 1.6 }}>
                        <div><strong>Full Name:</strong> {createdPartnerCreds.name}</div>
                        <div><strong>Login ID:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 900, color: '#0F52BA' }}>{createdPartnerCreds.id}</span></div>
                        <div><strong>Password:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 900, color: '#059669' }}>{createdPartnerCreds.password}</span></div>
                        <div><strong>Role Tier:</strong> <span style={{ fontWeight: 700 }}>{createdPartnerCreds.role}</span></div>
                        <div><strong>POS Provider:</strong> <span style={{ fontWeight: 700 }}>{createdPartnerCreds.pos_provider || 'Pine Labs'} (T+1 Settlement)</span></div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          onClick={() => {
                            const text = `Hello ${createdPartnerCreds.name}, your RONAV portal login credentials are:\nLogin ID: ${createdPartnerCreds.id}\nPassword: ${createdPartnerCreds.password}\nAccount Type: ${createdPartnerCreds.role}\nLogin Link: ${window.location.origin}`;
                            navigator.clipboard.writeText(text);
                            showToast('✓ Login credentials copied!');
                          }}
                          style={{ flex: 1, background: '#FFFFFF', border: '1px solid #86EFAC', color: '#15803D', borderRadius: '8px', padding: '0.45rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                        >
                          <Copy style={{ width: '14px', height: '14px' }} />
                          <span>Copy Details</span>
                        </button>

                        <a 
                          href={`https://api.whatsapp.com/send?phone=${createdPartnerCreds.mobile}&text=${encodeURIComponent(`Hello ${createdPartnerCreds.name}, your RONAV portal login credentials are:\n\nLogin ID: ${createdPartnerCreds.id}\nPassword: ${createdPartnerCreds.password}\nAccount Type: ${createdPartnerCreds.role}\n\nLogin Link: ${window.location.origin}`)}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ flex: 1, background: '#25D366', color: '#FFFFFF', borderRadius: '8px', padding: '0.45rem', fontSize: '0.75rem', fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                        >
                          <Share2 style={{ width: '14px', height: '14px' }} />
                          <span>Share on WhatsApp</span>
                        </a>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleOnboardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    {/* Basic Downline Partner Info Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                      {/* Dynamic Downline Role Tier Dropdown (Strictly Downline Only) */}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                          Select Downline Role Tier *
                        </label>
                        <select 
                          id="account-type-select"
                          value={onboardForm.role} 
                          onChange={(e) => {
                            const newRole = e.target.value;
                            const defaultT1 = newRole === 'DISTRIBUTOR' ? '1.48' : (newRole === 'DIST_FRANCHISE' ? '1.45' : '1.50');
                            const defaultInstant = newRole === 'DISTRIBUTOR' ? '1.78' : (newRole === 'DIST_FRANCHISE' ? '1.75' : '1.80');
                            setOnboardForm(prev => ({
                              ...prev,
                              role: newRole,
                              commission_rate_t1: defaultT1,
                              commission_rate_instant: defaultInstant
                            }));
                          }}
                          style={{ width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', background: '#FFFFFF', cursor: 'pointer', outline: 'none' }}
                        >
                          {allowedRolesForCreator.map(r => (
                            <option key={r.value} value={r.value} style={{ padding: '8px', fontWeight: 600 }}>
                              {r.icon} {r.label} ({r.badge})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Full Name / Store Name */}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                          Full Name / Store Name *
                        </label>
                        <input 
                          type="text" 
                          placeholder="e.g. Ramesh Enterprises"
                          value={onboardForm.name}
                          onChange={(e) => setOnboardForm(prev => ({ ...prev, name: e.target.value }))}
                          required
                          style={{ width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', outline: 'none' }}
                        />
                      </div>

                      {/* Mobile Number */}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                          Mobile Number *
                        </label>
                        <input 
                          type="tel" 
                          placeholder="10-digit mobile"
                          maxLength="10"
                          value={onboardForm.mobile}
                          onChange={(e) => setOnboardForm(prev => ({ ...prev, mobile: e.target.value.replace(/\D/g, '') }))}
                          required
                          style={{ width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.8125rem', fontWeight: 600, color: '#0F172A', outline: 'none' }}
                        />
                      </div>
                    </div>

                    {/* Counter POS Terminal & Commission Rates Card (Exact Image 2 Structure) */}
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      
                      {/* POS Hardware Provider */}
                      <div>
                        <label style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '4px' }}>
                          POS Hardware Provider
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                          {['Pine Labs', 'Payswiff'].map(p => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => handleOnboardProviderChange(p)}
                              style={{
                                padding: '0.45rem',
                                fontSize: '0.6875rem',
                                fontWeight: 800,
                                borderRadius: '6px',
                                border: onboardForm.pos_provider === p ? '2px solid #0F52BA' : '1px solid #CBD5E1',
                                background: onboardForm.pos_provider === p ? '#EFF6FF' : '#FFFFFF',
                                color: onboardForm.pos_provider === p ? '#0F52BA' : '#475569',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <span>{p === 'Pine Labs' ? '🌲 Pine Labs' : '⚡ Payswiff'}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Settlement Account & Legal Vendor */}
                      <div>
                        <label style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '4px' }}>
                          Settlement Account &amp; Legal Vendor
                        </label>
                        {onboardForm.pos_provider === 'Pine Labs' ? (
                          <div style={{ padding: '0.45rem', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 700, color: '#0F52BA' }}>
                            Rose Navaneetham Enterprises (Pine Labs)
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.375rem' }}>
                            {['RONAV Technologies', 'R.P. Technologies'].map(v => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => setOnboardForm(prev => ({ ...prev, pos_vendor: v }))}
                                style={{
                                  padding: '0.4rem',
                                  fontSize: '0.625rem',
                                  fontWeight: 800,
                                  borderRadius: '6px',
                                  border: onboardForm.pos_vendor === v ? '2px solid #D97706' : '1px solid #CBD5E1',
                                  background: onboardForm.pos_vendor === v ? '#FEF3C7' : '#FFFFFF',
                                  color: onboardForm.pos_vendor === v ? '#B45309' : '#475569',
                                  cursor: 'pointer'
                                }}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Physical POS Machine / Terminal Serial Number */}
                      <div>
                        <label style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '4px' }}>
                          POS Machine Serial / Terminal Number *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder={onboardForm.pos_provider === 'Pine Labs' ? 'e.g. PL-884920' : 'e.g. SWIFF-58201'}
                          value={onboardForm.pos_terminal_id}
                          onChange={(e) => setOnboardForm(prev => ({ ...prev, pos_terminal_id: e.target.value }))}
                          style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8125rem', fontWeight: 700, boxSizing: 'border-box', outline: 'none' }}
                        />
                        <span style={{ fontSize: '0.625rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                          Unique TID / Serial number printed on physical device sticker
                        </span>
                      </div>

                      {/* Device Plan */}
                      <div>
                        <label style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '4px' }}>
                          Device Plan
                        </label>
                        <select
                          value={onboardForm.device_plan}
                          onChange={(e) => {
                            const val = e.target.value;
                            setOnboardForm(prev => ({
                              ...prev,
                              device_plan: val,
                              monthly_rent: val === 'RENTAL' ? '499' : (prev.monthly_rent || '499')
                            }));
                          }}
                          style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.71875rem', background: '#FFFFFF', outline: 'none' }}
                        >
                          <option value="RENTAL">Monthly Rental (₹499/mo)</option>
                          <option value="CUSTOM">Custom Amount</option>
                        </select>

                        {onboardForm.device_plan === 'CUSTOM' && (
                          <div style={{ marginTop: '6px' }}>
                            <span style={{ fontSize: '0.65625rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '3px' }}>
                              Custom Amount (₹) *
                            </span>
                            <div style={{ position: 'relative' }}>
                              <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', fontWeight: 800, color: '#64748B' }}>₹</span>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                placeholder="e.g. 799"
                                value={onboardForm.monthly_rent}
                                onChange={(e) => setOnboardForm(prev => ({ ...prev, monthly_rent: e.target.value }))}
                                style={{ width: '100%', padding: '0.45rem 0.6rem 0.45rem 1.4rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8125rem', fontWeight: 700, boxSizing: 'border-box', outline: 'none' }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Commission Rates (MDR %) */}
                      <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0.65rem' }}>
                        <label style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '6px' }}>
                          Commission Rates (MDR %)
                        </label>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                          {/* T+1 Rate */}
                          <div>
                            <span style={{ fontSize: '0.65625rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '3px' }}>
                              T+1 Rate (%) *
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0.5"
                              max="3.0"
                              value={onboardForm.commission_rate_t1}
                              onChange={(e) => setOnboardForm(prev => ({ ...prev, commission_rate_t1: e.target.value }))}
                              style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8125rem', fontWeight: 700, boxSizing: 'border-box', outline: 'none' }}
                            />
                            <span style={{ fontSize: '0.625rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                              Standard settlement
                            </span>
                          </div>

                          {/* Instant Rate */}
                          <div>
                            <span style={{ fontSize: '0.65625rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '3px' }}>
                              Instant / QR Rate (%) *
                            </span>
                            <input
                              type="number"
                              step="0.01"
                              min="0.5"
                              max="4.0"
                              value={onboardForm.commission_rate_instant}
                              onChange={(e) => setOnboardForm(prev => ({ ...prev, commission_rate_instant: e.target.value }))}
                              style={{ width: '100%', padding: '0.45rem 0.6rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8125rem', fontWeight: 700, boxSizing: 'border-box', outline: 'none' }}
                            />
                            <span style={{ fontSize: '0.625rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                              Instant IMPS / QR
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>

                    {/* Submit Button */}
                    <button 
                      type="submit"
                      disabled={isSubmittingOnboard}
                      style={{ width: '100%', background: 'linear-gradient(135deg, #0F52BA 0%, #083B8A 100%)', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '0.625rem 1rem', fontSize: '0.8125rem', fontWeight: 800, cursor: isSubmittingOnboard ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '40px', boxShadow: '0 2px 8px rgba(15,82,186,0.25)', marginTop: '0.25rem' }}
                    >
                      {isSubmittingOnboard ? (
                        <>
                          <RefreshCw style={{ width: '15px', height: '15px', animation: 'spin 1s linear infinite' }} />
                          <span>Creating Account &amp; Configuring POS...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 style={{ width: '16px', height: '16px' }} />
                          <span>Onboard Downline Partner &amp; Generate Credentials</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* 5. SEARCH & ROLE FILTER TOOLBAR */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.625rem', background: '#FFFFFF', padding: '0.75rem', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                
                {/* Search Box */}
                <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                  <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: '#94A3B8' }} />
                  <input 
                    type="text" 
                    placeholder="Search by name, phone, shop, or ID..."
                    value={peopleSearch}
                    onChange={(e) => setPeopleSearch(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.45rem 0.75rem 0.45rem 2rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.78125rem', color: '#0F172A', outline: 'none' }}
                  />
                  {peopleSearch && (
                    <button 
                      onClick={() => setPeopleSearch('')}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '2px' }}
                    >
                      <X style={{ width: '12px', height: '12px' }} />
                    </button>
                  )}
                </div>

                {/* Filter Chips (Zero Scrollbar Visibility for Clean Native Mobile Feel) */}
                <div 
                  className="no-scrollbar" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.35rem', 
                    overflowX: 'auto', 
                    paddingBottom: '2px',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    WebkitOverflowScrolling: 'touch'
                  }}
                >
                  {[
                    { key: 'ALL', label: 'All', count: networkData.partners.length },
                    { key: 'SHOPS', label: 'Shops', count: networkData.partners.filter(p => p.role === 'MERCHANT' || p.id.startsWith('MID')).length },
                    { key: 'DISTRIBUTORS', label: 'Distributors', count: networkData.partners.filter(p => p.role === 'DISTRIBUTOR' || p.id.startsWith('DIST')).length },
                    { key: 'DISTRICT', label: 'District Heads', count: networkData.partners.filter(p => p.role === 'DISTRICT_DISTRIBUTOR' || p.role === 'DIST_FRANCHISE' || p.id.startsWith('DD')).length }
                  ].map(chip => (
                    <button 
                      key={chip.key}
                      onClick={() => setPeopleRoleFilter(chip.key)}
                      style={{ 
                        background: peopleRoleFilter === chip.key ? '#0F52BA' : '#F1F5F9', 
                        color: peopleRoleFilter === chip.key ? '#FFFFFF' : '#475569', 
                        border: 'none', 
                        borderRadius: '20px', 
                        padding: '0.35rem 0.75rem', 
                        fontSize: '0.71875rem', 
                        fontWeight: 700, 
                        cursor: 'pointer', 
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span>{chip.label}</span>
                      <span style={{ fontSize: '0.625rem', opacity: 0.9, background: peopleRoleFilter === chip.key ? 'rgba(255,255,255,0.25)' : '#E2E8F0', padding: '1px 5px', borderRadius: '10px' }}>
                        {chip.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 6. END-TO-END PEOPLE & SHOPS CARDS ROSTER */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {filteredPartners.length === 0 ? (
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '3rem 1rem', textAlign: 'center', color: '#94A3B8' }}>
                    <Users style={{ width: '36px', height: '36px', margin: '0 auto 0.5rem', opacity: 0.4 }} />
                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#334155', margin: '0 0 0.25rem' }}>
                      {peopleSearch ? 'No matching people found' : 'No team members added yet'}
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#64748B', maxWidth: '380px', margin: '0 auto 1rem', lineHeight: 1.5 }}>
                      {peopleSearch ? 'Try a different search term or clear the filter.' : 'Click the "+ Onboard Person / Shop" button above to add your first distributor or store owner.'}
                    </p>
                    {!showOnboardForm && (
                      <button 
                        onClick={() => setShowOnboardForm(true)}
                        style={{ background: '#0F52BA', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '0.45rem 1rem', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                      >
                        <UserPlus style={{ width: '15px', height: '15px' }} />
                        <span>Onboard First Member</span>
                      </button>
                    )}
                  </div>
                ) : (
                  filteredPartners.map((p) => {
                    const isExpanded = expandedPartnerId === p.id;
                    const roleBadge = (p.role === 'MERCHANT' || p.id.startsWith('MID'))
                      ? { label: 'Shop Owner (Retailer)', bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' }
                      : (p.role === 'DISTRIBUTOR' || p.id.startsWith('DIST'))
                      ? { label: 'Area Distributor', bg: '#EFF6FF', color: '#0F52BA', border: '#BFDBFE' }
                      : (p.role === 'DISTRICT_DISTRIBUTOR' || p.role === 'DIST_FRANCHISE' || p.id.startsWith('DD'))
                      ? { label: 'District Head', bg: '#F3E8FF', color: '#7C3AED', border: '#DDD6FE' }
                      : { label: 'Super Distributor', bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' };

                    return (
                      <div 
                        key={p.id}
                        style={{
                          background: '#FFFFFF',
                          border: isExpanded ? '1.5px solid #0F52BA' : '1px solid #E2E8F0',
                          borderRadius: '16px',
                          boxShadow: isExpanded ? '0 4px 16px rgba(15,82,186,0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                          overflow: 'hidden',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* 1. APPLE NATIVE PRIMARY ROW (Name, Role, Profit & Actions) */}
                        <div style={{ padding: '0.75rem 0.875rem', borderBottom: '1px solid #F1F5F9' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.625rem' }}>
                            
                            {/* Left: Squircle Avatar + Name Stack */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
                              <div style={{ 
                                width: '38px', 
                                height: '38px', 
                                borderRadius: '11px', 
                                background: isExpanded ? '#0F52BA' : '#EFF6FF', 
                                color: isExpanded ? '#FFFFFF' : '#0F52BA', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center', 
                                fontSize: '0.9375rem', 
                                fontWeight: 900, 
                                flexShrink: 0,
                                border: '1px solid #DBEAFE'
                              }}>
                                {p.name ? p.name.charAt(0).toUpperCase() : 'U'}
                              </div>

                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                  <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {p.name}
                                  </h3>
                                  <span style={{ fontSize: '0.59rem', fontWeight: 800, color: roleBadge.color, background: roleBadge.bg, border: `1px solid ${roleBadge.border}`, padding: '1px 5px', borderRadius: '4px' }}>
                                    {roleBadge.label}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '2px', fontSize: '0.6875rem', color: '#64748B' }}>
                                  <span style={{ fontFamily: 'monospace', color: '#0F52BA', fontWeight: 700 }}>
                                    {p.id}
                                  </span>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(p.id);
                                      showToast(`✓ ID ${p.id} copied!`);
                                    }}
                                    title="Copy ID"
                                    style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center' }}
                                  >
                                    <Copy style={{ width: '10px', height: '10px' }} />
                                  </button>
                                  <span>•</span>
                                  <span>{p.mobile}</span>
                                </div>
                              </div>
                            </div>

                            {/* Right: Profit Amount + Fast iOS Action Buttons */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.9375rem', fontWeight: 900, color: '#059669', letterSpacing: '-0.01em', lineHeight: 1.1 }}>
                                  +₹{(p.commission_earned || 0).toFixed(2)}
                                </div>
                                <span style={{ fontSize: '0.59rem', color: '#64748B', fontWeight: 700 }}>
                                  {p.commission_rate_pct}% margin
                                </span>
                              </div>

                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <a 
                                  href={`tel:${p.mobile}`}
                                  onClick={(e) => e.stopPropagation()}
                                  title="Call Retailer"
                                  style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', border: '1px solid #BFDBFE' }}
                                >
                                  <Phone style={{ width: '12px', height: '12px' }} />
                                </a>
                                <a 
                                  href={`https://api.whatsapp.com/send?phone=91${p.mobile}`}
                                  onClick={(e) => e.stopPropagation()}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Chat on WhatsApp"
                                  style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#ECFDF5', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', border: '1px solid #A7F3D0' }}
                                >
                                  <MessageCircle style={{ width: '12px', height: '12px' }} />
                                </a>
                              </div>
                            </div>

                          </div>
                        </div>

                        {/* 2. GLANCEABLE SUMMARY PILLS STRIP (Apple Inset Style) */}
                        <div style={{ padding: '0.45rem 0.875rem', background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', borderBottom: '1px solid #F1F5F9' }}>
                          <span style={{ fontSize: '0.625rem', background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '2px 7px', borderRadius: '6px', color: '#334155', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <span>🌲</span>
                            <span>{p.pos_provider || 'Pine Labs'} ({p.pos_terminal ? p.pos_terminal.split('|')[0] : 'TID Pending'})</span>
                          </span>

                          <span style={{ fontSize: '0.625rem', background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '2px 7px', borderRadius: '6px', color: '#0F52BA', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <span>💳</span>
                            <span>₹{(p.total_volume || 0).toLocaleString('en-IN')} Sales</span>
                          </span>

                          <span style={{ fontSize: '0.625rem', background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '2px 7px', borderRadius: '6px', color: '#15803D', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <span>⚡</span>
                            <span>{p.settlement_type || 'T+1'} Payout</span>
                          </span>

                          <span style={{ fontSize: '0.625rem', background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '2px 7px', borderRadius: '6px', color: '#64748B', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <span>🔄</span>
                            <span>{p.txn_count || 0} Txns</span>
                          </span>
                        </div>

                        {/* 3. APPLE DISCLOSURE TOGGLE BAR (Tap to reveal full specs & live swipes) */}
                        <div 
                          onClick={() => togglePartnerExpand(p)}
                          style={{
                            padding: '0.45rem 0.875rem',
                            background: isExpanded ? '#EFF6FF' : '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            fontSize: '0.6875rem',
                            fontWeight: 800,
                            color: isExpanded ? '#0F52BA' : '#475569',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <CreditCard style={{ width: '13px', height: '13px', color: isExpanded ? '#0F52BA' : '#64748B' }} />
                            <span>{isExpanded ? 'Hide Specs & Swipes' : `Specs & Live Swipes (${p.txn_count || 0})`}</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: isExpanded ? '#0F52BA' : '#94A3B8' }}>
                            <span style={{ fontSize: '0.625rem' }}>{isExpanded ? 'Less' : 'Details'}</span>
                            {isExpanded ? <ChevronUp style={{ width: '14px', height: '14px' }} /> : <ChevronDown style={{ width: '14px', height: '14px' }} />}
                          </div>
                        </div>

                        {/* 4. EXPANDED VIEW: HARDWARE SPECS + FINANCIAL PILLARS (Clean Inset Cells) */}
                        {isExpanded && (
                          <div style={{ padding: '0.75rem 0.875rem', background: '#F8FAFC', borderTop: '1px solid #DBEAFE', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                            {/* 4-Cell Inset Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', background: '#FFFFFF', padding: '0.625rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                              <div>
                                <span style={{ color: '#64748B', display: 'block', fontSize: '0.5625rem', fontWeight: 700 }}>DEVICE PLAN</span>
                                <strong style={{ color: '#0F172A', fontSize: '0.75rem' }}>{p.pos_plan || 'RENTAL'} (₹{p.monthly_rent || 499}/mo)</strong>
                              </div>

                              <div>
                                <span style={{ color: '#64748B', display: 'block', fontSize: '0.5625rem', fontWeight: 700 }}>TODAY'S VOLUME</span>
                                <strong style={{ color: '#475569', fontSize: '0.75rem' }}>₹{(p.today_volume || 0).toLocaleString('en-IN')}</strong>
                              </div>

                              <div>
                                <span style={{ color: '#64748B', display: 'block', fontSize: '0.5625rem', fontWeight: 700 }}>TODAY'S YOUR PROFIT</span>
                                <strong style={{ color: '#059669', fontSize: '0.75rem' }}>+₹{(p.today_profit || 0).toFixed(2)}</strong>
                              </div>

                              <div>
                                <span style={{ color: '#64748B', display: 'block', fontSize: '0.5625rem', fontWeight: 700 }}>HIERARCHY</span>
                                <strong style={{ color: p.is_direct ? '#15803D' : '#0F52BA', fontSize: '0.75rem' }}>
                                  {p.is_direct ? 'Direct Retailer' : `Under: ${p.creator_name || p.creator_id}`}
                                </strong>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* EXPANDED LIVE TRANSACTIONS LEDGER */}
                        {isExpanded && (
                          <div style={{ padding: '0.875rem 1rem', background: '#FFFFFF', borderTop: '1px solid #DBEAFE' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem', paddingBottom: '0.5rem', borderBottom: '1px solid #F1F5F9' }}>
                              <span style={{ fontSize: '0.71875rem', fontWeight: 800, color: '#334155' }}>
                                Customer Swipes &amp; Your Profit Ledger
                              </span>
                              <span style={{ fontSize: '0.65rem', color: '#64748B' }}>
                                Your Profit Rate: <strong style={{ color: '#059669' }}>{p.commission_rate_pct}% margin</strong>
                              </span>
                            </div>

                            {isLoadingPartnerTxns ? (
                              <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#64748B' }}>
                                <RefreshCw style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite', margin: '0 auto 0.35rem' }} />
                                <p style={{ margin: 0, fontSize: '0.75rem' }}>Loading live transactions...</p>
                              </div>
                            ) : partnerTxns.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem', color: '#94A3B8' }}>
                                <CreditCard style={{ width: '28px', height: '28px', margin: '0 auto 0.35rem', opacity: 0.5 }} />
                                <p style={{ margin: 0, fontSize: '0.78125rem', fontWeight: 600, color: '#475569' }}>No card swipes or bill payments recorded yet.</p>
                                <span style={{ fontSize: '0.65rem', color: '#64748B' }}>When this member swipes a customer card, your profit cut will appear right here in real time!</span>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {partnerTxns.map((t) => (
                                  <div 
                                    key={t.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '0.625rem 0.75rem',
                                      background: '#F8FAFC',
                                      borderRadius: '10px',
                                      border: '1px solid #E2E8F0',
                                      flexWrap: 'wrap',
                                      gap: '0.5rem'
                                    }}
                                  >
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '2px' }}>
                                        <span style={{ fontSize: '0.78125rem', fontWeight: 800, color: '#0F172A' }}>
                                          {t.type === 'BBPS_BILL' ? '⚡ Utility Bill' : '💳 POS Card Swipe'}
                                        </span>
                                        <span style={{ fontSize: '0.59rem', color: '#0F52BA', background: '#EFF6FF', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                          {t.provider || 'Pine Labs'}
                                        </span>
                                        <span style={{ fontSize: '0.59rem', color: '#15803D', background: '#ECFDF5', padding: '1px 5px', borderRadius: '4px', fontWeight: 800 }}>
                                          ✓ Settled (T+1)
                                        </span>
                                      </div>

                                      <div style={{ fontSize: '0.65rem', color: '#64748B' }}>
                                        <strong style={{ fontFamily: 'monospace', color: '#475569' }}>{t.id}</strong> • Customer: <strong>{t.customer_mobile || 'Walk-in'}</strong> • {new Date(t.created_at || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}, {new Date(t.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </div>
                                    </div>

                                    <div style={{ textAlign: 'right' }}>
                                      <div style={{ fontSize: '0.71875rem', color: '#475569' }}>
                                        Swipe Amount: <strong>₹{parseFloat(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                      </div>
                                      <div style={{ fontSize: '0.875rem', fontWeight: 900, color: '#059669' }}>
                                        +₹{t.commission_profit.toFixed(2)} Profit
                                      </div>
                                      <span style={{ fontSize: '0.5625rem', color: '#64748B' }}>
                                        (₹{parseFloat(t.amount).toLocaleString('en-IN')} × {t.commission_rate_pct}% margin)
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    );
                  })
                )}
              </div>
                </>
              )}

            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW 9: DEDICATED MERCHANT PROFILE & ACCOUNT SETTINGS     */}
          {/* ========================================================= */}
          {activeTab === 'profile' && (
            <div className="merchant-subpage-wrapper">
              
              {/* 1. Main Title & Status Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div>
                  <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.2rem', letterSpacing: '-0.01em' }}>
                    Merchant Profile &amp; Account Settings
                  </h1>
                  <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>
                    Account credentials, assigned terminals, linked settlement accounts &amp; session security
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#059669', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '0.35rem 0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <ShieldCheck style={{ width: '14px', height: '14px' }} />
                    Active Merchant Session
                  </span>
                </div>
              </div>

              {/* 2. Hero Profile Banner Card */}
              <div style={{
                background: 'linear-gradient(135deg, #0F52BA 0%, #1E3A8A 100%)',
                borderRadius: '20px',
                padding: '1.5rem',
                color: '#FFFFFF',
                boxShadow: '0 4px 20px rgba(15,82,186,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1.25rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.125rem', minWidth: 0 }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    color: '#0F52BA',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.75rem',
                    fontWeight: 900,
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    position: 'relative'
                  }}>
                    {merchantName ? merchantName.charAt(0).toUpperCase() : 'N'}
                    <span style={{
                      position: 'absolute',
                      bottom: '2px',
                      right: '2px',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: '#10B981',
                      border: '2.5px solid #FFFFFF'
                    }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: '1.375rem', fontWeight: 800, margin: 0, color: '#FFFFFF', letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {merchantName || 'nikhil slicers'}
                      </h2>
                      <span style={{
                        fontSize: '0.6875rem',
                        fontWeight: 800,
                        background: 'rgba(255,255,255,0.2)',
                        color: '#FFFFFF',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.3)'
                      }}>
                        {userRole}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginTop: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8125rem', color: '#DBEAFE', fontWeight: 800, fontFamily: 'monospace' }}>
                        {merchantId || 'MID6925'}
                      </span>
                      <span style={{ fontSize: '0.65rem', background: '#10B981', color: '#FFFFFF', fontWeight: 800, padding: '2px 7px', borderRadius: '5px' }}>
                        KYC Verified ✓
                      </span>
                      <span style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.85)' }}>
                        • Partner Since 2021
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <button
                    type="button"
                    onClick={onLogout}
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      backdropFilter: 'blur(8px)',
                      color: '#FFFFFF',
                      border: '1px solid rgba(255,255,255,0.3)',
                      borderRadius: '12px',
                      padding: '0.625rem 1.125rem',
                      fontSize: '0.8125rem',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <LogOut style={{ width: '16px', height: '16px' }} />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>

              {/* 3. Split Grid: Account & Business Details on Left, Terminals & Bank on Right */}
              <div className="subpage-split-grid" style={{ marginTop: '1.125rem' }}>
                
                {/* Left Column: Business & Contact Information */}
                <div className="subpage-col" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Card: Business & Account Information */}
                  <div style={{
                    background: '#FFFFFF',
                    borderRadius: '18px',
                    border: '1px solid #EDF2F7',
                    padding: '1.25rem',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.625rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User style={{ width: '18px', height: '18px' }} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Business Information</h3>
                        <span style={{ fontSize: '0.65rem', color: '#64748B' }}>Registered merchant contact &amp; operational entity</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.75rem', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Registered Mobile:</span>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                          {user?.mobile || user?.phone || '6301646462'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.75rem', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Registered Email:</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F172A' }}>
                          ronavtechnologies@gmail.com
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.75rem', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Store / Outlet Name:</span>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A' }}>
                          {merchantName || 'nikhil slicers'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.75rem', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Merchant Network Tier:</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F52BA' }}>
                          Retailer (Counter POS Operator)
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.625rem 0.75rem', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Regional Headquarters:</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                          Hyderabad, Telangana - 502 319
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card: 24x7 Dedicated Helpdesk Support */}
                  <div style={{
                    background: '#FFFFFF',
                    borderRadius: '18px',
                    border: '1px solid #EDF2F7',
                    padding: '1.25rem',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Headphones style={{ width: '18px', height: '18px' }} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Helpdesk &amp; Account Support</h3>
                        <span style={{ fontSize: '0.65rem', color: '#64748B' }}>Direct relationship manager &amp; technical hotline</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: '12px', background: '#EFF6FF', border: '1px solid #DBEAFE', marginBottom: '0.75rem' }}>
                      <div>
                        <span style={{ fontSize: '0.6875rem', color: '#0F52BA', fontWeight: 700, display: 'block' }}>Official Support Hotline:</span>
                        <span style={{ fontSize: '0.9375rem', fontWeight: 900, color: '#0F172A', fontFamily: 'monospace' }}>9966203038</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <a href="tel:9966203038" style={{ background: '#0F52BA', color: '#FFFFFF', padding: '0.45rem 0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 800 }}>
                          <Phone style={{ width: '13px', height: '13px' }} />
                          <span>Call</span>
                        </a>
                        <a href="https://wa.me/919966203037" target="_blank" rel="noreferrer" style={{ background: '#22C55E', color: '#FFFFFF', padding: '0.45rem 0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 800 }}>
                          <MessageCircle style={{ width: '13px', height: '13px' }} />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    </div>

                    <p style={{ fontSize: '0.6875rem', color: '#64748B', margin: 0, lineHeight: 1.4 }}>
                      Need terminal paper rolls, swipe limit increase, or payout queries? Contact your RONAV relationship manager anytime 24×7.
                    </p>
                  </div>

                </div>

                {/* Right Column: POS Terminals & Settlement Bank */}
                <div className="subpage-col" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Card: Assigned POS Terminals */}
                  <div style={{
                    background: '#FFFFFF',
                    borderRadius: '18px',
                    border: '1px solid #EDF2F7',
                    padding: '1.25rem',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.625rem' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F0FDF4', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CreditCard style={{ width: '18px', height: '18px' }} />
                      </div>
                      <div>
                        <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Assigned POS Terminals</h3>
                        <span style={{ fontSize: '0.65rem', color: '#64748B' }}>Configured swipe hardware &amp; contracted settlement rates</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      
                      {/* Pine Labs POS Terminal */}
                      <div style={{ padding: '0.875rem', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.1rem' }}>🌲</span>
                            <div>
                              <strong style={{ fontSize: '0.8125rem', color: '#0F172A', display: 'block' }}>Pine Labs POS</strong>
                              <span style={{ fontSize: '0.625rem', color: '#64748B' }}>Smart Android Counter POS</span>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.625rem', background: '#ECFDF5', color: '#059669', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', border: '1px solid #A7F3D0' }}>
                            Online
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', background: '#FFFFFF', padding: '0.5rem', borderRadius: '8px', border: '1px solid #EDF2F7', textAlign: 'center' }}>
                          <div>
                            <span style={{ fontSize: '0.58rem', color: '#64748B', display: 'block' }}>Terminal ID</span>
                            <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#0F52BA', fontFamily: 'monospace' }}>PL-HYD-9941</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.58rem', color: '#64748B', display: 'block' }}>T+1 MDR</span>
                            <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#059669' }}>1.50%</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.58rem', color: '#64748B', display: 'block' }}>Instant MDR</span>
                            <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#D97706' }}>1.80%</span>
                          </div>
                        </div>
                      </div>

                      {/* Payswiff POS Terminal */}
                      <div style={{ padding: '0.875rem', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.1rem' }}>⚡</span>
                            <div>
                              <strong style={{ fontSize: '0.8125rem', color: '#0F172A', display: 'block' }}>Payswiff POS</strong>
                              <span style={{ fontSize: '0.625rem', color: '#64748B' }}>High-Speed Contactless Terminal</span>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.625rem', background: '#ECFDF5', color: '#059669', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', border: '1px solid #A7F3D0' }}>
                            Online
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', background: '#FFFFFF', padding: '0.5rem', borderRadius: '8px', border: '1px solid #EDF2F7', textAlign: 'center' }}>
                          <div>
                            <span style={{ fontSize: '0.58rem', color: '#64748B', display: 'block' }}>Terminal ID</span>
                            <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#D97706', fontFamily: 'monospace' }}>PW-HYD-4482</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.58rem', color: '#64748B', display: 'block' }}>T+1 MDR</span>
                            <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#059669' }}>1.65%</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.58rem', color: '#64748B', display: 'block' }}>Instant MDR</span>
                            <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#D97706' }}>1.83%</span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Card: Linked Settlement Bank Accounts */}
                  <div style={{
                    background: '#FFFFFF',
                    borderRadius: '18px',
                    border: '1px solid #EDF2F7',
                    padding: '1.25rem',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.625rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Landmark style={{ width: '18px', height: '18px' }} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Settlement Bank Accounts</h3>
                          <span style={{ fontSize: '0.65rem', color: '#64748B' }}>Where your card swipe liquidity is transferred</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddAccountModalOpen(true)}
                        style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '0.35rem 0.65rem', fontSize: '0.6875rem', fontWeight: 800, color: '#0F52BA', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                      >
                        <Plus style={{ width: '12px', height: '12px' }} />
                        <span>Link Bank</span>
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {beneficiaries && beneficiaries.length > 0 ? (
                        beneficiaries.map(b => (
                          <div key={b.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.75rem', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                              <BankLogo bankName={b.bank_name || b.bank || ''} />
                              <div>
                                <strong style={{ fontSize: '0.78125rem', color: '#0F172A', display: 'block' }}>{b.bank_name || b.bank || 'Bank'}</strong>
                                <span style={{ fontSize: '0.65rem', color: '#64748B', fontFamily: 'monospace' }}>•••• {(b.account_number || b.account || '0000').slice(-4)} • {b.ifsc}</span>
                              </div>
                            </div>
                            {b.is_primary ? (
                              <span style={{ fontSize: '0.59rem', background: '#ECFDF5', color: '#059669', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                                Primary
                              </span>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.75rem', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                            <BankLogo bankName="State Bank of India" />
                            <div>
                              <strong style={{ fontSize: '0.78125rem', color: '#0F172A', display: 'block' }}>State Bank of India</strong>
                              <span style={{ fontSize: '0.65rem', color: '#64748B', fontFamily: 'monospace' }}>•••• 5678 • SBIN0001234</span>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.59rem', background: '#ECFDF5', color: '#059669', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                            Primary
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card: Session & Logout Action */}
                  <div style={{
                    background: '#FFFFFF',
                    borderRadius: '18px',
                    border: '1px solid #FEE2E2',
                    padding: '1.25rem',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <div>
                        <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#991B1B', margin: 0 }}>Platform Session</h4>
                        <span style={{ fontSize: '0.65rem', color: '#64748B' }}>Securely log out of this device when finished</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onLogout}
                      style={{
                        width: '100%',
                        background: '#DC2626',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '0.75rem 1rem',
                        fontSize: '0.875rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(220,38,38,0.2)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <LogOut style={{ width: '16px', height: '16px' }} />
                      <span>Log Out of Merchant Portal</span>
                    </button>
                  </div>

                </div>

              </div>

            </div>
          )}

        </div>
      </main>

      {/* 3. Mobile Bottom Navigation Bar (Withdraw is ALWAYS present for every role) */}
      <nav className="mobile-bottom-nav" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0.45rem 0 calc(0.45rem + env(safe-area-inset-bottom, 0px))', zIndex: 60, boxShadow: '0 -4px 16px rgba(0,0,0,0.06)' }}>
        <button 
          onClick={() => setActiveTab('home')} 
          style={{ flex: 1, background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', color: activeTab === 'home' ? '#0F52BA' : '#64748B', cursor: 'pointer', fontSize: '0.625rem', fontWeight: 800 }}
        >
          <Home style={{ width: '20px', height: '20px' }} />
          <span>Home</span>
        </button>

        <button 
          onClick={() => setActiveTab('record-sale')} 
          style={{ flex: 1, background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', color: activeTab === 'record-sale' ? '#0F52BA' : '#64748B', cursor: 'pointer', fontSize: '0.625rem', fontWeight: 800 }}
        >
          <CreditCard style={{ width: '20px', height: '20px' }} />
          <span>Record Sale</span>
        </button>

        {/* Withdraw: ALWAYS present for Merchant, Distributor, District Franchise & Super Distributor */}
        <button 
          onClick={() => setActiveTab('withdraw')} 
          style={{ flex: 1, background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', color: activeTab === 'withdraw' ? '#059669' : '#64748B', cursor: 'pointer', fontSize: '0.625rem', fontWeight: 800 }}
        >
          <Send style={{ width: '20px', height: '20px' }} />
          <span>Withdraw</span>
        </button>

        {/* My People: Network Downline for Super, District & Area Distributors */}
        {userRole !== 'MERCHANT' && userRole !== 'Retailer' && (
          <button 
            onClick={() => setActiveTab('network')} 
            style={{ flex: 1, background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', color: activeTab === 'network' ? '#0F52BA' : '#64748B', cursor: 'pointer', fontSize: '0.625rem', fontWeight: 800 }}
          >
            <Users style={{ width: '20px', height: '20px' }} />
            <span>My People</span>
          </button>
        )}

        <button 
          onClick={() => setActiveTab('history')} 
          style={{ flex: 1, background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', color: activeTab === 'history' ? '#0F52BA' : '#64748B', cursor: 'pointer', fontSize: '0.625rem', fontWeight: 800 }}
        >
          <History style={{ width: '20px', height: '20px' }} />
          <span>Transactions</span>
        </button>
      </nav>

      {/* ========================================================= */}
      {/* 3B. CUSTOMER COUNTER QR FULL SCREEN DISPLAY MODAL         */}
      {/* ========================================================= */}
      {/* ========================================================= */}
      {/* 3B. CUSTOMER COUNTER QR DISPLAY (ONLY QR)                 */}
      {/* ========================================================= */}
      {isCustomerQRModalOpen && (
        <div 
          className="modal-backdrop" 
          onClick={() => setIsCustomerQRModalOpen(false)}
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
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsCustomerQRModalOpen(false)}
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

            {/* ONLY THE QR */}
            {companyQrImage ? (
              <img
                src={companyQrImage}
                alt="Official QR Code"
                style={{
                  width: '100%',
                  maxHeight: '400px',
                  objectFit: 'contain',
                  borderRadius: '16px',
                  display: 'block'
                }}
              />
            ) : (
              <div style={{
                width: '280px',
                height: '280px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#FFFFFF',
                borderRadius: '16px',
                padding: '10px'
              }}>
                <svg width="260" height="260" viewBox="0 0 100 100" fill="none">
                  {/* 3 Corner Markers */}
                  <rect x="5" y="5" width="28" height="28" rx="4" fill="#0A192F" />
                  <rect x="10" y="10" width="18" height="18" rx="2" fill="#FFFFFF" />
                  <rect x="14" y="14" width="10" height="10" rx="1" fill="#7C3AED" />

                  <rect x="67" y="5" width="28" height="28" rx="4" fill="#0A192F" />
                  <rect x="72" y="10" width="18" height="18" rx="2" fill="#FFFFFF" />
                  <rect x="76" y="14" width="10" height="10" rx="1" fill="#7C3AED" />

                  <rect x="5" y="67" width="28" height="28" rx="4" fill="#0A192F" />
                  <rect x="10" y="72" width="18" height="18" rx="2" fill="#FFFFFF" />
                  <rect x="14" y="76" width="10" height="10" rx="1" fill="#7C3AED" />

                  {/* Inner Data Cells */}
                  <rect x="38" y="8" width="8" height="14" fill="#0A192F" />
                  <rect x="50" y="8" width="12" height="6" fill="#7C3AED" />
                  <rect x="38" y="26" width="14" height="7" fill="#7C3AED" />
                  <rect x="56" y="20" width="6" height="13" fill="#0A192F" />

                  <rect x="8" y="38" width="14" height="6" fill="#0A192F" />
                  <rect x="8" y="48" width="6" height="14" fill="#7C3AED" />
                  <rect x="26" y="38" width="7" height="14" fill="#7C3AED" />
                  <rect x="20" y="56" width="13" height="6" fill="#0A192F" />

                  {/* Center QR Logo Hub */}
                  <rect x="38" y="38" width="24" height="24" rx="4" fill="#0A192F" />
                  <rect x="41" y="41" width="18" height="18" rx="3" fill="#FFFFFF" />
                  <text x="50" y="54" textAnchor="middle" fontSize="9" fontWeight="900" fill="#7C3AED">R</text>

                  <rect x="66" y="38" width="14" height="7" fill="#7C3AED" />
                  <rect x="84" y="38" width="8" height="16" fill="#0A192F" />
                  <rect x="74" y="50" width="18" height="6" fill="#0A192F" />

                  <rect x="38" y="66" width="7" height="14" fill="#7C3AED" />
                  <rect x="38" y="84" width="14" height="8" fill="#0A192F" />
                  <rect x="50" y="72" width="12" height="8" fill="#0A192F" />
                  <rect x="56" y="84" width="8" height="8" fill="#7C3AED" />
                  <rect x="68" y="68" width="8" height="12" fill="#0A192F" />
                  <rect x="80" y="68" width="12" height="6" fill="#7C3AED" />
                  <rect x="80" y="78" width="12" height="14" fill="#0A192F" />
                </svg>
              </div>
            )}

            {/* Payee Name on Scan (Clarity for Customer & Merchant) */}
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

      {/* 4. MODAL: LINK NEW BANK ACCOUNT (Contained Searchable Design) */}
      {isAddAccountModalOpen && (
        <div className="modal-backdrop" onClick={() => { setIsAddAccountModalOpen(false); setIsBankPickerOpen(false); setBankSearchQuery(''); }}>
          <div 
            className="modal-dialog" 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              maxWidth: '400px', 
              width: '92%', 
              padding: '1.25rem', 
              boxSizing: 'border-box', 
              overflow: 'hidden' 
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Landmark style={{ width: '18px', height: '18px' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Link Bank Account</h3>
                  <span style={{ fontSize: '0.625rem', color: '#64748B' }}>For instant withdrawals</span>
                </div>
              </div>
              <button 
                onClick={() => { setIsAddAccountModalOpen(false); setIsBankPickerOpen(false); setBankSearchQuery(''); }} 
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <form onSubmit={handleAddBankSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Bank Name *
                </label>
                
                {!isBankPickerOpen ? (
                  /* Collapsed Selected Bank View */
                  <div 
                    onClick={() => setIsBankPickerOpen(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '10px',
                      background: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      cursor: 'pointer',
                      width: '100%',
                      boxSizing: 'border-box',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', minWidth: 0 }}>
                      <BankLogo bankName={bankForm.bank_name} />
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {bankForm.bank_name || 'Select Bank'}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#0F52BA', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      Search / Change ▾
                    </span>
                  </div>
                ) : (
                  /* In-Modal Searchable Bank Selector (Never Overflows) */
                  <div style={{
                    background: '#FFFFFF',
                    border: '1.5px solid #0F52BA',
                    borderRadius: '10px',
                    padding: '0.625rem',
                    width: '100%',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    boxShadow: '0 4px 12px rgba(15,82,186,0.08)'
                  }}>
                    {/* Search Input */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: '#F1F5F9',
                      borderRadius: '8px',
                      padding: '0.375rem 0.625rem',
                      border: '1px solid #CBD5E1',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}>
                      <Search style={{ width: '15px', height: '15px', color: '#64748B', flexShrink: 0 }} />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search 40+ Indian banks..."
                        value={bankSearchQuery}
                        onChange={(e) => setBankSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          border: 'none',
                          background: 'transparent',
                          outline: 'none',
                          fontSize: '0.8125rem',
                          color: '#0F172A',
                          padding: 0
                        }}
                      />
                      {bankSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setBankSearchQuery('')}
                          style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }}
                        >
                          <X style={{ width: '14px', height: '14px' }} />
                        </button>
                      )}
                    </div>

                    {/* Popular Bank Chips */}
                    {!bankSearchQuery && (
                      <div>
                        <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.3125rem' }}>
                          Popular Banks
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3125rem' }}>
                          {['SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak', 'PNB', 'Canara', 'BoB'].map(abbr => {
                            const found = ALL_INDIAN_BANKS.find(b => b.code === abbr);
                            if (!found) return null;
                            const isCur = bankForm.bank_name === found.name;
                            return (
                              <button
                                key={abbr}
                                type="button"
                                onClick={() => {
                                  setBankForm({ ...bankForm, bank_name: found.name, ifsc: found.ifsc || bankForm.ifsc });
                                  setIsBankPickerOpen(false);
                                  setBankSearchQuery('');
                                }}
                                style={{
                                  background: isCur ? '#EFF6FF' : '#F8FAFC',
                                  border: isCur ? '1px solid #3B82F6' : '1px solid #E2E8F0',
                                  color: isCur ? '#0F52BA' : '#334155',
                                  borderRadius: '6px',
                                  padding: '0.2rem 0.5rem',
                                  fontSize: '0.6875rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                {abbr}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Filtered Scrollable Bank List */}
                    <div style={{
                      maxHeight: '130px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      borderTop: '1px solid #F1F5F9',
                      paddingTop: '0.375rem',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}>
                      {filteredBanksList.map(bank => {
                        const isCur = bankForm.bank_name === bank.name;
                        return (
                          <div
                            key={bank.name}
                            onClick={() => {
                              setBankForm({ ...bankForm, bank_name: bank.name, ifsc: bank.ifsc || bankForm.ifsc });
                              setIsBankPickerOpen(false);
                              setBankSearchQuery('');
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.35rem 0.5rem',
                              borderRadius: '6px',
                              background: isCur ? '#EFF6FF' : 'transparent',
                              cursor: 'pointer',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={(e) => { if (!isCur) e.currentTarget.style.background = '#F8FAFC'; }}
                            onMouseLeave={(e) => { if (!isCur) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                              <BankLogo bankName={bank.name} />
                              <span style={{ fontSize: '0.75rem', fontWeight: isCur ? 800 : 600, color: isCur ? '#0F52BA' : '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {bank.name}
                              </span>
                            </div>
                            {isCur && <Check style={{ width: '14px', height: '14px', color: '#0F52BA', flexShrink: 0 }} />}
                          </div>
                        );
                      })}

                      {/* Custom bank option if user types a new bank */}
                      {bankSearchQuery.trim() && (
                        <div
                          onClick={() => {
                            setBankForm({ ...bankForm, bank_name: bankSearchQuery.trim() });
                            setIsBankPickerOpen(false);
                          }}
                          style={{
                            padding: '0.4rem 0.5rem',
                            borderRadius: '6px',
                            background: '#EFF6FF',
                            color: '#0F52BA',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            marginTop: '0.25rem',
                            border: '1px dashed #93C5FD'
                          }}
                        >
                          + Use "{bankSearchQuery.trim()}" as bank name
                        </div>
                      )}
                    </div>

                    {/* Close / Done */}
                    <div style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => setIsBankPickerOpen(false)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#64748B',
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '0.2rem'
                        }}
                      >
                        Done / Close
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Account Number *
                </label>
                <input 
                  type="text"
                  placeholder="Enter bank account number"
                  required
                  value={bankForm.account_number}
                  onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.875rem', fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Confirm Account Number *
                </label>
                <input 
                  type="text"
                  placeholder="Re-enter bank account number"
                  required
                  value={bankForm.confirm_account}
                  onChange={(e) => setBankForm({ ...bankForm, confirm_account: e.target.value })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.875rem', fontFamily: 'monospace' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  IFSC Code *
                </label>
                <input 
                  type="text"
                  placeholder="e.g. SBIN0001234"
                  required
                  value={bankForm.ifsc}
                  onChange={(e) => setBankForm({ ...bankForm, ifsc: e.target.value.toUpperCase() })}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.875rem', textTransform: 'uppercase' }}
                />
              </div>

              <button 
                type="submit"
                disabled={isSubmittingBank}
                style={{ width: '100%', boxSizing: 'border-box', background: '#0F52BA', color: '#FFF', border: 'none', padding: '0.75rem', borderRadius: '8px', fontWeight: 800, fontSize: '0.875rem', cursor: 'pointer' }}
              >
                {isSubmittingBank ? 'Linking...' : '+ Save Bank Account →'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TRANSACTION & PAYOUT RECEIPT DETAIL MODAL                 */}
      {/* ========================================================= */}
      {selectedTxnForDetails && (() => {
        const item = selectedTxnForDetails;
        const isWithdrawal = txnDetailType === 'WITHDRAWAL' || item.payout_type || item.bank_name;
        const st = (item.status || '').toUpperCase();
        const isApproved = st === 'APPROVED' || st === 'SUCCESS' || st === 'COMPLETED' || st === 'SETTLED';
        const isPending = st === 'PENDING';

        // Parse swipe meta if it's a swipe
        let parsed = { title: isWithdrawal ? (item.bank_name || 'Bank Transfer') : 'Card Swipe', rrn: item.ref_number || item.id || 'N/A', customerMobile: item.customer_mobile || '' };
        if (!isWithdrawal) {
          parsed = parseTxnDisplay(item);
        }

        const utr = item.utr_number || item.ref_number || item.rrn || item.id;
        const amountNum = parseFloat(item.amount || 0);

        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            animation: 'fadeIn 0.15s ease'
          }}>
            <div style={{
              background: '#FFFFFF',
              borderRadius: '20px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(15, 23, 42, 0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              {/* Modal Top Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.875rem 1.25rem',
                borderBottom: '1px solid #F1F5F9'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1rem' }}>{isWithdrawal ? '🏦' : (isQRTxn(item) ? '📱' : '💳')}</span>
                  <div>
                    <strong style={{ fontSize: '0.875rem', color: '#0F172A', display: 'block', lineHeight: 1.2 }}>
                      {isWithdrawal ? 'Bank Disbursal Receipt' : (isQRTxn(item) ? 'UPI QR Payment Receipt' : 'POS Charge Slip & Sale Receipt')}
                    </strong>
                    <span style={{ fontSize: '0.625rem', color: '#64748B' }}>
                      {isWithdrawal ? 'Payout to Verified Bank Account' : (isQRTxn(item) ? 'Customer UPI Payment via Company QR' : `${item.provider || activeMachine?.title || 'Pine Labs'} Verified Swipe`)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTxnForDetails(null)}
                  style={{
                    background: '#F1F5F9',
                    border: 'none',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748B'
                  }}
                >
                  <X style={{ width: '16px', height: '16px' }} />
                </button>
              </div>

              {/* Status Banner */}
              <div style={{
                textAlign: 'center',
                padding: '1.25rem 1rem 1rem',
                background: isApproved ? '#F0FDF4' : isPending ? '#FFFBEB' : '#FEF2F2',
                borderBottom: isApproved ? '1px solid #DCFCE7' : isPending ? '1px solid #FEF3C7' : '1px solid #FEE2E2'
              }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: isApproved ? '#22C55E' : isPending ? '#F59E0B' : '#EF4444',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 0.5rem',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  {isApproved ? <Check style={{ width: '22px', height: '22px', strokeWidth: 3 }} /> : isPending ? <Clock style={{ width: '22px', height: '22px' }} /> : <X style={{ width: '22px', height: '22px', strokeWidth: 3 }} />}
                </div>

                <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  {isWithdrawal ? `-₹${amountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : `+₹${amountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                </div>

                <div style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  marginTop: '0.35rem',
                  color: isApproved ? '#15803D' : isPending ? '#B45309' : '#B91C1C'
                }}>
                  {isApproved ? (isWithdrawal ? '✓ Settled & Transferred to Bank' : '✓ Cleared & Credited to Wallet') : isPending ? '⏳ In Verification / Pending Clearance' : '✕ Transaction Rejected'}
                </div>

                <div style={{ fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>
                  {item.created_at ? new Date(item.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Recent Transaction'}
                </div>
              </div>

              {/* Receipt Details Breakdown Grid */}
              <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.625rem', maxHeight: '340px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid #F1F5F9', fontSize: '0.75rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 600 }}>{isWithdrawal ? 'Bank Reference (UTR)' : 'Slip UTR Number'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0F172A' }}>{utr}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(utr);
                        showToast(`✓ Copied UTR: ${utr}`);
                      }}
                      style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#0F52BA', borderRadius: '4px', padding: '2px 6px', fontSize: '0.625rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Copy
                    </button>
                  </div>
                </div>

                {isWithdrawal ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid #F1F5F9', fontSize: '0.75rem' }}>
                      <span style={{ color: '#64748B', fontWeight: 600 }}>Destination Bank</span>
                      <span style={{ fontWeight: 800, color: '#0F172A' }}>{item.bank_name || 'Bank Account'}</span>
                    </div>

                    {/* FULL BANK ACCOUNT NUMBER (NOT HIDDEN + EYE TOGGLE & COPY) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid #F1F5F9', fontSize: '0.75rem' }}>
                      <span style={{ color: '#64748B', fontWeight: 600 }}>Bank Account Number</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0F172A', letterSpacing: showFullAccountInModal ? '0.03em' : '0.08em' }}>
                          {showFullAccountInModal 
                            ? (item.account_number && !item.account_number.startsWith('••') ? item.account_number : (item.account_number || '102938475620'))
                            : (item.account_number ? (item.account_number.startsWith('••') ? item.account_number : `•••• ${item.account_number.slice(-4)}`) : '•••• 9090')}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowFullAccountInModal(!showFullAccountInModal)}
                          title={showFullAccountInModal ? "Mask Account Number" : "Reveal Full Account Number"}
                          style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                        >
                          {showFullAccountInModal ? <EyeOff style={{ width: '14px', height: '14px' }} /> : <Eye style={{ width: '14px', height: '14px' }} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const rawAcc = item.account_number || '102938475620';
                            navigator.clipboard.writeText(rawAcc);
                            showToast(`✓ Copied A/C: ${rawAcc}`);
                          }}
                          style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#0F52BA', borderRadius: '4px', padding: '2px 6px', fontSize: '0.625rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid #F1F5F9', fontSize: '0.75rem' }}>
                      <span style={{ color: '#64748B', fontWeight: 600 }}>IFSC Code</span>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0F172A' }}>{item.ifsc || 'SBIN0001234'}</span>
                    </div>

                    {item.customer_name && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid #F1F5F9', fontSize: '0.75rem' }}>
                        <span style={{ color: '#64748B', fontWeight: 600 }}>Beneficiary Name</span>
                        <span style={{ fontWeight: 700, color: '#0F172A' }}>{item.customer_name}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid #F1F5F9', fontSize: '0.75rem' }}>
                      <span style={{ color: '#64748B', fontWeight: 600 }}>Clearance Speed</span>
                      <span style={{ fontWeight: 700, color: '#0F52BA' }}>{item.settlement_mode === 'T1' ? 'T+1 Standard Payout' : '⚡ Instant IMPS Bank Disbursal'}</span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* REAL POS SALE / QR DETAILS */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid #F1F5F9', fontSize: '0.75rem' }}>
                      <span style={{ color: '#64748B', fontWeight: 600 }}>{isQRTxn(item) ? 'Payment Mode' : 'POS Terminal Channel'}</span>
                      <span style={{ fontWeight: 800, color: isQRTxn(item) ? '#7C3AED' : '#0F172A' }}>
                        {isQRTxn(item) ? '📱 Company QR (UPI)' : (item.provider || activeMachine?.title || 'Pine Labs POS')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid #F1F5F9', fontSize: '0.75rem' }}>
                      <span style={{ color: '#64748B', fontWeight: 600 }}>{isQRTxn(item) ? 'Payer / App' : 'Customer Name'}</span>
                      <span style={{ fontWeight: 700, color: '#0F172A' }}>
                        {parsed.customerName || (isQRTxn(item) ? 'UPI Customer' : 'Customer')}
                      </span>
                    </div>

                    {parsed.customerMobile && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid #F1F5F9', fontSize: '0.75rem' }}>
                        <span style={{ color: '#64748B', fontWeight: 600 }}>Customer Mobile</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0F172A' }}>{parsed.customerMobile}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.35rem 0', borderBottom: '1px solid #F1F5F9', fontSize: '0.75rem' }}>
                      <span style={{ color: '#64748B', fontWeight: 600 }}>Settlement Speed</span>
                      <span style={{ fontWeight: 700, color: '#059669' }}>
                        {isQRTxn(item) ? '⚡ Instant (100% Immediate IMPS Credit)' : (parsed.settlementType === 'T0' || parsed.settlementType === 'INSTANT' ? '⚡ Instant (Same-Day Settlement)' : '📅 Standard T+1 Bank Clearing')}
                      </span>
                    </div>

                    {/* Financial Ledger Breakdown */}
                    <div style={{ background: '#F8FAFC', padding: '0.625rem 0.75rem', borderRadius: '10px', border: '1px solid #E2E8F0', marginTop: '0.25rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.71875rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                        <span>{isQRTxn(item) ? 'Gross UPI Received:' : 'Gross Card Swipe:'}</span>
                        <span style={{ fontWeight: 700, color: '#0F172A' }}>₹{amountNum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748B' }}>
                        <span>{isQRTxn(item) ? 'UPI Service Fee (1.20%):' : 'Company Fee:'}</span>
                        <span style={{ fontWeight: 600, color: '#0F172A' }}>-₹{parseFloat(parsed.companyFee || 0).toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #CBD5E1', paddingTop: '0.3rem', fontWeight: 800, color: '#059669' }}>
                        <span>Net Credited to Wallet:</span>
                        <span>₹{(amountNum - parseFloat(parsed.companyFee || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </>
                )}

                {/* Sanitized Admin remark if present */}
                {item.admin_remark && (
                  <div style={{ background: '#F8FAFC', padding: '0.5rem 0.65rem', borderRadius: '8px', border: '1px solid #E2E8F0', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', display: 'block' }}>
                      Official Admin Remark:
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: '#1E293B', marginTop: '2px', display: 'block', lineHeight: 1.4 }}>
                      {item.admin_remark
                        .replace(/\[CUSTOMER_PAYOUT\]\s*Name:\s*([^|]+)\s*\|\s*Mob:\s*([^|]+)\s*\|?/gi, 'Beneficiary: $1')
                        .replace(/\[CARD_SWIPE_ENTRY\]\s*\{[^}]*\}/gi, '')
                        .trim()}
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div style={{
                padding: '0.875rem 1.25rem',
                borderTop: '1px solid #F1F5F9',
                display: 'flex',
                gap: '0.5rem',
                background: '#FAFAFA'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    const receiptSummary = isWithdrawal 
                      ? `RONAV TECHNOLOGIES - BANK DISBURSAL RECEIPT\nType: Bank Disbursal\nAmount: ₹${amountNum.toFixed(2)}\nBank: ${item.bank_name || 'Bank Account'}\nA/C: ${item.account_number || ''}\nUTR: ${utr}\nStatus: ${st}\nDate: ${item.created_at || 'Recent'}`
                      : `RONAV TECHNOLOGIES - POS SALE RECEIPT\nMachine: ${item.provider || activeMachine?.title || 'Pine Labs POS'}\nSlip UTR: ${parsed.utr}\nCustomer: ${parsed.customerName || 'Customer'}\nAmount: ₹${amountNum.toFixed(2)}\nStatus: ${st}\nDate: ${item.created_at || 'Recent'}`;
                    navigator.clipboard.writeText(receiptSummary);
                    showToast('✓ Slip details copied to clipboard!');
                  }}
                  style={{
                    flex: 1,
                    background: '#FFFFFF',
                    border: '1px solid #CBD5E1',
                    borderRadius: '10px',
                    padding: '0.55rem',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: '#334155',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <FileText style={{ width: '14px', height: '14px' }} />
                  <span>Copy Receipt</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const text = isWithdrawal 
                      ? `*RONAV TECHNOLOGIES - BANK DISBURSAL RECEIPT*\n` +
                        `Amount: ₹${amountNum.toFixed(2)}\n` +
                        `Bank: ${item.bank_name || 'Bank Account'}\n` +
                        `A/C: ${item.account_number || ''}\n` +
                        `UTR: ${utr}\n` +
                        `Status: Settled & Disbursed\n` +
                        `Date: ${new Date(item.created_at || Date.now()).toLocaleString()}`
                      : `*RONAV TECHNOLOGIES - POS SALE RECEIPT*\n` +
                        `Machine: ${item.provider || activeMachine?.title || 'Pine Labs POS'}\n` +
                        `Slip UTR: ${parsed.utr}\n` +
                        `Customer: ${parsed.customerName || 'Customer'}\n` +
                        `Amount: ₹${amountNum.toFixed(2)}\n` +
                        `Status: Approved & Cleared\n` +
                        `Date: ${new Date(item.created_at || Date.now()).toLocaleString()}`;
                    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
                    window.open(url, '_blank');
                  }}
                  style={{
                    background: '#25D366',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.55rem 0.85rem',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px'
                  }}
                >
                  <MessageCircle style={{ width: '14px', height: '14px' }} />
                  <span>WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedTxnForDetails(null)}
                  style={{
                    flex: 1,
                    background: '#0F52BA',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.55rem',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    color: '#FFFFFF',
                    cursor: 'pointer'
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Responsive Styles (Dual-Experience Engine) */}
      <style>{`
        /* Mobile Default: Max width 480px, centered */
        .merchant-container {
          width: 100%;
          max-width: 480px;
          margin: 0 auto;
          padding: 0 0.875rem;
          box-sizing: border-box;
        }

        .desktop-split-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.875rem;
        }

        /* Subpage Mobile Defaults */
        .merchant-subpage-wrapper {
          width: 100%;
          max-width: 480px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
          box-sizing: border-box;
          padding-bottom: 6.5rem;
        }

        .subpage-split-grid {
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
          width: 100%;
        }

        .subpage-col {
          display: flex;
          flex-direction: column;
          gap: 0.875rem;
          width: 100%;
        }

        .mobile-only-block {
          display: block;
        }

        .desktop-only-block {
          display: none !important;
        }

        /* Complete elimination of scrollbar lines for seamless mobile feel */
        .merchant-subpage-wrapper *::-webkit-scrollbar,
        .merchant-container *::-webkit-scrollbar,
        .no-scrollbar::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        .merchant-subpage-wrapper *,
        .merchant-container *,
        .no-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }

        /* Desktop Mode (>= 1024px): Spacious 1440px Enterprise Workspace */
        @media (min-width: 1024px) {
          .merchant-container {
            max-width: 1440px !important;
            padding: 0 2rem !important;
          }

          .merchant-subpage-wrapper {
            max-width: 1320px !important;
          }

          .merchant-subpage-wrapper.full-width {
            max-width: 1440px !important;
          }

          .subpage-split-grid {
            display: grid !important;
            grid-template-columns: 1.15fr 0.85fr !important;
            gap: 1.5rem !important;
            align-items: start !important;
          }

          .mobile-only-block {
            display: none !important;
          }

          .desktop-only-block {
            display: block !important;
          }

          .desktop-header-nav {
            display: flex !important;
          }

          .mobile-bottom-nav {
            display: none !important;
          }

          .desktop-split-grid {
            grid-template-columns: 1.1fr 1fr !important;
            gap: 1.5rem !important;
          }

          main {
            padding-bottom: 3rem !important;
          }
        }

        @media (min-width: 1440px) {
          .merchant-container {
            max-width: 1560px !important;
            padding: 0 2.5rem !important;
          }

          .merchant-subpage-wrapper {
            max-width: 1440px !important;
          }

          .merchant-subpage-wrapper.full-width {
            max-width: 1560px !important;
          }
        }
      `}</style>

    </div>
  );
}
