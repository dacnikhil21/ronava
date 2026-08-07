import React, { useState, useEffect } from 'react';
import { Wallet, Eye, EyeOff, Plus, Send, Users, History, Receipt, CreditCard, Landmark, Building2, BarChart3, Headphones, Calendar, ChevronRight, LogOut, PlusCircle, Home, User, Bell, Phone, QrCode } from 'lucide-react';

export default function MerchantDashboardPage({ user, onLogout, onNavigate }) {
  const [showBalance, setShowBalance] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [selectedDate, setSelectedDate] = useState('16 May 2025');
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimated(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const transactions = [
    { id: 'TXN: BBPS25051600124', title: 'BBPS Electricity Bill', amount: '₹1,250.00', status: 'Success', time: '10:45 AM' },
    { id: 'TXN: MBL25051600123', title: 'Jio Mobile Recharge', amount: '₹199.00', status: 'Success', time: '10:30 AM' },
    { id: 'TXN: DTH25051600122', title: 'Airtel DTH Recharge', amount: '₹349.00', status: 'Success', time: '10:15 AM' },
    { id: 'TXN: CC25051600121', title: 'Credit Card Payment', amount: '₹2,500.00', status: 'Success', time: '09:50 AM' },
    { id: 'TXN: POS25051600120', title: 'Airtel Postpaid Bill', amount: '₹599.00', status: 'Success', time: '09:30 AM' }
  ];

  const beneficiaries = [
    { bank: 'SBI Bank', account: '********1234', name: 'Ravi Kumar', primary: true },
    { bank: 'HDFC Bank', account: '********5678', name: 'Ravi Kumar', primary: false },
    { bank: 'ICICI Bank', account: '********9012', name: 'Ravi Kumar', primary: false }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" style={{ width: '100%', overflowX: 'hidden', paddingBottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}>
      
      {/* Tier-1 Enterprise Connected Navigation Bar */}
      <header className="navbar-header" style={{ backgroundColor: '#FFFFFF', width: '100%', borderBottom: '1px solid #E2E8F0', padding: '0.5rem 0' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', width: '100%', boxSizing: 'border-box' }}>
          
          {/* Brand Logo & Merchant Portal Scope */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {/* Symmetrical Vector TR Monogram Symbol (Official Shape) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg 
                viewBox="0 0 120 100" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg" 
                style={{ 
                  height: '34px', 
                  width: 'auto', 
                  flexShrink: 0 
                }}
              >
                <defs>
                  <linearGradient id="logoTGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0066FF" />
                    <stop offset="100%" stopColor="#003399" />
                  </linearGradient>
                  <linearGradient id="logoRGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#0A1E3F" />
                    <stop offset="100%" stopColor="#051024" />
                  </linearGradient>
                </defs>
                
                {/* Scattered Pixel Blocks */}
                <rect x="12" y="24" width="5.5" height="5.5" fill="#0066FF" />
                <rect x="20" y="31.5" width="5.5" height="5.5" fill="#0066FF" />
                <rect x="28.5" y="33" width="7" height="6.5" fill="#0066FF" />
                <rect x="14" y="38.5" width="5.5" height="5.5" fill="#0066FF" />
                <rect x="22" y="44" width="7" height="6.5" fill="#0066FF" />

                {/* T Horizontal Bar */}
                <path d="M30 40 H74 L66 52 H30 Z" fill="url(#logoTGrad)" />
                
                {/* T Vertical Stem */}
                <path d="M52 52 H64 V90 H52 Z" fill="url(#logoTGrad)" />

                {/* R Upper Monogram Curve */}
                <path 
                  d="M34 22 H80 C95 22 105 34 105 48 C105 62 95 72 80 72 H64" 
                  fill="none" 
                  stroke="url(#logoRGrad)" 
                  strokeWidth="11" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />

                {/* R Leg */}
                <path 
                  d="M72 70 L96 92" 
                  fill="none" 
                  stroke="url(#logoRGrad)" 
                  strokeWidth="11" 
                  strokeLinecap="round" 
                />
              </svg>
            </div>

            {/* Letter-by-Letter Writing Animation Naming */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div 
                style={{ 
                  fontSize: 'clamp(1.05rem, 3.2vw, 1.25rem)', 
                  fontWeight: 900, 
                  color: '#0A192F', 
                  letterSpacing: '0.04em', 
                  lineHeight: 1, 
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {/* R */}
                <span style={{
                  display: 'inline-block',
                  opacity: animated ? 1 : 0,
                  transform: animated ? 'translateX(0)' : 'translateX(-6px)',
                  transition: `opacity 300ms cubic-bezier(0.16, 1, 0.3, 1) 300ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) 300ms`
                }}>R</span>
                {/* O */}
                <span style={{
                  display: 'inline-block',
                  opacity: animated ? 1 : 0,
                  transform: animated ? 'translateX(0)' : 'translateX(-6px)',
                  transition: `opacity 300ms cubic-bezier(0.16, 1, 0.3, 1) 370ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) 370ms`
                }}>O</span>
                {/* N */}
                <span style={{
                  display: 'inline-block',
                  opacity: animated ? 1 : 0,
                  transform: animated ? 'translateX(0)' : 'translateX(-6px)',
                  transition: `opacity 300ms cubic-bezier(0.16, 1, 0.3, 1) 440ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) 440ms`
                }}>N</span>
                {/* A (Inverted V Chevron) */}
                <span
                  style={{
                    display: 'inline-flex',
                    opacity: animated ? 1 : 0,
                    transform: animated ? 'translateX(0)' : 'translateX(-6px)',
                    transition: `opacity 300ms cubic-bezier(0.16, 1, 0.3, 1) 510ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) 510ms`,
                    width: 'clamp(0.8rem, 2.5vw, 0.95rem)',
                    height: 'clamp(0.8rem, 2.5vw, 0.95rem)',
                    marginRight: '2px',
                    marginLeft: '2px',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', display: 'block' }}>
                    <path d="M12 90 L50 15 L88 90" stroke="url(#logoTGrad)" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {/* V */}
                <span style={{
                  display: 'inline-block',
                  opacity: animated ? 1 : 0,
                  transform: animated ? 'translateX(0)' : 'translateX(-6px)',
                  transition: `opacity 300ms cubic-bezier(0.16, 1, 0.3, 1) 580ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) 580ms`
                }}>V</span>

                <span className="brand-tag" style={{ fontSize: '0.45rem', padding: '0.0625rem 0.2rem', marginLeft: '0.25rem', alignSelf: 'center' }}>MERCHANT</span>
              </div>
              
              {/* TECHNOLOGIES with gradient accent lines */}
              <div 
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  opacity: animated ? 1 : 0,
                  transform: animated ? 'translateY(0)' : 'translateY(3px)',
                  transition: `opacity 400ms cubic-bezier(0.16, 1, 0.3, 1) 750ms, transform 400ms cubic-bezier(0.16, 1, 0.3, 1) 750ms`,
                  marginTop: '2px'
                }}
              >
                {/* Accent Line Left */}
                <div style={{ height: '1.5px', width: '8px', background: 'linear-gradient(90deg, transparent, #0066FF)', borderRadius: '1px' }} />
                <span 
                  style={{ 
                    fontSize: 'clamp(0.4rem, 1.2vw, 0.5rem)', 
                    fontWeight: 800, 
                    color: '#64748B', 
                    letterSpacing: '0.14em', 
                    lineHeight: 1
                  }}
                >
                  TECHNOLOGIES
                </span>
                {/* Accent Line Right */}
                <div style={{ height: '1.5px', width: '8px', background: 'linear-gradient(90deg, #0066FF, transparent)', borderRadius: '1px' }} />
              </div>
            </div>
          </div>

          {/* Action Tools (Notifications, Profile Avatar) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>

            {/* Notification Bell with Badge */}
            <div style={{ position: 'relative' }}>
              <button className="btn btn-ghost btn-sm" style={{ padding: '0.25rem', borderRadius: '50%', minHeight: '32px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bell style={{ width: '16px', height: '16px', color: '#334155' }} />
              </button>
              <span style={{ position: 'absolute', top: '0px', right: '0px', width: '12px', height: '12px', borderRadius: '50%', background: '#EF4444', color: '#FFF', fontSize: '0.5rem', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                3
              </span>
            </div>

            {/* Merchant Profile Avatar Pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.125rem 0.375rem', borderRadius: '20px', background: '#F8FAFC', border: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#0F52BA', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem', flexShrink: 0 }}>
                {user?.name?.charAt(0).toUpperCase() || 'R'}
              </div>
              <div className="profile-info-text text-left" style={{ whiteSpace: 'nowrap', paddingRight: '0.25rem' }}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.1, margin: 0 }}>{user?.name || 'Ravi Store'}</p>
                <p style={{ fontSize: '0.5rem', fontWeight: 700, color: '#64748B', margin: 0 }}>MID: {user?.mid || 'RONAV12345'}</p>
              </div>
              <button onClick={onLogout} className="btn btn-ghost btn-sm" title="Log Out" style={{ padding: '0.125rem', color: '#DC2626', minHeight: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LogOut style={{ width: '14px', height: '14px' }} />
              </button>
            </div>

          </div>

        </div>
      </header>

      {/* Main Operational Dashboard Workspace */}
      <main className="flex-grow" style={{ paddingTop: '0.875rem', width: '100%' }}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          
          {/* Virtual Wallet Hero Card */}
          <div style={{ padding: '1rem 1.125rem', borderRadius: '18px', background: 'linear-gradient(135deg, #0A192F 0%, #0F52BA 60%, #1E64EC 100%)', color: '#FFFFFF', boxShadow: '0 12px 32px -4px rgba(15,23,42,0.25), inset 0 1px 0 rgba(255,255,255,0.2)', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#BFDBFE', textTransform: 'uppercase', letterSpacing: '0.05em' }}>VIRTUAL WALLET</span>
                  <button onClick={() => setShowBalance(!showBalance)} style={{ background: 'none', border: 'none', color: '#BFDBFE', cursor: 'pointer', padding: 0 }} title={showBalance ? 'Hide Balance' : 'Show Balance'}>
                    {showBalance ? <Eye style={{ width: '14px', height: '14px' }} /> : <EyeOff style={{ width: '14px', height: '14px' }} />}
                  </button>
                </div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 900, margin: '0.125rem 0 0', letterSpacing: '-0.02em', whiteSpace: 'nowrap', fontFeatureSettings: '"tnum", "cv02", "cv03"' }}>
                  {showBalance ? '₹24,560.75' : '••••••••'}
                </h2>
                <p style={{ fontSize: '0.625rem', color: '#93C5FD', marginTop: '1px' }}>Available Balance for Withdrawals & BBPS</p>
              </div>

              <button className="btn btn-primary btn-sm" style={{ backgroundColor: '#FFFFFF', color: '#0F52BA', fontWeight: 800, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', height: '32px', minHeight: '32px', fontSize: '0.75rem' }}>
                <Plus style={{ width: '14px', height: '14px' }} />
                + Add Money
              </button>
            </div>

            {/* Sub-Metrics Glass Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.25rem', paddingTop: '0.625rem', borderTop: '1px solid rgba(255,255,255,0.15)', textAlign: 'center' }}>
              <div>
                <span style={{ color: '#94A3B8', display: 'block', fontSize: '0.5625rem', textTransform: 'uppercase', fontWeight: 700 }}>Total Sales</span>
                <strong style={{ color: '#FFFFFF', fontSize: '0.75rem', whiteSpace: 'nowrap', fontFeatureSettings: '"tnum"' }}>₹1.85L</strong>
              </div>
              <div>
                <span style={{ color: '#94A3B8', display: 'block', fontSize: '0.5625rem', textTransform: 'uppercase', fontWeight: 700 }}>Received</span>
                <strong style={{ color: '#34D399', fontSize: '0.75rem', whiteSpace: 'nowrap', fontFeatureSettings: '"tnum"' }}>₹1.60L</strong>
              </div>
              <div>
                <span style={{ color: '#94A3B8', display: 'block', fontSize: '0.5625rem', textTransform: 'uppercase', fontWeight: 700 }}>Pending</span>
                <strong style={{ color: '#FCD34D', fontSize: '0.75rem', whiteSpace: 'nowrap', fontFeatureSettings: '"tnum"' }}>₹24.5K</strong>
              </div>
              <div>
                <span style={{ color: '#94A3B8', display: 'block', fontSize: '0.5625rem', textTransform: 'uppercase', fontWeight: 700 }}>Withdrawn</span>
                <strong style={{ color: '#BFDBFE', fontSize: '0.75rem', whiteSpace: 'nowrap', fontFeatureSettings: '"tnum"' }}>₹1.35L</strong>
              </div>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div>
            <h3 style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Quick Actions</h3>
            <div className="mobile-app-quick-grid">
              <button className="card card-hover" style={{ textAlign: 'center', padding: '0.5rem 0.25rem', border: '1px solid #E2E8F0', cursor: 'pointer', backgroundColor: '#FFFFFF' }}>
                <div className="icon-badge" style={{ margin: '0 auto 0.25rem', background: '#EFF6FF', color: '#0F52BA', width: '30px', height: '30px' }}>
                  <PlusCircle style={{ width: '16px', height: '16px' }} />
                </div>
                <h4 style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#0F172A', margin: 0, whiteSpace: 'nowrap' }}>Record Sale</h4>
                <p style={{ fontSize: '0.5rem', color: '#64748B', margin: 0, whiteSpace: 'nowrap' }}>Collect Payment</p>
              </button>

              <button className="card card-hover" style={{ textAlign: 'center', padding: '0.5rem 0.25rem', border: '1px solid #E2E8F0', cursor: 'pointer', backgroundColor: '#FFFFFF' }}>
                <div className="icon-badge" style={{ margin: '0 auto 0.25rem', background: '#ECFDF5', color: '#059669', width: '30px', height: '30px' }}>
                  <Send style={{ width: '16px', height: '16px' }} />
                </div>
                <h4 style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#0F172A', margin: 0, whiteSpace: 'nowrap' }}>Withdraw</h4>
                <p style={{ fontSize: '0.5rem', color: '#64748B', margin: 0, whiteSpace: 'nowrap' }}>Send to Bank</p>
              </button>

              <button className="card card-hover" style={{ textAlign: 'center', padding: '0.5rem 0.25rem', border: '1px solid #E2E8F0', cursor: 'pointer', backgroundColor: '#FFFFFF' }}>
                <div className="icon-badge" style={{ margin: '0 auto 0.25rem', background: '#FEF3C7', color: '#D97706', width: '30px', height: '30px' }}>
                  <Users style={{ width: '16px', height: '16px' }} />
                </div>
                <h4 style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#0F172A', margin: 0, whiteSpace: 'nowrap' }}>Beneficiaries</h4>
                <p style={{ fontSize: '0.5rem', color: '#64748B', margin: 0, whiteSpace: 'nowrap' }}>Accounts</p>
              </button>

              <button className="card card-hover" style={{ textAlign: 'center', padding: '0.5rem 0.25rem', border: '1px solid #E2E8F0', cursor: 'pointer', backgroundColor: '#FFFFFF' }}>
                <div className="icon-badge" style={{ margin: '0 auto 0.25rem', background: '#F1F5F9', color: '#475569', width: '30px', height: '30px' }}>
                  <History style={{ width: '16px', height: '16px' }} />
                </div>
                <h4 style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#0F172A', margin: 0, whiteSpace: 'nowrap' }}>Txn History</h4>
                <p style={{ fontSize: '0.5rem', color: '#64748B', margin: 0, whiteSpace: 'nowrap' }}>View Ledger</p>
              </button>
            </div>
          </div>

          {/* Financial Services Grid */}
          <div className="card" style={{ padding: '0.75rem', backgroundColor: '#FFFFFF' }}>
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.5rem' }}>Our Financial Services</h3>
            <div className="mobile-app-services-grid">
              <div style={{ padding: '0.375rem 0.125rem', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', textAlign: 'center', cursor: 'pointer' }}>
                <Receipt style={{ width: '16px', height: '16px', color: '#0F52BA', margin: '0 auto 0.125rem' }} />
                <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>BBPS</p>
              </div>
              <div style={{ padding: '0.375rem 0.125rem', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', textAlign: 'center', cursor: 'pointer' }}>
                <CreditCard style={{ width: '16px', height: '16px', color: '#D97706', margin: '0 auto 0.125rem' }} />
                <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>PG & POS</p>
              </div>
              <div style={{ padding: '0.375rem 0.125rem', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', textAlign: 'center', cursor: 'pointer' }}>
                <Landmark style={{ width: '16px', height: '16px', color: '#059669', margin: '0 auto 0.125rem' }} />
                <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Loans</p>
              </div>
              <div style={{ padding: '0.375rem 0.125rem', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', textAlign: 'center', cursor: 'pointer' }}>
                <Building2 style={{ width: '16px', height: '16px', color: '#4F46E5', margin: '0 auto 0.125rem' }} />
                <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>ATM/CDM</p>
              </div>
              <div style={{ padding: '0.375rem 0.125rem', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', textAlign: 'center', cursor: 'pointer' }}>
                <BarChart3 style={{ width: '16px', height: '16px', color: '#0F52BA', margin: '0 auto 0.125rem' }} />
                <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Reports</p>
              </div>
              <div style={{ padding: '0.375rem 0.125rem', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', textAlign: 'center', cursor: 'pointer' }}>
                <Headphones style={{ width: '16px', height: '16px', color: '#DC2626', margin: '0 auto 0.125rem' }} />
                <p style={{ fontSize: '0.625rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Support</p>
              </div>
            </div>
          </div>

          {/* Sales Overview Sparklines */}
          <div className="card" style={{ padding: '0.75rem', backgroundColor: '#FFFFFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Sales Overview</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.125rem 0.375rem', borderRadius: '4px', background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: '0.5625rem', fontWeight: 700, color: '#334155' }}>
                <Calendar style={{ width: '10px', height: '10px', color: '#0F52BA' }} />
                <span>16 May 2025</span>
              </div>
            </div>

            <div className="mobile-app-sales-grid">
              <div style={{ padding: '0.5rem', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <p style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#64748B', margin: 0 }}>Today's Sales</p>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 900, color: '#0F172A', margin: '2px 0 0', fontFeatureSettings: '"tnum"' }}>₹12,450.00</h4>
                <div style={{ height: '2px', background: '#BFDBFE', borderRadius: '2px', marginTop: '0.25rem', width: '75%' }}></div>
              </div>

              <div style={{ padding: '0.5rem', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <p style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#64748B', margin: 0 }}>Today's Received</p>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 900, color: '#059669', margin: '2px 0 0', fontFeatureSettings: '"tnum"' }}>₹10,890.00</h4>
                <div style={{ height: '2px', background: '#A7F3D0', borderRadius: '2px', marginTop: '0.25rem', width: '85%' }}></div>
              </div>

              <div style={{ padding: '0.5rem', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <p style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#64748B', margin: 0 }}>Today's Pending</p>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 900, color: '#D97706', margin: '2px 0 0', fontFeatureSettings: '"tnum"' }}>₹1,560.00</h4>
                <div style={{ height: '2px', background: '#FDE68A', borderRadius: '2px', marginTop: '0.25rem', width: '20%' }}></div>
              </div>

              <div style={{ padding: '0.5rem', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <p style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#64748B', margin: 0 }}>Transactions</p>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 900, color: '#0F52BA', margin: '2px 0 0', fontFeatureSettings: '"tnum"' }}>32</h4>
                <div style={{ height: '2px', background: '#BFDBFE', borderRadius: '2px', marginTop: '0.25rem', width: '90%' }}></div>
              </div>
            </div>
          </div>

          {/* Recent Transactions Ledger */}
          <div className="card" style={{ padding: '0.75rem', backgroundColor: '#FFFFFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Recent Transactions</h3>
              <a href="#" style={{ fontSize: '0.625rem', fontWeight: 800, color: '#0F52BA', display: 'flex', alignItems: 'center', gap: '0.125rem' }}>
                View All <ChevronRight style={{ width: '12px', height: '12px' }} />
              </a>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {transactions.map((t, idx) => (
                <div key={idx} style={{ padding: '0.375rem 0.5rem', borderRadius: '8px', background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.25rem', width: '100%', boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <div className="icon-badge" style={{ width: '26px', height: '26px' }}>
                      <Receipt style={{ width: '13px', height: '13px' }} />
                    </div>
                    <div>
                      <p style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#0F172A', margin: 0, whiteSpace: 'nowrap' }}>{t.title}</p>
                      <p style={{ fontSize: '0.5rem', color: '#64748B', margin: 0, whiteSpace: 'nowrap' }}>{t.id}</p>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 900, color: '#059669', margin: 0, whiteSpace: 'nowrap', fontFeatureSettings: '"tnum"' }}>{t.amount}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'flex-end', marginTop: '1px' }}>
                      <span style={{ fontSize: '0.5rem', fontWeight: 800, padding: '0.0625rem 0.25rem', background: '#ECFDF5', color: '#059669', borderRadius: '3px', border: '1px solid #A7F3D0' }}>
                        {t.status}
                      </span>
                      <span style={{ fontSize: '0.5rem', color: '#94A3B8' }}>{t.time}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Beneficiary Accounts Hub */}
          <div className="card" style={{ padding: '0.75rem', backgroundColor: '#FFFFFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>My Beneficiaries</h3>
              <a href="#" style={{ fontSize: '0.625rem', fontWeight: 800, color: '#0F52BA', display: 'flex', alignItems: 'center', gap: '0.125rem' }}>
                View All <ChevronRight style={{ width: '12px', height: '12px' }} />
              </a>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.375rem', marginBottom: '0.5rem' }}>
              {beneficiaries.map((b, idx) => (
                <div key={idx} style={{ padding: '0.375rem', borderRadius: '8px', background: '#F8FAFC', border: b.primary ? '1.5px solid #0F52BA' : '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: '0.6875rem', color: '#0F172A' }}>{b.bank}</strong>
                    {b.primary && (
                      <span style={{ fontSize: '0.4375rem', fontWeight: 800, padding: '0.0625rem 0.1875rem', background: '#EFF6FF', color: '#0F52BA', borderRadius: '3px' }}>
                        PRIMARY
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.5625rem', color: '#64748B', fontFamily: 'monospace', margin: 0 }}>{b.account}</p>
                  <p style={{ fontSize: '0.5rem', fontWeight: 700, color: '#334155', margin: 0 }}>{b.name}</p>
                </div>
              ))}
            </div>

            <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center', fontWeight: 800, color: '#0F52BA', borderStyle: 'dashed', minHeight: '30px', fontSize: '0.6875rem' }}>
              <Plus style={{ width: '12px', height: '12px' }} />
              + Add New Beneficiary Bank Account
            </button>
          </div>

        </div>
      </main>

      {/* Native App Bottom Navigation Bar with Center Floating Action Button */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, width: '100%', zIndex: 50, backgroundColor: 'rgba(255, 255, 255, 0.96)', backdropFilter: 'blur(16px)', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '0.375rem 0 calc(0.375rem + env(safe-area-inset-bottom, 0px))', boxShadow: '0 -4px 16px rgba(15,23,42,0.08)', boxSizing: 'border-box' }}>
        <button onClick={() => setActiveTab('home')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.125rem', background: 'none', border: 'none', color: activeTab === 'home' ? '#0F52BA' : '#64748B', cursor: 'pointer', fontSize: '0.625rem', fontWeight: 700 }}>
          <Home style={{ width: '18px', height: '18px' }} />
          Home
        </button>

        <button onClick={() => setActiveTab('record')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.125rem', background: 'none', border: 'none', color: activeTab === 'record' ? '#0F52BA' : '#64748B', cursor: 'pointer', fontSize: '0.625rem', fontWeight: 700 }}>
          <Receipt style={{ width: '18px', height: '18px' }} />
          Record Sale
        </button>

        {/* Center Floating Action Button (Scan & Pay) */}
        <button onClick={() => setActiveTab('scan')} style={{ marginTop: '-1.25rem', width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, #0F52BA 0%, #0A3E90 100%)', color: '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(15,82,186,0.45)', border: '3px solid #FFFFFF', cursor: 'pointer', flexShrink: 0 }}>
          <QrCode style={{ width: '22px', height: '22px' }} />
        </button>

        <button onClick={() => setActiveTab('transactions')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.125rem', background: 'none', border: 'none', color: activeTab === 'transactions' ? '#0F52BA' : '#64748B', cursor: 'pointer', fontSize: '0.625rem', fontWeight: 700 }}>
          <History style={{ width: '18px', height: '18px' }} />
          Txns
        </button>

        <button onClick={() => setActiveTab('profile')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.125rem', background: 'none', border: 'none', color: activeTab === 'profile' ? '#0F52BA' : '#64748B', cursor: 'pointer', fontSize: '0.625rem', fontWeight: 700 }}>
          <User style={{ width: '18px', height: '18px' }} />
          Profile
        </button>
      </nav>

    </div>
  );
}
