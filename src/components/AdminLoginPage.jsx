import React, { useState, useEffect } from 'react';
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  LogIn, 
  Phone, 
  Mail, 
  X, 
  Menu, 
  ArrowRight,
  Shield,
  Activity,
  Settings,
  TrendingUp,
  Headphones,
  CheckCircle2
} from 'lucide-react';

export default function AdminLoginPage({ onLoginSuccess, onBackToHome }) {
  const [adminId, setAdminId] = useState('');
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
      onLoginSuccess();
    }, 800);
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
    <div className="min-h-screen flex flex-col bg-slate-50 relative font-sans" style={{ width: '100%', overflowX: 'hidden' }}>
      
      {/* 1. Header Navigation Bar (White Background matching the blueprint) */}
      <header style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0', padding: 'var(--nav-padding) 1rem', position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Brand Logo and Title */}
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
            {/* Symmetrical Vector TR Monogram Symbol in Blue */}
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

            {/* Letter-by-Letter Naming */}
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
                <span style={{
                  display: 'inline-block',
                  opacity: animated ? 1 : 0,
                  transform: animated ? 'translateX(0)' : 'translateX(-6px)',
                  transition: `opacity 300ms cubic-bezier(0.16, 1, 0.3, 1) 300ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) 300ms`
                }}>R</span>
                <span style={{
                  display: 'inline-block',
                  opacity: animated ? 1 : 0,
                  transform: animated ? 'translateX(0)' : 'translateX(-6px)',
                  transition: `opacity 300ms cubic-bezier(0.16, 1, 0.3, 1) 370ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) 370ms`
                }}>O</span>
                <span style={{
                  display: 'inline-block',
                  opacity: animated ? 1 : 0,
                  transform: animated ? 'translateX(0)' : 'translateX(-6px)',
                  transition: `opacity 300ms cubic-bezier(0.16, 1, 0.3, 1) 440ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) 440ms`
                }}>N</span>
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
                <span style={{
                  display: 'inline-block',
                  opacity: animated ? 1 : 0,
                  transform: animated ? 'translateX(0)' : 'translateX(-6px)',
                  transition: `opacity 300ms cubic-bezier(0.16, 1, 0.3, 1) 580ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) 580ms`
                }}>V</span>
              </div>
              
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
                <div style={{ height: '2px', width: '12px', background: 'linear-gradient(90deg, transparent, #0066FF)', borderRadius: '1px' }} />
                <span style={{ fontSize: 'clamp(0.45rem, 1.4vw, 0.58rem)', fontWeight: 800, color: '#475569', letterSpacing: '0.16em', lineHeight: 1 }}>
                  TECHNOLOGIES
                </span>
                <div style={{ height: '2px', width: '12px', background: 'linear-gradient(90deg, #0066FF, transparent)', borderRadius: '1px' }} />
              </div>
            </div>
          </button>

          {/* Contact Helpline Call Icon in Blue Circle */}
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
        <div className="mobile-drawer" style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', zIndex: 60, position: 'absolute', width: '100%' }}>
          <button onClick={onBackToHome} className="mobile-drawer-link" style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', color: '#0F172A' }}>
            Home
          </button>
          <button onClick={onBackToHome} className="mobile-drawer-link" style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', color: '#0F172A' }}>
            About Us
          </button>
          <button onClick={onBackToHome} className="mobile-drawer-link" style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%', color: '#0F172A' }}>
            Services
          </button>
        </div>
      )}

      {/* 2. Deep Blue Banner Header */}
      <div 
        style={{ 
          background: 'linear-gradient(to bottom, #0A192F 0%, #002244 100%)',
          padding: '3.5rem 1rem 6.5rem', 
          textAlign: 'center', 
          color: '#FFFFFF', 
          position: 'relative',
          clipPath: 'ellipse(130% 100% at 50% 0%)',
          borderBottom: '1px solid #1E293B',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        {/* White shield lock check icon */}
        <div style={{ width: '56px', height: '56px', borderRadius: '16px', border: '2.5px solid #FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.875rem' }}>
          <Shield style={{ width: '28px', height: '28px', color: '#FFFFFF', fill: '#0066FF' }} />
        </div>

        <h1 style={{ fontSize: 'var(--text-h1)', fontWeight: 900, color: '#FFFFFF', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
          Admin Login
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#38BDF8', fontWeight: 500 }}>
          Secure access to Admin Panel
        </p>
        
        {/* Blue accent line under banner title */}
        <div style={{ width: '40px', height: '4px', backgroundColor: '#0F52BA', borderRadius: '2px', margin: '0.75rem auto 0' }} />
      </div>

      {/* 3. Floating Login Card Container (White Card, Blue Button) */}
      <main className="flex-grow container" style={{ marginTop: '-4.5rem', marginBottom: '2.5rem', maxWidth: '440px', position: 'relative', zIndex: 10 }}>
        
        <div className="card" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', padding: '1.75rem 1.5rem', borderRadius: '18px', boxShadow: '0 12px 32px -4px rgba(15,23,42,0.1)' }}>
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
            
            {/* Admin ID field */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.375rem' }}>
                Admin ID
              </label>
              <div style={{ position: 'relative' }}>
                <User style={{ width: '18px', height: '18px', color: '#0F52BA', position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  required
                  placeholder="Enter Admin ID"
                  value={adminId}
                  onChange={(e) => setAdminId(e.target.value)}
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

            {/* Password field */}
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.375rem' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock style={{ width: '18px', height: '18px', color: '#0F52BA', position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
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

              {/* Forgot password link in blue */}
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

            {/* Login button (Ronav Blue `#0F52BA`) */}
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
              <LogIn style={{ width: '18px', height: '18px' }} />
              <span>{isLoading ? 'VERIFYING...' : 'LOGIN'}</span>
            </button>

          </form>

        </div>

        {/* 4. Admin Security Pillars (Light blue circle icons, blue labels) */}
        <div style={{ marginTop: '3rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0A192F', marginBottom: '0.25rem' }}>
            Secure. Monitor. Manage.
          </h2>
          <p style={{ fontSize: '0.8125rem', color: '#64748B', fontWeight: 500 }}>
            Everything from one powerful dashboard.
          </p>
          
          {/* Blue line accent below section header */}
          <div style={{ width: '40px', height: '4px', backgroundColor: '#0F52BA', borderRadius: '2px', margin: '0.5rem auto 1.5rem' }} />

          {/* 4 Pillars Horizontal Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', margin: '0 auto' }}>
            
            {/* Pillar 1: Secure Access */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.375rem', border: '1.5px solid #BFDBFE' }}>
                <Shield style={{ width: '22px', height: '22px' }} />
              </div>
              <strong style={{ fontSize: '0.6875rem', color: '#0A192F', display: 'block', lineHeight: 1.1, fontWeight: 700 }}>Secure<br />Access</strong>
            </div>

            {/* Pillar 2: Real-time Monitoring */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.375rem', border: '1.5px solid #BFDBFE' }}>
                <Activity style={{ width: '22px', height: '22px' }} />
              </div>
              <strong style={{ fontSize: '0.6875rem', color: '#0A192F', display: 'block', lineHeight: 1.1, fontWeight: 700 }}>Real-time<br />Monitoring</strong>
            </div>

            {/* Pillar 3: Efficient Management */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.375rem', border: '1.5px solid #BFDBFE' }}>
                <Settings style={{ width: '22px', height: '22px' }} />
              </div>
              <strong style={{ fontSize: '0.6875rem', color: '#0A192F', display: 'block', lineHeight: 1.1, fontWeight: 700 }}>Efficient<br />Management</strong>
            </div>

            {/* Pillar 4: Detailed Reports */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.375rem', border: '1.5px solid #BFDBFE' }}>
                <TrendingUp style={{ width: '22px', height: '22px' }} />
              </div>
              <strong style={{ fontSize: '0.6875rem', color: '#0A192F', display: 'block', lineHeight: 1.1, fontWeight: 700 }}>Detailed<br />Reports</strong>
            </div>

          </div>
        </div>

        {/* 5. Need Help Box (White Background, Light Blue Outline, Phone & Email) */}
        <div 
          className="card" 
          style={{ 
            backgroundColor: '#FFFFFF', 
            border: '1.5px solid #EFF6FF', 
            borderRadius: '16px', 
            padding: '1rem', 
            marginTop: '2rem',
            boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}
        >
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Headphones style={{ width: '20px', height: '20px' }} />
          </div>
          <div>
            <span style={{ fontSize: '0.75rem', color: '#0A192F', display: 'block', fontWeight: 700 }}>Need Help?</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569' }}>
              <a href="tel:9966203053" style={{ color: '#0F52BA', textDecoration: 'none', fontWeight: 800 }}>9966203053</a>
              <span style={{ color: '#94A3B8', margin: '0 6px' }}>|</span>
              <a href="mailto:admin@ronavtech.com" style={{ color: '#0F52BA', textDecoration: 'none', fontWeight: 800 }}>admin@ronavtech.com</a>
            </span>
          </div>
        </div>

      </main>

      {/* 6. Dark Navy Footer Bar */}
      <footer style={{ backgroundColor: '#0A192F', color: '#FFFFFF', textAlign: 'center', padding: '1.25rem', fontSize: '0.75rem', fontWeight: 600, borderTop: '1px solid #1E293B' }}>
        © 2021 – RONAV TECHNOLOGIES. All Rights Reserved.
      </footer>

      {/* Recover Password Recovery Modal */}
      {showForgotModal && (
        <div className="modal-backdrop" onClick={() => setShowForgotModal(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100 }}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '380px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', padding: '1.5rem', borderRadius: '14px' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0A192F', marginBottom: '0.375rem' }}>
              Admin Key Reset
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '1rem' }}>
              Enter your registered Security Code or Mobile Number to request a secret key recovery.
            </p>

            {forgotSuccess ? (
              <div style={{ padding: '1rem', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '12px', color: '#059669', textAlign: 'center', fontSize: '0.8125rem', fontWeight: 800 }}>
                ✓ Key reset request logged. Verification link sent to registered email.
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: '#0A192F', fontWeight: 700 }}>Secret Key Identifier</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter registered mobile or ID"
                    value={forgotMobile}
                    onChange={(e) => setForgotMobile(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.875rem',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      backgroundColor: '#FFFFFF',
                      fontSize: '0.875rem',
                      color: '#0F172A',
                      outline: 'none'
                    }}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button 
                    type="button" 
                    onClick={() => setShowForgotModal(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1, color: '#475569', backgroundColor: '#F1F5F9', border: 'none' }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    style={{ flex: 1, backgroundColor: '#0F52BA', border: 'none' }}
                  >
                    Log Request &rarr;
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
