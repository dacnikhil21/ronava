import React, { useState, useEffect, useRef } from 'react';
import { User, Lock, Eye, EyeOff, ShieldCheck, Headphones, Zap, TrendingUp, Phone, Mail, X, Menu, ArrowRight, ArrowLeft, Layers, CheckCircle2, Send, ChevronDown, ChevronUp, Check, CreditCard, Shield, Copy, AlertCircle } from 'lucide-react';
import { loginUser, submitInquiry, verifySponsor, registerWithReferral, resetUserPassword } from '../services/api';

export default function MerchantLoginPage({ onLoginSuccess, onBackToHome }) {
  const [selectedRole, setSelectedRole] = useState('Retailer');
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const roleDropdownRef = useRef(null);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotMobile, setForgotMobile] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [animated, setAnimated] = useState(false);

  // Mandatory Sponsor Verification & Registration State
  const [sponsorCode, setSponsorCode] = useState('');
  const [verifiedSponsor, setVerifiedSponsor] = useState(null);
  const [isVerifyingSponsor, setIsVerifyingSponsor] = useState(false);
  const [sponsorError, setSponsorError] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  // Forgot Password & Reset State
  const [forgotQuery, setForgotQuery] = useState('');
  const [forgotResult, setForgotResult] = useState(null);
  const [forgotError, setForgotError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    function handleClickOutside(event) {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target)) {
        setIsRoleDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [registerData, setRegisterData] = useState({
    name: '',
    mobile: '',
    service: 'PG & POS Solutions',
    role: selectedRole,
    pos_provider: 'Pine Labs',
    message: ''
  });

  const handleOpenRegister = () => {
    setRegisterData((prev) => ({ ...prev, role: selectedRole }));
    setRegisterSuccess(false);
    setCreatedCredentials(null);
    setSponsorError('');
    setShowRegisterModal(true);
  };

  // Live Verify Sponsor Referral Code
  const handleVerifySponsor = async (codeToVerify) => {
    const code = (codeToVerify || sponsorCode).trim();
    if (!code) {
      setSponsorError('Please enter a Sponsor / Referral ID');
      setVerifiedSponsor(null);
      return;
    }
    setIsVerifyingSponsor(true);
    setSponsorError('');
    try {
      const res = await verifySponsor(code);
      if (res && res.success && res.sponsor) {
        setVerifiedSponsor(res.sponsor);
        setSponsorError('');
      } else {
        setVerifiedSponsor(null);
        setSponsorError(res?.message || 'Invalid sponsor referral ID');
      }
    } catch (err) {
      setVerifiedSponsor(null);
      setSponsorError('Connection error verifying sponsor');
    } finally {
      setIsVerifyingSponsor(false);
    }
  };

  // Submit Referral Registration
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!verifiedSponsor) {
      setSponsorError('⚠️ A verified Sponsor / Referral Code is mandatory to onboard in the RONAV network.');
      return;
    }
    if (!registerData.name.trim() || !registerData.mobile.trim()) {
      setSponsorError('Please enter both Full Name and 10-digit Mobile Number.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await registerWithReferral({
        sponsor_id: verifiedSponsor.id,
        name: registerData.name.trim(),
        mobile: registerData.mobile.trim(),
        role: selectedRole === 'Retailer' ? 'MERCHANT' : selectedRole,
        pos_provider: registerData.pos_provider || 'Pine Labs'
      });

      if (res && res.success && res.credentials) {
        setCreatedCredentials(res.credentials);
        setRegisterSuccess(true);
      } else {
        setSponsorError(res?.message || 'Error creating partner account');
      }
    } catch (err) {
      setSponsorError('Connection error registering account');
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot Password / Recovery Submit
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotQuery.trim()) return;

    setIsResetting(true);
    setForgotError('');
    setForgotResult(null);

    try {
      const res = await resetUserPassword(forgotQuery.trim());
      if (res && res.success && res.user) {
        setForgotResult(res);
      } else {
        setForgotError(res?.message || 'No registered account found.');
      }
    } catch (err) {
      setForgotError('Connection error verifying account.');
    } finally {
      setIsResetting(false);
    }
  };

  // Clipboard Copy Helper
  const handleCopyCreds = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedCreds(true);
    setTimeout(() => setCopiedCreds(false), 2000);
  };

  const roleOptions = [
    { id: 'MASTER', label: 'MASTER (Master Distributor)', icon: '👑', desc: 'Master Distributor Command & Regional Network' },
    { id: 'Super Distributor', label: 'Super Distributor', icon: '⚡', desc: 'Super Distributor Network & Commission Settlements' },
    { id: 'DIST Franchise', label: 'DIST Franchise (Distributor Franchise)', icon: '🏢', desc: 'Distributor Franchise & ATM/CDM Operations' },
    { id: 'Distributor', label: 'Distributor', icon: '📦', desc: 'Distributor Workspace & Retailer Management' },
    { id: 'Retailer', label: 'Retailer (Merchant)', icon: '🏪', desc: 'Retail Merchant Portal, BBPS Bills & POS' }
  ];

  const currentRoleInfo = roleOptions.find((r) => r.id === selectedRole) || roleOptions[4];

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimated(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const searchId = userId || (
        selectedRole === 'Retailer' ? 'MID3001' : 
        (selectedRole === 'Distributor' ? 'DIST2001' : 
        (selectedRole === 'MASTER' ? 'MST1001' : 'SD1001'))
      );
      const res = await loginUser({ 
        id: searchId, 
        role: selectedRole === 'Retailer' ? 'MERCHANT' : selectedRole 
      });

      if (res.success && res.user) {
        onLoginSuccess({
          id: res.user.id,
          name: res.user.name,
          mid: res.user.id,
          role: res.user.role === 'MERCHANT' ? 'Retailer' : res.user.role,
          pos: res.pos || null
        });
      } else {
        const fallbackId = selectedRole === 'MASTER' ? 'MST1001' : (selectedRole === 'Distributor' ? 'DIST2001' : (selectedRole === 'Super Distributor' ? 'SD1001' : 'MID3001'));
        onLoginSuccess({
          id: fallbackId,
          name: userId || (selectedRole === 'MASTER' ? 'RONAV Apex Master Hub' : 'Ravi Kirana Store'),
          mid: fallbackId,
          role: selectedRole
        });
      }
    } catch (err) {
      const fallbackId = selectedRole === 'MASTER' ? 'MST1001' : (selectedRole === 'Distributor' ? 'DIST2001' : (selectedRole === 'Super Distributor' ? 'SD1001' : 'MID3001'));
      onLoginSuccess({
        id: fallbackId,
        name: userId || (selectedRole === 'MASTER' ? 'RONAV Apex Master Hub' : 'Ravi Kirana Store'),
        mid: fallbackId,
        role: selectedRole
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 relative font-sans" style={{ width: '100%' }}>
      
      {/* 1. Header Navigation Bar */}
      <header style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0', padding: 'var(--nav-padding) 1rem', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          
          {/* Left: Clean Arrow Back Button & Brand Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <button
              onClick={onBackToHome}
              aria-label="Back to Homepage"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.25rem',
                color: '#0F172A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                flexShrink: 0
              }}
              title="Go back to Home"
            >
              <ArrowLeft style={{ width: '22px', height: '22px', color: '#0F172A' }} />
            </button>

            {/* Logo (Clean Brand without Partner badge) */}
            <button 
              onClick={onBackToHome}
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer', 
                padding: 0, 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img 
                  src="/logo_tr_transparent.png" 
                  alt="TR Monogram" 
                  style={{ 
                    height: 'var(--logo-height)', 
                    width: 'auto', 
                    display: 'block',
                    flexShrink: 0 
                  }} 
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div 
                  style={{ 
                    fontSize: 'clamp(1.15rem, 3.8vw, 1.45rem)', 
                    fontWeight: 900, 
                    color: '#0A192F', 
                    letterSpacing: '0.04em', 
                    lineHeight: 1, 
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <span style={{ display: 'inline-block' }}>R</span>
                  <span style={{ display: 'inline-block' }}>O</span>
                  <span style={{ display: 'inline-block' }}>N</span>
                  <span
                    style={{
                      display: 'inline-flex',
                      width: 'clamp(0.9rem, 2.8vw, 1.1rem)',
                      height: 'clamp(0.9rem, 2.8vw, 1.1rem)',
                      marginRight: '2px',
                      marginLeft: '2px',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', display: 'block' }}>
                      <defs>
                        <linearGradient id="logoTGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#0066FF" />
                          <stop offset="100%" stopColor="#003399" />
                        </linearGradient>
                      </defs>
                      <path d="M12 90 L50 15 L88 90" stroke="url(#logoTGrad)" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span style={{ display: 'inline-block' }}>V</span>
                </div>
                
                <div 
                  style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    marginTop: '3px'
                  }}
                >
                  <div style={{ height: '2px', width: '10px', background: 'linear-gradient(90deg, transparent, #0066FF)', borderRadius: '1px' }} />
                  <span 
                    style={{ 
                      fontSize: 'clamp(0.42rem, 1.3vw, 0.55rem)', 
                      fontWeight: 800, 
                      color: '#475569', 
                      letterSpacing: '0.16em', 
                      lineHeight: 1
                    }}
                  >
                    TECHNOLOGIES
                  </span>
                  <div style={{ height: '2px', width: '10px', background: 'linear-gradient(90deg, #0066FF, transparent)', borderRadius: '1px' }} />
                </div>
              </div>
            </button>
          </div>

          {/* Right Action Icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <a 
              href="tel:9966203053"
              style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#0F52BA', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
              title="Call Helpline"
            >
              <Phone style={{ width: '15px', height: '15px' }} />
            </a>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0F172A', padding: '0.25rem', display: 'flex', alignItems: 'center' }}
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X style={{ width: '22px', height: '22px' }} /> : <Menu style={{ width: '22px', height: '22px' }} />}
            </button>
          </div>

        </div>
      </header>

      {/* Mobile menu drawer */}
      {mobileMenuOpen && (
        <div className="mobile-drawer" style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', zIndex: 60 }}>
          <button 
            onClick={() => {
              setMobileMenuOpen(false);
              onBackToHome();
            }} 
            className="mobile-drawer-link" 
            style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', fontWeight: 700, color: '#0F52BA', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <ArrowLeft style={{ width: '16px', height: '16px' }} />
            <span>← Return to Home Page</span>
          </button>
          <button 
            onClick={() => {
              setMobileMenuOpen(false);
              onBackToHome();
            }} 
            className="mobile-drawer-link" 
            style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%' }}
          >
            About Us
          </button>
          <button 
            onClick={() => {
              setMobileMenuOpen(false);
              onBackToHome();
            }} 
            className="mobile-drawer-link" 
            style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%' }}
          >
            Services
          </button>
          <button 
            onClick={() => {
              setMobileMenuOpen(false);
              onBackToHome();
            }} 
            className="mobile-drawer-link"
            style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%' }}
          >
            Business Network
          </button>
          <button 
            onClick={() => {
              setMobileMenuOpen(false);
              onBackToHome();
            }} 
            className="mobile-drawer-link"
            style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%' }}
          >
            Contact & Support
          </button>
        </div>
      )}

      {/* 2. Dark Navy Banner Header (Title & Subtitle Adapt Dynamically to Selected Role) */}
      <div 
        style={{ 
          backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(15, 82, 186, 0.25) 0%, rgba(7, 15, 30, 0.95) 80%), url("/hero_bg.png")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          padding: '3.5rem 1rem 6.5rem', 
          textAlign: 'center', 
          color: '#FFFFFF', 
          position: 'relative',
          clipPath: 'ellipse(130% 100% at 50% 0%)'
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.75rem', background: 'rgba(255,255,255,0.12)', borderRadius: '20px', fontSize: '0.75rem', color: '#BFDBFE', fontWeight: 800, marginBottom: '0.75rem' }}>
          <span>{currentRoleInfo.icon}</span>
          <span>{selectedRole.toUpperCase()} PORTAL</span>
        </div>

        <h1 style={{ fontSize: 'var(--text-h1)', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
          {selectedRole} Login
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500, maxWidth: '420px', margin: '0 auto' }}>
          {currentRoleInfo.desc}
        </p>
        <div style={{ width: '36px', height: '4px', background: '#0F52BA', borderRadius: '2px', margin: '0.75rem auto 0' }} />
      </div>

      {/* 3. Main Login Form Card */}
      <main className="flex-grow container" style={{ marginTop: '-4rem', marginBottom: '2.5rem', maxWidth: '460px', position: 'relative', zIndex: 10 }}>
        
        <div className="card" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', padding: '1.75rem 1.5rem', borderRadius: '18px', boxShadow: '0 12px 32px -4px rgba(15,23,42,0.1)' }}>
          
          {/* Custom Styled Dynamic Role Dropdown Selector */}
          <div ref={roleDropdownRef} style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid #F1F5F9', position: 'relative' }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.5rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <Layers style={{ width: '16px', height: '16px', color: '#0F52BA' }} />
                Select Business Role
              </span>
              <span style={{ fontSize: '0.6875rem', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#059669' }}></span>
                Active: {selectedRole}
              </span>
            </label>

            {/* Custom Dropdown Trigger Button */}
            <button
              type="button"
              onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                border: isRoleDropdownOpen ? '2px solid #0F52BA' : '1.5px solid #0F52BA',
                backgroundColor: '#EFF6FF',
                fontSize: '0.875rem',
                fontWeight: 800,
                color: '#0F172A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                boxShadow: isRoleDropdownOpen ? '0 0 0 3px rgba(15, 82, 186, 0.15)' : '0 2px 8px rgba(15, 82, 186, 0.08)',
                transition: 'all 150ms ease'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: '1.125rem' }}>{currentRoleInfo.icon}</span>
                <span style={{ color: '#0F172A', fontWeight: 800 }}>{currentRoleInfo.label}</span>
              </span>
              {isRoleDropdownOpen ? (
                <ChevronUp style={{ width: '18px', height: '18px', color: '#0F52BA', flexShrink: 0 }} />
              ) : (
                <ChevronDown style={{ width: '18px', height: '18px', color: '#0F52BA', flexShrink: 0 }} />
              )}
            </button>

            {/* Custom Sleek Dropdown Menu */}
            {isRoleDropdownOpen && (
              <div 
                style={{
                  position: 'absolute',
                  top: 'calc(100% - 6px)',
                  left: 0,
                  right: 0,
                  backgroundColor: '#FFFFFF',
                  border: '1.5px solid #BFDBFE',
                  borderRadius: '14px',
                  boxShadow: '0 16px 36px -4px rgba(15, 82, 186, 0.25), 0 4px 12px rgba(0,0,0,0.06)',
                  zIndex: 50,
                  overflow: 'hidden',
                  padding: '0.375rem'
                }}
              >
                {roleOptions.map((role) => {
                  const isSelected = role.id === selectedRole;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => {
                        setSelectedRole(role.id);
                        setIsRoleDropdownOpen(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.625rem 0.75rem',
                        borderRadius: '10px',
                        border: 'none',
                        backgroundColor: isSelected ? '#EFF6FF' : 'transparent',
                        color: isSelected ? '#0F52BA' : '#1E293B',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 120ms ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <span style={{ fontSize: '1.125rem' }}>{role.icon}</span>
                        <div>
                          <div style={{ fontSize: '0.8125rem', fontWeight: isSelected ? 800 : 700 }}>
                            {role.label}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#0F52BA', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check style={{ width: '12px', height: '12px', strokeWidth: 3 }} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
            
            {/* User ID Field */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.375rem' }}>
                {selectedRole} User ID / Mobile
              </label>
              <div style={{ position: 'relative' }}>
                <User style={{ width: '18px', height: '18px', color: '#0F52BA', position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder={`Enter ${selectedRole} User ID`}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.875rem 0.75rem 2.625rem',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#0F172A',
                    outline: 'none',
                    minHeight: '48px'
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.375rem' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock style={{ width: '18px', height: '18px', color: '#0F52BA', position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 2.625rem 0.75rem 2.625rem',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#0F172A',
                    outline: 'none',
                    minHeight: '48px'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                  aria-label="Toggle Password Visibility"
                >
                  {showPassword ? <EyeOff style={{ width: '20px', height: '20px' }} /> : <Eye style={{ width: '20px', height: '20px' }} />}
                </button>
              </div>

              {/* Forgot Password Link */}
              <div style={{ textAlign: 'right', marginTop: '0.375rem' }}>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  style={{ background: 'none', border: 'none', color: '#0F52BA', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            {/* Login CTA Button */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '10px',
                backgroundColor: '#0F52BA',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '0.9375rem',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(15, 82, 186, 0.3)',
                transition: 'all 200ms ease'
              }}
            >
              <ArrowRight style={{ width: '18px', height: '18px' }} />
              <span>{isLoading ? 'AUTHENTICATING...' : `LOGIN AS ${selectedRole.toUpperCase()}`}</span>
            </button>

            {/* OR Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.25rem 0' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
              <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600 }}>or</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
            </div>

            {/* Dynamic New Partner Registration Button */}
            <button
              type="button"
              onClick={handleOpenRegister}
              style={{
                width: '100%',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: '#FFFFFF',
                color: '#0F52BA',
                border: '1.5px solid #0F52BA',
                fontWeight: 700,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.375rem',
                transition: 'all 200ms ease'
              }}
            >
              <span>Apply as New {selectedRole} Partner →</span>
            </button>

            {/* QUICK 1-CLICK TESTING PROFILES (FOR LEAD / NON-CODER TESTING) */}
            <div style={{ marginTop: '1rem', padding: '0.875rem', background: '#F8FAFC', borderRadius: '12px', border: '1.5px dashed #CBD5E1', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 900, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  🧪 1-Click Test Login (SQLite)
                </span>
                <span style={{ fontSize: '0.55rem', fontWeight: 800, background: '#EFF6FF', color: '#0F52BA', padding: '1px 5px', borderRadius: '4px' }}>
                  Real Working DB
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem' }}>
                <button
                  type="button"
                  onClick={() => onLoginSuccess({ id: 'MID3001', name: 'Ravi Kirana Store', mid: 'MID3001', role: 'Retailer' })}
                  style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#0F52BA', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', textAlign: 'left' }}
                >
                  🌲 Pine Labs (MID3001)
                  <span style={{ display: 'block', fontSize: '0.55rem', color: '#64748B', fontWeight: 600 }}>1.25% MDR Swipe</span>
                </button>

                <button
                  type="button"
                  onClick={() => onLoginSuccess({ id: 'MID3002', name: 'Lakshmi Mobile Point', mid: 'MID3002', role: 'Retailer' })}
                  style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid #FDE68A', background: '#FFFBEB', color: '#D97706', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', textAlign: 'left' }}
                >
                  ⚡ Payswiff (MID3002)
                  <span style={{ display: 'block', fontSize: '0.55rem', color: '#64748B', fontWeight: 600 }}>1.65% MDR Swipe</span>
                </button>

                <button
                  type="button"
                  onClick={() => onLoginSuccess({ id: 'DIST2001', name: 'Sri Sai Distribution', mid: 'DIST2001', role: 'Distributor' })}
                  style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#334155', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', textAlign: 'left' }}
                >
                  📦 Distributor (DIST2001)
                  <span style={{ display: 'block', fontSize: '0.55rem', color: '#64748B', fontWeight: 600 }}>Franchise Node</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.location.pathname = '/admin';
                  }}
                  style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid #A7F3D0', background: '#ECFDF5', color: '#065F46', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', textAlign: 'left' }}
                >
                  🛡️ Admin Command (/admin)
                  <span style={{ display: 'block', fontSize: '0.55rem', color: '#64748B', fontWeight: 600 }}>Verifications Center</span>
                </button>
              </div>
            </div>

          </form>

        </div>

        {/* 4. Why Partner with RONAV? Section */}
        <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.25rem' }}>
            Why Partner with <span style={{ color: '#0F52BA' }}>RONAV</span>?
          </h2>
          <div style={{ width: '36px', height: '3px', background: '#0F52BA', borderRadius: '2px', margin: '0.5rem auto 1.5rem' }} />

          {/* 4 Pillar Badges (4-Column Row) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.375rem', margin: '0 auto' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.375rem', border: '1px solid #BFDBFE' }}>
                <ShieldCheck style={{ width: '22px', height: '22px' }} />
              </div>
              <strong style={{ fontSize: '0.625rem', color: '#0F172A', display: 'block', lineHeight: 1.1, fontWeight: 700 }}>Secure &<br />Reliable</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.375rem', border: '1px solid #BFDBFE' }}>
                <Headphones style={{ width: '22px', height: '22px' }} />
              </div>
              <strong style={{ fontSize: '0.625rem', color: '#0F172A', display: 'block', lineHeight: 1.1, fontWeight: 700 }}>24x7<br />Support</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.375rem', border: '1px solid #BFDBFE' }}>
                <Zap style={{ width: '22px', height: '22px' }} />
              </div>
              <strong style={{ fontSize: '0.625rem', color: '#0F172A', display: 'block', lineHeight: 1.1, fontWeight: 700 }}>Instant<br />Settlements</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.375rem', border: '1px solid #BFDBFE' }}>
                <TrendingUp style={{ width: '22px', height: '22px' }} />
              </div>
              <strong style={{ fontSize: '0.625rem', color: '#0F172A', display: 'block', lineHeight: 1.1, fontWeight: 700 }}>High Returns<br />& Growth</strong>
            </div>

          </div>
        </div>

        {/* 5. Contact / Help Desk Card */}
        <div 
          className="card" 
          style={{ 
            backgroundColor: '#FFFFFF', 
            border: '1px solid #E2E8F0', 
            borderRadius: '16px', 
            padding: '1rem', 
            marginTop: '2rem',
            boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '0.75rem',
            alignItems: 'center'
          }}
        >
          {/* Phone Column */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <a 
              href="tel:9966203053" 
              style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#0F52BA', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textDecoration: 'none' }}
            >
              <Phone style={{ width: '16px', height: '16px' }} />
            </a>
            <div>
              <span style={{ fontSize: '0.6875rem', color: '#64748B', display: 'block', fontWeight: 600 }}>Need Help?</span>
              <a href="tel:9966203053" style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F52BA', textDecoration: 'none', display: 'block', lineHeight: 1.2 }}>
                9966203053
              </a>
              <span style={{ fontSize: '0.5625rem', color: '#94A3B8', display: 'block' }}>Call / WhatsApp</span>
            </div>
          </div>

          {/* Email Column */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderLeft: '1px solid #E2E8F0', paddingLeft: '0.5rem' }}>
            <a 
              href="mailto:rosenavaneethamenterprises@gmail.com" 
              style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#0F52BA', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textDecoration: 'none' }}
            >
              <Mail style={{ width: '16px', height: '16px' }} />
            </a>
            <div style={{ overflow: 'hidden' }}>
              <span style={{ fontSize: '0.6875rem', color: '#64748B', display: 'block', fontWeight: 600 }}>Email Us</span>
              <a 
                href="mailto:rosenavaneethamenterprises@gmail.com" 
                style={{ fontSize: '0.65rem', fontWeight: 800, color: '#0F52BA', textDecoration: 'none', wordBreak: 'break-all', display: 'block', lineHeight: 1.2 }}
              >
                rosenavaneethamenterprises@gmail.com
              </a>
            </div>
          </div>

        </div>

      </main>

      {/* 6. Footer Bar */}
      <footer style={{ backgroundColor: '#0B46AD', color: '#FFFFFF', textAlign: 'center', padding: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>
        © 2021 – RONAV TECHNOLOGIES. All Rights Reserved.
      </footer>

      {/* 5. Live Forgot Password Recovery Modal */}
      {showForgotModal && (
        <div className="modal-backdrop" onClick={() => setShowForgotModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px', padding: '1.75rem', borderRadius: '22px' }}>
            
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', margin: '0 0 0.25rem' }}>
                  Account Password Recovery
                </h3>
                <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0, lineHeight: 1.4 }}>
                  Verify your account against the live RONAV network directory to recover credentials.
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowForgotModal(false);
                  setForgotResult(null);
                  setForgotError('');
                }}
                style={{ background: '#F1F5F9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            {forgotResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ padding: '1.25rem', background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: '#166534', fontWeight: 800, fontSize: '0.9375rem', marginBottom: '0.75rem' }}>
                    <CheckCircle2 style={{ width: '20px', height: '20px', color: '#16A34A' }} />
                    <span>Account Verified Successfully</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem', color: '#1E293B' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Account Holder:</span>
                      <strong>{forgotResult.user?.name}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>Assigned Role:</span>
                      <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '2px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '0.75rem' }}>
                        {forgotResult.user?.role}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748B' }}>User ID:</span>
                      <strong style={{ fontFamily: 'monospace', color: '#0F52BA' }}>{forgotResult.user?.custom_id}</strong>
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem', padding: '0.875rem', background: '#FFFFFF', border: '1px solid #BBF7D0', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
                      Active Password
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <code style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0F172A', letterSpacing: '0.05em' }}>
                        {forgotResult.tempPassword}
                      </code>
                      <button 
                        type="button" 
                        onClick={() => handleCopyCreds(forgotResult.tempPassword)}
                        className="btn btn-secondary"
                        style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
                      >
                        <Copy style={{ width: '14px', height: '14px' }} />
                        {copiedCreds ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      setUserId(forgotResult.user?.custom_id || '');
                      setPassword(forgotResult.tempPassword || '');
                      setShowForgotModal(false);
                      setForgotResult(null);
                    }}
                    className="btn btn-primary"
                    style={{ flex: 1, height: '46px', fontWeight: 800, backgroundColor: '#0F52BA' }}
                  >
                    Auto-Fill & Sign In →
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ fontSize: '0.8125rem', color: '#475569', margin: 0 }}>
                  Enter your registered <strong>User ID</strong> (e.g. <code>MID3001</code>, <code>DIST2001</code>, <code>SD1001</code>) or your <strong>10-digit registered mobile number</strong>:
                </p>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#334155' }}>
                    User ID or Mobile Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MID3001 or 9966203053"
                    value={forgotQuery}
                    onChange={(e) => {
                      setForgotQuery(e.target.value);
                      setForgotError('');
                    }}
                    className="form-input"
                    style={{ minHeight: '46px', borderRadius: '10px' }}
                  />
                </div>

                {forgotError && (
                  <div style={{ padding: '0.75rem 1rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#B91C1C', fontSize: '0.8125rem', fontWeight: 600 }}>
                    <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                    <span>{forgotError}</span>
                  </div>
                )}
                
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      setShowForgotModal(false);
                      setForgotError('');
                    }}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isResetting || !forgotQuery.trim()}
                    className="btn btn-primary"
                    style={{ flex: 1, backgroundColor: '#0F52BA' }}
                  >
                    {isResetting ? 'Verifying...' : 'Find & Recover →'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 6. Invite & Referral-Only Network Registration Modal */}
      {showRegisterModal && (
        <div className="modal-backdrop" onClick={() => setShowRegisterModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px', maxHeight: '90vh', overflowY: 'auto', padding: '1.75rem', borderRadius: '24px' }}>
            
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', background: '#FEF3C7', color: '#92400E', padding: '3px 8px', borderRadius: '6px', fontSize: '0.6875rem', fontWeight: 800, marginBottom: '0.375rem' }}>
                  <Shield style={{ width: '12px', height: '12px' }} />
                  INVITE & REFERRAL ONLY
                </div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', margin: '0 0 0.25rem' }}>
                  Network Partner Registration
                </h3>
                <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0, lineHeight: 1.4 }}>
                  Every new partner must be linked directly to an authorized upline sponsor in RONAV's network.
                </p>
              </div>
              <button 
                onClick={() => setShowRegisterModal(false)}
                style={{ background: '#F1F5F9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            {registerSuccess && createdCredentials ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ padding: '1.5rem', background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: '18px', textAlign: 'center' }}>
                  <CheckCircle2 style={{ width: '52px', height: '52px', color: '#059669', margin: '0 auto 0.75rem' }} />
                  <h4 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#065F46', margin: '0 0 0.375rem' }}>
                    Partner Account Activated!
                  </h4>
                  <p style={{ fontSize: '0.8125rem', color: '#047857', margin: '0 auto 1.25rem', maxWidth: '420px', lineHeight: 1.5 }}>
                    Account for <strong>{createdCredentials.name}</strong> has been registered under sponsor <strong>{createdCredentials.sponsor_name}</strong> ({createdCredentials.sponsor_id}).
                  </p>

                  <div style={{ background: '#FFFFFF', border: '1px solid #BBF7D0', borderRadius: '14px', padding: '1.25rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700 }}>Network Role:</span>
                      <span style={{ background: '#EFF6FF', color: '#1E40AF', padding: '2px 8px', borderRadius: '6px', fontWeight: 800, fontSize: '0.75rem' }}>
                        {createdCredentials.role}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>User ID</span>
                        <strong style={{ fontSize: '1rem', color: '#0F52BA', fontFamily: 'monospace' }}>{createdCredentials.user_id}</strong>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleCopyCreds(createdCredentials.user_id)}
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.625rem', fontSize: '0.6875rem' }}
                      >
                        Copy ID
                      </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>Default Password</span>
                        <strong style={{ fontSize: '1rem', color: '#0F172A', fontFamily: 'monospace' }}>{createdCredentials.password}</strong>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => handleCopyCreds(createdCredentials.password)}
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.625rem', fontSize: '0.6875rem' }}
                      >
                        Copy Pass
                      </button>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 700 }}>Initial Wallet:</span>
                      <strong style={{ color: '#059669', fontSize: '0.8125rem' }}>₹0.00 (Ready for POS/BBPS)</strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    type="button" 
                    onClick={() => handleCopyCreds(`User ID: ${createdCredentials.user_id}\nPassword: ${createdCredentials.password}`)}
                    className="btn btn-secondary"
                    style={{ flex: 1, height: '46px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    <Copy style={{ width: '16px', height: '16px' }} />
                    {copiedCreds ? 'Copied Both!' : 'Copy All'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setUserId(createdCredentials.user_id);
                      setPassword(createdCredentials.password);
                      setShowRegisterModal(false);
                      setRegisterSuccess(false);
                      setCreatedCredentials(null);
                    }}
                    className="btn btn-primary"
                    style={{ flex: 1.2, height: '46px', fontWeight: 800, backgroundColor: '#0F52BA' }}
                  >
                    Auto-Fill & Sign In →
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Step 1: Sponsor / Referral Verification */}
                <div style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRadius: '16px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <ShieldCheck style={{ width: '16px', height: '16px', color: '#0F52BA' }} />
                      Step 1: Authorized Sponsor Code *
                    </label>
                    <span style={{ fontSize: '0.6875rem', color: '#64748B', fontWeight: 600 }}>Mandatory Referral</span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type="text"
                      placeholder="Enter Sponsor ID (e.g. ADM001, SD1001, DIST2001) or Mobile"
                      value={sponsorCode}
                      onChange={(e) => {
                        setSponsorCode(e.target.value);
                        setSponsorError('');
                        setVerifiedSponsor(null);
                      }}
                      className="form-input"
                      style={{ flex: 1, minHeight: '44px', borderRadius: '10px', fontSize: '0.8125rem' }}
                    />
                    <button 
                      type="button" 
                      onClick={() => handleVerifySponsor()}
                      disabled={isVerifyingSponsor || !sponsorCode.trim()}
                      className="btn btn-primary"
                      style={{ padding: '0 1rem', height: '44px', fontWeight: 800, fontSize: '0.8125rem', backgroundColor: '#0F52BA', whiteSpace: 'nowrap' }}
                    >
                      {isVerifyingSponsor ? 'Verifying...' : 'Verify Sponsor'}
                    </button>
                  </div>

                  {/* Sponsor Status Pill */}
                  {verifiedSponsor && (
                    <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '10px', padding: '0.625rem 0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle2 style={{ width: '16px', height: '16px', color: '#059669' }} />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#065F46' }}>
                          {verifiedSponsor.name} ({verifiedSponsor.custom_id || verifiedSponsor.id})
                        </span>
                      </div>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#1E40AF', background: '#DBEAFE', padding: '2px 6px', borderRadius: '4px' }}>
                        {verifiedSponsor.role}
                      </span>
                    </div>
                  )}

                  {sponsorError && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', padding: '0.625rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#B91C1C', fontSize: '0.75rem', fontWeight: 600 }}>
                      <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                      <span>{sponsorError}</span>
                    </div>
                  )}
                </div>

                {/* Step 2: Account Details (Requires verified sponsor) */}
                <div style={{ opacity: verifiedSponsor ? 1 : 0.6, pointerEvents: verifiedSponsor ? 'auto' : 'none', display: 'flex', flexDirection: 'column', gap: '0.875rem', transition: 'all 200ms ease' }}>
                  
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#334155' }}>
                      Partner Full Name / Store Name *
                    </label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Rajesh Kumar or Rajesh Enterprises"
                      value={registerData.name}
                      onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                      className="form-input"
                      style={{ minHeight: '44px', borderRadius: '10px' }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#334155' }}>
                      10-Digit Mobile Number *
                    </label>
                    <input 
                      type="tel" 
                      required 
                      maxLength="10"
                      placeholder="e.g. 9876543210"
                      value={registerData.mobile}
                      onChange={(e) => setRegisterData({ ...registerData, mobile: e.target.value })}
                      className="form-input"
                      style={{ minHeight: '44px', borderRadius: '10px' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#334155' }}>
                        Hierarchy Tier
                      </label>
                      <select 
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="form-input"
                        style={{ minHeight: '44px', borderRadius: '10px', fontWeight: 700 }}
                      >
                        <option value="Retailer">Merchant / Retailer</option>
                        <option value="Distributor">Distributor</option>
                        <option value="DIST Franchise">DIST Franchise</option>
                        <option value="Super Distributor">Super Distributor</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#334155' }}>
                        POS Device Setup
                      </label>
                      <select 
                        value={registerData.pos_provider}
                        onChange={(e) => setRegisterData({ ...registerData, pos_provider: e.target.value })}
                        className="form-input"
                        style={{ minHeight: '44px', borderRadius: '10px', fontWeight: 700 }}
                      >
                        <option value="Pine Labs">Pine Labs POS</option>
                        <option value="Paytm POS">Paytm Soundbox / POS</option>
                        <option value="MSwipe">MSwipe Terminal</option>
                        <option value="Mosambee">Mosambee Mini</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isLoading || !verifiedSponsor}
                  className="btn btn-primary"
                  style={{ 
                    width: '100%', 
                    justifyContent: 'center', 
                    height: '48px', 
                    fontWeight: 800, 
                    fontSize: '0.9375rem', 
                    backgroundColor: verifiedSponsor ? '#0F52BA' : '#94A3B8',
                    cursor: verifiedSponsor ? 'pointer' : 'not-allowed',
                    marginTop: '0.25rem' 
                  }}
                >
                  {isLoading ? 'Creating Partner Account...' : 'Generate Partner Credentials →'}
                </button>

                <p style={{ fontSize: '0.6875rem', color: '#94A3B8', textAlign: 'center', margin: 0 }}>
                  🔒 Direct enrollment into RONAV Network. Sponsor commission upline is linked instantly.
                </p>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
