import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wallet, Eye, EyeOff, Plus, Send, Landmark, History, 
  Smartphone, Zap, Tv, CreditCard, Car, BarChart3, Headphones,
  LogOut, PlusCircle, Home, User, Bell, Phone, CheckCircle2, 
  Clock, AlertCircle, X, ChevronRight, Check, ArrowRight,
  Search, Calendar, ArrowLeft, RefreshCw, FileText, Filter, ShieldCheck, LayoutGrid, MoreHorizontal,
  Users, Share2, Copy, ExternalLink, UserPlus, ChevronDown, ChevronUp
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
  createDownstreamUser
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

// Dedicated Bank Logo Renderer with authentic bank identities
function BankLogo({ bankName }) {
  const name = (bankName || '').toLowerCase();

  // State Bank of India
  if (name.includes('state') || name.includes('sbi')) {
    return (
      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#0082CA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="46" fill="#0082CA" />
          <circle cx="50" cy="40" r="14" fill="#FFFFFF" />
          <rect x="46" y="40" width="8" height="34" fill="#FFFFFF" rx="4" />
        </svg>
      </div>
    );
  }

  // Kotak Mahindra Bank
  if (name.includes('kotak')) {
    return (
      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#0B132B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="46" fill="#0B132B" />
          <path d="M28 50 C28 36, 42 36, 50 50 C58 64, 72 64, 72 50 C72 36, 58 36, 50 50 C42 64, 28 64, 28 50 Z" stroke="#ED1C24" strokeWidth="10" fill="none" strokeLinecap="round" />
          <path d="M36 50 C36 43, 44 43, 50 50 C56 57, 64 57, 64 50" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // HDFC Bank
  if (name.includes('hdfc')) {
    return (
      <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: '#004C8F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="20" height="20" viewBox="0 0 100 100" fill="none">
          <rect width="100" height="100" rx="16" fill="#004C8F" />
          <rect x="18" y="18" width="64" height="64" fill="#FFFFFF" rx="4" />
          <rect x="32" y="32" width="36" height="36" fill="#004C8F" />
          <rect x="32" y="44" width="36" height="12" fill="#ED1C24" />
          <rect x="44" y="32" width="12" height="36" fill="#ED1C24" />
        </svg>
      </div>
    );
  }

  // ICICI Bank
  if (name.includes('icici')) {
    return (
      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#FFF5F0', border: '1px solid #FFEDD5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="20" height="20" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="46" fill="#B32025" />
          <circle cx="50" cy="30" r="8" fill="#F37021" />
          <path d="M42 46 C42 46, 50 42, 56 46 C60 49, 58 68, 66 70" stroke="#F37021" strokeWidth="9" strokeLinecap="round" fill="none" />
          <path d="M38 72 C46 72, 54 70, 62 70" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // Axis Bank
  if (name.includes('axis')) {
    return (
      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#97144D', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="46" fill="#97144D" />
          <path d="M50 20 L78 78 L62 78 L50 50 L38 78 L22 78 Z" fill="#FFFFFF" />
        </svg>
      </div>
    );
  }

  // Punjab National Bank (PNB)
  if (name.includes('punjab') || name.includes('pnb')) {
    return (
      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#A20021', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="46" fill="#A20021" />
          <circle cx="50" cy="50" r="24" stroke="#FFB612" strokeWidth="7" fill="none" />
          <rect x="46" y="32" width="8" height="36" fill="#FFB612" rx="4" />
        </svg>
      </div>
    );
  }

  // Bank of Baroda
  if (name.includes('baroda') || name.includes('bob')) {
    return (
      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#F26522', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="46" fill="#F26522" />
          <circle cx="42" cy="50" r="16" fill="#FFFFFF" />
          <circle cx="58" cy="50" r="16" fill="#FFFFFF" />
        </svg>
      </div>
    );
  }

  // Canara Bank
  if (name.includes('canara')) {
    return (
      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#0091DF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="46" fill="#0091DF" />
          <polygon points="35,65 50,35 65,65" fill="#FFCC00" />
          <polygon points="42,75 57,45 72,75" fill="#FFFFFF" opacity="0.8" />
        </svg>
      </div>
    );
  }

  // Union Bank of India
  if (name.includes('union')) {
    return (
      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#C8102E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="18" height="18" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="46" fill="#C8102E" />
          <text x="50" y="64" fill="#FFFFFF" fontSize="34" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">U</text>
        </svg>
      </div>
    );
  }

  // Fallback: Modern monogram badge with initials
  const initials = (bankName || 'BK').split(' ').map(w => w[0]).filter(Boolean).slice(0, 3).join('').toUpperCase();
  return (
    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#EFF6FF', border: '1px solid #DBEAFE', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.625rem', fontWeight: 800 }}>
      {initials || <Landmark style={{ width: '15px', height: '15px' }} />}
    </div>
  );
}

// Swipe Machine Configurations (Pine Labs & Payswiff)
const POS_MACHINES_DATA = {
  pine_labs: {
    key: 'pine_labs',
    provider: 'Pine Labs',
    title: 'Pine Labs POS',
    terminal_id: 'PL-HYD-9941',
    rate: '1.25%',
    rateNum: 1.25,
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
    terminal_id: 'SWIFF-TS-8812',
    rate: '1.65%',
    rateNum: 1.65,
    icon: '⚡',
    themeColor: '#D97706',
    accentBg: '#FFFBEB',
    accentBorder: '#FDE68A',
    badgeText: 'Smart Android'
  }
};

export default function MerchantDashboardPage({ user, onLogout }) {
  const [showBalance, setShowBalance] = useState(true);
  // Views: 'home' | 'record-sale' | 'withdraw' | 'bbps' | 'history'
  const [activeTab, setActiveTab] = useState('home');
  const [toastMessage, setToastMessage] = useState('');

  // Swipe Machine Active State (Case 1: Dual Machines vs Case 2: Single Machine)
  const [machineMode, setMachineMode] = useState('dual'); // 'dual' | 'single'
  const [selectedMachineKey, setSelectedMachineKey] = useState('pine_labs'); // 'pine_labs' | 'payswiff'
  const activeMachine = POS_MACHINES_DATA[selectedMachineKey] || POS_MACHINES_DATA.pine_labs;

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
  const [bbpsCategory, setBbpsCategory] = useState('mobile'); // 'mobile' | 'electricity' | 'dth' | 'fastag'

  // Record Sale Form state
  const [saleForm, setSaleForm] = useState({
    amount: '',
    customer_mobile: '',
    transaction_id: '',
    payment_mode: 'RuPay Card',
    notes: ''
  });
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);

  // Withdraw to Bank Form state
  const [selectedBankId, setSelectedBankId] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);

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

  // Live bank withdrawals list from DB
  const displayWithdrawals = useMemo(() => {
    return withdrawals || [];
  }, [withdrawals]);

  // Live card swipe transactions list from DB
  const swipeTransactions = useMemo(() => {
    return (transactions || []).filter(t => t.type !== 'BBPS_BILL');
  }, [transactions]);

  // Dynamic Today's Stats from Live Transactions
  const todayStats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayTxns = (transactions || []).filter(t => {
      const d = new Date(t.created_at || Date.now()).toISOString().slice(0, 10);
      return d === todayStr;
    });

    const sales = todayTxns.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    const collected = todayTxns.filter(t => t.status === 'APPROVED').reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
    const pending = todayTxns.filter(t => t.status === 'PENDING').reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);

    return {
      sales,
      collected,
      pending,
      count: todayTxns.length
    };
  }, [transactions]);

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
  const [isLoadingNetwork, setIsLoadingNetwork] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [partnerTxns, setPartnerTxns] = useState([]);
  const [isLoadingPartnerTxns, setIsLoadingPartnerTxns] = useState(false);
  const [onboardForm, setOnboardForm] = useState({
    name: '',
    mobile: '',
    role: '',
    shop_name: '',
    pos_provider: 'Pine Labs',
    password: ''
  });
  const [isSubmittingOnboard, setIsSubmittingOnboard] = useState(false);
  const [createdPartnerCreds, setCreatedPartnerCreds] = useState(null);

  const [expandedPartnerId, setExpandedPartnerId] = useState(null);

  // Allowed downstream roles based on hierarchy & Machine Provider (Pine Labs vs Payswiff)
  const allowedRolesForCreator = useMemo(() => {
    const r = (userRole || '').toUpperCase();
    const isPine = (onboardForm.pos_provider || 'Pine Labs') === 'Pine Labs';

    if (isPine) {
      // -------------------------------------------------------------------
      // 1. PINE LABS T+1: 4 Tiers (Super Distributor is strictly OMITTED)
      // MASTER (1.21%) -> DIST Franchise (1.41%) -> Distributor (1.47%) -> Retailer (1.53%)
      // -------------------------------------------------------------------
      if (r.includes('MASTER') || r.includes('ADMIN')) {
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
        setOnboardForm(prev => ({ ...prev, role: allowedRolesForCreator[0].value }));
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
        pos_provider: onboardForm.pos_provider || 'Pine Labs'
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
      }

      const txnRes = await getMerchantTransactions(merchantId);
      if (txnRes.success && txnRes.transactions) {
        setTransactions(txnRes.transactions);
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

  // Filtered Transactions with Today, Yesterday & Custom Date Range
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const txnDate = new Date(t.created_at || Date.now());
      const txnDateStr = txnDate.toISOString().slice(0, 10);
      
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      // Date Filtering
      if (dateFilter === 'TODAY') {
        if (txnDateStr !== todayStr) return false;
      } else if (dateFilter === 'YESTERDAY') {
        if (txnDateStr !== yesterdayStr) return false;
      } else if (dateFilter === 'WEEK') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (txnDate < weekAgo) return false;
      } else if (dateFilter === 'CUSTOM') {
        if (customFromDate && txnDateStr < customFromDate) return false;
        if (customToDate && txnDateStr > customToDate) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const idMatch = t.id?.toLowerCase().includes(q);
        const rrnMatch = t.ref_number?.toLowerCase().includes(q);
        const mobileMatch = t.customer_mobile?.toLowerCase().includes(q);
        const notesMatch = t.notes?.toLowerCase().includes(q);
        if (!idMatch && !rrnMatch && !mobileMatch && !notesMatch) return false;
      }

      return true;
    });
  }, [transactions, dateFilter, customFromDate, customToDate, searchQuery]);

  // Dynamic turnover total for filtered transactions
  const filteredTurnoverTotal = useMemo(() => {
    return filteredTransactions.reduce((acc, t) => acc + (parseFloat(t.amount) || 0), 0);
  }, [filteredTransactions]);

  // Card Swipe record submission (Compulsory UTR / Transaction ID)
  const handleRecordSaleSubmit = async (e) => {
    e.preventDefault();
    const amountVal = parseFloat(saleForm.amount);
    if (!amountVal || amountVal <= 0) {
      showToast('⚠️ Please enter a valid sale amount.');
      return;
    }
    if (!saleForm.transaction_id || !saleForm.transaction_id.trim()) {
      showToast('⚠️ Transaction ID / UTR is compulsory!');
      return;
    }

    setIsSubmittingSale(true);
    try {
      const res = await recordMerchantSale({
        merchant_id: merchantId,
        amount: amountVal,
        customer_mobile: saleForm.customer_mobile,
        type: 'POS_SWIPE',
        provider: activeMachine.provider,
        ref_number: saleForm.transaction_id.trim().toUpperCase(),
        notes: `${activeMachine.title} Swipe (${saleForm.payment_mode || 'Debit/Credit Card'}) • ${activeMachine.rate} MDR - ₹${amountVal}`
      });

      if (res.success) {
        showToast(`✓ ${activeMachine.title} Swipe Recorded! Added to Wallet.`);
        setSaleForm({ amount: '', customer_mobile: '', transaction_id: '', payment_mode: 'RuPay Card', notes: '' });
        fetchLiveData();
      } else {
        showToast(res.message || 'Error recording sale');
      }
    } catch (err) {
      showToast('Failed to connect to server');
    } finally {
      setIsSubmittingSale(false);
    }
  };

  // Withdraw to Bank submission
  const handleWithdrawSubmit = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(withdrawAmount);
    if (!amountNum || amountNum <= 0) {
      showToast('⚠️ Please enter a valid withdrawal amount.');
      return;
    }

    if (amountNum > wallet.available_balance) {
      showToast(`⚠️ Insufficient balance! Max available: ₹${wallet.available_balance.toFixed(2)}`);
      return;
    }

    const targetBank = beneficiaries.find(b => b.id === selectedBankId) || beneficiaries[0];
    if (!targetBank) {
      showToast('⚠️ Please link a bank account first.');
      return;
    }

    setIsSubmittingWithdraw(true);
    try {
      const res = await requestWithdrawal({
        merchant_id: merchantId,
        amount: amountNum,
        bank_name: targetBank.bank_name || targetBank.bank,
        account_number: targetBank.account_number || targetBank.account,
        ifsc: targetBank.ifsc || 'SBIN0001234'
      });

      if (res.success) {
        showToast('✓ Withdrawal Successful! Sent to your Bank Account.');
        setWithdrawAmount('');
        fetchLiveData();
      } else {
        showToast(res.message || 'Error processing withdrawal');
      }
    } catch (err) {
      showToast('Failed to process withdrawal');
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
            /* Sub-page Header: Clean circle back button on left, and Secure & Encrypted badge on the right */
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

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#059669', fontSize: '0.75rem', fontWeight: 700 }}>
                <ShieldCheck style={{ width: '16px', height: '16px' }} />
                <span>Secure & Encrypted</span>
              </div>
            </div>
          ) : (
            /* Home Page Header: Brand Logo + Desktop Nav + Profile & Hotline */
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
                    My Network
                  </button>
                )}
              </nav>

              {/* Right: Phone Hotline & Merchant Profile */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <a href="tel:9966203053" style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }} title="Call Support 9966203053">
                  <Phone style={{ width: '15px', height: '15px' }} />
                </a>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '0.25rem 0.5rem', borderRadius: '20px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#0F52BA', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>
                    {merchantName.charAt(0)}
                  </div>
                  <div style={{ textAlign: 'left', lineHeight: 1.1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <p style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#0F172A', margin: 0, maxWidth: '105px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {merchantName}
                      </p>
                      <span style={{ fontSize: '0.5rem', fontWeight: 800, color: '#0F52BA', background: '#EFF6FF', border: '1px solid #DBEAFE', padding: '1px 4px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                        {userRole}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.5rem', color: '#64748B', fontWeight: 700 }}>
                      {merchantId}
                    </span>
                  </div>
                  <button onClick={onLogout} title="Log Out" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#DC2626', marginLeft: '4px' }}>
                    <LogOut style={{ width: '14px', height: '14px' }} />
                  </button>
                </div>
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
              {/* SWIPE MACHINE (POS) - ONLY THE TWO MACHINE NAMES          */}
              {/* ========================================================= */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                margin: '0.125rem 0 -0.25rem',
                padding: '0 0.125rem'
              }}>
                <div style={{
                  display: 'inline-flex',
                  background: '#F1F5F9',
                  padding: '3px',
                  borderRadius: '10px',
                  gap: '4px',
                  border: '1px solid #E2E8F0'
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMachineKey('pine_labs');
                      showToast('Active: Pine Labs');
                    }}
                    style={{
                      padding: '0.35rem 0.85rem',
                      borderRadius: '7px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      background: selectedMachineKey === 'pine_labs' ? '#0F52BA' : 'transparent',
                      color: selectedMachineKey === 'pine_labs' ? '#FFFFFF' : '#64748B',
                      boxShadow: selectedMachineKey === 'pine_labs' ? '0 2px 6px rgba(15,82,186,0.25)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>🌲</span>
                    <span>Pine Labs</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMachineKey('payswiff');
                      showToast('Active: Payswiff');
                    }}
                    style={{
                      padding: '0.35rem 0.85rem',
                      borderRadius: '7px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      background: selectedMachineKey === 'payswiff' ? '#D97706' : 'transparent',
                      color: selectedMachineKey === 'payswiff' ? '#FFFFFF' : '#64748B',
                      boxShadow: selectedMachineKey === 'payswiff' ? '0 2px 6px rgba(217,119,6,0.25)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>⚡</span>
                    <span>Payswiff</span>
                  </button>
                </div>
              </div>

              {/* 1. Virtual Wallet Card (Refined Compact Scale with 3 Clean Metrics) */}
              <div style={{
                position: 'relative',
                background: 'linear-gradient(135deg, #09204A 0%, #0F52BA 55%, #184196 100%)',
                borderRadius: '20px',
                padding: '1rem 1.125rem 0.875rem',
                color: '#FFFFFF',
                boxShadow: '0 10px 24px rgba(10,34,82,0.22), 0 2px 6px rgba(0,0,0,0.06)',
                overflow: 'hidden'
              }}>
                {/* Ambient Glows */}
                <div style={{
                  position: 'absolute',
                  top: '-40%',
                  right: '-10%',
                  width: '240px',
                  height: '240px',
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(56,189,248,0.20) 0%, rgba(37,99,235,0.06) 50%, transparent 70%)',
                  pointerEvents: 'none',
                  zIndex: 0
                }} />

                {/* Content Container */}
                <div style={{ position: 'relative', zIndex: 2 }}>
                  {/* Top Bar: Virtual Wallet + Eye Toggle (3-dots button removed) */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.01em' }}>
                        Virtual Wallet
                      </span>
                      <button 
                        onClick={() => setShowBalance(!showBalance)} 
                        style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        title={showBalance ? "Hide balance" : "Show balance"}
                      >
                        {showBalance ? <Eye style={{ width: '14px', height: '14px' }} /> : <EyeOff style={{ width: '14px', height: '14px' }} />}
                      </button>
                    </div>
                  </div>

                  {/* Main Amount & CTA Row (Reduced Font Size) */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                    <div>
                      <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', fontFeatureSettings: '"tnum"', lineHeight: 1.15 }}>
                        {showBalance ? `₹${wallet.available_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '••••••••'}
                      </h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10B981', display: 'inline-block', boxShadow: '0 0 5px #10B981' }} />
                        <span style={{ fontSize: '0.625rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
                          Available Balance for Withdrawal
                        </span>
                      </div>
                    </div>

                    {/* White Pill '+ Record Sale' Button (Nicely Proportioned) */}
                    <button 
                      onClick={() => setActiveTab('record-sale')}
                      className="card-hover"
                      style={{
                        background: '#FFFFFF',
                        color: '#0F52BA',
                        border: 'none',
                        borderRadius: '20px',
                        padding: '0.42rem 0.85rem',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 3px 10px rgba(0,0,0,0.14)',
                        transition: 'all 0.15s ease',
                        flexShrink: 0
                      }}
                    >
                      <Plus style={{ width: '12px', height: '12px', strokeWidth: 3 }} />
                      <span>Record Sale</span>
                    </button>
                  </div>

                  {/* 3 Bottom Metrics: Total Credited, Sent to Bank, In Transit (Settlement removed) */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    paddingTop: '0.625rem',
                    borderTop: '1px solid rgba(255,255,255,0.14)',
                    textAlign: 'center'
                  }}>
                    {/* Col 1: Total Credited */}
                    <div style={{ padding: '0 0.25rem' }}>
                      <span style={{ color: '#93C5FD', display: 'block', fontSize: '0.59rem', fontWeight: 700, marginBottom: '2px', whiteSpace: 'nowrap' }}>
                        Total Credited
                      </span>
                      <strong style={{ color: '#FFFFFF', fontSize: '0.8125rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                        ₹{(wallet.total_sales / 100000).toFixed(2)}L
                      </strong>
                    </div>

                    {/* Col 2: Sent to Bank */}
                    <div style={{ padding: '0 0.25rem', borderLeft: '1px solid rgba(255,255,255,0.14)' }}>
                      <span style={{ color: '#93C5FD', display: 'block', fontSize: '0.59rem', fontWeight: 700, marginBottom: '2px', whiteSpace: 'nowrap' }}>
                        Sent to Bank
                      </span>
                      <strong style={{ color: '#34D399', fontSize: '0.8125rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                        ₹{(wallet.withdrawn_amount / 100000).toFixed(2)}L
                      </strong>
                    </div>

                    {/* Col 3: In Transit */}
                    <div style={{ padding: '0 0.25rem', borderLeft: '1px solid rgba(255,255,255,0.14)' }}>
                      <span style={{ color: '#93C5FD', display: 'block', fontSize: '0.59rem', fontWeight: 700, marginBottom: '2px', whiteSpace: 'nowrap' }}>
                        In Transit
                      </span>
                      <strong style={{ color: '#FCD34D', fontSize: '0.8125rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
                        ₹{wallet.pending_balance > 0 ? (wallet.pending_balance / 1000).toFixed(1) + 'k' : '0'}
                      </strong>
                    </div>
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.375rem' }}>
                  {/* Card 1: Record Sale (Soft Icy Blue) */}
                  <button 
                    onClick={() => setActiveTab('record-sale')}
                    className="card-hover"
                    style={{
                      background: 'linear-gradient(180deg, #F0F7FF 0%, #E8F2FE 100%)',
                      border: '1px solid #E0EEFD',
                      borderRadius: '15px',
                      padding: '0.55rem 0.15rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.3rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      boxShadow: '0 2px 8px rgba(37,99,235,0.04)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#FFFFFF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(37,99,235,0.08)' }}>
                      <CreditCard style={{ width: '16px', height: '16px' }} />
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#0F172A', display: 'block', whiteSpace: 'nowrap' }}>Record Sale</strong>
                      <span style={{ fontSize: '0.5rem', color: '#64748B', display: 'block', marginTop: '1px', whiteSpace: 'nowrap' }}>Card Swipe</span>
                    </div>
                  </button>

                  {/* Card 2: Withdraw (Soft Fresh Mint) */}
                  <button 
                    onClick={() => setActiveTab('withdraw')}
                    className="card-hover"
                    style={{
                      background: 'linear-gradient(180deg, #F0FDF4 0%, #E6F9EE 100%)',
                      border: '1px solid #DCFCE7',
                      borderRadius: '15px',
                      padding: '0.55rem 0.15rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.3rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      boxShadow: '0 2px 8px rgba(5,150,105,0.04)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#FFFFFF', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(5,150,105,0.08)' }}>
                      <Send style={{ width: '16px', height: '16px' }} />
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#0F172A', display: 'block', whiteSpace: 'nowrap' }}>Withdraw</strong>
                      <span style={{ fontSize: '0.5rem', color: '#64748B', display: 'block', marginTop: '1px', whiteSpace: 'nowrap' }}>Send to Bank</span>
                    </div>
                  </button>

                  {/* Card 3: Bill Payments (Soft Warm Amber) */}
                  <button 
                    onClick={() => setActiveTab('bbps')}
                    className="card-hover"
                    style={{
                      background: 'linear-gradient(180deg, #FFFBEB 0%, #FEF3C7 100%)',
                      border: '1px solid #FDE68A',
                      borderRadius: '15px',
                      padding: '0.55rem 0.15rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.3rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      boxShadow: '0 2px 8px rgba(217,119,6,0.04)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#FFFFFF', color: '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(217,119,6,0.08)' }}>
                      <Zap style={{ width: '16px', height: '16px' }} />
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#0F172A', display: 'block', whiteSpace: 'nowrap' }}>Bill Payments</strong>
                      <span style={{ fontSize: '0.5rem', color: '#64748B', display: 'block', marginTop: '1px', whiteSpace: 'nowrap' }}>Recharges</span>
                    </div>
                  </button>

                  {/* Card 4: History (Soft Lavender Purple) */}
                  <button 
                    onClick={() => setActiveTab('history')}
                    className="card-hover"
                    style={{
                      background: 'linear-gradient(180deg, #FAF5FF 0%, #F3E8FF 100%)',
                      border: '1px solid #E9D5FF',
                      borderRadius: '15px',
                      padding: '0.55rem 0.15rem',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.3rem',
                      cursor: 'pointer',
                      textAlign: 'center',
                      boxShadow: '0 2px 8px rgba(124,58,237,0.04)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#FFFFFF', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(124,58,237,0.08)' }}>
                      <History style={{ width: '16px', height: '16px' }} />
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#0F172A', display: 'block', whiteSpace: 'nowrap' }}>History</strong>
                      <span style={{ fontSize: '0.5rem', color: '#64748B', display: 'block', marginTop: '1px', whiteSpace: 'nowrap' }}>All Transactions</span>
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
                          <h4 style={{ margin: 0, fontSize: '0.78125rem', fontWeight: 800, color: '#0F172A' }}>My Team &amp; Referral Profit</h4>
                          <span style={{ fontSize: '0.5rem', fontWeight: 800, color: '#0F52BA', background: '#FFFFFF', padding: '1px 5px', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
                            {networkData.partners.length} Members
                          </span>
                        </div>
                        <p style={{ margin: '1px 0 0', fontSize: '0.59rem', color: '#475569', fontWeight: 500 }}>
                          Add members, see daily sales &amp; check your profit
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

                  {/* 5-Item Grid matching reference image: Mobile, Electricity, DTH / TV, Fastag, More */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.375rem', textAlign: 'center' }}>
                    {/* 1. Mobile */}
                    <div 
                      onClick={() => { setBbpsCategory('mobile'); setActiveTab('bbps'); }}
                      className="card-hover"
                      style={{ cursor: 'pointer', padding: '0.5rem 0.15rem', borderRadius: '14px', background: '#F0F7FF', border: '1px solid #E0EEFD', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', transition: 'all 0.15s ease' }}
                    >
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#FFFFFF', color: '#2563EB', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(37,99,235,0.08)' }}>
                        <Smartphone style={{ width: '15px', height: '15px' }} />
                      </div>
                      <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>Mobile</span>
                    </div>

                    {/* 2. Electricity */}
                    <div 
                      onClick={() => { setBbpsCategory('electricity'); setActiveTab('bbps'); }}
                      className="card-hover"
                      style={{ cursor: 'pointer', padding: '0.5rem 0.15rem', borderRadius: '14px', background: '#FFFBEB', border: '1px solid #FEF3C7', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', transition: 'all 0.15s ease' }}
                    >
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#FFFFFF', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(217,119,6,0.08)' }}>
                        <Zap style={{ width: '15px', height: '15px' }} />
                      </div>
                      <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>Electricity</span>
                    </div>

                    {/* 3. DTH / TV */}
                    <div 
                      onClick={() => { setBbpsCategory('dth'); setActiveTab('bbps'); }}
                      className="card-hover"
                      style={{ cursor: 'pointer', padding: '0.5rem 0.15rem', borderRadius: '14px', background: '#FAF5FF', border: '1px solid #F3E8FF', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', transition: 'all 0.15s ease' }}
                    >
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#FFFFFF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(124,58,237,0.08)' }}>
                        <Tv style={{ width: '15px', height: '15px' }} />
                      </div>
                      <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>DTH / TV</span>
                    </div>

                    {/* 4. Fastag */}
                    <div 
                      onClick={() => { setBbpsCategory('fastag'); setActiveTab('bbps'); }}
                      className="card-hover"
                      style={{ cursor: 'pointer', padding: '0.5rem 0.15rem', borderRadius: '14px', background: '#F0FDF4', border: '1px solid #DCFCE7', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', transition: 'all 0.15s ease' }}
                    >
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#FFFFFF', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(5,150,105,0.08)' }}>
                        <Car style={{ width: '15px', height: '15px' }} />
                      </div>
                      <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>Fastag</span>
                    </div>

                    {/* 5. More */}
                    <div 
                      onClick={() => setActiveTab('bbps')}
                      className="card-hover"
                      style={{ cursor: 'pointer', padding: '0.5rem 0.15rem', borderRadius: '14px', background: '#F8FAFC', border: '1px solid #EDF2F7', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', transition: 'all 0.15s ease' }}
                    >
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#FFFFFF', color: '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(100,116,139,0.08)' }}>
                        <LayoutGrid style={{ width: '15px', height: '15px' }} />
                      </div>
                      <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>More</span>
                    </div>
                  </div>
                </div>

                {/* Today's Sales Overview Box (Placed below Bill Payments and above My Bank Accounts) */}
                <div style={{ background: '#FFFFFF', borderRadius: '18px', border: '1px solid #E2E8F0', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Today's Sales Overview</h3>
                      <p style={{ fontSize: '0.625rem', color: '#64748B', margin: 0 }}>Today's counter swipe collection</p>
                    </div>
                    <span style={{ fontSize: '0.625rem', color: '#0F52BA', fontWeight: 800, background: '#EFF6FF', padding: '2px 8px', borderRadius: '10px' }}>
                      ● LIVE TODAY
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                    <div style={{ background: '#F8FAFC', padding: '0.625rem 0.25rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                      <span style={{ fontSize: '0.5625rem', color: '#64748B', fontWeight: 700 }}>Today's Sales</span>
                      <p style={{ fontSize: '0.875rem', fontWeight: 900, color: '#0F172A', margin: '2px 0 0' }}>
                        ₹{todayStats.sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div style={{ background: '#F8FAFC', padding: '0.625rem 0.25rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                      <span style={{ fontSize: '0.5625rem', color: '#64748B', fontWeight: 700 }}>Collected</span>
                      <p style={{ fontSize: '0.875rem', fontWeight: 900, color: '#059669', margin: '2px 0 0' }}>
                        ₹{todayStats.collected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div style={{ background: '#F8FAFC', padding: '0.625rem 0.25rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                      <span style={{ fontSize: '0.5625rem', color: '#64748B', fontWeight: 700 }}>Pending</span>
                      <p style={{ fontSize: '0.875rem', fontWeight: 900, color: '#D97706', margin: '2px 0 0' }}>
                        ₹{todayStats.pending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div style={{ background: '#F8FAFC', padding: '0.625rem 0.25rem', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                      <span style={{ fontSize: '0.5625rem', color: '#64748B', fontWeight: 700 }}>Swipes</span>
                      <p style={{ fontSize: '0.875rem', fontWeight: 900, color: '#0F52BA', margin: '2px 0 0' }}>
                        {todayStats.count}
                      </p>
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
                              •••• {b.account_number ? b.account_number.slice(-4) : '1234'} • {b.holder_name || 'Ravi Kumar'}
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

                {/* Recent Transactions List */}
                <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Recent Transactions</h3>
                      <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#0F52BA', background: '#EFF6FF', padding: '1px 6px', borderRadius: '10px' }}>
                        {transactions.length} Records
                      </span>
                    </div>
                    <button 
                      onClick={() => setActiveTab('history')} 
                      style={{ background: 'none', border: 'none', color: '#0F52BA', fontSize: '0.6875rem', fontWeight: 800, cursor: 'pointer' }}
                    >
                      View All Transactions &gt;
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {transactions.slice(0, 5).map((t, idx) => (
                      <div key={t.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.75rem', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {t.type === 'BBPS_BILL' ? <Zap style={{ width: '16px', height: '16px' }} /> : <CreditCard style={{ width: '16px', height: '16px' }} />}
                          </div>
                          <div>
                            <strong style={{ fontSize: '0.75rem', color: '#0F172A', display: 'block' }}>
                              {t.notes || 'Counter Card Swipe'}
                            </strong>
                            <span style={{ fontSize: '0.5625rem', color: '#64748B' }}>
                              TXN ID: {t.id} • RRN: {t.ref_number || 'N/A'} • {new Date(t.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '0.875rem', fontWeight: 800, color: '#059669', margin: 0 }}>
                            ₹{parseFloat(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                          <span style={{ fontSize: '0.5rem', fontWeight: 800, color: '#059669', background: '#ECFDF5', padding: '1px 6px', borderRadius: '4px' }}>
                            Success
                          </span>
                        </div>
                      </div>
                    ))}
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
            <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.875rem', width: '100%', boxSizing: 'border-box', paddingBottom: '1.5rem' }}>
              
              {/* Sub-page Title */}
              <div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
                  Record Card Swipe Sale
                </h1>
              </div>

              {/* 2. Ronav Wallet Balance Card (Identical Mint Gradient Banner) */}
              <div style={{
                background: 'linear-gradient(135deg, #ECFDF5 0%, #F0FDFA 55%, #FFFFFF 100%)',
                border: '1px solid #D1FAE5',
                borderRadius: '14px',
                padding: '0.75rem 1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 1px 4px rgba(5,150,105,0.04)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: '#DCFCE7',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Wallet style={{ width: '18px', height: '18px' }} />
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      RONAV WALLET
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 600, display: 'block' }}>
                    Available Balance
                  </span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#059669', letterSpacing: '-0.01em', marginTop: '1px' }}>
                    ₹{wallet.available_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* 3. Joint Entry Form Card (Amount + Compulsory Transaction ID / UTR) */}
              <form onSubmit={handleRecordSaleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div style={{
                  background: '#FFFFFF',
                  borderRadius: '14px',
                  border: '1px solid #EDF2F7',
                  padding: '1rem',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  {/* Active Swipe Terminal Information & Switcher */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '10px',
                    background: activeMachine.accentBg,
                    border: `1px solid ${activeMachine.accentBorder}`
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1rem' }}>{activeMachine.icon}</span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A' }}>
                            {activeMachine.title}
                          </span>
                          <span style={{
                            fontSize: '0.625rem',
                            fontWeight: 800,
                            color: activeMachine.themeColor,
                            background: '#FFFFFF',
                            padding: '0.1rem 0.35rem',
                            borderRadius: '5px',
                            border: `1px solid ${activeMachine.accentBorder}`
                          }}>
                            {activeMachine.rate} MDR
                          </span>
                        </div>
                        <span style={{ fontSize: '0.625rem', color: '#64748B' }}>
                          Terminal: <strong style={{ color: '#334155' }}>{activeMachine.terminal_id}</strong>
                        </span>
                      </div>
                    </div>

                    {machineMode === 'dual' && (
                      <button
                        type="button"
                        onClick={() => {
                          const otherKey = selectedMachineKey === 'pine_labs' ? 'payswiff' : 'pine_labs';
                          setSelectedMachineKey(otherKey);
                          showToast(`Switched active terminal to ${POS_MACHINES_DATA[otherKey].title}`);
                        }}
                        style={{
                          background: '#FFFFFF',
                          border: `1px solid ${activeMachine.accentBorder}`,
                          color: activeMachine.themeColor,
                          borderRadius: '6px',
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.625rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <RefreshCw style={{ width: '10px', height: '10px' }} />
                        <span>Switch Terminal</span>
                      </button>
                    )}
                  </div>

                  {/* Amount Section */}
                  <div>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A' }}>
                        How much was collected? (Sale Amount *)
                      </label>
                    </div>

                    {/* Darker amount input field so it clearly stands out */}
                    <div style={{
                      background: '#F1F5F9',
                      border: '1px solid #CBD5E1',
                      borderRadius: '10px',
                      padding: '0.55rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'all 0.15s ease'
                    }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginRight: '0.5rem' }}>₹</span>
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
                          fontSize: '1.375rem',
                          fontWeight: 800,
                          color: '#0F172A',
                          padding: 0
                        }}
                      />
                    </div>

                    {/* Quick Amount Chips */}
                    <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      {['500', '1000', '2000', '5000', '10000'].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setSaleForm({ ...saleForm, amount: amt })}
                          style={{
                            flex: 1,
                            minWidth: '52px',
                            background: saleForm.amount === amt ? '#EFF6FF' : '#FFFFFF',
                            border: saleForm.amount === amt ? '1.5px solid #2563EB' : '1px solid #CBD5E1',
                            borderRadius: '8px',
                            padding: '0.35rem 0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: saleForm.amount === amt ? '#1D4ED8' : '#334155',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          +₹{parseInt(amt).toLocaleString('en-IN')}
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
                            borderRadius: '8px',
                            padding: '0.35rem 0.5rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Clean Hairline Divider */}
                  <div style={{ height: '1px', background: '#F1F5F9', margin: '0 -0.25rem' }} />

                  {/* Mandatory Transaction ID / UTR Field Only */}
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', display: 'block', marginBottom: '0.3125rem' }}>
                      Transaction ID / UTR Number *
                    </label>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: '#F8FAFC',
                      border: !saleForm.transaction_id && saleForm.amount ? '1.5px solid #FCA5A5' : '1px solid #CBD5E1',
                      borderRadius: '10px',
                      padding: '0.55rem 0.75rem'
                    }}>
                      <FileText style={{ width: '15px', height: '15px', color: '#0F52BA', flexShrink: 0 }} />
                      <input 
                        type="text"
                        required
                        placeholder="Enter 12-digit UTR number"
                        value={saleForm.transaction_id}
                        onChange={(e) => setSaleForm({ ...saleForm, transaction_id: e.target.value.toUpperCase() })}
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          fontSize: '0.8125rem',
                          fontWeight: saleForm.transaction_id ? 700 : 500,
                          fontFamily: saleForm.transaction_id ? 'monospace' : 'inherit',
                          color: '#0F172A',
                          padding: 0
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Submit CTA Button */}
                <button 
                  type="submit"
                  disabled={isSubmittingSale || parseFloat(saleForm.amount || 0) <= 0 || !saleForm.transaction_id}
                  style={{
                    width: '100%',
                    background: (parseFloat(saleForm.amount || 0) > 0 && saleForm.transaction_id)
                      ? 'linear-gradient(135deg, #0F52BA 0%, #1E3A8A 100%)'
                      : '#8B95A5',
                    color: '#FFF',
                    border: 'none',
                    padding: '0.8125rem 1rem',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '0.875rem',
                    cursor: (parseFloat(saleForm.amount || 0) > 0 && saleForm.transaction_id) ? 'pointer' : 'not-allowed',
                    boxShadow: (parseFloat(saleForm.amount || 0) > 0 && saleForm.transaction_id) ? '0 4px 14px rgba(15,82,186,0.25)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <CreditCard style={{ width: '15px', height: '15px' }} />
                  <span>
                    {isSubmittingSale 
                      ? 'Recording Swipe...' 
                      : (parseFloat(saleForm.amount || 0) > 0 && saleForm.transaction_id)
                        ? `Record & Credit ₹${parseFloat(saleForm.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} to Wallet →`
                        : !saleForm.transaction_id && parseFloat(saleForm.amount || 0) > 0
                          ? 'Enter Transaction ID / UTR to Record →'
                          : 'Enter Sale Amount & UTR →'}
                  </span>
                </button>
              </form>

              {/* 6. Recent Card Swipes Ledger (Below CTA button - Matches Withdraw Recent Ledger) */}
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
                    <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <History style={{ width: '14px', height: '14px' }} />
                    </div>
                    <h4 style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      Recent Recorded Swipes
                    </h4>
                    <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#0F52BA', background: '#EFF6FF', padding: '1px 6px', borderRadius: '6px' }}>
                      {swipeTransactions.length} Recorded
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('history')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#0F52BA',
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
                  {swipeTransactions.slice(0, 5).map((t, idx) => (
                    <div
                      key={t.id || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.625rem 0.75rem',
                        borderRadius: '10px',
                        background: '#F8FAFC',
                        border: '1px solid #EDF2F7'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <CreditCard style={{ width: '16px', height: '16px' }} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                            <strong style={{ fontSize: '0.75rem', color: '#0F172A', fontWeight: 700 }}>
                              {t.notes || 'Counter Card Swipe'}
                            </strong>
                            <span style={{ fontSize: '0.5rem', fontWeight: 800, background: '#DCFCE7', color: '#15803D', padding: '1px 5px', borderRadius: '4px' }}>
                              POS
                            </span>
                          </div>
                          <span style={{ fontSize: '0.625rem', color: '#94A3B8', display: 'block', marginTop: '1px' }}>
                            UTR: {t.ref_number || t.id} • {new Date(t.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#059669', margin: 0 }}>
                          +₹{parseFloat(t.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                        <span style={{
                          display: 'inline-block',
                          fontSize: '0.5625rem',
                          fontWeight: 800,
                          marginTop: '2px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          background: '#ECFDF5',
                          color: '#059669'
                        }}>
                          ✓ Credited
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW 3: DEDICATED "WITHDRAW TO BANK" PAGE                 */}
          {/* (PREMIUM NATIVE APP FINTECH EXPERIENCE - STANDARD SCALE)   */}
          {/* ========================================================= */}
          {activeTab === 'withdraw' && (() => {
            const defaultBankList = [
              { id: 'BEN-01', bank_name: 'State Bank of India', account_number: '30891245678', holder_name: 'Ravi Kumar', ifsc: 'SBIN0001234', is_primary: 1 },
              { id: 'BEN-02', bank_name: 'Kotak Mahindra Bank', account_number: '41200122109', holder_name: 'Ravi Kumar', ifsc: 'KKBK0000123', is_primary: 0 },
              { id: 'BEN-03', bank_name: 'HDFC Bank', account_number: '50100456789', holder_name: 'Ravi Kumar', ifsc: 'HDFC0000456', is_primary: 0 },
              { id: 'BEN-04', bank_name: 'ICICI Bank', account_number: '00234567890', holder_name: 'Ravi Kumar', ifsc: 'ICIC0000234', is_primary: 0 },
            ];
            const displayBeneficiaries = beneficiaries.length >= 2 ? beneficiaries : defaultBankList;
            const currentBankId = selectedBankId || displayBeneficiaries[0].id;
            const selectedBank = displayBeneficiaries.find(b => b.id === currentBankId) || displayBeneficiaries[0];
            const parsedAmount = parseFloat(withdrawAmount) || 0;

            return (
              <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.875rem', width: '100%', boxSizing: 'border-box', paddingBottom: '1.5rem' }}>
                
                {/* 1. Main Title & Subtitle (Standard Proportional Heading) */}
                <div>
                  <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.2rem', letterSpacing: '-0.01em' }}>
                    Withdraw Funds
                  </h1>
                  <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>
                    Send money from your Ronav wallet to your bank account
                  </p>
                </div>

                {/* 2. Ronav Wallet Balance Card (Standard Compact Scale) */}
                <div style={{
                  background: 'linear-gradient(135deg, #ECFDF5 0%, #F0FDFA 55%, #FFFFFF 100%)',
                  border: '1px solid #D1FAE5',
                  borderRadius: '14px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 1px 4px rgba(5,150,105,0.04)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: '#DCFCE7',
                      color: '#059669',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Wallet style={{ width: '18px', height: '18px' }} />
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        RONAV WALLET
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 600, display: 'block' }}>
                      Available Balance
                    </span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#059669', letterSpacing: '-0.01em', marginTop: '1px' }}>
                      ₹{wallet.available_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* 3. Joint Transfer Form: Amount & Destination Bank in One Box */}
                <div style={{
                  background: '#FFFFFF',
                  borderRadius: '14px',
                  border: '1px solid #EDF2F7',
                  padding: '1rem',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  {/* Amount Section */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A' }}>
                        How much do you want to send?
                      </label>
                      <button
                        type="button"
                        onClick={() => setWithdrawAmount(wallet.available_balance.toString())}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: '#64748B'
                        }}
                      >
                        Available <span style={{ color: '#2563EB', fontWeight: 700 }}>₹{wallet.available_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </button>
                    </div>

                    {/* Darker amount input field so it clearly stands out */}
                    <div style={{
                      background: '#F1F5F9',
                      border: parsedAmount > wallet.available_balance ? '1.5px solid #EF4444' : '1.5px solid #CBD5E1',
                      borderRadius: '10px',
                      padding: '0.55rem 0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'all 0.15s ease'
                    }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginRight: '0.5rem' }}>₹</span>
                      <input 
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          fontSize: '1.375rem',
                          fontWeight: 800,
                          color: '#0F172A',
                          padding: 0
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem' }}>
                      {[
                        { label: '₹1,000', value: 1000 },
                        { label: '₹5,000', value: 5000 },
                        { label: '₹10,000', value: 10000 }
                      ].map(chip => (
                        <button
                          key={chip.label}
                          type="button"
                          onClick={() => setWithdrawAmount(chip.value.toString())}
                          style={{
                            flex: 1,
                            background: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: '8px',
                            padding: '0.35rem 0.25rem',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#334155',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {chip.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setWithdrawAmount(wallet.available_balance.toString())}
                        style={{
                          flex: 1.1,
                          background: '#ECFDF5',
                          border: '1px solid #A7F3D0',
                          borderRadius: '8px',
                          padding: '0.35rem 0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          color: '#059669',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        All (100%)
                      </button>
                    </div>
                  </div>

                  {/* Clean Subtle Divider */}
                  <div style={{ height: '1px', background: '#F1F5F9', margin: '0 -0.25rem' }} />

                  {/* Transfer to (Select Account) Section */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A' }}>
                        Transfer to (Select Account)
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsAddAccountModalOpen(true)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563EB',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        + Add Bank Account
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {displayBeneficiaries.map(b => {
                        const isSelected = currentBankId === b.id;
                        return (
                          <div
                            key={b.id}
                            onClick={() => setSelectedBankId(b.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.625rem 0.75rem',
                              borderRadius: '10px',
                              background: isSelected ? '#F4F8FF' : '#F8FAFC',
                              border: isSelected ? '1.5px solid #3B82F6' : '1px solid #EDF2F7',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              boxShadow: isSelected ? '0 1px 4px rgba(37,99,235,0.06)' : 'none'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                              <div style={{
                                width: '16px',
                                height: '16px',
                                borderRadius: '50%',
                                border: isSelected ? '5px solid #2563EB' : '1.5px solid #CBD5E1',
                                background: '#FFFFFF',
                                flexShrink: 0
                              }} />

                              <BankLogo bankName={b.bank_name || b.bank} />

                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                  <strong style={{ fontSize: '0.8125rem', color: '#0F172A', fontWeight: 700 }}>
                                    {b.bank_name || b.bank}
                                  </strong>
                                  <span style={{ fontSize: '0.5rem', fontWeight: 800, background: '#DCFCE7', color: '#15803D', padding: '1px 5px', borderRadius: '4px' }}>
                                    IMPS
                                  </span>
                                </div>
                                <p style={{ fontSize: '0.6875rem', color: '#64748B', margin: '1px 0 0', fontWeight: 500 }}>
                                  •••• {b.account_number ? b.account_number.slice(-4) : '5678'}  •  {b.holder_name || 'Ravi Kumar'}
                                </p>
                              </div>
                            </div>

                            {isSelected ? (
                              <span style={{
                                fontSize: '0.625rem',
                                fontWeight: 800,
                                color: '#059669',
                                background: '#ECFDF5',
                                border: '1px solid #A7F3D0',
                                padding: '1px 6px',
                                borderRadius: '4px'
                              }}>
                                Selected
                              </span>
                            ) : (
                              <ChevronRight style={{ width: '16px', height: '16px', color: '#94A3B8' }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 5. Trust & Speed Strip (Compact Standard Padding) */}
                <div style={{
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: '12px',
                  padding: '0.625rem 0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#DCFCE7', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Zap style={{ width: '13px', height: '13px' }} />
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.75rem', color: '#0F172A', display: 'block', fontWeight: 700 }}>
                        Zero Transfer Fee (Free)
                      </strong>
                      <span style={{ fontSize: '0.625rem', color: '#64748B' }}>
                        Instant IMPS credit to your bank account
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#64748B', textAlign: 'right' }}>
                    <Clock style={{ width: '16px', height: '16px', color: '#059669', flexShrink: 0 }} />
                    <div style={{ lineHeight: 1.2 }}>
                      <span style={{ fontSize: '0.5625rem', color: '#64748B', display: 'block' }}>Usually within</span>
                      <strong style={{ fontSize: '0.6875rem', color: '#0F172A', fontWeight: 700 }}>a few seconds</strong>
                    </div>
                  </div>
                </div>

                {/* 6. Primary Action CTA Button (Standard Mobile Touch Height) */}
                <button
                  type="button"
                  onClick={handleWithdrawSubmit}
                  disabled={isSubmittingWithdraw || parsedAmount <= 0}
                  style={{
                    width: '100%',
                    background: parsedAmount > 0 
                      ? 'linear-gradient(135deg, #0F52BA 0%, #1E3A8A 100%)' 
                      : '#8B95A5',
                    color: '#FFF',
                    border: 'none',
                    padding: '0.8125rem 1rem',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '0.875rem',
                    cursor: parsedAmount > 0 ? 'pointer' : 'not-allowed',
                    boxShadow: parsedAmount > 0 ? '0 4px 14px rgba(15,82,186,0.25)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Send style={{ width: '15px', height: '15px' }} />
                  <span>
                    {isSubmittingWithdraw 
                      ? 'Processing Transfer via IMPS...' 
                      : parsedAmount > 0 
                        ? `Transfer ₹${parsedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} to ${selectedBank?.bank_name || 'Bank'} →` 
                        : 'Enter Amount to Transfer →'}
                  </span>
                </button>

                {/* 7. Recent Bank Transfers & Withdrawals (Compact Standard Proportions) */}
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
                      <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <History style={{ width: '14px', height: '14px' }} />
                      </div>
                      <h4 style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                        Recent Bank Transfers
                      </h4>
                      <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#0F52BA', background: '#EFF6FF', padding: '1px 6px', borderRadius: '6px' }}>
                        {displayWithdrawals.length} Settled
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab('history')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#0F52BA',
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
                    {displayWithdrawals.map((w, idx) => {
                      const isPending = (w.status || '').toUpperCase() === 'PENDING';
                      const isRejected = (w.status || '').toUpperCase() === 'REJECTED';
                      const isApproved = !isPending && !isRejected;

                      const formattedDate = w.created_at 
                        ? new Date(w.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' + new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Recent';

                      return (
                        <div
                          key={w.id || idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.625rem 0.75rem',
                            borderRadius: '10px',
                            background: '#F8FAFC',
                            border: '1px solid #EDF2F7'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                            <BankLogo bankName={w.bank_name || 'Bank'} />
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <strong style={{ fontSize: '0.75rem', color: '#0F172A', fontWeight: 700 }}>
                                  {w.bank_name || 'State Bank of India'}
                                </strong>
                                <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#64748B' }}>
                                  {w.account_number ? (w.account_number.startsWith('••') ? w.account_number : `•••• ${w.account_number.slice(-4)}`) : '•••• 5678'}
                                </span>
                              </div>
                              <span style={{ fontSize: '0.625rem', color: '#94A3B8', display: 'block', marginTop: '1px' }}>
                                ID: {w.id || `WTH-${88210 + idx}`} • {formattedDate}
                              </span>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A' }}>
                              -₹{parseFloat(w.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                            <span style={{
                              display: 'inline-block',
                              fontSize: '0.5625rem',
                              fontWeight: 800,
                              marginTop: '2px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: isApproved ? '#ECFDF5' : isPending ? '#FEF3C7' : '#FEE2E2',
                              color: isApproved ? '#059669' : isPending ? '#D97706' : '#DC2626'
                            }}>
                              {isApproved ? '✓ Settled IMPS' : isPending ? '⏳ Processing' : '✕ Failed'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
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
            <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.875rem', width: '100%', boxSizing: 'border-box', paddingBottom: '1.5rem' }}>
              
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

              {/* 4. Main Payment Form Card */}
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

              {/* 5. Recent Utility Collections Card matching Screenshot exactly */}
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
          )}

          {/* ========================================================= */}
          {/* VIEW 5: DEDICATED "TRANSACTION HISTORY" PAGE               */}
          {/* (SIMPLIFIED DATE FILTER AT TOP & NO NESTED INNER BOX)      */}
          {/* ========================================================= */}
          {activeTab === 'history' && (
            <div style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.875rem', width: '100%', boxSizing: 'border-box', paddingBottom: '1.5rem' }}>
              
              {/* Main Card with Date Filter & Search (No inner box, stretches cleanly to outer border) */}
              <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                
                {/* 1. Date Filter at the TOP (Simplified) */}
                <div style={{ display: 'flex', gap: '0.3125rem', alignItems: 'center' }}>
                  {[
                    { id: 'ALL', label: 'All' },
                    { id: 'TODAY', label: "Today" },
                    { id: 'YESTERDAY', label: 'Yesterday' },
                    { id: 'WEEK', label: '7 Days' },
                    { id: 'CUSTOM', label: 'Custom 📅' }
                  ].map(f => (
                    <button 
                      key={f.id}
                      type="button"
                      onClick={() => setDateFilter(f.id)}
                      style={{
                        flex: f.id === 'YESTERDAY' ? 1.35 : (f.id === 'CUSTOM' ? 1.25 : 1),
                        padding: '0.42rem 0.15rem',
                        fontSize: f.id === 'YESTERDAY' ? '0.65rem' : '0.6875rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        borderRadius: '8px',
                        border: dateFilter === f.id ? '1.5px solid #0F52BA' : '1px solid #CBD5E1',
                        background: dateFilter === f.id ? '#EFF6FF' : '#FFFFFF',
                        color: dateFilter === f.id ? '#0F52BA' : '#475569',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Simplified Custom Date Inputs (Sleek 1-row From - To) */}
                {dateFilter === 'CUSTOM' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#F8FAFC', padding: '0.45rem 0.625rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 600 }}>From:</span>
                      <input 
                        type="date"
                        value={customFromDate}
                        onChange={(e) => setCustomFromDate(e.target.value)}
                        style={{ width: '100%', padding: '0.25rem 0.35rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem', color: '#0F172A', background: '#FFF' }}
                      />
                    </div>
                    <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>→</span>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 600 }}>To:</span>
                      <input 
                        type="date"
                        value={customToDate}
                        onChange={(e) => setCustomToDate(e.target.value)}
                        style={{ width: '100%', padding: '0.25rem 0.35rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem', color: '#0F172A', background: '#FFF' }}
                      />
                    </div>
                    {(customFromDate || customToDate) && (
                      <button 
                        type="button"
                        onClick={() => { setCustomFromDate(''); setCustomToDate(''); }}
                        title="Clear Dates"
                        style={{ background: '#FEE2E2', border: 'none', color: '#DC2626', width: '22px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                      >
                        <X style={{ width: '12px', height: '12px' }} />
                      </button>
                    )}
                  </div>
                )}

                {/* 2. Search Bar below Date Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#F8FAFC', padding: '0.5rem 0.75rem', borderRadius: '10px', border: '1px solid #CBD5E1' }}>
                  <Search style={{ width: '15px', height: '15px', color: '#94A3B8', flexShrink: 0 }} />
                  <input 
                    type="text"
                    placeholder="Search Txn ID, RRN, or Mobile..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '0.8125rem', color: '#0F172A' }}
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 0 }}>
                      <X style={{ width: '14px', height: '14px' }} />
                    </button>
                  )}
                </div>

                {/* 3. Transaction Summary Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.125rem 0.125rem' }}>
                  <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                    Showing <strong>{filteredTransactions.length}</strong> transactions
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F52BA' }}>
                    Total Volume: ₹{filteredTurnoverTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Clean Hairline Divider */}
                <div style={{ height: '1px', background: '#F1F5F9', margin: '0.25rem -0.25rem' }} />

                {/* 4. Transactions List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {filteredTransactions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', background: '#F8FAFC', borderRadius: '10px', border: '1px dashed #CBD5E1' }}>
                      <History style={{ width: '28px', height: '28px', color: '#94A3B8', margin: '0 auto 0.5rem' }} />
                      <h4 style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>No transactions found</h4>
                      <p style={{ fontSize: '0.6875rem', color: '#64748B', margin: '0.25rem 0 0.5rem' }}>
                        Try selecting a different date range or clearing search.
                      </p>
                      <button type="button" onClick={() => { setDateFilter('ALL'); setSearchQuery(''); setCustomFromDate(''); setCustomToDate(''); }} className="btn btn-secondary btn-sm" style={{ fontSize: '0.6875rem', padding: '0.25rem 0.5rem' }}>
                        Reset to All
                      </button>
                    </div>
                  ) : (
                    filteredTransactions.map(t => (
                      <div key={t.id} style={{ padding: '0.625rem 0.75rem', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {t.type === 'BBPS_BILL' ? <Zap style={{ width: '15px', height: '15px' }} /> : <CreditCard style={{ width: '15px', height: '15px' }} />}
                          </div>
                          <div>
                            <strong style={{ fontSize: '0.75rem', color: '#0F172A', display: 'block' }}>{t.notes || 'Card Swipe'}</strong>
                            <span style={{ fontSize: '0.625rem', color: '#64748B', fontFamily: 'monospace' }}>
                              ID: {t.id} • RRN: {t.ref_number || 'N/A'} • {new Date(t.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontSize: '0.875rem', fontWeight: 900, color: '#059669', margin: 0 }}>
                            ₹{parseFloat(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                          <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#059669', background: '#ECFDF5', padding: '1px 6px', borderRadius: '4px' }}>
                            Success
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>

            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW 6: DEDICATED "MY NETWORK & REFERRALS" PAGE           */}
          {/* ========================================================= */}
          {activeTab === 'network' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', width: '100%', boxSizing: 'border-box', paddingBottom: '2rem' }}>
              
              {/* Header Title & Refresh */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
                    My Team &amp; Referral Earnings
                  </h1>
                  <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '2px 0 0' }}>
                    Add your members, see their daily work, and check your profit.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button 
                    onClick={fetchNetworkData}
                    disabled={isLoadingNetwork}
                    style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <RefreshCw style={{ width: '13px', height: '13px', animation: isLoadingNetwork ? 'spin 1s linear infinite' : 'none' }} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* 1. SLIM & COMPACT TOP BANNER: REFERRAL PROFIT FIRST */}
              <div style={{
                position: 'relative',
                background: 'linear-gradient(135deg, #09204A 0%, #0F52BA 55%, #184196 100%)',
                borderRadius: '16px',
                padding: '0.875rem 1.125rem',
                color: '#FFFFFF',
                boxShadow: '0 6px 18px rgba(10,34,82,0.18)',
                overflow: 'hidden'
              }}>
                <div style={{ position: 'relative', zIndex: 2 }}>
                  {/* Top line: Label & Tier */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#93C5FD', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Total Referral Profit
                    </span>
                    <span style={{ fontSize: '0.5625rem', fontWeight: 800, background: 'rgba(255,255,255,0.18)', padding: '2px 7px', borderRadius: '10px' }}>
                      ★ {userRole}
                    </span>
                  </div>

                  {/* Primary Hero Metric: Total Referral Profit */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h2 style={{ fontSize: '1.625rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em', fontFeatureSettings: '"tnum"', lineHeight: 1.1, color: '#FFFFFF' }}>
                      ₹{networkData.total_commission_earned.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </h2>
                    <span style={{ fontSize: '0.625rem', fontWeight: 800, background: '#10B981', color: '#FFFFFF', padding: '3px 8px', borderRadius: '8px' }}>
                      +{parseFloat(userTierMargin) > 0 ? userTierMargin : networkData.commission_rate_pct}% {onboardForm.pos_provider} Profit Margin
                    </span>
                  </div>

                  {/* Compact Bottom Row: 3 metrics */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.375rem',
                    paddingTop: '0.625rem',
                    borderTop: '1px solid rgba(255,255,255,0.15)',
                    textAlign: 'center'
                  }}>
                    <div>
                      <span style={{ color: '#93C5FD', display: 'block', fontSize: '0.5625rem', fontWeight: 700, marginBottom: '1px' }}>
                        Today's Profit
                      </span>
                      <strong style={{ color: '#FCD34D', fontSize: '0.875rem', fontWeight: 800 }}>
                        ₹{networkData.today_network_profit.toFixed(2)}
                      </strong>
                    </div>

                    <div style={{ borderLeft: '1px solid rgba(255,255,255,0.12)', borderRight: '1px solid rgba(255,255,255,0.12)' }}>
                      <span style={{ color: '#93C5FD', display: 'block', fontSize: '0.5625rem', fontWeight: 700, marginBottom: '1px' }}>
                        My Team
                      </span>
                      <strong style={{ color: '#6EE7B7', fontSize: '0.875rem', fontWeight: 800 }}>
                        {networkData.partners.length} Active
                      </strong>
                    </div>

                    <div>
                      <span style={{ color: '#93C5FD', display: 'block', fontSize: '0.5625rem', fontWeight: 700, marginBottom: '1px' }}>
                        Wallet Balance
                      </span>
                      <strong style={{ color: '#FFFFFF', fontSize: '0.875rem', fontWeight: 800 }}>
                        ₹{wallet.available_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notice if Merchant / Retailer is viewing */}
              {(userRole === 'MERCHANT' || userRole === 'Retailer') ? (
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1.5rem 1rem', textAlign: 'center' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                    <Users style={{ width: '22px', height: '22px' }} />
                  </div>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.35rem' }}>
                    Shop Owner Account
                  </h3>
                  <p style={{ fontSize: '0.78rem', color: '#64748B', maxWidth: '440px', margin: '0 auto', lineHeight: 1.5 }}>
                    Shop owners and retailers earn profit on direct customer card swipes and bill payments. To add new members or earn team commission, talk to your Distributor.
                  </p>
                </div>
              ) : (
                <>
                  {/* TWO COLUMN GRID: Add Person (Left) & People List with Inline Transactions (Right) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
                    
                    {/* SECTION 1: ADD NEW PERSON / SHOP */}
                    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1.125rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', height: 'fit-content' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.625rem' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <UserPlus style={{ width: '16px', height: '16px' }} />
                        </div>
                        <div>
                          <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                            Add New Person / Shop
                          </h3>
                          <span style={{ fontSize: '0.625rem', color: '#64748B' }}>
                            Choose account type and enter details
                          </span>
                        </div>
                      </div>

                      {/* Instant Generated Credentials Card */}
                      {createdPartnerCreds && (
                        <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '12px', padding: '0.75rem', marginBottom: '0.875rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#15803D', fontSize: '0.75rem', fontWeight: 800 }}>
                              <CheckCircle2 style={{ width: '15px', height: '15px' }} />
                              <span>Person Added Successfully!</span>
                            </div>
                            <button 
                              onClick={() => setCreatedPartnerCreds(null)}
                              style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '2px' }}
                            >
                              <X style={{ width: '14px', height: '14px' }} />
                            </button>
                          </div>

                          <div style={{ background: '#FFFFFF', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '0.5rem', marginBottom: '0.5rem', fontSize: '0.75rem', lineHeight: 1.5 }}>
                            <div><strong>Name:</strong> {createdPartnerCreds.name}</div>
                            <div><strong>Login ID:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0F52BA' }}>{createdPartnerCreds.id}</span></div>
                            <div><strong>Password:</strong> <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#059669' }}>{createdPartnerCreds.password}</span></div>
                            <div><strong>Type:</strong> <span style={{ fontWeight: 700 }}>{createdPartnerCreds.role}</span></div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              onClick={() => {
                                const text = `Hello ${createdPartnerCreds.name}, your RONAV login details are:\nLogin ID: ${createdPartnerCreds.id}\nPassword: ${createdPartnerCreds.password}\nAccount Type: ${createdPartnerCreds.role}\nLogin here: ${window.location.origin}`;
                                navigator.clipboard.writeText(text);
                                showToast('✓ Login details copied!');
                              }}
                              style={{ flex: 1, background: '#FFFFFF', border: '1px solid #86EFAC', color: '#15803D', borderRadius: '8px', padding: '0.4rem', fontSize: '0.6875rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            >
                              <Copy style={{ width: '12px', height: '12px' }} />
                              <span>Copy Details</span>
                            </button>

                            <a 
                              href={`https://api.whatsapp.com/send?phone=${createdPartnerCreds.mobile}&text=${encodeURIComponent(`Hello ${createdPartnerCreds.name}, your RONAV login details are:\n\nLogin ID: ${createdPartnerCreds.id}\nPassword: ${createdPartnerCreds.password}\nAccount Type: ${createdPartnerCreds.role}\n\nLogin here: ${window.location.origin}`)}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ flex: 1, background: '#25D366', color: '#FFFFFF', borderRadius: '8px', padding: '0.4rem', fontSize: '0.6875rem', fontWeight: 800, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                            >
                              <Share2 style={{ width: '12px', height: '12px' }} />
                              <span>WhatsApp</span>
                            </a>
                          </div>
                        </div>
                      )}

                      <form onSubmit={handleOnboardSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {/* 1. Machine & Settlement Provider Dropdown */}
                        <div>
                          <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <span>Machine &amp; Settlement Provider *</span>
                            <span style={{ fontSize: '0.625rem', color: '#0F52BA', background: '#EFF6FF', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>T+1 Settlement</span>
                          </label>
                          <select 
                            id="pos-provider-select"
                            value={onboardForm.pos_provider} 
                            onChange={(e) => setOnboardForm({ ...onboardForm, pos_provider: e.target.value })}
                            style={{ 
                              width: '100%', 
                              boxSizing: 'border-box', 
                              padding: '0.625rem 0.75rem', 
                              borderRadius: '8px', 
                              border: '1px solid #CBD5E1', 
                              fontSize: '0.8125rem', 
                              fontWeight: 700, 
                              color: '#0F172A', 
                              background: '#FFFFFF',
                              cursor: 'pointer',
                              outline: 'none',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                            }}
                          >
                            <option value="Pine Labs">🌲 Pine Labs (T+1 Settlement • 4 Tiers)</option>
                            <option value="Payswiff">⚡ Payswiff (T+1 Settlement • 5 Tiers)</option>
                          </select>
                          <div style={{ marginTop: '0.35rem', fontSize: '0.625rem', color: '#64748B', lineHeight: 1.4 }}>
                            <span style={{ fontWeight: 700 }}>Chain: </span>
                            {onboardForm.pos_provider === 'Pine Labs' ? (
                              <span style={{ color: '#0F52BA', fontWeight: 700 }}>
                                Master (1.21%) → DIST Franchise (1.41%) → Distributor (1.47%) → Retailer (1.53%)
                              </span>
                            ) : (
                              <span style={{ color: '#D97706', fontWeight: 700 }}>
                                Master (1.40%) → Super Dist (1.42%) → DIST Franchise (1.45%) → Distributor (1.48%) → Retailer (1.53%)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 2. Dynamic Account Type Dropdown */}
                        <div>
                          <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>
                            Account Type *
                          </label>
                          <select 
                            id="account-type-select"
                            value={onboardForm.role} 
                            onChange={(e) => setOnboardForm({ ...onboardForm, role: e.target.value })}
                            style={{ 
                              width: '100%', 
                              boxSizing: 'border-box', 
                              padding: '0.625rem 0.75rem', 
                              borderRadius: '8px', 
                              border: '1px solid #CBD5E1', 
                              fontSize: '0.8125rem', 
                              fontWeight: 700, 
                              color: '#0F172A', 
                              background: '#FFFFFF',
                              cursor: 'pointer',
                              outline: 'none',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                            }}
                          >
                            {allowedRolesForCreator.map(r => (
                              <option key={r.value} value={r.value} style={{ padding: '8px', fontWeight: 600, color: '#0F172A', background: '#FFFFFF' }}>
                                {r.icon} {r.label} ({r.badge})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* 3. Full Name */}
                        <div>
                          <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>
                            Full Name (Person or Shop Name) *
                          </label>
                          <input 
                            type="text" 
                            required
                            placeholder="e.g. Ramesh Kumar"
                            value={onboardForm.name}
                            onChange={(e) => setOnboardForm({ ...onboardForm, name: e.target.value })}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.8125rem' }}
                          />
                        </div>

                        {/* 4. Mobile Number */}
                        <div>
                          <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '0.2rem' }}>
                            Mobile Number *
                          </label>
                          <input 
                            type="tel" 
                            required
                            maxLength="10"
                            placeholder="e.g. 9876543210"
                            value={onboardForm.mobile}
                            onChange={(e) => setOnboardForm({ ...onboardForm, mobile: e.target.value.replace(/\D/g, '') })}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.8125rem' }}
                          />
                        </div>

                        <button 
                          type="submit"
                          disabled={isSubmittingOnboard}
                          style={{
                            marginTop: '0.25rem',
                            background: '#0F52BA',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '0.625rem',
                            fontSize: '0.8125rem',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            boxShadow: '0 3px 10px rgba(15,82,186,0.25)'
                          }}
                        >
                          <PlusCircle style={{ width: '15px', height: '15px' }} />
                          <span>{isSubmittingOnboard ? 'Adding Person...' : '+ Add Person Now →'}</span>
                        </button>
                      </form>
                    </div>

                    {/* SECTION 2: PEOPLE YOU ADDED (MY TEAM) WITH INLINE EXPANDABLE TRANSACTIONS */}
                    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '1.125rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.625rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F0FDF4', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Users style={{ width: '16px', height: '16px' }} />
                          </div>
                          <div>
                            <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                              People You Added (My Team)
                            </h3>
                            <span style={{ fontSize: '0.625rem', color: '#64748B' }}>
                              Tap any person to see their daily work &amp; your profit
                            </span>
                          </div>
                        </div>
                        <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: '12px' }}>
                          {networkData.partners.length} Members
                        </span>
                      </div>

                      {/* People List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '550px', overflowY: 'auto', paddingRight: '2px' }}>
                        {networkData.partners.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#94A3B8' }}>
                            <Users style={{ width: '32px', height: '32px', margin: '0 auto 0.5rem', opacity: 0.5 }} />
                            <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 600 }}>No members added yet</p>
                            <span style={{ fontSize: '0.6875rem' }}>Use the form to add your first shop owner or distributor.</span>
                          </div>
                        ) : (
                          networkData.partners.map((p) => {
                            const isExpanded = expandedPartnerId === p.id;
                            return (
                              <div 
                                key={p.id}
                                style={{
                                  borderRadius: '12px',
                                  border: isExpanded ? '1.5px solid #0F52BA' : '1px solid #E2E8F0',
                                  background: '#FFFFFF',
                                  boxShadow: isExpanded ? '0 4px 14px rgba(15,82,186,0.08)' : 'none',
                                  overflow: 'hidden',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                {/* Person Summary Card (Click to Expand) */}
                                <div 
                                  onClick={() => togglePartnerExpand(p)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '0.75rem',
                                    background: isExpanded ? '#EFF6FF' : '#F8FAFC',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: isExpanded ? '#0F52BA' : '#E2E8F0', color: isExpanded ? '#FFF' : '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem', fontWeight: 800, flexShrink: 0 }}>
                                      {p.name.charAt(0)}
                                    </div>
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                                        <strong style={{ fontSize: '0.8125rem', color: '#0F172A' }}>{p.name}</strong>
                                        <span style={{ fontSize: '0.55rem', fontWeight: 800, color: p.role === 'DISTRICT_DISTRIBUTOR' ? '#7C3AED' : p.role === 'DISTRIBUTOR' ? '#0F52BA' : '#059669', background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '1px 5px', borderRadius: '4px' }}>
                                          {p.role === 'MERCHANT' ? 'Shop Owner' : p.role === 'DISTRIBUTOR' ? 'Distributor' : 'District Head'}
                                        </span>
                                      </div>
                                      <span style={{ fontSize: '0.625rem', color: '#64748B' }}>
                                        ID: {p.id} • Phone: {p.mobile}
                                      </span>
                                    </div>
                                  </div>

                                  <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                                    <div>
                                      <p style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#059669', margin: 0 }}>
                                        +₹{p.commission_earned.toFixed(2)} Profit
                                      </p>
                                      <span style={{ fontSize: '0.5625rem', color: '#64748B' }}>
                                        Sales: ₹{(p.total_volume || 0).toLocaleString('en-IN')}
                                      </span>
                                    </div>
                                    <div style={{ color: isExpanded ? '#0F52BA' : '#94A3B8' }}>
                                      {isExpanded ? <ChevronUp style={{ width: '18px', height: '18px' }} /> : <ChevronDown style={{ width: '18px', height: '18px' }} />}
                                    </div>
                                  </div>
                                </div>

                                {/* EXPANDED INLINE TRANSACTIONS & PROFIT AUDIT */}
                                {isExpanded && (
                                  <div style={{ padding: '0.75rem', background: '#FFFFFF', borderTop: '1px solid #DBEAFE' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem', paddingBottom: '0.5rem', borderBottom: '1px solid #F1F5F9' }}>
                                      <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>
                                        Daily Work &amp; Your Profit
                                      </span>
                                      <span style={{ fontSize: '0.65rem', color: '#64748B' }}>
                                        Profit Rate: <strong style={{ color: '#059669' }}>{networkData.commission_rate_pct}%</strong>
                                      </span>
                                    </div>

                                    {isLoadingPartnerTxns ? (
                                      <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#64748B' }}>
                                        <RefreshCw style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite', margin: '0 auto 0.35rem' }} />
                                        <p style={{ margin: 0, fontSize: '0.75rem' }}>Loading sales &amp; profit...</p>
                                      </div>
                                    ) : partnerTxns.length === 0 ? (
                                      <div style={{ textAlign: 'center', padding: '1.25rem 0.5rem', color: '#94A3B8' }}>
                                        <CreditCard style={{ width: '26px', height: '26px', margin: '0 auto 0.35rem', opacity: 0.5 }} />
                                        <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600 }}>No card swipes or bill payments done yet.</p>
                                        <span style={{ fontSize: '0.625rem' }}>When this shop owner makes a sale, you will see your profit cut right here!</span>
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
                                              padding: '0.5rem 0.625rem',
                                              background: '#F8FAFC',
                                              borderRadius: '8px',
                                              border: '1px solid #E2E8F0'
                                            }}
                                          >
                                            <div>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>
                                                  {t.type === 'BBPS_BILL' ? '⚡ Bill Payment' : '💳 Card Swipe'}
                                                </span>
                                                <span style={{ fontSize: '0.5625rem', color: '#64748B' }}>
                                                  ({t.provider || 'Terminal'})
                                                </span>
                                              </div>
                                              <span style={{ fontSize: '0.625rem', color: '#64748B' }}>
                                                {new Date(t.created_at || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' })}, {new Date(t.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Customer: {t.customer_mobile || 'Walk-in'}
                                              </span>
                                            </div>

                                            <div style={{ textAlign: 'right' }}>
                                              <div style={{ fontSize: '0.6875rem', color: '#475569' }}>
                                                Sale: <strong>₹{parseFloat(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                                              </div>
                                              <div style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#059669' }}>
                                                +₹{t.commission_profit.toFixed(2)} Profit
                                              </div>
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
                    </div>

                  </div>
                </>
              )}

            </div>
          )}

        </div>
      </main>

      {/* 3. Mobile Bottom Navigation Bar (Hidden on Desktop) */}
      <nav className="mobile-bottom-nav" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0.375rem 0 calc(0.375rem + env(safe-area-inset-bottom, 0px))', zIndex: 60, boxShadow: '0 -4px 16px rgba(0,0,0,0.06)' }}>
        <button 
          onClick={() => setActiveTab('home')} 
          style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: activeTab === 'home' ? '#0F52BA' : '#64748B', cursor: 'pointer', fontSize: '0.625rem', fontWeight: 700 }}
        >
          <Home style={{ width: '18px', height: '18px' }} />
          Home
        </button>

        <button 
          onClick={() => setActiveTab('record-sale')} 
          style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: activeTab === 'record-sale' ? '#0F52BA' : '#64748B', cursor: 'pointer', fontSize: '0.625rem', fontWeight: 700 }}
        >
          <CreditCard style={{ width: '18px', height: '18px' }} />
          Record Sale
        </button>

        {/* Center Blue Action Button */}
        <button 
          onClick={() => setActiveTab('record-sale')}
          style={{ marginTop: '-1.25rem', width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, #0F52BA 0%, #083B8A 100%)', color: '#FFFFFF', border: '3px solid #FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 8px 20px rgba(15,82,186,0.4)', flexShrink: 0 }}
          title="Record Card Swipe"
        >
          <Plus style={{ width: '24px', height: '24px' }} />
        </button>

        <button 
          onClick={() => setActiveTab('withdraw')} 
          style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: activeTab === 'withdraw' ? '#059669' : '#64748B', cursor: 'pointer', fontSize: '0.625rem', fontWeight: 700 }}
        >
          <Send style={{ width: '18px', height: '18px' }} />
          Withdraw
        </button>

        {userRole !== 'MERCHANT' && userRole !== 'Retailer' ? (
          <button 
            onClick={() => setActiveTab('network')} 
            style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: activeTab === 'network' ? '#0F52BA' : '#64748B', cursor: 'pointer', fontSize: '0.625rem', fontWeight: 700 }}
          >
            <Users style={{ width: '18px', height: '18px' }} />
            Network
          </button>
        ) : (
          <button 
            onClick={() => setActiveTab('history')} 
            style={{ background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: activeTab === 'history' ? '#0F52BA' : '#64748B', cursor: 'pointer', fontSize: '0.625rem', fontWeight: 700 }}
          >
            <History style={{ width: '18px', height: '18px' }} />
            History
          </button>
        )}
      </nav>

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

        /* Desktop Mode (>= 1024px): Spacious 1180px FinTech Workspace */
        @media (min-width: 1024px) {
          .merchant-container {
            max-width: 1180px !important;
            padding: 0 1.5rem !important;
          }

          .desktop-header-nav {
            display: flex !important;
          }

          .mobile-bottom-nav {
            display: none !important;
          }

          .desktop-split-grid {
            grid-template-columns: 1.1fr 1fr !important;
            gap: 1.25rem !important;
          }

          main {
            padding-bottom: 2.5rem !important;
          }
        }
      `}</style>

    </div>
  );
}
