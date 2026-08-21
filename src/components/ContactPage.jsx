import React, { useState } from 'react';
import { 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  Send, 
  CheckCircle2, 
  MessageSquare, 
  ShieldCheck, 
  Sparkles,
  ArrowRight,
  Headphones,
  Building,
  Navigation
} from 'lucide-react';

export default function ContactPage({ onBack, onShowToast }) {
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    service: 'PG & POS Solutions',
    role: 'Merchant / Retailer',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.mobile) return;

    const newInquiry = {
      id: 'INQ' + Math.floor(10000 + Math.random() * 90000),
      name: formData.name,
      mobile: formData.mobile,
      service: formData.service,
      role: formData.role,
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      message: formData.message || 'Direct inquiry from dedicated contact page',
      status: 'New'
    };

    try {
      const existing = JSON.parse(localStorage.getItem('ronav_general_inquiries') || '[]');
      localStorage.setItem('ronav_general_inquiries', JSON.stringify([newInquiry, ...existing]));
    } catch (err) {
      console.error(err);
    }

    setSubmitted(true);
    if (onShowToast) {
      onShowToast('✓ Inquiry submitted! Our enterprise team will call you within 2 hours.');
    }
  };

  return (
    <div className="contact-page min-h-screen bg-slate-50">
      
      {/* 1. Dedicated Header Banner */}
      <section 
        style={{ 
          backgroundColor: '#060B1E',
          backgroundImage: 'radial-gradient(circle at 75% 30%, rgba(15, 82, 186, 0.25) 0%, rgba(6, 11, 30, 0.95) 70%), url("/hero_bg.png")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          paddingTop: 'calc(var(--section-pad-top) + 65px)',
          paddingBottom: '3.5rem',
          color: '#FFFFFF',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <div className="container" style={{ textAlign: 'center', maxWidth: '820px' }}>
          
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.75rem', background: 'rgba(15, 82, 186, 0.25)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '20px', fontSize: '0.75rem', color: '#7DD3FC', fontWeight: 800, marginBottom: '1rem' }}>
            <Sparkles style={{ width: '14px', height: '14px' }} />
            <span>24x7 ENTERPRISE SUPPORT & ONBOARDING</span>
          </div>

          <h1 style={{ fontSize: 'var(--text-h1)', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.15, margin: '0 0 1rem', letterSpacing: '-0.02em' }}>
            Connect with <span style={{ color: '#38BDF8' }}>RONAV Technologies</span>
          </h1>

          <p style={{ fontSize: 'var(--text-body)', lineHeight: 1.6, color: '#94A3B8', fontWeight: 400, maxWidth: '640px', margin: '0 auto' }}>
            Have questions about merchant POS, ATM & CDM franchise setups, BBPS integration, or partner credit? Our team is available round the clock.
          </p>

        </div>
      </section>

      {/* 2. Main Content: Contact Matrix & Inquiry Form */}
      <main className="container" style={{ padding: '3.5rem 1rem 5rem', maxWidth: '1100px' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '2.5rem', alignItems: 'flex-start' }} className="contact-grid-split">
          
          {/* Left Column: Direct Contact Info Matrix */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F52BA', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                DIRECT REACH
              </span>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 900, color: '#0F172A', margin: '0.25rem 0 0.5rem' }}>
                Get in Touch Directly
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#64748B', lineHeight: 1.5, margin: 0 }}>
                Reach out via phone, WhatsApp, or email. We respond to inquiries in real-time.
              </p>
            </div>

            {/* Phone & WhatsApp Card */}
            <div className="card" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '18px', padding: '1.5rem', boxShadow: '0 4px 16px rgba(15,23,42,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Phone style={{ width: '22px', height: '22px' }} />
                </div>
                <div style={{ flexGrow: 1 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', display: 'block' }}>Hotline / WhatsApp</span>
                  <a 
                    href="tel:9966203053" 
                    style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', textDecoration: 'none', display: 'block', margin: '2px 0 6px' }}
                  >
                    +91 9966203053
                  </a>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <a 
                      href="tel:9966203053" 
                      className="btn btn-sm btn-primary"
                      style={{ backgroundColor: '#0F52BA', fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                    >
                      <span>Direct Call</span>
                    </a>
                    <a 
                      href="https://wa.me/919966203053" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn btn-sm"
                      style={{ backgroundColor: '#10B981', color: '#FFFFFF', fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
                    >
                      <MessageSquare style={{ width: '14px', height: '14px' }} />
                      <span>WhatsApp</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Email Card */}
            <div className="card" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '18px', padding: '1.5rem', boxShadow: '0 4px 16px rgba(15,23,42,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#EFF6FF', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Mail style={{ width: '22px', height: '22px' }} />
                </div>
                <div style={{ flexGrow: 1, overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', display: 'block' }}>Official Support Email</span>
                  <a 
                    href="mailto:rosenavaneethamenterprises@gmail.com" 
                    style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F52BA', textDecoration: 'none', display: 'block', wordBreak: 'break-all', margin: '2px 0 6px' }}
                  >
                    rosenavaneethamenterprises@gmail.com
                  </a>
                  <span style={{ fontSize: '0.6875rem', color: '#94A3B8' }}>Inquiries answered within 2 hours</span>
                </div>
              </div>
            </div>

            {/* Headquarters & Operating Hours */}
            <div className="card" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '18px', padding: '1.5rem', boxShadow: '0 4px 16px rgba(15,23,42,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: '#F8FAFC', color: '#0F52BA', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MapPin style={{ width: '22px', height: '22px' }} />
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', display: 'block' }}>Registered Office & Hub</span>
                  <strong style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', display: 'block', margin: '2px 0 4px' }}>
                    Hyderabad, Telangana, India
                  </strong>
                  <p style={{ fontSize: '0.75rem', color: '#64748B', margin: '0 0 0.5rem', lineHeight: 1.4 }}>
                    Regional merchant distribution hubs active across Andhra Pradesh & Telangana.
                  </p>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.6875rem', color: '#059669', fontWeight: 700 }}>
                    <Clock style={{ width: '13px', height: '13px' }} />
                    <span>24x7 Technical & Merchant Operations Active</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Dedicated General Partner Inquiry Form (with selector service field) */}
          <div 
            className="card" 
            style={{ 
              backgroundColor: '#FFFFFF', 
              border: '1px solid #E2E8F0', 
              borderRadius: '24px', 
              padding: '2.25rem 2rem', 
              boxShadow: '0 16px 40px -8px rgba(15,23,42,0.08)' 
            }}
          >
            
            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#0F52BA', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                GENERAL INQUIRY & ONBOARDING
              </span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', margin: '0.25rem 0 0.35rem' }}>
                Send an Inquiry / Contact Us
              </h2>
              <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0, lineHeight: 1.4 }}>
                Fill in your details to get a callback from our merchant team within 2 hours.
              </p>
            </div>

            {submitted ? (
              <div style={{ padding: '2.5rem 1.5rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '16px', textAlign: 'center' }}>
                <CheckCircle2 style={{ width: '56px', height: '56px', color: '#059669', margin: '0 auto 1rem' }} />
                <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#065F46', margin: '0 0 0.5rem' }}>
                  Inquiry Dispatched to Admin!
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#047857', lineHeight: 1.6, margin: '0 auto 1.5rem', maxWidth: '420px' }}>
                  Thank you, <strong>{formData.name}</strong>. Your inquiry for <strong>{formData.service}</strong> as a <strong>{formData.role}</strong> has been received. Our team will connect with you at <strong>{formData.mobile}</strong> shortly.
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
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
                
                {/* Full Name Field */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#334155' }}>
                    FULL NAME *
                  </label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Ramesh Kumar"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="form-input"
                    style={{ minHeight: '48px', borderRadius: '10px' }}
                  />
                </div>

                {/* Mobile Number Field */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#334155' }}>
                    MOBILE NUMBER *
                  </label>
                  <input 
                    type="tel" 
                    required 
                    placeholder="10-digit Mobile No."
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="form-input"
                    style={{ minHeight: '48px', borderRadius: '10px' }}
                  />
                </div>

                {/* Service Interested Selector Field */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#334155' }}>
                    SERVICE INTERESTED
                  </label>
                  <select 
                    value={formData.service}
                    onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                    className="form-input"
                    style={{ minHeight: '48px', borderRadius: '10px', fontWeight: 700 }}
                  >
                    <option value="PG & POS Solutions">PG & POS Solutions (Payment Gateway & Terminals)</option>
                    <option value="Personal & Business Loans">Personal & Business Loans (Credit Disbursal)</option>
                    <option value="ATM & CDM Franchise">ATM & CDM Franchise (Banking Kiosks)</option>
                    <option value="BBPS Utility Bill Payments">BBPS Utility Bill Payments (Collections Hub)</option>
                    <option value="All Financial Ecosystem Services">All Financial Ecosystem Services</option>
                  </select>
                </div>

                {/* Partner Category Selector Field */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#334155' }}>
                    PARTNER CATEGORY
                  </label>
                  <select 
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="form-input"
                    style={{ minHeight: '48px', borderRadius: '10px', fontWeight: 700 }}
                  >
                    <option value="Merchant / Retailer">Merchant / Retailer (Shop Owner)</option>
                    <option value="Distributor">Distributor (Area Network)</option>
                    <option value="DIST Franchise">DIST Franchise (Distributor Franchise)</option>
                    <option value="Super Distributor">Super Distributor (Regional Network)</option>
                    <option value="MASTER">MASTER (Master Distributor)</option>
                  </select>
                </div>

                {/* Additional Message / Requirement Field */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: '#334155' }}>
                    ADDITIONAL MESSAGE / REQUIREMENT
                  </label>
                  <textarea 
                    rows="3" 
                    placeholder="Briefly describe your business location, store details, or requirements..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="form-input"
                    style={{ borderRadius: '10px' }}
                  ></textarea>
                </div>

                {/* Submit CTA */}
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ 
                    width: '100%', 
                    justifyContent: 'center', 
                    height: '50px', 
                    fontWeight: 800, 
                    fontSize: '1rem', 
                    backgroundColor: '#0F52BA', 
                    boxShadow: '0 8px 24px rgba(15, 82, 186, 0.35)',
                    marginTop: '0.25rem' 
                  }}
                >
                  <span>Submit Inquiry to Admin</span>
                  <Send style={{ width: '16px', height: '16px' }} />
                </button>

                <p style={{ fontSize: '0.75rem', color: '#94A3B8', textAlign: 'center', margin: 0 }}>
                  🔒 Official inquiry. Directly routed to RONAV Technologies Admin team.
                </p>
              </form>
            )}

          </div>

        </div>

      </main>

      <style>{`
        @media (max-width: 860px) {
          .contact-grid-split {
            grid-template-columns: 1fr !important;
            gap: 2rem !important;
          }
        }
      `}</style>

    </div>
  );
}
