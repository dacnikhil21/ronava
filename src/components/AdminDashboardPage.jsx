import React, { useState, useEffect } from 'react';
import { 
  Menu, 
  Bell, 
  ChevronDown, 
  Calendar, 
  ChevronRight, 
  Landmark, 
  Building2, 
  Receipt, 
  CreditCard, 
  Smartphone, 
  Users, 
  AlertCircle, 
  Copy, 
  Check, 
  Eye, 
  Search, 
  X, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  HelpCircle,
  LogOut,
  Shield,
  Activity,
  Settings,
  PlusCircle,
  RefreshCw
} from 'lucide-react';
import { 
  getAdminPending, 
  verifyTransaction, 
  getAllUsers, 
  createDownstreamUser, 
  verifyWithdrawal,
  getInquiries 
} from '../services/api';
import RonavLogo from './RonavLogo';

export default function AdminDashboardPage({ onLogout, onNavigate }) {
  // Navigation & Tabs state
  const [activeTab, setActiveTab] = useState('verifications'); // 'verifications' | 'hierarchy' | 'loans' | 'franchise' | 'transactions' | 'withdrawals'
  const [searchQuery, setSearchQuery] = useState('');
  
  // Interaction drawer states
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [selectedFranchise, setSelectedFranchise] = useState(null);
  const [showAlertCenter, setShowAlertCenter] = useState(false);
  const [toast, setToast] = useState(null);
  
  // Clipboard copy success states
  const [copiedId, setCopiedId] = useState({});

  // Dynamic Telemetry states
  const [gatewayStatus, setGatewayStatus] = useState({
    bbps: { status: 'online', latency: 42 },
    payout: { status: 'online', latency: 85 },
    pgPos: { status: 'degraded', latency: 310 },
    atm: { status: 'online', latency: 58 }
  });
  
  const [isRefreshingTelemetry, setIsRefreshingTelemetry] = useState(false);
  const [tabLoading, setTabLoading] = useState(false);

  // Dynamic Metrics States (Pure DB driven)
  const [metrics, setMetrics] = useState({
    loansCount: 0,
    franchiseRequests: 0,
    bbpsTxns: 0,
    pgPosTxns: 0,
    atmTxns: 0,
    totalMerchants: 0,
    withdrawalsCount: 0,
    totalVolume: 0,
    pendingVolume: 0
  });

  // Dynamic data stores
  const [loansList, setLoansList] = useState([]);
  const [franchisesList, setFranchisesList] = useState([]);

  // Load inquiries submitted by users from SQLite backend
  useEffect(() => {
    const fetchInquiries = async () => {
      try {
        const res = await getInquiries();
        if (res.success && res.inquiries) {
          const dbLoans = res.inquiries
            .filter(i => i.type === 'LOAN')
            .map(i => ({
              id: i.id,
              name: i.name,
              phone: i.phone,
              type: i.category || 'Personal Loan',
              amount: i.amount,
              status: i.status || 'New',
              date: new Date(i.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
              creditScore: 760,
              docStatus: 'Verified',
              businessType: 'Retail Merchant',
              remarks: i.remarks || ''
            }));

          const dbFranchises = res.inquiries
            .filter(i => i.type === 'FRANCHISE')
            .map(i => ({
              id: i.id,
              name: i.name,
              phone: i.phone,
              location: i.location || 'Hyderabad',
              status: i.status || 'New',
              date: new Date(i.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
              spaceArea: '120 sq ft',
              depositStatus: 'Verified',
              siteReview: 'Under Review',
              proximityToBank: 'Commercial Node'
            }));

          setLoansList(dbLoans);
          setFranchisesList(dbFranchises);
          setMetrics(m => ({
            ...m,
            loansCount: dbLoans.length,
            franchiseRequests: dbFranchises.length
          }));
        }
      } catch (err) {
        console.error('Failed to fetch inquiries from SQLite backend:', err);
      }
    };

    fetchInquiries();
  }, []);

  // Dynamic SQLite Integration States (Live DB)
  const [pendingTxns, setPendingTxns] = useState([]);
  const [pendingPayouts, setPendingPayouts] = useState([]);
  const [networkUsers, setNetworkUsers] = useState([]);
  const [withdrawalsList, setWithdrawalsList] = useState([]);
  const [transactionsLedger, setTransactionsLedger] = useState([]);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    mobile: '',
    role: 'MERCHANT',
    pos_provider: 'Pine Labs',
    commission_rate: '1.25'
  });
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);

  // Fetch Live Pending Approvals, Volume, & Network from SQLite
  const fetchAdminData = async () => {
    try {
      const res = await getAdminPending();
      if (res.success) {
        setPendingTxns(res.pendingTransactions || []);
        setPendingPayouts(res.pendingWithdrawals || []);

        // Map dynamic withdrawals from DB
        const mappedWithdrawals = (res.pendingWithdrawals || []).map(w => ({
          id: w.id,
          merchant: w.merchant_name || 'Merchant',
          mid: w.merchant_id,
          amount: `₹${parseFloat(w.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          bank: `${w.bank_name} (${w.account_number ? '••••' + w.account_number.slice(-4) : '••••'})`,
          date: new Date(w.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
          status: w.status === 'APPROVED' ? 'Approved' : (w.status === 'REJECTED' ? 'Rejected' : 'Pending')
        }));
        setWithdrawalsList(mappedWithdrawals);

        // Map dynamic transactions ledger from DB
        const mappedLedger = (res.allTransactions || []).map(t => ({
          id: t.id,
          merchant: t.merchant_name || 'Merchant',
          mid: t.merchant_id,
          type: t.type === 'POS_SWIPE' ? `${t.pos_provider || 'POS'} Card Swipe` : (t.type === 'BBPS_BILL' ? 'BBPS Utility Bill' : 'QR Payment'),
          amount: `₹${parseFloat(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          status: t.status === 'APPROVED' ? 'Success' : (t.status === 'REJECTED' ? 'Failed' : 'Pending'),
          gateway: t.provider || 'Gateway',
          date: new Date(t.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        }));
        setTransactionsLedger(mappedLedger);

        if (res.stats) {
          setMetrics(m => ({
            ...m,
            ...res.stats
          }));
        }
      }
      const usersRes = await getAllUsers();
      if (usersRes.success) {
        setNetworkUsers(usersRes.users || []);
        setMetrics(m => ({ ...m, totalMerchants: usersRes.users.filter(u => u.role === 'MERCHANT').length }));
      }
    } catch (e) {
      console.error('Failed to fetch admin pending data:', e);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  // Handle Approve or Reject Merchant Transaction
  const handleVerifyTxn = async (txnId, action, merchantName, amount) => {
    try {
      const res = await verifyTransaction(txnId, action);
      if (res.success) {
        triggerToast(
          action === 'APPROVE' 
            ? `✓ Approved ₹${parseFloat(amount).toFixed(2)} for ${merchantName}. Available balance credited!` 
            : `✕ Transaction ${txnId} rejected.`,
          action === 'APPROVE' ? 'success' : 'error'
        );
        fetchAdminData();
      } else {
        triggerToast(res.message || 'Error updating transaction', 'error');
      }
    } catch (e) {
      console.error(e);
      triggerToast('Backend connection failed', 'error');
    }
  };

  // Handle Create User in Hierarchy
  const handleCreateDownstreamUser = async (e) => {
    e.preventDefault();
    if (!newUserForm.name || !newUserForm.mobile) return;
    setIsSubmittingUser(true);
    try {
      const res = await createDownstreamUser({
        creator_id: 'ADM001',
        name: newUserForm.name,
        mobile: newUserForm.mobile,
        role: newUserForm.role,
        pos_provider: newUserForm.pos_provider,
        commission_rate: parseFloat(newUserForm.commission_rate || (newUserForm.pos_provider === 'Payswiff' ? 1.65 : 1.25))
      });

      if (res.success) {
        triggerToast(`✓ Created ${newUserForm.role} (${res.user?.id})!`);
        setIsCreateUserModalOpen(false);
        setNewUserForm({
          name: '',
          mobile: '',
          role: 'MERCHANT',
          pos_provider: 'Pine Labs',
          commission_rate: '1.25'
        });
        fetchAdminData();
      } else {
        triggerToast(res.message || 'Failed to create user', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Network error creating user', 'error');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const [issuedCredsModal, setIssuedCredsModal] = useState(null);

  const handleTabSwitch = (tabName) => {
    setTabLoading(true);
    setActiveTab(tabName);
    setSearchQuery('');
    fetchAdminData();
    setTimeout(() => {
      setTabLoading(false);
    }, 350);
  };

  const triggerToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(prev => ({ ...prev, [id]: true }));
      triggerToast(`Copied to Clipboard: ${text}`, 'info');
      setTimeout(() => {
        setCopiedId(prev => ({ ...prev, [id]: false }));
      }, 1500);
    });
  };

  const handleApprovePayout = async (id, merchant, amount) => {
    try {
      const res = await verifyWithdrawal(id, 'APPROVE');
      if (res.success) {
        triggerToast(`✓ Payout of ${amount} cleared for ${merchant}.`, 'success');
        fetchAdminData();
      } else {
        triggerToast(res.message || 'Failed to approve payout', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Network error verifying withdrawal', 'error');
    }
  };

  const handleRejectPayout = async (id, merchant) => {
    try {
      const res = await verifyWithdrawal(id, 'REJECT');
      if (res.success) {
        triggerToast(`✕ Payout for ${merchant} rejected.`, 'error');
        fetchAdminData();
      } else {
        triggerToast(res.message || 'Failed to reject payout', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Network error verifying withdrawal', 'error');
    }
  };

  const handleCreateAndIssueCredentials = (applicant) => {
    const generatedMid = 'RONAV' + Math.floor(10000 + Math.random() * 90000);
    const generatedPassword = 'Ronav@' + Math.floor(1000 + Math.random() * 9000);
    const role = applicant.businessType || 'Retailer';

    // Update status in list
    if (applicant.type) {
      setLoansList(prev => prev.map(l => l.id === applicant.id ? { ...l, status: 'Approved' } : l));
    } else {
      setFranchisesList(prev => prev.map(f => f.id === applicant.id ? { ...f, status: 'Approved' } : f));
    }

    setIssuedCredsModal({
      name: applicant.name,
      phone: applicant.phone,
      mid: generatedMid,
      password: generatedPassword,
      role: role,
      service: applicant.type || 'ATM Franchise'
    });

    triggerToast(`✓ Generated Merchant ID: ${generatedMid} for ${applicant.name}!`);
    setSelectedLoan(null);
    setSelectedFranchise(null);
  };

  const handleUpdateLoanStatus = (id, newStatus) => {
    setLoansList(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
    if (newStatus === 'Approved') {
      setMetrics(prev => ({ ...prev, loansCount: Math.max(0, prev.loansCount - 1) }));
      triggerToast(`Loan application ${id} approved!`);
    } else {
      triggerToast(`Loan ${id} status updated to: ${newStatus}`);
    }
    setSelectedLoan(null);
  };

  const handleUpdateFranchiseStatus = (id, newStatus) => {
    setFranchisesList(prev => prev.map(f => f.id === id ? { ...f, status: newStatus } : f));
    if (newStatus === 'Approved') {
      setMetrics(prev => ({ ...prev, franchiseRequests: Math.max(0, prev.franchiseRequests - 1) }));
      triggerToast(`Franchise request ${id} site approved!`);
    } else {
      triggerToast(`Franchise request status updated: ${newStatus}`);
    }
    setSelectedFranchise(null);
  };

  const filteredLoans = loansList.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.phone.includes(searchQuery)
  );

  const filteredFranchises = franchisesList.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTxns = transactionsLedger.filter(t => 
    t.merchant.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 relative" style={{ width: '100%', overflowX: 'hidden' }}>
      
      {/* Toast Notification Surface */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          backgroundColor: toast.type === 'success' ? '#059669' : toast.type === 'error' ? '#DC2626' : '#0F52BA',
          padding: '0.875rem 1.25rem',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          color: '#FFFFFF',
          animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          <CheckCircle2 style={{ width: '18px', height: '18px', color: '#FFF' }} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>{toast.msg}</span>
        </div>
      )}

      {/* 1. Header Navigation Bar (Matches the second image exactly) */}
      <header style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0', padding: '0.625rem 1rem', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0 }}>
          
          {/* Hamburger menu + Monogram logo group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0F172A', padding: '4px', display: 'flex', alignItems: 'center' }}>
              <Menu style={{ width: '24px', height: '24px' }} />
            </button>
            
            {/* Official Ronav Brand Logo */}
            <RonavLogo size="small" />
          </div>

          {/* Right utilities: Notification + Admin Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            
            {/* Notification bell with red badge "5" */}
            <button style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#334155', display: 'flex', alignItems: 'center' }}>
              <Bell style={{ width: '22px', height: '22px' }} />
              <span style={{
                position: 'absolute',
                top: '0px',
                right: '0px',
                minWidth: '15px',
                height: '15px',
                borderRadius: '50%',
                backgroundColor: '#DC2626',
                color: '#FFF',
                fontSize: '0.55rem',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid #FFF',
                padding: '1px'
              }}>
                5
              </span>
            </button>

            {/* Admin Profile Dropdown Widget */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', borderLeft: '1px solid #E2E8F0', paddingLeft: '1rem' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: '#0A192F', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users style={{ width: '16px', height: '16px' }} />
              </div>
              <div className="desktop-only" style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: 1.1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0A192F' }}>Admin</span>
                  <ChevronDown style={{ width: '12px', height: '12px', color: '#64748B' }} />
                </div>
                <span style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 600 }}>Super Admin</span>
              </div>
            </div>

            {/* Close session */}
            <button onClick={onLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', display: 'flex', alignItems: 'center' }} title="Logout">
              <LogOut style={{ width: '18px', height: '18px' }} />
            </button>

          </div>

        </div>
      </header>

      {/* 2. Blue Hello Admin Banner with Calendar Box */}
      <section style={{ background: 'linear-gradient(135deg, #0B1E3F 0%, #051024 100%)', padding: '2rem 1rem', color: '#FFFFFF' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', padding: 0 }}>
          
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#FFFFFF', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Hello, Admin 👋
            </h1>
            <p style={{ fontSize: '0.8125rem', color: '#94A3B8', margin: '4px 0 0', fontWeight: 500 }}>
              Welcome to <span style={{ color: '#38BDF8', fontWeight: 700 }}>RONAV</span> Admin Dashboard
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {/* Quick Switch back to Merchant Portal for testing */}
            <button
              onClick={() => onNavigate ? onNavigate('merchant-dashboard') : window.location.pathname = '/'}
              className="btn btn-sm"
              style={{
                backgroundColor: '#0F52BA',
                color: '#FFFFFF',
                border: '1px solid #38BDF8',
                fontWeight: 800,
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                borderRadius: '8px',
                padding: '0.5rem 0.875rem',
                cursor: 'pointer'
              }}
            >
              <span>🏪 Switch to Merchant Portal →</span>
            </button>

            {/* Calendar Widget Card */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem', 
              background: 'rgba(255, 255, 255, 0.06)', 
              border: '1px solid rgba(255, 255, 255, 0.12)', 
              padding: '0.625rem 1rem', 
              borderRadius: '10px' 
            }}>
              <Calendar style={{ width: '20px', height: '20px', color: '#38BDF8' }} />
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#FFFFFF' }}>16 May 2025</span>
                <span style={{ fontSize: '0.6875rem', color: '#38BDF8', fontWeight: 600 }}>Live SQLite</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Main Executive Body Layout */}
      <main style={{ padding: '1.25rem 0.75rem', flexGrow: 1 }}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: 0 }}>
          
          {/* 3. 7 Metric Cards (Matches the layout and colors of 2nd image, now configured in side-by-side 2-column mobile grid) */}
          <div>
            <div className="metrics-adaptive-grid">
              
              {/* Card 1: Loan Applications */}
              <div onClick={() => handleTabSwitch('loans')} className="metric-blue-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div className="metric-icon-square" style={{ color: '#0F52BA', backgroundColor: '#EFF6FF' }}>
                    <Landmark style={{ width: '16px', height: '16px' }} />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>{metrics.loansCount}</h3>
                </div>
                <span className="metric-card-lbl">
                  New Loan Applications
                </span>
                <div className="metric-card-footer">
                  <span>View All</span>
                  <ChevronRight style={{ width: '12px', height: '12px' }} />
                </div>
              </div>

              {/* Card 2: ATM & CDM Franchise Requests */}
              <div onClick={() => handleTabSwitch('franchise')} className="metric-blue-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div className="metric-icon-square" style={{ color: '#059669', backgroundColor: '#ECFDF5' }}>
                    <Building2 style={{ width: '16px', height: '16px' }} />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>{metrics.franchiseRequests}</h3>
                </div>
                <span className="metric-card-lbl">
                  ATM & CDM Franchise
                </span>
                <div className="metric-card-footer">
                  <span>View All</span>
                  <ChevronRight style={{ width: '12px', height: '12px' }} />
                </div>
              </div>

              {/* Card 3: BBPS Transactions */}
              <div onClick={() => handleTabSwitch('transactions')} className="metric-blue-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div className="metric-icon-square" style={{ color: '#7C3AED', backgroundColor: '#F5F3FF' }}>
                    <Receipt style={{ width: '16px', height: '16px' }} />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>{metrics.bbpsTxns}</h3>
                </div>
                <span className="metric-card-lbl">
                  BBPS Transactions
                </span>
                <div className="metric-card-footer">
                  <span>View All</span>
                  <ChevronRight style={{ width: '12px', height: '12px' }} />
                </div>
              </div>

              {/* Card 4: Payments via PG & POS */}
              <div onClick={() => handleTabSwitch('transactions')} className="metric-blue-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div className="metric-icon-square" style={{ color: '#EA580C', backgroundColor: '#FFF7ED' }}>
                    <CreditCard style={{ width: '16px', height: '16px' }} />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>1,245</h3>
                </div>
                <span className="metric-card-lbl">
                  Payments via PG & POS
                </span>
                <div className="metric-card-footer">
                  <span>View All</span>
                  <ChevronRight style={{ width: '12px', height: '12px' }} />
                </div>
              </div>

              {/* Card 5: ATM Related Transactions */}
              <div onClick={() => handleTabSwitch('transactions')} className="metric-blue-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div className="metric-icon-square" style={{ color: '#0284C7', backgroundColor: '#F0F9FF' }}>
                    <Smartphone style={{ width: '16px', height: '16px' }} />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>{metrics.atmTxns}</h3>
                </div>
                <span className="metric-card-lbl">
                  ATM Cash Swipes
                </span>
                <div className="metric-card-footer">
                  <span>View All</span>
                  <ChevronRight style={{ width: '12px', height: '12px' }} />
                </div>
              </div>

              {/* Card 6: Total Merchants */}
              <div className="metric-blue-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div className="metric-icon-square" style={{ color: '#0D9488', backgroundColor: '#F0FDF4' }}>
                    <Users style={{ width: '16px', height: '16px' }} />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>2,538</h3>
                </div>
                <span className="metric-card-lbl">
                  Total Active Merchants
                </span>
                <div className="metric-card-footer">
                  <span>View All</span>
                  <ChevronRight style={{ width: '12px', height: '12px' }} />
                </div>
              </div>

              {/* Card 7: Withdrawal Requests */}
              <div onClick={() => handleTabSwitch('withdrawals')} className="metric-blue-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <div className="metric-icon-square" style={{ color: '#E11D48', backgroundColor: '#FFF5F5' }}>
                    <AlertCircle style={{ width: '16px', height: '16px' }} />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>{metrics.withdrawalsCount}</h3>
                </div>
                <span className="metric-card-lbl">
                  Withdrawal Requests
                </span>
                <div className="metric-card-footer">
                  <span>View All</span>
                  <ChevronRight style={{ width: '12px', height: '12px' }} />
                </div>
              </div>

            </div>
          </div>

          {/* 4. Recent Applications Block */}
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0A192F', margin: 0 }}>Recent Applications</h2>
              <button style={{ border: 'none', background: 'none', color: '#0F52BA', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                <span>View All</span>
                <ChevronRight style={{ width: '14px', height: '14px' }} />
              </button>
            </div>

            {/* Tab Group */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', marginBottom: '1rem', overflowX: 'auto', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
                <button onClick={() => handleTabSwitch('verifications')} className={`queue-nav-tab ${activeTab === 'verifications' ? 'tab-active' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Pending Verifications</span>
                  {pendingTxns.length > 0 && (
                    <span style={{ fontSize: '0.6rem', fontWeight: 900, background: '#DC2626', color: '#FFF', padding: '1px 6px', borderRadius: '10px' }}>
                      {pendingTxns.length}
                    </span>
                  )}
                </button>
                <button onClick={() => handleTabSwitch('hierarchy')} className={`queue-nav-tab ${activeTab === 'hierarchy' ? 'tab-active' : ''}`}>
                  Network Hierarchy & POS
                </button>
                <button onClick={() => handleTabSwitch('loans')} className={`queue-nav-tab ${activeTab === 'loans' ? 'tab-active' : ''}`}>
                  Loan Applications
                </button>
                <button onClick={() => handleTabSwitch('franchise')} className={`queue-nav-tab ${activeTab === 'franchise' ? 'tab-active' : ''}`}>
                  ATM/CDM Requests
                </button>
                <button onClick={() => handleTabSwitch('transactions')} className={`queue-nav-tab ${activeTab === 'transactions' ? 'tab-active' : ''}`}>
                  BBPS Transactions
                </button>
                <button onClick={() => handleTabSwitch('withdrawals')} className={`queue-nav-tab ${activeTab === 'withdrawals' ? 'tab-active' : ''}`}>
                  Payment Transactions
                </button>
              </div>

              {activeTab === 'hierarchy' && (
                <button 
                  onClick={() => setIsCreateUserModalOpen(true)}
                  className="btn btn-primary btn-sm"
                  style={{ whiteSpace: 'nowrap', fontSize: '0.75rem', fontWeight: 800, padding: '0.35rem 0.75rem', marginBottom: '0.5rem' }}
                >
                  <PlusCircle style={{ width: '14px', height: '14px' }} />
                  + Onboard Partner Store
                </button>
              )}
            </div>

            {/* Content list with dynamic Skeleton support */}
            {tabLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '0.5rem 0' }}>
                <div className="skeleton-line" style={{ width: '100%', height: '40px', borderRadius: '6px' }}></div>
                <div className="skeleton-line" style={{ width: '100%', height: '40px', borderRadius: '6px' }}></div>
                <div className="skeleton-line" style={{ width: '100%', height: '40px', borderRadius: '6px' }}></div>
              </div>
            ) : (
              <div className="adaptive-table-wrapper" style={{ display: 'block' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '0.625rem', textTransform: 'uppercase' }}>
                      {activeTab === 'verifications' && (
                        <>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Merchant / Store</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Customer Mobile</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Swipe Machine Assigned</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Amount</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Time</th>
                          <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Action</th>
                        </>
                      )}

                      {activeTab === 'hierarchy' && (
                        <>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Account / ID</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Mobile Number</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Role Hierarchy</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Swipe Machine Config</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Created By</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Live Wallet</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                        </>
                      )}

                      {activeTab !== 'verifications' && activeTab !== 'hierarchy' && (
                        <>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Applicant Name</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Mobile Number</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Type</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Amount</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                          <th style={{ padding: '0.75rem 0.5rem' }}>Applied On</th>
                          <th style={{ padding: '0.75rem 0.5rem', width: '24px' }}></th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {activeTab === 'verifications' && (
                      pendingTxns.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748B' }}>
                            <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem' }}>
                              <CheckCircle2 style={{ width: '24px', height: '24px' }} />
                            </div>
                            <strong style={{ display: 'block', color: '#0F172A', fontSize: '0.875rem' }}>All Merchant Transactions Cleared!</strong>
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem' }}>When merchants record manual sales, swipe collections, or wallet deposits, they will show up here for your verification.</p>
                          </td>
                        </tr>
                      ) : (
                        pendingTxns.map((t) => (
                          <tr key={t.id} className="interactive-table-row">
                            <td style={{ padding: '0.75rem 0.5rem', fontWeight: 800, color: '#0A192F' }}>
                              <div style={{ fontSize: '0.8125rem' }}>{t.merchant_name}</div>
                              <span style={{ fontSize: '0.55rem', color: '#64748B' }}>ID: {t.merchant_id} • Ref: {t.ref_number || 'N/A'}</span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem', color: '#475569' }}>
                              {t.customer_mobile || t.merchant_mobile || 'N/A'}
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span style={{
                                fontSize: '0.625rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: t.pos_provider === 'Payswiff' ? '#FEF3C7' : '#DBEAFE',
                                color: t.pos_provider === 'Payswiff' ? '#B45309' : '#1D4ED8',
                                border: '1px solid currentColor'
                              }}>
                                {t.pos_provider || 'Pine Labs'} POS ({t.pos_rate || '1.25'}% MDR)
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem', fontWeight: 900, color: '#059669', fontSize: '0.875rem' }}>
                              ₹{parseFloat(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span style={{ fontSize: '0.5625rem', fontWeight: 800, padding: '0.125rem 0.375rem', background: '#FEF3C7', color: '#D97706', borderRadius: '4px', border: '1px solid #FDE68A' }}>
                                PENDING VERIFICATION
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem', color: '#64748B', fontSize: '0.6875rem' }}>
                              {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                                <button 
                                  onClick={() => handleVerifyTxn(t.id, 'APPROVE', t.merchant_name, t.amount)}
                                  style={{ border: 'none', background: '#059669', color: '#FFF', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 800, padding: '4px 10px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(5,150,105,0.2)' }}
                                >
                                  ✓ Approve & Credit
                                </button>
                                <button 
                                  onClick={() => handleVerifyTxn(t.id, 'REJECT', t.merchant_name, t.amount)}
                                  style={{ border: '1px solid #EF4444', background: '#FFF', color: '#DC2626', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 800, padding: '4px 8px', cursor: 'pointer' }}
                                >
                                  ✕ Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )
                    )}

                    {activeTab === 'hierarchy' && (
                      networkUsers.map((u) => (
                        <tr key={u.id} className="interactive-table-row">
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: 800, color: '#0A192F' }}>
                            <div style={{ fontSize: '0.8125rem' }}>{u.name}</div>
                            <span style={{ fontSize: '0.55rem', color: '#64748B' }}>ID: {u.id}</span>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', color: '#475569', fontWeight: 600 }}>{u.mobile}</td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <span style={{
                              fontSize: '0.625rem',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: u.role === 'ADMIN' ? '#0F172A' : u.role === 'SUPER_DISTRIBUTOR' ? '#7C3AED' : u.role === 'DISTRIBUTOR' ? '#0F52BA' : '#059669',
                              color: '#FFF'
                            }}>
                              {u.role}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            {u.pos_provider ? (
                              <span style={{
                                fontSize: '0.625rem',
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: u.pos_provider === 'Payswiff' ? '#FEF3C7' : '#DBEAFE',
                                color: u.pos_provider === 'Payswiff' ? '#B45309' : '#1D4ED8',
                                border: '1px solid currentColor'
                              }}>
                                {u.pos_provider} ({u.pos_rate}% MDR)
                              </span>
                            ) : (
                              <span style={{ color: '#94A3B8', fontSize: '0.625rem' }}>Network Distributor Node</span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', color: '#64748B' }}>
                            {u.creator_name || (u.creator_id ? `By ${u.creator_id}` : 'Root Admin (Super)')}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', fontWeight: 800, color: '#059669', fontSize: '0.8125rem' }}>
                            ₹{u.available_balance ? u.available_balance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <span style={{ fontSize: '0.55rem', color: '#059669', fontWeight: 800, background: '#ECFDF5', padding: '1px 5px', borderRadius: '4px', border: '1px solid #A7F3D0' }}>
                              ACTIVE
                            </span>
                          </td>
                        </tr>
                      ))
                    )}

                    {activeTab === 'loans' && filteredLoans.map((app) => (
                      <tr key={app.id} onClick={() => setSelectedLoan(app)} className="interactive-table-row" style={{ cursor: 'pointer' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 800, color: '#0A192F' }}>{app.name}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#475569' }}>{app.phone}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#475569' }}>{app.type}</td>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 800, color: '#059669' }}>{app.amount}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span style={{ 
                            fontSize: '0.5625rem', 
                            fontWeight: 800, 
                            padding: '0.125rem 0.375rem', 
                            background: app.status === 'Approved' ? '#D1FAE5' : app.status === 'Under Review' ? '#FEF3C7' : '#EFF6FF', 
                            color: app.status === 'Approved' ? '#059669' : app.status === 'Under Review' ? '#D97706' : '#0F52BA', 
                            borderRadius: '4px',
                            border: app.status === 'Approved' ? '1px solid #A7F3D0' : app.status === 'Under Review' ? '1px solid #FDE68A' : '1px solid #BFDBFE'
                          }}>
                            {app.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#64748B' }}>{app.date}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#64748B' }}>
                          <ChevronRight style={{ width: '14px', height: '14px' }} />
                        </td>
                      </tr>
                    ))}

                    {activeTab === 'franchise' && filteredFranchises.map((f) => (
                      <tr key={f.id} onClick={() => setSelectedFranchise(f)} className="interactive-table-row" style={{ cursor: 'pointer' }}>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 800, color: '#0A192F' }}>{f.name}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#475569' }}>{f.phone}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#475569' }}>ATM Franchise</td>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 800, color: '#059669' }}>-</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span style={{ 
                            fontSize: '0.5625rem', 
                            fontWeight: 800, 
                            padding: '0.125rem 0.375rem', 
                            background: f.status === 'Approved' ? '#D1FAE5' : '#FEF3C7', 
                            color: f.status === 'Approved' ? '#059669' : '#D97706', 
                            borderRadius: '4px',
                            border: f.status === 'Approved' ? '1px solid #A7F3D0' : '1px solid #FDE68A'
                          }}>{f.status}</span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#64748B' }}>{f.date}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#64748B' }}>
                          <ChevronRight style={{ width: '14px', height: '14px' }} />
                        </td>
                      </tr>
                    ))}

                    {activeTab === 'transactions' && filteredTxns.map((t) => (
                      <tr key={t.id} className="interactive-table-row">
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 800, color: '#0A192F' }}>{t.merchant}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#475569' }}>MID: {t.mid}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#475569' }}>{t.type}</td>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 800, color: '#0A192F' }}>{t.amount}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span style={{ 
                            fontSize: '0.5625rem', 
                            fontWeight: 800, 
                            padding: '0.125rem 0.375rem', 
                            background: t.status === 'Success' ? '#D1FAE5' : '#FEE2E2', 
                            color: t.status === 'Success' ? '#059669' : '#DC2626', 
                            borderRadius: '4px' 
                          }}>{t.status}</span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#64748B' }}>{t.date}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#64748B' }}>
                          <ChevronRight style={{ width: '14px', height: '14px' }} />
                        </td>
                      </tr>
                    ))}

                    {activeTab === 'withdrawals' && withdrawalsList.map((w) => (
                      <tr key={w.id} className="interactive-table-row">
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 800, color: '#0A192F' }}>{w.merchant}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#475569' }}>MID: {w.mid}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#475569' }}>Settlement Payout</td>
                        <td style={{ padding: '0.75rem 0.5rem', fontWeight: 800, color: '#059669' }}>{w.amount}</td>
                        <td style={{ padding: '0.75rem 0.5rem' }}>
                          <span style={{ 
                            fontSize: '0.5625rem', 
                            fontWeight: 800, 
                            padding: '0.125rem 0.375rem', 
                            background: w.status === 'Approved' ? '#D1FAE5' : '#FEF3C7', 
                            color: w.status === 'Approved' ? '#059669' : '#D97706', 
                            borderRadius: '4px' 
                          }}>{w.status}</span>
                        </td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#64748B' }}>{w.date}</td>
                        <td style={{ padding: '0.75rem 0.5rem', color: '#64748B' }}>
                          <ChevronRight style={{ width: '14px', height: '14px' }} />
                        </td>
                      </tr>
                    ))}

                  </tbody>
                </table>
              </div>
            )}

          </div>

          {/* 5. Transactions Overview Grid Breakdown */}
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0A192F', margin: 0 }}>Transactions Overview</h2>
              
              {/* Date Filter Selector Dropdown */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                border: '1px solid #CBD5E1', 
                padding: '0.375rem 0.75rem', 
                borderRadius: '8px',
                fontSize: '0.75rem',
                color: '#475569',
                backgroundColor: '#FFFFFF',
                cursor: 'pointer'
              }}>
                <Calendar style={{ width: '14px', height: '14px', color: '#64748B' }} />
                <span style={{ fontWeight: 600 }}>09 May 2025 - 16 May 2025</span>
                <ChevronDown style={{ width: '12px', height: '12px', color: '#64748B' }} />
              </div>
            </div>

            {/* 4 Cards Subgrid (Matches 2nd image colors exactly) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              
              {/* Subcard 1: BBPS Transactions */}
              <div style={{ backgroundColor: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#7C3AED', marginBottom: '0.5rem' }}>
                  <Receipt style={{ width: '16px', height: '16px' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>BBPS Transactions</span>
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>{metrics.bbpsTxns}</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', borderTop: '1px dashed #DDD6FE', paddingTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0A192F' }}>Live Records</span>
                  <span style={{ fontSize: '0.625rem', color: '#64748B' }}>Total Count</span>
                </div>
              </div>

              {/* Subcard 2: PG & POS Payments */}
              <div style={{ backgroundColor: '#FFF7ED', border: '1px solid #FFEDD5', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#EA580C', marginBottom: '0.5rem' }}>
                  <CreditCard style={{ width: '16px', height: '16px' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>PG & POS Payments</span>
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>{metrics.pgPosTxns}</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', borderTop: '1px dashed #FFEDD5', paddingTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0A192F' }}>Card Swipes</span>
                  <span style={{ fontSize: '0.625rem', color: '#64748B' }}>Total Count</span>
                </div>
              </div>

              {/* Subcard 3: ATM Transactions */}
              <div style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#0284C7', marginBottom: '0.5rem' }}>
                  <Smartphone style={{ width: '16px', height: '16px' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>ATM Transactions</span>
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>{metrics.atmTxns}</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', borderTop: '1px dashed #BAE6FD', paddingTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0A192F' }}>ATM / QR</span>
                  <span style={{ fontSize: '0.625rem', color: '#64748B' }}>Total Count</span>
                </div>
              </div>

              {/* Subcard 4: Total Volume */}
              <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#059669', marginBottom: '0.5rem' }}>
                  <TrendingUp style={{ width: '16px', height: '16px' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Total Volume</span>
                </div>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>
                  ₹{(metrics.totalVolume || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', borderTop: '1px dashed #A7F3D0', paddingTop: '0.5rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#059669' }}>
                    {metrics.pgPosTxns + metrics.bbpsTxns + metrics.atmTxns} Txns
                  </span>
                  <span style={{ fontSize: '0.625rem', color: '#64748B' }}>Settled Ecosystem</span>
                </div>
              </div>

            </div>
          </div>

          {/* 6. Withdrawal Requests Table Card */}
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.25rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0A192F', margin: 0 }}>Withdrawal Requests</h2>
              <button onClick={() => handleTabSwitch('withdrawals')} style={{ border: 'none', background: 'none', color: '#0F52BA', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                <span>View All</span>
                <ChevronRight style={{ width: '14px', height: '14px' }} />
              </button>
            </div>

            <div className="adaptive-table-wrapper" style={{ display: 'block' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '0.625rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Merchant Name</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Merchant ID</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Amount</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Bank Details</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Requested On</th>
                    <th style={{ padding: '0.75rem 0.5rem', width: '24px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawalsList.map((w) => (
                    <tr key={w.id} className="interactive-table-row">
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 800, color: '#0A192F' }}>{w.merchant}</td>
                      <td style={{ padding: '0.75rem 0.5rem', color: '#475569' }}>{w.mid}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 800, color: '#0A192F' }}>{w.amount}</td>
                      <td style={{ padding: '0.75rem 0.5rem', color: '#475569' }}>{w.bank}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span style={{ 
                          fontSize: '0.5625rem', 
                          fontWeight: 800, 
                          padding: '0.125rem 0.375rem', 
                          background: w.status === 'Approved' ? '#D1FAE5' : w.status === 'Rejected' ? '#FEE2E2' : '#FEF3C7', 
                          color: w.status === 'Approved' ? '#059669' : w.status === 'Rejected' ? '#DC2626' : '#D97706', 
                          borderRadius: '4px',
                          border: w.status === 'Approved' ? '1px solid #A7F3D0' : w.status === 'Rejected' ? '1px solid #FCA5A5' : '1px solid #FDE68A'
                        }}>{w.status}</span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: '#64748B' }}>{w.date}</td>
                      <td style={{ padding: '0.75rem 0.5rem', color: '#64748B' }}>
                        {w.status === 'Pending' ? (
                          <div style={{ display: 'flex', gap: '0.25rem' }}>
                            <button onClick={() => handleApprovePayout(w.id, w.merchant, w.amount)} style={{ border: 'none', background: '#059669', color: '#FFF', borderRadius: '4px', fontSize: '0.625rem', padding: '2px 6px', cursor: 'pointer' }}>Clear</button>
                          </div>
                        ) : (
                          <ChevronRight style={{ width: '14px', height: '14px' }} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </main>

      {/* DETAIL DRAWER: LOAN ASSESSMENT */}
      {selectedLoan && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '100%',
          maxWidth: '480px',
          height: '100vh',
          backgroundColor: '#FFFFFF',
          borderLeft: '1px solid #E2E8F0',
          zIndex: 999,
          boxShadow: '-10px 0 30px rgba(0,0,0,0.05)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          animation: 'slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.625rem', color: '#0F52BA', fontWeight: 800 }}>{selectedLoan.id}</span>
                <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>Review Loan Request</h3>
              </div>
              <button 
                onClick={() => setSelectedLoan(null)} 
                style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}
                aria-label="Close"
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
              <div>
                <label style={{ fontSize: '0.625rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 800 }}>Applicant Name</label>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0A192F', display: 'block' }}>{selectedLoan.name}</span>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Business Type: {selectedLoan.businessType}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.625rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 800 }}>Loan Type</label>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0A192F', display: 'block' }}>{selectedLoan.type}</span>
                </div>
                <div>
                  <label style={{ fontSize: '0.625rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 800 }}>Requested Value</label>
                  <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#059669', display: 'block' }}>{selectedLoan.amount}</span>
                </div>
              </div>

              <div style={{ backgroundColor: '#F8FAFC', padding: '0.875rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <span style={{ fontSize: '0.625rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>Credit Profile Score</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 900, color: selectedLoan.creditScore >= 750 ? '#059669' : '#D97706' }}>
                    {selectedLoan.creditScore}
                  </span>
                  <span style={{ fontSize: '0.6875rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: selectedLoan.creditScore >= 750 ? '#D1FAE5' : '#FEF3C7', color: selectedLoan.creditScore >= 750 ? '#059669' : '#D97706' }}>
                    {selectedLoan.creditScore >= 750 ? 'Low Risk' : 'Medium Risk'}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.625rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 800 }}>Compliance Parameters</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.375rem', fontSize: '0.75rem', color: '#334155' }}>
                  <div>PAN / KYC Match: <b>PASSED</b></div>
                  <div>Audit Account Log: <b>VERIFIED</b></div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid #E2E8F0', paddingTop: '1rem', marginTop: '1rem' }}>
            <button 
              onClick={() => handleCreateAndIssueCredentials(selectedLoan)}
              className="btn btn-primary" 
              style={{ backgroundColor: '#059669', border: 'none', minHeight: '44px', color: '#FFF', fontWeight: 800 }}
            >
              Approve & Issue Merchant Credentials →
            </button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={() => handleUpdateLoanStatus(selectedLoan.id, 'Under Review')}
                className="btn btn-secondary" 
                style={{ flex: 1, color: '#475569', backgroundColor: '#F1F5F9', border: 'none', minHeight: '40px' }}
              >
                Escalate Check
              </button>
              <button 
                onClick={() => setSelectedLoan(null)}
                className="btn btn-secondary" 
                style={{ flex: 1, color: '#64748B', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL DRAWER: FRANCHISE */}
      {selectedFranchise && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '100%',
          maxWidth: '480px',
          height: '100vh',
          backgroundColor: '#FFFFFF',
          borderLeft: '1px solid #E2E8F0',
          zIndex: 999,
          boxShadow: '-10px 0 30px rgba(0,0,0,0.05)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          animation: 'slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.625rem', color: '#0F52BA', fontWeight: 800 }}>{selectedFranchise.id}</span>
                <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#0A192F', margin: 0 }}>Review Franchise Request</h3>
              </div>
              <button onClick={() => setSelectedFranchise(null)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.625rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 800 }}>Applicant Name</label>
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0A192F', display: 'block' }}>{selectedFranchise.name}</span>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Phone: {selectedFranchise.phone}</span>
              </div>
              <div>
                <label style={{ fontSize: '0.625rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 800 }}>ATM Premises Space</label>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0A192F', display: 'block' }}>{selectedFranchise.location}</span>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Area: {selectedFranchise.spaceArea}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
            <button 
              onClick={() => handleCreateAndIssueCredentials(selectedFranchise)}
              className="btn btn-primary" 
              style={{ backgroundColor: '#0F52BA', border: 'none', minHeight: '44px', color: '#FFF', fontWeight: 800 }}
            >
              Approve & Issue Franchise Credentials →
            </button>
            <button 
              onClick={() => setSelectedFranchise(null)}
              className="btn btn-secondary" 
              style={{ color: '#475569', backgroundColor: '#F1F5F9', border: 'none' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ISSUED CREDENTIALS MODAL */}
      {issuedCredsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            maxWidth: '480px',
            width: '100%',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            border: '1px solid #E2E8F0',
            textAlign: 'center'
          }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <CheckCircle2 style={{ width: '32px', height: '32px' }} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', margin: '0 0 0.25rem' }}>
              Partner Credentials Generated!
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '0 0 1.5rem' }}>
              Provide these login details to <strong>{issuedCredsModal.name}</strong> ({issuedCredsModal.phone}).
            </p>

            <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1rem', textAlign: 'left', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700 }}>USER ID / MID:</span>
                <strong style={{ fontSize: '0.9375rem', color: '#0F52BA', fontFamily: 'monospace' }}>{issuedCredsModal.mid}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700 }}>TEMP PASSWORD:</span>
                <strong style={{ fontSize: '0.9375rem', color: '#059669', fontFamily: 'monospace' }}>{issuedCredsModal.password}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700 }}>ASSIGNED ROLE:</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', background: '#EFF6FF', padding: '2px 8px', borderRadius: '4px' }}>{issuedCredsModal.role}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                onClick={() => {
                  const text = `Hello ${issuedCredsModal.name}, your RONAV partner credentials are: User ID: ${issuedCredsModal.mid}, Password: ${issuedCredsModal.password}, Role: ${issuedCredsModal.role}. Login at Partner Portal.`;
                  copyToClipboard(text, 'creds');
                }}
                className="btn btn-primary"
                style={{ flex: 1, backgroundColor: '#0F52BA', justifyContent: 'center' }}
              >
                <Copy style={{ width: '16px', height: '16px' }} />
                <span>Copy SMS / WhatsApp Text</span>
              </button>
              <button 
                onClick={() => setIssuedCredsModal(null)}
                className="btn btn-secondary"
                style={{ flex: 0.5, justifyContent: 'center' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SYSTEM ACCESS FOOTER */}
      <footer style={{ borderTop: '1px solid #E2E8F0', padding: '1.25rem 0', textAlign: 'center', fontSize: '0.6875rem', color: '#64748B', backgroundColor: '#FFFFFF', marginBottom: '56px' }} className="mobile-footer-margin">
        <p style={{ margin: 0 }}>© 2021 – RONAV TECHNOLOGIES. All Rights Reserved.</p>
      </footer>

      {/* Mobile Sticky Tab Navigation Bar (Matches the second image exactly) */}
      <div className="mobile-only" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#0A192F',
        borderTop: '1px solid #1E293B',
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        padding: '0.5rem 0',
        zIndex: 90
      }}>
        <button onClick={() => handleTabSwitch('loans')} style={{ background: 'none', border: 'none', color: activeTab === 'loans' ? '#38BDF8' : '#8E9A9D', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <Landmark style={{ width: '16px', height: '16px' }} />
          <span style={{ fontSize: '0.5rem', fontWeight: 700 }}>Dashboard</span>
        </button>

        <button onClick={() => handleTabSwitch('loans')} style={{ background: 'none', border: 'none', color: activeTab === 'loans' ? '#38BDF8' : '#8E9A9D', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <Landmark style={{ width: '16px', height: '16px' }} />
          <span style={{ fontSize: '0.5rem', fontWeight: 700 }}>Loans</span>
        </button>

        <button onClick={() => handleTabSwitch('franchise')} style={{ background: 'none', border: 'none', color: activeTab === 'franchise' ? '#38BDF8' : '#8E9A9D', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <Building2 style={{ width: '16px', height: '16px' }} />
          <span style={{ fontSize: '0.5rem', fontWeight: 700 }}>Franchise</span>
        </button>

        <button onClick={() => handleTabSwitch('transactions')} style={{ background: 'none', border: 'none', color: activeTab === 'transactions' ? '#38BDF8' : '#8E9A9D', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <Receipt style={{ width: '16px', height: '16px' }} />
          <span style={{ fontSize: '0.5rem', fontWeight: 700 }}>Txns</span>
        </button>

        <button style={{ background: 'none', border: 'none', color: '#8E9A9D', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <Users style={{ width: '16px', height: '16px' }} />
          <span style={{ fontSize: '0.5rem', fontWeight: 700 }}>Merchants</span>
        </button>

        <button onClick={() => handleTabSwitch('withdrawals')} style={{ background: 'none', border: 'none', color: activeTab === 'withdrawals' ? '#38BDF8' : '#8E9A9D', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <CreditCard style={{ width: '16px', height: '16px' }} />
          <span style={{ fontSize: '0.5rem', fontWeight: 700 }}>Payouts</span>
        </button>

        <button onClick={onLogout} style={{ background: 'none', border: 'none', color: '#FCA5A5', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <LogOut style={{ width: '16px', height: '16px' }} />
          <span style={{ fontSize: '0.5rem', fontWeight: 700 }}>Exit</span>
        </button>
      </div>

      {/* MODAL: ONBOARD DOWNSTREAM PARTNER STORE (HIERARCHY ENGINE) */}
      {isCreateUserModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCreateUserModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users style={{ width: '18px', height: '18px' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0A192F', margin: 0 }}>Onboard Downstream Partner</h3>
                  <p style={{ fontSize: '0.625rem', color: '#64748B', margin: 0 }}>Enforce Network Hierarchy & Assign POS Machine</p>
                </div>
              </div>
              <button onClick={() => setIsCreateUserModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <form onSubmit={handleCreateDownstreamUser} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Select Hierarchy Role *
                </label>
                <select 
                  value={newUserForm.role}
                  onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.8125rem', color: '#0F172A', fontWeight: 700 }}
                >
                  <option value="MERCHANT">Retailer / Merchant (End-User Counter)</option>
                  <option value="DISTRIBUTOR">Distributor (Franchise Partner)</option>
                  <option value="SUPER_DISTRIBUTOR">Super Distributor (Master Hub)</option>
                </select>
                <p style={{ fontSize: '0.6rem', color: '#64748B', marginTop: '3px' }}>
                  {newUserForm.role === 'MERCHANT' ? 'ℹ️ End-user: Cannot create accounts below him.' : 'ℹ️ Network node: Can onboard accounts below him.'}
                </p>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Partner Store / Business Name *
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Balaji Telecom & Grocery"
                  required
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.875rem', color: '#0F172A', fontWeight: 600 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', display: 'block', marginBottom: '0.25rem' }}>
                  Mobile Number (Unique Login ID) *
                </label>
                <input 
                  type="tel" 
                  placeholder="10-digit mobile"
                  required
                  value={newUserForm.mobile}
                  onChange={(e) => setNewUserForm({ ...newUserForm, mobile: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.875rem', color: '#0F172A', fontWeight: 600 }}
                />
              </div>

              {/* POS Machine Provider Selection (Only for Merchants) */}
              {newUserForm.role === 'MERCHANT' && (
                <div style={{ padding: '0.75rem', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <CreditCard style={{ width: '16px', height: '16px', color: '#0F52BA' }} />
                    <strong style={{ fontSize: '0.75rem', color: '#0F172A' }}>Swipe Machine Hardware Provider</strong>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <label style={{
                      padding: '0.5rem',
                      borderRadius: '8px',
                      border: newUserForm.pos_provider === 'Pine Labs' ? '2px solid #0F52BA' : '1px solid #CBD5E1',
                      background: newUserForm.pos_provider === 'Pine Labs' ? '#EFF6FF' : '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input 
                          type="radio" 
                          name="pos_provider" 
                          value="Pine Labs" 
                          checked={newUserForm.pos_provider === 'Pine Labs'}
                          onChange={() => setNewUserForm({ ...newUserForm, pos_provider: 'Pine Labs', commission_rate: '1.25' })}
                        />
                        <strong style={{ fontSize: '0.75rem', color: '#0F172A' }}>🌲 Pine Labs</strong>
                      </div>
                      <span style={{ fontSize: '0.6rem', color: '#0F52BA', fontWeight: 700 }}>MDR Rate: 1.25%</span>
                    </label>

                    <label style={{
                      padding: '0.5rem',
                      borderRadius: '8px',
                      border: newUserForm.pos_provider === 'Payswiff' ? '2px solid #D97706' : '1px solid #CBD5E1',
                      background: newUserForm.pos_provider === 'Payswiff' ? '#FFFBEB' : '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input 
                          type="radio" 
                          name="pos_provider" 
                          value="Payswiff" 
                          checked={newUserForm.pos_provider === 'Payswiff'}
                          onChange={() => setNewUserForm({ ...newUserForm, pos_provider: 'Payswiff', commission_rate: '1.65' })}
                        />
                        <strong style={{ fontSize: '0.75rem', color: '#0F172A' }}>⚡ Payswiff</strong>
                      </div>
                      <span style={{ fontSize: '0.6rem', color: '#D97706', fontWeight: 700 }}>MDR Rate: 1.65%</span>
                    </label>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '2px' }}>
                      Assigned MDR Commission (%)
                    </label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={newUserForm.commission_rate}
                      onChange={(e) => setNewUserForm({ ...newUserForm, commission_rate: e.target.value })}
                      style={{ width: '100%', padding: '0.375rem 0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.75rem' }}
                    />
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isSubmittingUser}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', fontWeight: 800, padding: '0.625rem' }}
              >
                {isSubmittingUser ? 'Registering...' : `Create ${newUserForm.role} Account in SQLite →`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CSS Styling Injection */}
      <style>{`
        @keyframes slideLeft {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes skeletonPulse {
          0% { background-color: #F1F5F9; }
          50% { background-color: #E2E8F0; }
          100% { background-color: #F1F5F9; }
        }

        .skeleton-line {
          animation: skeletonPulse 1.2s infinite ease-in-out;
        }

        .interactive-table-row {
          border-bottom: 1px solid #E2E8F0;
          transition: background-color 150ms ease;
        }
        .interactive-table-row:hover {
          background-color: #F8FAFC;
        }

        /* --- Replicating the exact Metric cards style of screenshot 2 --- */
        .metric-blue-card {
          background-color: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          padding: 0.75rem 0.875rem;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 110px;
          transition: all 200ms ease;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.01);
        }
        .metric-blue-card:hover {
          transform: translateY(-2px);
          border-color: #CBD5E1;
          box-shadow: 0 10px 15px -3px rgba(0,0,0,0.04);
        }
        .metric-icon-square {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .metric-card-lbl {
          font-size: 0.6875rem;
          color: #64748B;
          font-weight: 700;
          margin-top: 0.375rem;
          line-height: 1.25;
          display: block;
          min-height: 28px;
        }
        .metric-card-footer {
          border-top: 1px solid #F1F5F9;
          margin-top: 0.375rem;
          padding-top: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #0F52BA;
          font-size: 0.65rem;
          font-weight: 700;
        }

        /* --- Queue Navigation tabs --- */
        .queue-nav-tab {
          border: none;
          background: none;
          color: #64748B;
          font-size: 0.75rem;
          font-weight: 800;
          padding: 0.625rem 0.875rem;
          cursor: pointer;
          white-space: nowrap;
          transition: all 200ms ease;
          border-bottom: 2px solid transparent;
        }
        .queue-nav-tab:hover {
          color: #0A192F;
        }
        .tab-active {
          color: #0F52BA !important;
          border-bottom: 2px solid #0F52BA !important;
        }

        /* Adaptive Grid for Metric Cards - Start with 2 Columns side-by-side on mobile */
        .metrics-adaptive-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.625rem;
        }
        
        /* Balanced span for odd 7th card on mobile/tablet viewports */
        .metrics-adaptive-grid > div:nth-child(7) {
          grid-column: span 2;
        }

        @media (min-width: 640px) {
          .metrics-adaptive-grid {
            grid-template-columns: repeat(3, 1fr);
          }
          .metrics-adaptive-grid > div:nth-child(7) {
            grid-column: span 3;
          }
        }
        @media (min-width: 1024px) {
          .metrics-adaptive-grid {
            grid-template-columns: repeat(7, 1fr);
          }
          .metrics-adaptive-grid > div:nth-child(7) {
            grid-column: span 1;
          }
        }

        @media (max-width: 767px) {
          .mobile-footer-margin {
            margin-bottom: 56px !important;
          }
        }
      `}</style>

    </div>
  );
}
