import React, { useState } from 'react';
import { 
  Zap, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight, 
  Send, 
  Receipt, 
  Smartphone, 
  Droplet, 
  Flame, 
  Tv, 
  Wifi, 
  CreditCard, 
  Phone,
  Clock,
  Check
} from 'lucide-react';

export default function ServiceBbpsPage({ onOpenLogin, onBack, onShowToast }) {
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    outletName: '',
    category: 'Retail Store / Supermarket',
    city: '',
    expectedTxns: '100 - 300 bills / month',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const categories = [
    { icon: <Zap style={{ width: '20px', height: '20px' }} />, title: 'Electricity Bills', desc: 'All state electricity distribution boards across India' },
    { icon: <Smartphone style={{ width: '20px', height: '20px' }} />, title: 'Mobile Postpaid & Prepaid', desc: 'Jio, Airtel, Vi, BSNL instant recharges and postpaid' },
    { icon: <Droplet style={{ width: '20px', height: '20px' }} />, title: 'Water Supply', desc: 'Municipal water tax and utility supply payment' },
    { icon: <Flame style={{ width: '20px', height: '20px' }} />, title: 'Piped Gas & Cylinder', desc: 'HP, Indane, Bharat Gas cylinder and piped gas' },
    { icon: <Tv style={{ width: '20px', height: '20px' }} />, title: 'DTH & Cable TV', desc: 'Tata Play, Airtel DTH, Sun Direct, Dish TV' },
    { icon: <Wifi style={{ width: '20px', height: '20px' }} />, title: 'Broadband & Landline', desc: 'ACT, JioFiber, Airtel Xstream, BSNL Fiber' }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.mobile) return;

    // Save lead to shared localStorage for Admin Dashboard
    const newBbpsInquiry = {
      id: 'BBPS-' + Math.floor(1000 + Math.random() * 9000),
      name: formData.name,
      phone: formData.mobile,
      outlet: formData.outletName || 'Retail Outlet',
      city: formData.city || 'Hyderabad / AP & TS',
      status: 'New',
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      expectedTxns: formData.expectedTxns,
      remarks: formData.message || 'BBPS Terminal activation request'
    };

    try {
      const existing = JSON.parse(localStorage.getItem('ronav_bbps_inquiries') || '[]');
      localStorage.setItem('ronav_bbps_inquiries', JSON.stringify([newBbpsInquiry, ...existing]));
    } catch (err) {
      console.error(err);
    }

    setSubmitted(true);
    if (onShowToast) onShowToast('✓ BBPS activation inquiry submitted to Admin for onboarding!');
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
              backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(217, 119, 6, 0.25) 0%, rgba(7, 22, 48, 0.95) 75%), url("/hero_bg.png")',
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
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.625rem', background: 'rgba(217,119,6,0.25)', border: '1px solid #D97706', borderRadius: '20px', fontSize: '0.6875rem', fontWeight: 800, color: '#FCD34D' }}>
                  <Zap style={{ width: '14px', height: '14px' }} />
                  <span>BHARAT BILLPAY (BBPS) ECOSYSTEM</span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', padding: '0.25rem 0.625rem', background: 'rgba(251, 191, 36, 0.15)', border: '1px solid rgba(251, 191, 36, 0.4)', borderRadius: '20px', fontSize: '0.6875rem', fontWeight: 800, color: '#FDE68A' }}>
                  <span>● 100+ BILLERS • INSTANT COMMISSION PAYOUT</span>
                </div>
              </div>

              <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.15, margin: '0 0 0.75rem', letterSpacing: '-0.02em' }}>
                BBPS Utility Bill <br />
                <span style={{ color: '#FBBF24' }}>Payments Engine.</span>
              </h1>

              <p style={{ fontSize: '0.875rem', color: '#94A3B8', lineHeight: 1.6, margin: '0 0 1.5rem', maxWidth: '520px' }}>
                Enable your retail outlet to collect electricity, water, gas, DTH, and mobile bills with zero failure rate and direct instant commission credited to your wallet.
              </p>

              {/* Highlights */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.06)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ fontSize: '0.6875rem', color: '#94A3B8', display: 'block', fontWeight: 700 }}>BILLING PARTNERS</span>
                  <strong style={{ fontSize: '1.125rem', color: '#FBBF24', fontWeight: 900 }}>20,000+ Billers</strong>
                  <span style={{ fontSize: '0.625rem', color: '#CBD5E1', display: 'block' }}>Pan-India official BBPS coverage</span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.06)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ fontSize: '0.6875rem', color: '#94A3B8', display: 'block', fontWeight: 700 }}>SETTLEMENT TIME</span>
                  <strong style={{ fontSize: '1.125rem', color: '#34D399', fontWeight: 900 }}>Real-Time Instant</strong>
                  <span style={{ fontSize: '0.625rem', color: '#CBD5E1', display: 'block' }}>Zero delay receipt generation</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <a 
                  href="#bbps-inquiry-form"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#D97706', borderColor: '#B45309', fontWeight: 800, padding: '0.75rem 1.5rem', borderRadius: '10px' }}
                >
                  <span>Activate BBPS Terminal</span>
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
                src="/bbps_bills.png" 
                alt="BBPS Bill Payments" 
                style={{ width: '100%', maxWidth: '280px', height: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 15px 30px rgba(0,0,0,0.5))' }}
              />
            </div>
          </div>

          {/* Supported Categories Grid */}
          <div style={{ marginBottom: '3rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#D97706', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                COMPREHENSIVE UTILITIES
              </span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', margin: '0.25rem 0' }}>
                All Utility Categories Under One Roof
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              {categories.map((cat, idx) => (
                <div key={idx} className="card" style={{ padding: '1.25rem', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#FFFBEB', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {cat.icon}
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem' }}>{cat.title}</h4>
                    <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0, lineHeight: 1.4 }}>{cat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Direct Dedicated Inquiry & Application Form */}
          <div id="bbps-inquiry-form" style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', border: '1px solid #E2E8F0', padding: '2rem', boxShadow: '0 12px 32px rgba(15,23,42,0.06)' }}>
            
            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#D97706', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                DIRECT BBPS ONBOARDING
              </span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', margin: '0.25rem 0' }}>
                Inquiry for BBPS Bill Payments
              </h2>
              <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0 }}>
                Fill in your details to get a callback from our merchant team within 2 hours.
              </p>
            </div>

            {submitted ? (
              <div style={{ padding: '2rem', borderRadius: '16px', background: '#FFFBEB', border: '1px solid #FDE68A', textAlign: 'center' }}>
                <CheckCircle2 style={{ width: '56px', height: '56px', color: '#D97706', margin: '0 auto 1rem' }} />
                <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#B45309', margin: '0 0 0.5rem' }}>
                  BBPS Activation Request Submitted!
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#92400E', maxWidth: '540px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
                  Thank you, <strong>{formData.name}</strong>. Your BBPS onboarding request has been received by RONAV Technologies. We will call you at <strong>{formData.mobile}</strong> within 2 hours.
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
                    style={{ backgroundColor: '#D97706', borderColor: '#B45309' }}
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
                      placeholder="e.g. Anand Sharma"
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
                    placeholder="Briefly describe your store location, expected bill volume, or requirements..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="form-input"
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ backgroundColor: '#D97706', borderColor: '#B45309', width: '100%', justifyContent: 'center', height: '50px', fontSize: '1rem', fontWeight: 800, boxShadow: '0 8px 24px rgba(217,119,6,0.35)' }}
                >
                  <span>Submit</span>
                  <Send style={{ width: '16px', height: '16px' }} />
                </button>

                <p style={{ fontSize: '0.75rem', color: '#94A3B8', textAlign: 'center', margin: 0 }}>
                  🔒 Official NPCI Bharat BillPay Certified Partner.
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
          .responsive-two-col {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

    </div>
  );
}
