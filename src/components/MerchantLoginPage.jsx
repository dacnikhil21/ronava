import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, LogIn, UserPlus, ShieldCheck, Headphones, Zap, TrendingUp, Phone, Mail, X } from 'lucide-react';

export default function MerchantLoginPage({ onLoginSuccess, onBackToHome }) {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotMobile, setForgotMobile] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

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
      <header style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0', padding: '0.875rem 1.25rem', position: 'sticky', top: 0, zIndex: 40 }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Logo */}
          <button 
            onClick={onBackToHome}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '0.625rem' }}
          >
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #0F52BA 0%, #0A3E90 100%)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.25rem' }}>
              R
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 900, fontSize: '1.125rem', color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1 }}>
                RONAV
              </div>
              <div style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#0F52BA', letterSpacing: '0.08em', marginTop: '2px' }}>
                TECHNOLOGIES
              </div>
            </div>
          </button>

          {/* Right Action Icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <a 
              href="tel:9966203053"
              style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#0F52BA', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
              title="Call Helpline"
            >
              <Phone style={{ width: '18px', height: '18px' }} />
            </a>

            <button
              onClick={onBackToHome}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0F172A', padding: '0.25rem' }}
              aria-label="Back to Home"
            >
              <X style={{ width: '24px', height: '24px' }} />
            </button>
          </div>

        </div>
      </header>

      {/* 2. Dark Navy Banner Header */}
      <div style={{ background: 'linear-gradient(180deg, #0A192F 0%, #0F2042 100%)', padding: '2.5rem 1rem 4rem', textAlign: 'center', color: '#FFFFFF', position: 'relative' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.375rem' }}>
          Merchant Login
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#93C5FD' }}>
          Access your Merchant Portal
        </p>
        <div style={{ width: '36px', height: '4px', background: '#0F52BA', borderRadius: '2px', margin: '0.75rem auto 0' }} />
      </div>

      {/* 3. Main Login Form Card (Overlaps Banner with Negative Top Margin) */}
      <main className="flex-grow container" style={{ marginTop: '-2.5rem', marginBottom: '2.5rem', maxWidth: '440px' }}>
        
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
                  required
                  placeholder="Enter User ID"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.875rem 0.75rem 2.625rem',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#F8FAFC',
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
                  required
                  placeholder="Enter Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 2.625rem 0.75rem 2.625rem',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#F8FAFC',
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
                justify: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(15, 82, 186, 0.3)',
                transition: 'all 200ms ease'
              }}
            >
              <LogIn style={{ width: '18px', height: '18px' }} />
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
                height: '48px',
                borderRadius: '10px',
                backgroundColor: '#FFFFFF',
                color: '#0F52BA',
                border: '1.5px solid #0F52BA',
                fontWeight: 800,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justify: 'center',
                gap: '0.5rem',
                transition: 'all 200ms ease'
              }}
            >
              <UserPlus style={{ width: '18px', height: '18px' }} />
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem', border: '1px solid #BFDBFE' }}>
                <ShieldCheck style={{ width: '28px', height: '28px' }} />
              </div>
              <strong style={{ fontSize: '0.8125rem', color: '#0F172A', display: 'block', lineHeight: 1.2 }}>Secure &<br />Reliable</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem', border: '1px solid #BFDBFE' }}>
                <Headphones style={{ width: '28px', height: '28px' }} />
              </div>
              <strong style={{ fontSize: '0.8125rem', color: '#0F172A', display: 'block', lineHeight: 1.2 }}>24x7<br />Support</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem', border: '1px solid #BFDBFE' }}>
                <Zap style={{ width: '28px', height: '28px' }} />
              </div>
              <strong style={{ fontSize: '0.8125rem', color: '#0F172A', display: 'block', lineHeight: 1.2 }}>Instant<br />Settlements</strong>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem', border: '1px solid #BFDBFE' }}>
                <TrendingUp style={{ width: '28px', height: '28px' }} />
              </div>
              <strong style={{ fontSize: '0.8125rem', color: '#0F172A', display: 'block', lineHeight: 1.2 }}>High Returns<br />& Growth</strong>
            </div>

          </div>
        </div>

        {/* 5. Contact / Help Desk 2-Column Card */}
        <div 
          className="card" 
          style={{ 
            backgroundColor: '#FFFFFF', 
            border: '1px solid #E2E8F0', 
            borderRadius: '16px', 
            padding: '1.25rem', 
            marginTop: '2rem',
            boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '0.75rem',
            alignItems: 'center'
          }}
        >
          {/* Phone Column */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <a 
              href="tel:9966203053" 
              style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#0F52BA', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textDecoration: 'none' }}
            >
              <Phone style={{ width: '20px', height: '20px' }} />
            </a>
            <div>
              <span style={{ fontSize: '0.6875rem', color: '#64748B', display: 'block', fontWeight: 600 }}>Need Help?</span>
              <a href="tel:9966203053" style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F52BA', textDecoration: 'none', display: 'block', lineHeight: 1.2 }}>
                9966203053
              </a>
              <span style={{ fontSize: '0.625rem', color: '#94A3B8' }}>Call / WhatsApp</span>
            </div>
          </div>

          {/* Vertical Separator & Email Column */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '1px solid #E2E8F0', paddingLeft: '0.75rem' }}>
            <a 
              href="mailto:rosenavaneethamenterprises@gmail.com" 
              style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#0F52BA', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textDecoration: 'none' }}
            >
              <Mail style={{ width: '20px', height: '20px' }} />
            </a>
            <div style={{ overflow: 'hidden' }}>
              <span style={{ fontSize: '0.6875rem', color: '#64748B', display: 'block', fontWeight: 600 }}>Email Us</span>
              <a 
                href="mailto:rosenavaneethamenterprises@gmail.com" 
                style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#0F52BA', textDecoration: 'none', wordBreak: 'break-all', display: 'block', lineHeight: 1.2 }}
              >
                rosenavaneethamenterprises@gmail.com
              </a>
            </div>
          </div>

        </div>

      </main>

      {/* 6. Blueprint Footer Bar */}
      <footer style={{ backgroundColor: '#0A192F', color: '#FFFFFF', textAlign: 'center', padding: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>
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
