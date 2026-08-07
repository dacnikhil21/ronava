import React, { useState } from 'react';
import { ShieldCheck, Eye, EyeOff, Lock, ArrowLeft, Headphones, CheckCircle2 } from 'lucide-react';

export default function AdminLoginPage({ onLoginSuccess, onBackToHome }) {
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onLoginSuccess();
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-between font-sans text-slate-100" style={{ width: '100%', overflowX: 'hidden' }}>
      
      {/* Top Bar Navigation */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '1rem 0', backgroundColor: '#070F1E' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button 
            onClick={onBackToHome}
            style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', fontWeight: 700 }}
          >
            <ArrowLeft style={{ width: '16px', height: '16px' }} />
            Back to Public Website
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="brand-icon-box" style={{ width: '30px', height: '30px', fontSize: '0.9375rem' }}>R</div>
            <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#FFFFFF' }}>RONAV</span>
            <span style={{ fontSize: '0.5625rem', fontWeight: 800, padding: '0.125rem 0.375rem', background: 'rgba(220,38,38,0.2)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px' }}>
              ADMIN COMMAND
            </span>
          </div>
        </div>
      </header>

      {/* Main Admin Authentication Portal */}
      <main style={{ padding: '2.5rem 0', display: 'flex', alignItems: 'center', flexGrow: 1 }}>
        <div className="container" style={{ maxWidth: '440px' }}>
          
          <div className="card" style={{ backgroundColor: '#0F172A', border: '1px solid #334155', borderRadius: '20px', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', color: '#FFFFFF' }}>
            
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.75rem', boxShadow: '0 8px 20px rgba(220,38,38,0.3)' }}>
                <ShieldCheck style={{ width: '26px', height: '26px' }} />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FFFFFF', margin: 0 }}>Ecosystem Command Center</h2>
              <p style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.25rem' }}>Secure Administrator Authentication Gateway</p>
            </div>

            <form onSubmit={handleSubmit}>
              
              <div className="form-group">
                <label className="form-label" style={{ color: '#CBD5E1' }}>Admin Identifier (ID)</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g. ADMIN_SUPER_01"
                  value={adminId}
                  onChange={(e) => setAdminId(e.target.value)}
                  className="form-input"
                  style={{ backgroundColor: '#1E293B', borderColor: '#475569', color: '#FFFFFF' }}
                />
              </div>

              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label" style={{ color: '#CBD5E1' }}>Secret Key Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input"
                    style={{ backgroundColor: '#1E293B', borderColor: '#475569', color: '#FFFFFF', paddingRight: '2.5rem' }}
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
                disabled={isLoading}
                className="btn btn-primary"
                style={{ width: '100%', backgroundColor: '#DC2626', borderColor: '#B91C1C', marginTop: '0.5rem', fontWeight: 800, fontSize: '0.875rem' }}
              >
                {isLoading ? 'AUTHENTICATING COMMAND SESSION...' : 'SECURE ADMIN LOGIN →'}
              </button>

            </form>

            <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #1E293B', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.6875rem', color: '#94A3B8' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <CheckCircle2 style={{ width: '14px', height: '14px', color: '#34D399' }} />
                <span>256-Bit Encrypted Admin Governance Session</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <CheckCircle2 style={{ width: '14px', height: '14px', color: '#34D399' }} />
                <span>Super Distributor & Merchant Network Audit Trail</span>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '1rem 0', textAlign: 'center', fontSize: '0.75rem', color: '#64748B' }}>
        <p>© 2021 – {new Date().getFullYear()} RONAV TECHNOLOGIES. Restricted System Access.</p>
      </footer>

    </div>
  );
}
