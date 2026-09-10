import React, { useState, useEffect, useMemo } from 'react';
import { 
  Menu, Bell, ChevronDown, Calendar, ChevronRight, Landmark, 
  Building2, Receipt, CreditCard, Smartphone, Users, AlertCircle, 
  Copy, Search, X, TrendingUp, CheckCircle2, Clock, LogOut, 
  Shield, Activity, PlusCircle, RefreshCw, GitFork, Layers, 
  Store, Briefcase, ShieldCheck, ArrowRight, ArrowLeft,
  Check, Phone, DollarSign, ArrowUpRight, Zap
} from 'lucide-react';
import { 
  getAdminPending, 
  verifyTransaction, 
  getAllUsers, 
  createDownstreamUser, 
  verifyWithdrawal,
  getInquiries,
  getHierarchyTree
} from '../services/api';
import { subscribeToAdminFeed } from '../services/supabase';
import RonavLogo from './RonavLogo';

export default function AdminDashboardPage({ onLogout, onNavigate }) {
  // Navigation View: 'overview' | 'super_distributors' | 'distributors' | 'merchants' | 'payouts'
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [tabLoading, setTabLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [copiedId, setCopiedId] = useState({});

  // Active Person Dossier Drilldown View (When clicking ANY card)
  const [viewingUserDossier, setViewingUserDossier] = useState(null);
  const [dossierHistory, setDossierHistory] = useState([]);

  // Dynamic Data Stores
  const [networkUsers, setNetworkUsers] = useState([]);
  const [hierarchyData, setHierarchyData] = useState(null);
  const [pendingTxns, setPendingTxns] = useState([]);
  const [pendingPayouts, setPendingPayouts] = useState([]);
  const [transactionsLedger, setTransactionsLedger] = useState([]);
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

  // Universal Onboard Partner Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdResultModal, setCreatedResultModal] = useState(null);
  const [onboardForm, setOnboardForm] = useState({
    name: '',
    mobile: '',
    role: 'MERCHANT', // 'SUPER_DISTRIBUTOR' | 'DISTRIBUTOR' | 'MERCHANT' | 'MASTER'
    parent_id: '',
    pos_provider: 'Pine Labs', // 'Pine Labs' | 'Payswiff'
    pos_vendor: 'Rose Navaneetham Enterprises', // 'Rose Navaneetham Enterprises' | 'RONAV Technologies' | 'R.P. Technologies'
    device_plan: 'RENTAL', // 'RENTAL' | 'LIFETIME'
    monthly_rent: '499',
    settlement_type: 'T1' // 'T1' | 'INSTANT'
  });

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

  // Load Fresh Data from Backend
  const fetchAdminData = async () => {
    try {
      const [pendingRes, usersRes, treeRes] = await Promise.all([
        getAdminPending().catch(() => ({ success: false })),
        getAllUsers().catch(() => ({ success: false })),
        getHierarchyTree().catch(() => ({ success: false }))
      ]);

      if (pendingRes && pendingRes.success) {
        setPendingTxns(pendingRes.pendingTransactions || []);
        setPendingPayouts(pendingRes.pendingWithdrawals || []);
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
    const isPine = true;
    setOnboardForm({
      name: '',
      mobile: '',
      role: role,
      parent_id: parentId,
      pos_provider: 'Pine Labs',
      pos_vendor: 'Rose Navaneetham Enterprises',
      device_plan: 'RENTAL',
      monthly_rent: '499',
      settlement_type: 'T1'
    });
    setIsCreateModalOpen(true);
  };

  // Handle Provider Change in Onboard Modal
  const handleProviderChange = (provider) => {
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

  // Submit User Creation
  const handleSubmitOnboard = async (e) => {
    e.preventDefault();
    if (!onboardForm.name.trim() || !onboardForm.mobile.trim()) {
      triggerToast('Please provide both Name and Mobile Number.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        creator_id: 'ADM001',
        parent_id: onboardForm.parent_id || 'ADM001',
        name: onboardForm.name.trim(),
        mobile: onboardForm.mobile.trim(),
        role: onboardForm.role,
        pos_provider: onboardForm.pos_provider,
        pos_vendor: onboardForm.pos_vendor,
        device_plan: onboardForm.device_plan,
        monthly_rent: onboardForm.monthly_rent,
        settlement_type: onboardForm.settlement_type
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
          password: 'Ronav@' + (res.user?.id || '').slice(-4)
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

  // Approve / Reject Payout Action
  const handlePayoutAction = async (id, action, merchantName, amount) => {
    try {
      const res = await verifyWithdrawal(id, action);
      if (res && res.success) {
        triggerToast(
          action === 'APPROVE' 
            ? `✓ Approved payout of ₹${parseFloat(amount).toLocaleString('en-IN')} for ${merchantName}!` 
            : `✕ Rejected withdrawal request.`,
          action === 'APPROVE' ? 'success' : 'info'
        );
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
  const handleTransactionAction = async (id, action, merchantName, amount) => {
    try {
      const res = await verifyTransaction(id, action);
      if (res && res.success) {
        triggerToast(
          action === 'APPROVE' 
            ? `✓ Approved transaction of ₹${parseFloat(amount).toLocaleString('en-IN')} for ${merchantName}!` 
            : `✕ Rejected transaction.`,
          action === 'APPROVE' ? 'success' : 'info'
        );
        fetchAdminData();
      } else {
        triggerToast(res.message || 'Failed to verify transaction', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Connection error verifying transaction', 'error');
    }
  };

  // Process Super Distributors List
  const superDistributorsList = useMemo(() => {
    if (hierarchyData?.tree?.superDistributors) {
      return hierarchyData.tree.superDistributors;
    }
    return networkUsers.filter(u => u.role === 'SUPER_DISTRIBUTOR').map(u => ({
      ...u,
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
    return networkUsers.filter(u => u.role === 'DISTRICT_DISTRIBUTOR' || u.role === 'DIST_FRANCHISE').map(u => ({
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
    return networkUsers.filter(u => u.role === 'DISTRIBUTOR').map(u => ({
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

    // Robust Downline Entity Resolution
    let childDDs = [];
    let childDists = [];
    let childMerchants = [];
    const allRelevantIds = new Set([user.id]);

    if (type === 'SUPER_DISTRIBUTOR') {
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

    if (type === 'SUPER_DISTRIBUTOR') {
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
      profitEarned = totalVol * 0.0006;
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
      district_distributors: childDDs,
      distributors: childDists,
      merchants: childMerchants,
      transactions: userTxns
    });
    window.scrollTo(0, 0);
  };

  // Filtered Lists Based on Active Search Query
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

  // Combined Totals for Metrics
  const totalVolumeDisplay = parseFloat(metrics.totalVolume || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const adminProfitDisplay = parseFloat(metrics.adminNetProfit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });


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

      {/* 2. Mobile-First Clean Header Bar */}
      <header style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0', padding: '0.75rem 1rem', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          
          {/* Left: Brand Identity with Vector TR Monogram Emblem */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <RonavLogo size="small" />
          </div>

          {/* Right: Notification Alerts */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button 
              onClick={() => handleTabSwitch('payouts')}
              style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '6px', color: '#334155', display: 'flex', alignItems: 'center' }}
              title="Payout Requests Queue"
            >
              <Bell style={{ width: '22px', height: '22px' }} />
              {pendingPayouts.length > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  minWidth: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: '#DC2626',
                  color: '#FFF',
                  fontSize: '0.6rem',
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1.5px solid #FFF',
                  padding: '1px'
                }}>
                  {pendingPayouts.length}
                </span>
              )}
            </button>
          </div>

        </div>
      </header>

      {/* 4. Main Executive Workspace */}
      <main style={{ padding: '1rem', flexGrow: 1, paddingBottom: '80px' }}>
        
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
                      background: viewingUserDossier.dossierType === 'SUPER_DISTRIBUTOR' ? '#F3E8FF' : viewingUserDossier.dossierType === 'DISTRIBUTOR' ? '#EFF6FF' : '#ECFDF5',
                      color: viewingUserDossier.dossierType === 'SUPER_DISTRIBUTOR' ? '#7C3AED' : viewingUserDossier.dossierType === 'DISTRIBUTOR' ? '#0F52BA' : '#059669',
                      border: '1px solid currentColor'
                    }}>
                      {viewingUserDossier.dossierType.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: '#D1FAE5', color: '#059669' }}>
                      Active
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.375rem', fontSize: '0.75rem', color: '#64748B', flexWrap: 'wrap' }}>
                    <span><strong>ID:</strong> {viewingUserDossier.id}</span>
                    <span><strong>Mobile:</strong> {viewingUserDossier.mobile}</span>
                    <span><strong>Parent:</strong> {viewingUserDossier.creator_name || viewingUserDossier.parent_sd_name || 'Super Admin'}</span>
                  </div>

                  {/* Hardware & Vendor Information Tags (Exact Client Requirement) */}
                  {viewingUserDossier.dossierType === 'MERCHANT' && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, background: '#F1F5F9', color: '#334155', padding: '3px 8px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                        Machine: {viewingUserDossier.pos_provider || 'Pine Labs'} ({viewingUserDossier.pos_terminal || 'PL-TS'})
                      </span>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, background: '#EFF6FF', color: '#0F52BA', padding: '3px 8px', borderRadius: '6px', border: '1px solid #BFDBFE' }}>
                        Settlement Entity: {viewingUserDossier.pos_vendor || 'Rose Navaneetham Enterprises'}
                      </span>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, background: '#FEF3C7', color: '#B45309', padding: '3px 8px', borderRadius: '6px', border: '1px solid #FDE68A' }}>
                        Plan: {viewingUserDossier.pos_plan === 'LIFETIME' ? 'Lifetime Purchase' : 'Monthly Rental (₹499/mo)'}
                      </span>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, background: '#ECFDF5', color: '#059669', padding: '3px 8px', borderRadius: '6px', border: '1px solid #A7F3D0' }}>
                        Mode: {viewingUserDossier.pos_settlement === 'INSTANT' ? 'Instant Settlement' : 'T+1 Settlement (1.53% MDR)'}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => copyToClipboard(`ID: ${viewingUserDossier.id}\nMobile: ${viewingUserDossier.mobile}`, viewingUserDossier.id)}
                  style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Copy style={{ width: '12px', height: '12px' }} />
                  <span>{copiedId[viewingUserDossier.id] ? 'Copied!' : 'Copy Info'}</span>
                </button>
              </div>

              {/* 3 Financial Summary Cards for this Person */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginTop: '1.25rem' }}>
                <div style={{ background: '#F8FAFC', padding: '0.75rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase' }}>Total Sales / Volume</span>
                  <strong style={{ display: 'block', fontSize: '1.125rem', fontWeight: 900, color: '#0A192F', marginTop: '2px' }}>
                    ₹{viewingUserDossier.totalVol.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>

                <div style={{ background: '#ECFDF5', padding: '0.75rem', borderRadius: '8px', border: '1px solid #A7F3D0' }}>
                  <span style={{ fontSize: '0.625rem', color: '#059669', fontWeight: 800, textTransform: 'uppercase' }}>Admin Profit Earned</span>
                  <strong style={{ display: 'block', fontSize: '1.125rem', fontWeight: 900, color: '#059669', marginTop: '2px' }}>
                    +₹{viewingUserDossier.profitEarned.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>

                <div style={{ background: '#EFF6FF', padding: '0.75rem', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
                  <span style={{ fontSize: '0.625rem', color: '#0F52BA', fontWeight: 800, textTransform: 'uppercase' }}>Wallet Balance</span>
                  <strong style={{ display: 'block', fontSize: '1.125rem', fontWeight: 900, color: '#0F52BA', marginTop: '2px' }}>
                    ₹{parseFloat(viewingUserDossier.available_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>
            </div>

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
                            <span style={{ display: 'block', fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>MID: {m.id} • {m.mobile} • {m.pos_provider || 'Pine Labs'}</span>
                          </div>
                          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#059669' }}>
                              ₹{parseFloat(m.total_sales || 0).toLocaleString('en-IN')}
                            </span>
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
                            <span style={{ display: 'block', fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>MID: {m.id} • {m.mobile}</span>
                          </div>
                          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#059669' }}>
                              ₹{parseFloat(m.total_sales || 0).toLocaleString('en-IN')}
                            </span>
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
                        <span style={{ display: 'block', fontSize: '0.6875rem', color: '#64748B', marginTop: '2px' }}>MID: {m.id} • {m.mobile}</span>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#059669' }}>
                          ₹{parseFloat(m.total_sales || 0).toLocaleString('en-IN')}
                        </span>
                        <ChevronRight style={{ width: '14px', height: '14px', color: '#94A3B8' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chronological Transaction History Log */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '0.875rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
                  Chronological Transaction History ({viewingUserDossier.transactions?.length || 0})
                </h3>
                <span style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 600 }}>Live SQLite Ledger</span>
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

          </div>
        ) : (
          /* STANDARD TABBED SECTIONS (Zero Bloat, Zero Clutter) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* TAB VIEW 1: EXECUTIVE COMMAND DASHBOARD */}
            {activeTab === 'overview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                {/* 4 Core Financial KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                  
                  {/* Card 1: Total Sales */}
                  <div style={{ background: '#FFFFFF', padding: '1rem', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Total Sales</span>
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <TrendingUp style={{ width: '15px', height: '15px' }} />
                      </div>
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0A192F', margin: '6px 0 2px' }}>
                      ₹{totalVolumeDisplay}
                    </h3>
                    <span style={{ fontSize: '0.625rem', color: '#059669', fontWeight: 700 }}>All Shops Combined</span>
                  </div>

                  {/* Card 2: Admin Profit */}
                  <div style={{ background: '#ECFDF5', padding: '1rem', borderRadius: '12px', border: '1px solid #A7F3D0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>Admin Profit</span>
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#D1FAE5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <DollarSign style={{ width: '15px', height: '15px' }} />
                      </div>
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#059669', margin: '6px 0 2px' }}>
                      ₹{adminProfitDisplay}
                    </h3>
                    <span style={{ fontSize: '0.625rem', color: '#047857', fontWeight: 700 }}>Company Earnings</span>
                  </div>

                  {/* Card 3: Pending Payout Requests */}
                  <div 
                    onClick={() => handleTabSwitch('payouts')}
                    style={{ background: '#FFFFFF', padding: '1rem', borderRadius: '12px', border: pendingPayouts.length > 0 ? '1.5px solid #F87171' : '1px solid #E2E8F0', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Pending Payouts</span>
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Landmark style={{ width: '15px', height: '15px' }} />
                      </div>
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: pendingPayouts.length > 0 ? '#DC2626' : '#0A192F', margin: '6px 0 2px' }}>
                      {pendingPayouts.length}
                    </h3>
                    <span style={{ fontSize: '0.625rem', color: '#DC2626', fontWeight: 700 }}>
                      {pendingPayouts.length > 0 ? 'Action Needed' : 'All Cleared'}
                    </span>
                  </div>

                  {/* Card 4: Hardware POS & Device Plans */}
                  <div style={{ background: '#FFFFFF', padding: '1rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
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

                </div>

                {/* 1. NETWORK DIRECTORY (4 TIERS) + QUICK ONBOARD BUTTON */}
                <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
                        Network Hierarchy Directory (4 Tiers)
                      </h3>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#64748B' }}>
                        {superDistributorsList.length + districtDistributorsList.length + distributorsList.length + merchantsList.length} Active Partners in System
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

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.625rem' }}>
                    
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
                    background: pendingPayouts.length > 0 ? '#FEF2F2' : '#F0FDF4',
                    border: pendingPayouts.length > 0 ? '1.5px solid #FCA5A5' : '1px solid #BBF7D0',
                    borderRadius: '10px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow: pendingPayouts.length > 0 ? '0 2px 8px rgba(220, 38, 38, 0.08)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '6px',
                      background: pendingPayouts.length > 0 ? '#DC2626' : '#22C55E',
                      color: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 900
                    }}>
                      {pendingPayouts.length > 0 ? '!' : '✓'}
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.8125rem', color: pendingPayouts.length > 0 ? '#991B1B' : '#166534' }}>
                        {pendingPayouts.length > 0 
                          ? `⚠️ Alert: ${pendingPayouts.length} Merchant Payout(s) Waiting For Approval`
                          : 'Merchant Bank Payouts: All Cleared'}
                      </strong>
                      <span style={{ display: 'block', fontSize: '0.625rem', color: pendingPayouts.length > 0 ? '#B91C1C' : '#15803D' }}>
                        {pendingPayouts.length > 0 
                          ? 'Tap to review withdrawal requests and approve bank transfers'
                          : 'Zero pending withdrawals • All merchant payouts are up to date'}
                      </span>
                    </div>
                  </div>

                  <button
                    style={{
                      background: pendingPayouts.length > 0 ? '#DC2626' : '#FFFFFF',
                      color: pendingPayouts.length > 0 ? '#FFFFFF' : '#15803D',
                      border: pendingPayouts.length > 0 ? 'none' : '1px solid #86EFAC',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.6875rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {pendingPayouts.length > 0 ? `Review (${pendingPayouts.length}) →` : 'History →'}
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

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {pendingTxns.map(tx => (
                        <div key={tx.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #FDE68A', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <strong style={{ fontSize: '0.8125rem', color: '#0A192F', display: 'block' }}>
                              {tx.merchant_name || tx.merchant_id} ({tx.merchant_id})
                            </strong>
                            <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                              {tx.pos_provider || 'POS'} • Ref: {tx.ref_number || tx.id} • {new Date(tx.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ textAlign: 'right' }}>
                              <strong style={{ fontSize: '0.9375rem', fontWeight: 900, color: '#0A192F', display: 'block' }}>
                                ₹{parseFloat(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                              <span style={{ fontSize: '0.625rem', color: '#D97706', fontWeight: 800 }}>
                                PENDING
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.375rem' }}>
                              <button
                                onClick={() => handleTransactionAction(tx.id, 'APPROVE', tx.merchant_name, tx.amount)}
                                style={{ background: '#16A34A', color: '#FFFFFF', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 800, cursor: 'pointer' }}
                              >
                                Approve ✓
                              </button>
                              <button
                                onClick={() => handleTransactionAction(tx.id, 'REJECT', tx.merchant_name, tx.amount)}
                                style={{ background: '#FFFFFF', color: '#DC2626', border: '1px solid #FCA5A5', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 800, cursor: 'pointer' }}
                              >
                                Reject ✕
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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

                          {/* 3 Metric Pills: [Swipe Amount] [Instant Swipes] [Admin Profit] */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.375rem', marginTop: '0.625rem', background: '#F8FAFC', padding: '0.5rem 0.625rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>Swipe Amount</span>
                              <strong style={{ fontSize: '0.8125rem', color: '#0A192F', fontWeight: 900 }}>
                                ₹{sdVol.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                              </strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>Instant Swipes</span>
                              <strong style={{ fontSize: '0.8125rem', color: '#D97706', fontWeight: 900 }}>
                                ₹{Math.round(sdVol * 0.45).toLocaleString('en-IN')}
                              </strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.55rem', color: '#059669', display: 'block', textTransform: 'uppercase', fontWeight: 800 }}>Admin Profit</span>
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
                            <div>
                              <span style={{ fontSize: '0.625rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Total Sales</span>
                              <strong style={{ fontSize: '1rem', fontWeight: 900, color: '#0A192F' }}>
                                ₹{ddVol.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '0.625rem', color: '#059669', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Admin Profit</span>
                              <strong style={{ fontSize: '1rem', fontWeight: 900, color: '#059669' }}>
                                +₹{ddProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
                            <div>
                              <span style={{ fontSize: '0.625rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Total Sales</span>
                              <strong style={{ fontSize: '1rem', fontWeight: 900, color: '#0A192F' }}>
                                ₹{distVol.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '0.625rem', color: '#059669', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Admin Profit</span>
                              <strong style={{ fontSize: '1rem', fontWeight: 900, color: '#059669' }}>
                                +₹{distProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                              <span style={{ fontSize: '0.625rem', color: '#475569', display: 'block', marginTop: '1px' }}>
                                Sponsor: <strong>{m.creator_name || 'Super Admin'}</strong>
                              </span>
                            </div>
                            <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' }}>
                              Wallet: ₹{parseFloat(m.available_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>

                          {/* Machine & Vendor Badges */}
                          <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.6rem', fontWeight: 800, background: '#F1F5F9', color: '#334155', padding: '2px 6px', borderRadius: '4px' }}>
                              {m.pos_provider || 'Pine Labs'} ({m.pos_terminal || 'PL-TS'})
                            </span>
                            <span style={{ fontSize: '0.6rem', fontWeight: 800, background: '#EFF6FF', color: '#0F52BA', padding: '2px 6px', borderRadius: '4px' }}>
                              {m.pos_vendor || 'Rose Navaneetham'}
                            </span>
                            <span style={{ fontSize: '0.6rem', fontWeight: 800, background: '#FEF3C7', color: '#B45309', padding: '2px 6px', borderRadius: '4px' }}>
                              {m.pos_plan === 'LIFETIME' ? 'Lifetime' : 'Rental Plan'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
                            <div>
                              <span style={{ fontSize: '0.625rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Total Sales</span>
                              <strong style={{ fontSize: '1rem', fontWeight: 900, color: '#0A192F' }}>
                                ₹{sales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </strong>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '0.625rem', color: '#059669', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Admin Profit</span>
                              <strong style={{ fontSize: '1rem', fontWeight: 900, color: '#059669' }}>
                                +₹{adminProfit.toFixed(2)}
                              </strong>
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
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

            {/* TAB VIEW 5: DEDICATED PAYOUT APPROVALS QUEUE */}
            {activeTab === 'payouts' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
                    Bank Payout Approvals ({pendingPayouts.length})
                  </h2>
                  <span style={{ fontSize: '0.6875rem', color: '#64748B' }}>
                    Merchants requesting wallet fund transfers to their verified bank accounts
                  </span>
                </div>

                {pendingPayouts.length === 0 ? (
                  <div style={{ padding: '3rem 1rem', textAlign: 'center', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', color: '#059669' }}>
                    <CheckCircle2 style={{ width: '32px', height: '32px', margin: '0 auto 0.5rem', color: '#059669' }} />
                    <strong style={{ fontSize: '1rem', display: 'block' }}>Zero Pending Payouts</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#64748B' }}>All withdrawal requests have been verified and disbursed.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {pendingPayouts.map(p => (
                      <div key={p.id} style={{ background: '#FFFFFF', border: '1.5px solid #FCA5A5', borderRadius: '12px', padding: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <strong style={{ fontSize: '0.9375rem', color: '#0A192F' }}>{p.merchant_name}</strong>
                              <span style={{ fontSize: '0.625rem', fontWeight: 800, background: '#FEE2E2', color: '#DC2626', padding: '2px 6px', borderRadius: '4px' }}>
                                Awaiting Approval
                              </span>
                            </div>
                            <span style={{ fontSize: '0.6875rem', color: '#64748B', display: 'block', marginTop: '2px' }}>
                              MID: {p.merchant_id} • Phone: {p.merchant_mobile || 'Registered Mobile'}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: '#0A192F', fontWeight: 700, display: 'block', marginTop: '4px' }}>
                              Bank: {p.bank_name} • A/C: ••••{p.account_number?.slice(-4) || '••••'} • IFSC: {p.ifsc || 'Verified'}
                            </span>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.625rem', color: '#64748B', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Withdrawal Amount</span>
                            <strong style={{ fontSize: '1.25rem', fontWeight: 900, color: '#DC2626' }}>
                              ₹{parseFloat(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </strong>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #F1F5F9', marginTop: '0.875rem', paddingTop: '0.875rem' }}>
                          <button
                            onClick={() => handlePayoutAction(p.id, 'REJECT', p.merchant_name, p.amount)}
                            style={{ background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1', padding: '0.45rem 0.875rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
                          >
                            ✕ Reject Request
                          </button>
                          <button
                            onClick={() => handlePayoutAction(p.id, 'APPROVE', p.merchant_name, p.amount)}
                            style={{ background: '#059669', color: '#FFF', border: 'none', padding: '0.45rem 1.25rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 900, cursor: 'pointer', boxShadow: '0 2px 6px rgba(5,150,105,0.3)' }}
                          >
                            ✓ Approve & Disburse Payout
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}

          </div>
        )}

      </main>

      {/* 5. Mobile Sticky Bottom Navigation Bar (100% Touch-Friendly - 6 Tiers/Actions) */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#0A192F',
        borderTop: '1px solid #1E293B',
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        padding: '0.4rem 0',
        zIndex: 90
      }}>
        <button 
          onClick={() => handleTabSwitch('overview')} 
          style={{ background: 'none', border: 'none', color: activeTab === 'overview' ? '#38BDF8' : '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
        >
          <Activity style={{ width: '16px', height: '16px' }} />
          <span style={{ fontSize: '0.5rem', fontWeight: 800 }}>Overview</span>
        </button>

        <button 
          onClick={() => handleTabSwitch('super_distributors')} 
          style={{ background: 'none', border: 'none', color: activeTab === 'super_distributors' ? '#38BDF8' : '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
        >
          <GitFork style={{ width: '16px', height: '16px' }} />
          <span style={{ fontSize: '0.5rem', fontWeight: 800 }}>Super Dist</span>
        </button>

        <button 
          onClick={() => handleTabSwitch('district_distributors')} 
          style={{ background: 'none', border: 'none', color: activeTab === 'district_distributors' ? '#38BDF8' : '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
        >
          <Building2 style={{ width: '16px', height: '16px' }} />
          <span style={{ fontSize: '0.5rem', fontWeight: 800 }}>District Dist</span>
        </button>

        <button 
          onClick={() => handleTabSwitch('distributors')} 
          style={{ background: 'none', border: 'none', color: activeTab === 'distributors' ? '#38BDF8' : '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
        >
          <Layers style={{ width: '16px', height: '16px' }} />
          <span style={{ fontSize: '0.5rem', fontWeight: 800 }}>Dist</span>
        </button>

        <button 
          onClick={() => handleTabSwitch('merchants')} 
          style={{ background: 'none', border: 'none', color: activeTab === 'merchants' ? '#38BDF8' : '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
        >
          <Store style={{ width: '16px', height: '16px' }} />
          <span style={{ fontSize: '0.5rem', fontWeight: 800 }}>Merchants</span>
        </button>

        <button 
          onClick={() => handleTabSwitch('payouts')} 
          style={{ position: 'relative', background: 'none', border: 'none', color: activeTab === 'payouts' ? '#38BDF8' : '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' }}
        >
          <Landmark style={{ width: '16px', height: '16px' }} />
          <span style={{ fontSize: '0.5rem', fontWeight: 800 }}>Payouts</span>
          {pendingPayouts.length > 0 && (
            <span style={{
              position: 'absolute',
              top: '-2px',
              right: '12px',
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: '#DC2626'
            }} />
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.375rem' }}>
                  {[
                    { role: 'SUPER_DISTRIBUTOR', label: '⚡ Super Dist', color: '#7C3AED', bg: '#F3E8FF' },
                    { role: 'DISTRICT_DISTRIBUTOR', label: '🏛️ District Dist', color: '#D97706', bg: '#FEF3C7' },
                    { role: 'DISTRIBUTOR', label: '📦 Distributor', color: '#0F52BA', bg: '#EFF6FF' },
                    { role: 'MERCHANT', label: '🏪 Retailer / Shop', color: '#059669', bg: '#ECFDF5' }
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
                    Full Name / Store Name *
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
                    Mobile Number *
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

              {/* Parent Selector for District Distributor */}
              {onboardForm.role === 'DISTRICT_DISTRIBUTOR' && (
                <div>
                  <label style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Assign Parent Super Distributor
                  </label>
                  <select
                    value={onboardForm.parent_id}
                    onChange={(e) => setOnboardForm(prev => ({ ...prev, parent_id: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem' }}
                  >
                    <option value="">-- Direct to Super Admin --</option>
                    {superDistributorsList.map(sd => (
                      <option key={sd.id} value={sd.id}>{sd.name} ({sd.id})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Parent Selector for Distributor */}
              {onboardForm.role === 'DISTRIBUTOR' && (
                <div>
                  <label style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Assign Parent District Distributor / Super Distributor
                  </label>
                  <select
                    value={onboardForm.parent_id}
                    onChange={(e) => setOnboardForm(prev => ({ ...prev, parent_id: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem' }}
                  >
                    <option value="">-- Direct to Super Admin --</option>
                    {districtDistributorsList.length > 0 && (
                      <optgroup label="District Distributors (DIST Franchise)">
                        {districtDistributorsList.map(dd => (
                          <option key={dd.id} value={dd.id}>{dd.name} ({dd.id})</option>
                        ))}
                      </optgroup>
                    )}
                    <optgroup label="Super Distributors">
                      {superDistributorsList.map(sd => (
                        <option key={sd.id} value={sd.id}>{sd.name} ({sd.id})</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}

              {/* Parent Selector for Merchant */}
              {onboardForm.role === 'MERCHANT' && (
                <div>
                  <label style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Assign Parent Distributor
                  </label>
                  <select
                    value={onboardForm.parent_id}
                    onChange={(e) => setOnboardForm(prev => ({ ...prev, parent_id: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem' }}
                  >
                    <option value="">-- Direct to Super Admin --</option>
                    {distributorsList.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.id})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Merchant Hardware & Legal Vendor Configuration (Client Specification) */}
              {onboardForm.role === 'MERCHANT' && (
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  
                  {/* Hardware Provider */}
                  <div>
                    <label style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '4px' }}>
                      POS Hardware Provider
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                      {['Pine Labs', 'Payswiff'].map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handleProviderChange(p)}
                          style={{
                            padding: '0.45rem',
                            fontSize: '0.6875rem',
                            fontWeight: 800,
                            borderRadius: '6px',
                            border: onboardForm.pos_provider === p ? '2px solid #0F52BA' : '1px solid #CBD5E1',
                            background: onboardForm.pos_provider === p ? '#EFF6FF' : '#FFFFFF',
                            color: onboardForm.pos_provider === p ? '#0F52BA' : '#475569',
                            cursor: 'pointer'
                          }}
                        >
                          {p === 'Pine Labs' ? '🌲 Pine Labs' : '⚡ Payswiff'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Vendor Settlement Entity */}
                  <div>
                    <label style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '4px' }}>
                      Settlement Account & Legal Vendor
                    </label>
                    {onboardForm.pos_provider === 'Pine Labs' ? (
                      <div style={{ padding: '0.45rem', background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 700, color: '#0F52BA' }}>
                        Rose Navaneetham Enterprises (Locked for Pine Labs)
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
                            {v === 'RONAV Technologies' ? 'RONAV Tech (V01)' : 'R.P. Tech (V02)'}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Device Plan & Settlement Mode */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '4px' }}>
                        Device Plan
                      </label>
                      <select
                        value={onboardForm.device_plan}
                        onChange={(e) => setOnboardForm(prev => ({ ...prev, device_plan: e.target.value }))}
                        style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.6875rem' }}
                      >
                        <option value="RENTAL">Monthly Rental (₹499/mo)</option>
                        <option value="LIFETIME">Lifetime Purchase</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1E293B', display: 'block', marginBottom: '4px' }}>
                        Settlement Speed
                      </label>
                      <select
                        value={onboardForm.settlement_type}
                        onChange={(e) => setOnboardForm(prev => ({ ...prev, settlement_type: e.target.value }))}
                        style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.6875rem' }}
                      >
                        <option value="T1">T+1 Standard (1.53% MDR)</option>
                        <option value="INSTANT">Instant (+0.30p / 1.83%)</option>
                      </select>
                    </div>
                  </div>

                  {/* Client Math Verification Badge */}
                  <div style={{ padding: '0.375rem 0.5rem', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '6px', fontSize: '0.625rem', color: '#065F46', fontWeight: 700 }}>
                    💡 Configured MDR: {onboardForm.settlement_type === 'INSTANT' && onboardForm.pos_provider === 'Pine Labs' ? '1.83%' : '1.53%'}
                    {onboardForm.pos_provider === 'Payswiff' && onboardForm.settlement_type === 'INSTANT' ? ' + ₹0.30 flat vendor surcharge' : ''}
                  </div>

                </div>
              )}

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
              Partner onboarded into live SQLite hierarchy
            </span>

            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '0.875rem', margin: '1rem 0', textAlign: 'left', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div><strong>Name:</strong> {createdResultModal.name}</div>
              <div><strong>Role:</strong> {createdResultModal.role}</div>
              <div><strong>User ID:</strong> <span style={{ color: '#0F52BA', fontWeight: 800 }}>{createdResultModal.id}</span></div>
              <div><strong>Mobile:</strong> {createdResultModal.mobile}</div>
              <div><strong>Temp Password:</strong> <span style={{ color: '#059669', fontWeight: 800 }}>{createdResultModal.password}</span></div>
              <div><strong>Sponsor:</strong> {createdResultModal.parent_name}</div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  const shareText = `*RONAV Partner Welcome*\nName: ${createdResultModal.name}\nRole: ${createdResultModal.role}\nUser ID: ${createdResultModal.id}\nMobile: ${createdResultModal.mobile}\nPassword: ${createdResultModal.password}\nLogin Portal: http://localhost:3000/`;
                  copyToClipboard(shareText, 'share-creds');
                }}
                style={{ flex: 1, padding: '0.5rem', background: '#059669', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              >
                <Copy style={{ width: '14px', height: '14px' }} />
                <span>Copy WhatsApp Text</span>
              </button>

              <button
                onClick={() => setCreatedResultModal(null)}
                style={{ padding: '0.5rem 1rem', background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Animations */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateY(-12px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

    </div>
  );
}
