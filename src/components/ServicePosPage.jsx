import React, { useState } from 'react';
import { submitInquiry } from '../services/api';
import { 
  CreditCard, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight, 
  Send, 
  QrCode, 
  Smartphone, 
  Volume2, 
  Code, 
  Zap, 
  Phone,
  Clock,
  Layers,
  Check
} from 'lucide-react';

export default function ServicePosPage({ onOpenLogin, onBack, onShowToast }) {
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    businessName: '',
    deviceType: 'Android Smart Touchscreen POS',
    city: '',
    monthlyVolume: '₹1 Lakh - ₹5 Lakhs / month',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const deviceTypes = [
    { 
      icon: <Smartphone style={{ width: '22px', height: '22px' }} />, 
      title: 'Android Touch POS', 
      desc: 'Built-in receipt printer, 4G SIM + Wi-Fi, supports all Debit/Credit cards & contactless tap-to-pay.' 
    },
    { 
      icon: <Volume2 style={{ width: '22px', height: '22px' }} />, 
      title: 'Voice Alert Soundbox', 
      desc: 'Instant multilingual voice confirmation on every UPI QR payment. Loud and clear audio.' 
    },
    { 
      icon: <QrCode style={{ width: '22px', height: '22px' }} />, 
      title: 'All-in-One Dynamic QR', 
      desc: 'Accept payments from PhonePe, Google Pay, Paytm, Cred, and all UPI applications with 0% MDR.' 
    },
    { 
      icon: <Code style={{ width: '22px', height: '22px' }} />, 
      title: 'E-Commerce Gateway API', 
      desc: 'Developer-friendly checkout SDK & APIs for websites, mobile apps, and billing software.' 
    }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.mobile) return;

    submitInquiry({
      type: 'POS',
      name: formData.name,
      phone: formData.mobile,
      category: formData.deviceType || 'Smart POS',
      location: formData.city || 'Hyderabad / AP & TS',
      amount: formData.monthlyVolume || 'N/A',
      remarks: `${formData.businessName ? formData.businessName + ' • ' : ''}${formData.message || 'POS Terminal & Gateway request'}`
    }).catch(err => console.error(err));

    setSubmitted(true);
    if (onShowToast) onShowToast('✓ POS inquiry submitted to Admin for credential dispatch!');
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
              backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(124, 58, 237, 0.25) 0%, rgba(7, 22, 48, 0.95) 75%), url("/hero_bg.png")',
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
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.625rem', background: 'rgba(124,58,237,0.25)', border: '1px solid #7C3AED', borderRadius: '20px', fontSize: '0.6875rem', fontWeight: 800, color: '#C4B5FD' }}>
                  <CreditCard style={{ width: '14px', height: '14px' }} />
                  <span>RONAV MERCHANT ACQUIRING</span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', padding: '0.25rem 0.625rem', background: 'rgba(196, 181, 253, 0.15)', border: '1px solid rgba(196, 181, 253, 0.4)', borderRadius: '20px', fontSize: '0.6875rem', fontWeight: 800, color: '#DDD6FE' }}>
                  <span>● MULTI-BANK CARD SWIPES • T+0 SAME-DAY SETTLEMENT</span>
                </div>
              </div>

              <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.15, margin: '0 0 0.75rem', letterSpacing: '-0.02em' }}>
                Payment Gateway & <br />
                <span style={{ color: '#A78BFA' }}>Android POS Terminals.</span>
              </h1>

              <p style={{ fontSize: '0.875rem', color: '#94A3B8', lineHeight: 1.6, margin: '0 0 1.5rem', maxWidth: '520px' }}>
                Accept all payment methods seamlessly — from Credit/Debit cards and contactless Tap & Pay to dynamic QR codes and online payment gateway integrations.
              </p>

              {/* Highlights */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.06)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ fontSize: '0.6875rem', color: '#94A3B8', display: 'block', fontWeight: 700 }}>PAYMENT METHODS</span>
                  <strong style={{ fontSize: '1.125rem', color: '#A78BFA', fontWeight: 900 }}>Card + UPI + QR</strong>
                  <span style={{ fontSize: '0.625rem', color: '#CBD5E1', display: 'block' }}>Visa, RuPay, Mastercard, Amex</span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.06)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ fontSize: '0.6875rem', color: '#94A3B8', display: 'block', fontWeight: 700 }}>PAYOUT FREQUENCY</span>
                  <strong style={{ fontSize: '1.125rem', color: '#34D399', fontWeight: 900 }}>T+0 Instant Payout</strong>
                  <span style={{ fontSize: '0.625rem', color: '#CBD5E1', display: 'block' }}>Direct settlement to your bank</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <a 
                  href="#pos-inquiry-form"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#7C3AED', borderColor: '#6D28D9', fontWeight: 800, padding: '0.75rem 1.5rem', borderRadius: '10px' }}
                >
                  <span>Request POS Machine / API</span>
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
                src="/pos_gateway.png" 
                alt="Payment Gateway and POS Solutions" 
                style={{ width: '100%', maxWidth: '280px', height: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 15px 30px rgba(0,0,0,0.5))' }}
              />
            </div>
          </div>

          {/* Solutions Breakdown Grid */}
          <div style={{ marginBottom: '3rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#7C3AED', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                OMNICHANNEL ACQUIRING
              </span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', margin: '0.25rem 0' }}>
                Hardware & Online Solutions for Every Merchant
              </h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              {deviceTypes.map((item, idx) => (
                <div key={idx} className="card" style={{ padding: '1.5rem', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#F5F3FF', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.icon}
                  </div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>{item.title}</h4>
                  <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Direct Dedicated Inquiry & Application Form */}
          <div id="pos-inquiry-form" style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', border: '1px solid #E2E8F0', padding: '2rem', boxShadow: '0 12px 32px rgba(15,23,42,0.06)' }}>
            
            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#7C3AED', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                MERCHANT TERMINAL DISPATCH
              </span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', margin: '0.25rem 0' }}>
                Inquiry for Payment Gateway & POS
              </h2>
              <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0 }}>
                Fill in your details to get a callback from our merchant team within 2 hours.
              </p>
            </div>

            {submitted ? (
              <div style={{ padding: '2rem', borderRadius: '16px', background: '#F5F3FF', border: '1px solid #DDD6FE', textAlign: 'center' }}>
                <CheckCircle2 style={{ width: '56px', height: '56px', color: '#7C3AED', margin: '0 auto 1rem' }} />
                <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#5B21B6', margin: '0 0 0.5rem' }}>
                  POS & Gateway Request Submitted!
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#6D28D9', maxWidth: '540px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
                  Thank you, <strong>{formData.name}</strong>. Your POS/Gateway request has been received by RONAV Technologies. We will contact you at <strong>{formData.mobile}</strong> within 2 hours.
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
                    style={{ backgroundColor: '#7C3AED' }}
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
                      placeholder="e.g. Vikram Verma"
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
                    placeholder="Briefly describe your business location, store details, or POS requirements..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="form-input"
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ backgroundColor: '#7C3AED', borderColor: '#6D28D9', width: '100%', justifyContent: 'center', height: '50px', fontSize: '1rem', fontWeight: 800, boxShadow: '0 8px 24px rgba(124,58,237,0.35)' }}
                >
                  <span>Submit</span>
                  <Send style={{ width: '16px', height: '16px' }} />
                </button>

                <p style={{ fontSize: '0.75rem', color: '#94A3B8', textAlign: 'center', margin: 0 }}>
                  🔒 Fast dispatch. Same-day settlement support across AP & TS.
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
