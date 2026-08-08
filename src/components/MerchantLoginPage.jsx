import React, { useState, useEffect } from 'react';
import { User, Lock, Eye, EyeOff, LogIn, UserPlus, ShieldCheck, Headphones, Zap, TrendingUp, Phone, Mail, X, Menu, ArrowRight } from 'lucide-react';

export default function MerchantLoginPage({ onLoginSuccess, onBackToHome }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotMobile, setForgotMobile] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimated(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess({
        name: userId || 'Ravi Merchant Store',
        mid: 'MID: RONAV' + Math.floor(10000 + Math.random() * 90000)
      });
    }, 700);
  };

  const handleForgotSubmit = (e) => {
    e.preventDefault();
    setForgotSuccess(true);
    setTimeout(() => {
      setForgotSuccess(false);
      setShowForgotModal(false);
      setForgotMobile('');
    }, 2500);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 relative font-sans" style={{ width: '100%' }}>
      
      {/* 1. Header Navigation Bar (Same-to-Same Blueprint) */}
      <header style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0', padding: 'var(--nav-padding) 1rem', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Logo */}
          <button 
            onClick={onBackToHome}
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              padding: 0, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.625rem',
              textAlign: 'left'
            }}
          >
            {/* Symmetrical Vector TR Monogram Symbol (Official Shape) */}
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

            {/* Letter-by-Letter Writing Animation Naming */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div 
                style={{ 
                  fontSize: 'clamp(1.2rem, 3.8vw, 1.5rem)', 
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
                    width: 'clamp(0.95rem, 3vw, 1.15rem)',
                    height: 'clamp(0.95rem, 3vw, 1.15rem)',
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
                  marginTop: '3px'
                }}
              >
                {/* Accent Line Left */}
                <div style={{ height: '2px', width: '12px', background: 'linear-gradient(90deg, transparent, #0066FF)', borderRadius: '1px' }} />
                <span 
                  style={{ 
                    fontSize: 'clamp(0.45rem, 1.4vw, 0.58rem)', 
                    fontWeight: 800, 
                    color: '#475569', 
                    letterSpacing: '0.16em', 
                    lineHeight: 1
                  }}
                >
                  TECHNOLOGIES
                </span>
                {/* Accent Line Right */}
                <div style={{ height: '2px', width: '12px', background: 'linear-gradient(90deg, #0066FF, transparent)', borderRadius: '1px' }} />
              </div>
            </div>
          </button>

          {/* Right Action Icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <a 
              href="tel:9966203053"
              style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#0F52BA', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
              title="Call Helpline"
            >
              <Phone style={{ width: '16px', height: '16px' }} />
            </a>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0F172A', padding: '0.25rem', display: 'flex', alignItems: 'center' }}
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X style={{ width: '24px', height: '24px' }} /> : <Menu style={{ width: '24px', height: '24px' }} />}
            </button>
          </div>

        </div>
      </header>

      {/* Mobile menu drawer */}
      {mobileMenuOpen && (
        <div className="mobile-drawer" style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', zIndex: 60 }}>
          <button onClick={onBackToHome} className="mobile-drawer-link" style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%' }}>
            Home
          </button>
          <button onClick={onBackToHome} className="mobile-drawer-link" style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%' }}>
            About Us
          </button>
          <button onClick={onBackToHome} className="mobile-drawer-link" style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%' }}>
            Services
          </button>
          <a href="#network" onClick={onBackToHome} className="mobile-drawer-link">
            Business Network
          </a>
          <a href="#why-us" onClick={onBackToHome} className="mobile-drawer-link">
            Why Choose Us
          </a>
        </div>
      )}

      {/* 2. Dark Navy Banner Header */}
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
        <h1 style={{ fontSize: 'var(--text-h1)', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
          Merchant Login
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500 }}>
          Access your Merchant Portal
        </p>
        <div style={{ width: '36px', height: '4px', background: '#0F52BA', borderRadius: '2px', margin: '0.75rem auto 0' }} />
      </div>

      {/* 3. Main Login Form Card (Overlaps Banner with Negative Top Margin) */}
      <main className="flex-grow container" style={{ marginTop: '-4rem', marginBottom: '2.5rem', maxWidth: '440px', position: 'relative', zIndex: 10 }}>
        
        <div className="card" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', padding: '1.75rem 1.5rem', borderRadius: '18px', boxShadow: '0 12px 32px -4px rgba(15,23,42,0.1)' }}>
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
            
            {/* User ID Field */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.375rem' }}>
                User ID
              </label>
              <div style={{ position: 'relative' }}>
                <User style={{ width: '18px', height: '18px', color: '#0F52BA', position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Enter User ID"
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
              <span>{isLoading ? 'AUTHENTICATING...' : 'LOGIN'}</span>
            </button>

            {/* OR Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.25rem 0' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
              <span style={{ fontSize: '0.75rem', color: '#94A3B8', fontWeight: 600 }}>or</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: '#E2E8F0' }} />
            </div>

            {/* New Merchant Sign Up Outlined Button */}
            <button
              type="button"
              onClick={onBackToHome}
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
              <span>New Merchant? Sign Up</span>
            </button>

          </form>

        </div>

        {/* 4. Why Partner with RONAV? Section */}
        <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.25rem' }}>
            Why Partner with <span style={{ color: '#0F52BA' }}>RONAV</span>?
          </h2>
          <div style={{ width: '36px', height: '3px', background: '#0F52BA', borderRadius: '2px', margin: '0.5rem auto 1.5rem' }} />

          {/* 4 Pillar Badges (2x2 Grid) */}
          {/* 4 Pillar Badges (4-Column Row matching reference exactly) */}
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

        {/* 5. Contact / Help Desk Card (Responsive columns, fits email cleanly) */}
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

      {/* 6. Blueprint Footer Bar */}
      <footer style={{ backgroundColor: '#0B46AD', color: '#FFFFFF', textAlign: 'center', padding: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>
        © 2021 – RONAV TECHNOLOGIES. All Rights Reserved.
      </footer>

      {/* Forgot Password Recovery Modal */}
      {showForgotModal && (
        <div className="modal-backdrop" onClick={() => setShowForgotModal(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.375rem' }}>
              Merchant Password Reset
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '1rem' }}>
              Enter your registered User ID or Mobile Number to receive a password reset OTP.
            </p>

            {forgotSuccess ? (
              <div style={{ padding: '1rem', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '12px', color: '#059669', textAlign: 'center', fontSize: '0.8125rem', fontWeight: 800 }}>
                ✓ Password Reset OTP sent to your mobile number!
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">User ID / Registered Mobile</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter User ID or 9966203053"
                    value={forgotMobile}
                    onChange={(e) => setForgotMobile(e.target.value)}
                    className="form-input"
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowForgotModal(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                  >
                    Send OTP →
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
