import React, { useState } from 'react';
import { X, User, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, PhoneCall } from 'lucide-react';

export default function LoginModal({ isOpen, mode, onClose, onSwitchMode }) {
  if (!isOpen) return null;

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);

  const isMerchant = mode === 'merchant';

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setLoggedInUser({
        name: isMerchant ? 'Ravi Retail Store' : 'Super Admin',
        mid: isMerchant ? 'RONAV12345' : 'ADM-001',
        role: isMerchant ? 'Merchant Partner' : 'System Administrator'
      });
    }, 600);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        
        {/* Close Button */}
        <button 
          onClick={onClose} 
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '0.375rem', borderRadius: '6px' }}
        >
          <X style={{ width: '20px', height: '20px' }} />
        </button>

        {loggedInUser ? (
          /* Simulated Successful Login Screen */
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <CheckCircle2 style={{ width: '32px', height: '32px' }} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Welcome Back, {loggedInUser.name}!</h3>
            <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>
              Authenticated successfully into <strong>{loggedInUser.role}</strong> ({loggedInUser.mid}).
            </p>

            <div className="card" style={{ padding: '1rem', backgroundColor: '#F8FAFC', textAlign: 'left', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Account ID:</span>
                <strong style={{ color: '#0F172A' }}>{loggedInUser.mid}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Portal Mode:</span>
                <strong style={{ color: '#0F52BA' }}>{isMerchant ? 'Merchant Operational Workspace' : 'Admin Ecosystem Control'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748B' }}>Session Security:</span>
                <strong style={{ color: '#059669' }}>256-Bit Encrypted</strong>
              </div>
            </div>

            <button 
              onClick={() => { setLoggedInUser(null); onClose(); }} 
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Close & Enter Workspace
            </button>
          </div>
        ) : (
          /* Authentication Form */
          <div>
            
            {/* Header Banner */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', border: '1px solid #BFDBFE' }}>
                {isMerchant ? <User style={{ width: '24px', height: '24px' }} /> : <Lock style={{ width: '24px', height: '24px' }} />}
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                {isMerchant ? 'Merchant Login' : 'Admin Login'}
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>
                {isMerchant ? 'Access your Merchant Portal operational workspace' : 'Secure access to Ecosystem Command Center'}
              </p>
            </div>

            {/* Portal Switcher Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem', padding: '0.25rem', background: '#F1F5F9', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.75rem', fontWeight: 700 }}>
              <button 
                type="button"
                onClick={() => onSwitchMode('merchant')}
                style={{ padding: '0.5rem', borderRadius: '6px', border: 'none', background: isMerchant ? '#FFFFFF' : 'transparent', color: isMerchant ? '#0F52BA' : '#64748B', cursor: 'pointer', boxShadow: isMerchant ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}
              >
                Merchant Portal
              </button>
              <button 
                type="button"
                onClick={() => onSwitchMode('admin')}
                style={{ padding: '0.5rem', borderRadius: '6px', border: 'none', background: !isMerchant ? '#FFFFFF' : 'transparent', color: !isMerchant ? '#0F52BA' : '#64748B', cursor: 'pointer', boxShadow: !isMerchant ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}
              >
                Admin Portal
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{isMerchant ? 'User ID / Merchant ID' : 'Admin ID'}</label>
                <div style={{ position: 'relative' }}>
                  <User style={{ width: '16px', height: '16px', color: '#94A3B8', position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input 
                    type="text" 
                    required 
                    placeholder={isMerchant ? 'e.g. RONAV12345' : 'e.g. ADM-001'}
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: '2.25rem' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <label className="form-label" style={{ margin: 0 }}>Password</label>
                  <a href="#contact" onClick={onClose} style={{ fontSize: '0.75rem', color: '#0F52BA', fontWeight: 700 }}>Forgot Password?</a>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock style={{ width: '16px', height: '16px', color: '#94A3B8', position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    required 
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: '2.25rem', paddingRight: '2.5rem' }}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                  >
                    {showPassword ? <EyeOff style={{ width: '16px', height: '16px' }} /> : <Eye style={{ width: '16px', height: '16px' }} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
              >
                {loading ? 'Authenticating...' : `LOGIN TO ${isMerchant ? 'MERCHANT' : 'ADMIN'} PORTAL`}
                {!loading && <ArrowRight style={{ width: '16px', height: '16px' }} />}
              </button>

              {isMerchant && (
                <div style={{ paddingTop: '0.75rem', textAlign: 'center', borderTop: '1px solid #F1F5F9' }}>
                  <a 
                    href="#contact" 
                    onClick={onClose}
                    style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F52BA', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <span>New Merchant? Register / Sign Up Now</span>
                    <ArrowRight style={{ width: '14px', height: '14px' }} />
                  </a>
                </div>
              )}

            </form>

            <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyBetween: 'space-between', fontSize: '0.75rem', color: '#64748B' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 700, color: '#0F172A' }}>
                <PhoneCall style={{ width: '14px', height: '14px', color: '#0F52BA' }} /> Helpdesk: 9966203053
              </span>
              <span style={{ fontSize: '0.6875rem', color: '#94A3B8' }}>© 2021 RONAV</span>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
