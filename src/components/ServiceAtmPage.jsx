import React, { useState } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight, 
  Send, 
  Calculator, 
  TrendingUp, 
  MapPin, 
  Phone, 
  Clock, 
  Layers,
  Zap,
  Check
} from 'lucide-react';

export default function ServiceAtmPage({ onOpenLogin, onBack, onShowToast }) {
  // ATM Earnings calculator state
  const [dailyTxns, setDailyTxns] = useState(120);
  const [spaceType, setSpaceType] = useState('Front Shop Space');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    franchiseType: 'White-Label ATM + CDM (Dual Machine)',
    partnerCategory: 'Merchant / Retailer',
    spaceArea: '100 - 150 sq ft',
    location: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  // Revenue estimation
  // ~₹8 to ₹12 average payout per txn + non-financial txns
  const estimatedMonthlyEarnings = dailyTxns * 10 * 30;
  const estimatedAnnualEarnings = estimatedMonthlyEarnings * 12;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.mobile) return;

    // Save lead to shared localStorage for Admin Dashboard
    const newFranchiseInquiry = {
      id: 'FR-' + Math.floor(1000 + Math.random() * 9000),
      name: formData.name,
      phone: formData.mobile,
      location: formData.location || 'Hyderabad / Telangana',
      status: 'New',
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      spaceArea: formData.spaceArea,
      depositStatus: 'Inquiry Stage',
      siteReview: 'Pending Admin Assessment',
      proximityToBank: 'Commercial Spot'
    };

    try {
      const existing = JSON.parse(localStorage.getItem('ronav_franchise_inquiries') || '[]');
      localStorage.setItem('ronav_franchise_inquiries', JSON.stringify([newFranchiseInquiry, ...existing]));
    } catch (err) {
      console.error(err);
    }

    setSubmitted(true);
    if (onShowToast) onShowToast('✓ Franchise inquiry submitted to Admin for site assessment!');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" style={{ width: '100%', paddingTop: 'calc(var(--section-pad-top))' }}>
      
      {/* Main Container */}
      <main className="flex-grow" style={{ padding: '0.75rem 0 4rem' }}>
        <div className="container" style={{ maxWidth: '1080px', margin: '0 auto', padding: '0 1rem' }}>
          
          {/* Hero Section */}
          <div 
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: '2rem',
              alignItems: 'center',
              backgroundColor: '#071630',
              backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(15, 82, 186, 0.35) 0%, rgba(7, 22, 48, 0.95) 75%), url("/hero_bg.png")',
              backgroundSize: 'cover',
              padding: '2.5rem 2rem',
              borderRadius: '24px',
              color: '#FFFFFF',
              marginBottom: '2.5rem',
              boxShadow: '0 20px 48px rgba(15,23,42,0.25)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
            className="dedicated-service-hero"
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.625rem', background: 'rgba(15,82,186,0.3)', border: '1px solid #0F52BA', borderRadius: '20px', fontSize: '0.6875rem', fontWeight: 800, color: '#60A5FA' }}>
                  <Building2 style={{ width: '14px', height: '14px' }} />
                  <span>RONAV WHITE-LABEL OUTLET NETWORK</span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', padding: '0.25rem 0.625rem', background: 'rgba(96, 165, 250, 0.15)', border: '1px solid rgba(96, 165, 250, 0.4)', borderRadius: '20px', fontSize: '0.6875rem', fontWeight: 800, color: '#93C5FD' }}>
                  <span>● PASSIVE MONTHLY ROI • TURNKEY SETUP</span>
                </div>
              </div>

              <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.15, margin: '0 0 0.75rem', letterSpacing: '-0.02em' }}>
                ATM & Cash Deposit <br />
                <span style={{ color: '#38BDF8' }}>Machine Franchise.</span>
              </h1>

              <p style={{ fontSize: '0.875rem', color: '#94A3B8', lineHeight: 1.6, margin: '0 0 1.5rem', maxWidth: '520px' }}>
                Convert your commercial retail space into a high-footfall banking hub. Earn steady, guaranteed commissions on every cash withdrawal and deposit transaction.
              </p>

              {/* Highlights */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.06)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ fontSize: '0.6875rem', color: '#94A3B8', display: 'block', fontWeight: 700 }}>MINIMUM SPACE</span>
                  <strong style={{ fontSize: '1.125rem', color: '#38BDF8', fontWeight: 900 }}>40 - 100 Sq Ft</strong>
                  <span style={{ fontSize: '0.625rem', color: '#CBD5E1', display: 'block' }}>Commercial shop / lobby entrance</span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.06)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ fontSize: '0.6875rem', color: '#94A3B8', display: 'block', fontWeight: 700 }}>MONTHLY EARNINGS</span>
                  <strong style={{ fontSize: '1.125rem', color: '#34D399', fontWeight: 900 }}>₹35,000 to ₹90,000+</strong>
                  <span style={{ fontSize: '0.625rem', color: '#CBD5E1', display: 'block' }}>Direct transaction revenue</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <a 
                  href="#atm-inquiry-form"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#0F52BA', fontWeight: 800, padding: '0.75rem 1.5rem', borderRadius: '10px' }}
                >
                  <span>Apply for Franchise Setup</span>
                  <ArrowRight style={{ width: '16px', height: '16px' }} />
                </a>

                <a 
                  href="tel:9966203053"
                  className="btn btn-secondary"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.2)', fontWeight: 700 }}
                >
                  <Phone style={{ width: '16px', height: '16px' }} />
                  <span>Call 9966203053</span>
                </a>
              </div>
            </div>

            {/* 3D Illustration */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <img 
                src="/atm_lobby.png" 
                alt="ATM & CDM Franchise" 
                style={{ width: '100%', maxWidth: '280px', height: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 15px 30px rgba(0,0,0,0.5))' }}
              />
            </div>
          </div>

          {/* Interactive Franchise Earnings Calculator & Requirements */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '2rem', marginBottom: '3rem' }} className="responsive-split-grid">
            
            {/* Earnings Calculator */}
            <div className="card" style={{ padding: '1.75rem', backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 8px 24px rgba(15,23,42,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp style={{ width: '20px', height: '20px' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Franchise Monthly Revenue Calculator</h3>
                  <p style={{ fontSize: '0.6875rem', color: '#64748B', margin: 0 }}>Estimate income based on daily customer transactions</p>
                </div>
              </div>

              {/* Transactions Slider */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155' }}>Estimated Daily Transactions</label>
                  <span style={{ fontSize: '0.875rem', fontWeight: 900, color: '#0F52BA' }}>{dailyTxns} Swipes / Day</span>
                </div>
                <input 
                  type="range" 
                  min="30" 
                  max="400" 
                  step="10"
                  value={dailyTxns} 
                  onChange={(e) => setDailyTxns(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#0F52BA', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: '#94A3B8', marginTop: '2px' }}>
                  <span>30 txns/day (Low)</span>
                  <span>200 txns (Average)</span>
                  <span>400 txns (High Footfall)</span>
                </div>
              </div>

              {/* Results */}
              <div style={{ backgroundColor: '#F8FAFC', padding: '1rem', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', textAlign: 'center', gap: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 700, display: 'block' }}>MONTHLY ESTIMATE</span>
                  <strong style={{ fontSize: '1.25rem', color: '#059669', fontWeight: 900 }}>₹{estimatedMonthlyEarnings.toLocaleString('en-IN')}</strong>
                  <span style={{ fontSize: '0.625rem', color: '#64748B' }}>Net commission earnings</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 700, display: 'block' }}>ANNUAL ROI</span>
                  <strong style={{ fontSize: '1.25rem', color: '#0F52BA', fontWeight: 900 }}>₹{estimatedAnnualEarnings.toLocaleString('en-IN')}</strong>
                  <span style={{ fontSize: '0.625rem', color: '#64748B' }}>Recurring revenue stream</span>
                </div>
              </div>
            </div>

            {/* Turnkey Support Scope */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Turnkey <span style={{ color: '#0F52BA' }}>End-to-End Support</span>
              </h3>
              
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <Zap style={{ width: '22px', height: '22px', color: '#0F52BA', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ fontSize: '0.8125rem', color: '#0F172A', display: 'block' }}>Full Hardware & Booth Setup</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Complete installation of White-Label ATM and Cash Deposit Machine with illuminated signage.</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <ShieldCheck style={{ width: '22px', height: '22px', color: '#059669', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ fontSize: '0.8125rem', color: '#0F172A', display: 'block' }}>Cash Logistics & Armored Transit</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Secure, insured cash replenishment with 99.8% machine uptime monitoring.</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <Layers style={{ width: '22px', height: '22px', color: '#7C3AED', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ fontSize: '0.8125rem', color: '#0F172A', display: 'block' }}>Dual Revenue Stream</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Earn simultaneously on cash withdrawals, balance inquiries, and cash deposits.</span>
                </div>
              </div>
            </div>

          </div>

          {/* Direct Dedicated Inquiry & Application Form */}
          <div id="atm-inquiry-form" style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', border: '1px solid #E2E8F0', padding: '2rem', boxShadow: '0 12px 32px rgba(15,23,42,0.06)' }}>
            
            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#0F52BA', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                FRANCHISE APPLICATION
              </span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', margin: '0.25rem 0' }}>
                Inquiry for ATM & CDM Franchise
              </h2>
              <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0 }}>
                Fill in your details to get a callback from our merchant team within 2 hours.
              </p>
            </div>

            {submitted ? (
              <div style={{ padding: '2rem', borderRadius: '16px', background: '#EFF6FF', border: '1px solid #BFDBFE', textAlign: 'center' }}>
                <CheckCircle2 style={{ width: '56px', height: '56px', color: '#0F52BA', margin: '0 auto 1rem' }} />
                <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#1E40AF', margin: '0 0 0.5rem' }}>
                  Franchise Inquiry Submitted Successfully!
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#1E3A8A', maxWidth: '540px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
                  Thank you, <strong>{formData.name}</strong>. Your inquiry for ATM/CDM franchise installation has been forwarded to the RONAV Admin team. We will call you at <strong>{formData.mobile}</strong> within 2 hours.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <button 
                    onClick={() => setSubmitted(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Submit Another Inquiry
                  </button>
                  <button 
                    onClick={onBack}
                    className="btn btn-primary btn-sm"
                    style={{ backgroundColor: '#0F52BA' }}
                  >
                    Return to Homepage
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '720px', margin: '0 auto' }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="responsive-two-col">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#334155' }}>FULL NAME *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Rajesh Goud"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#334155' }}>MOBILE NUMBER *</label>
                    <input 
                      type="tel" 
                      required 
                      placeholder="10-digit Mobile No."
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#334155' }}>PARTNER CATEGORY</label>
                  <select 
                    value={formData.role || 'Merchant / Retailer'}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="form-input"
                  >
                    <option value="Merchant / Retailer">Merchant / Retailer</option>
                    <option value="Distributor">Distributor</option>
                    <option value="DIST Franchise">DIST Franchise (Distributor Franchise)</option>
                    <option value="Super Distributor">Super Distributor</option>
                    <option value="MASTER">MASTER (Master Distributor)</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#334155' }}>ADDITIONAL MESSAGE / REQUIREMENT</label>
                  <textarea 
                    rows="3" 
                    placeholder="Briefly describe your commercial location, city, space size, or footfall details..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="form-input"
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ backgroundColor: '#0F52BA', width: '100%', justifyContent: 'center', height: '50px', fontSize: '1rem', fontWeight: 800, boxShadow: '0 8px 24px rgba(15,82,186,0.35)' }}
                >
                  <span>Submit Franchise Request to Admin</span>
                  <Send style={{ width: '16px', height: '16px' }} />
                </button>

                <p style={{ fontSize: '0.75rem', color: '#94A3B8', textAlign: 'center', margin: 0 }}>
                  🔒 Official franchise partner. Fast callback by RONAV Admin team.
                </p>
              </form>
            )}

          </div>

        </div>
      </main>

      <style>{`
        @media (max-width: 767px) {
          .dedicated-service-hero {
            grid-template-columns: 1fr !important;
            padding: 2rem 1.25rem !important;
            border-radius: 16px !important;
            margin-bottom: 1.5rem !important;
          }
          .responsive-split-grid {
            grid-template-columns: 1fr !important;
          }
          .responsive-two-col {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

    </div>
  );
}
