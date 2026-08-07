import React, { useState } from 'react';
import { Phone, MessageSquare, Mail, MapPin, Send, CheckCircle2 } from 'lucide-react';

export default function ContactSection({ onOpenOfficeModal }) {
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    service: 'Loans',
    role: 'Merchant',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.mobile) return;
    setSubmitted(true);
  };

  return (
    <section id="contact" className="section-padding" style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0' }}>
      <div className="container">
        
        {/* Header */}
        <div className="section-header">
          <span className="section-tag">DIRECT CONTACT MATRIX</span>
          <h2 className="section-title">
            Get in Touch with <span style={{ color: '#0F52BA' }}>RONAV Technologies</span>
          </h2>
          <p className="section-subtitle">
            Have questions about loans, BBPS, or franchise setup? Reach our team directly or submit your inquiry below.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2.5rem' }}>
          
          {/* Direct Contact Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              
              <a href="tel:9966203053" className="card card-hover" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#F8FAFC' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#0F52BA', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Phone style={{ width: '24px', height: '24px' }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Direct Hotline</p>
                  <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>9966203053</h4>
                  <p style={{ fontSize: '0.75rem', color: '#0F52BA', fontWeight: 700 }}>Call Now for Merchant Support</p>
                </div>
              </a>

              <a href="https://wa.me/919966203053" target="_blank" rel="noopener noreferrer" className="card card-hover" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#F8FAFC' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#059669', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MessageSquare style={{ width: '24px', height: '24px' }} />
                </div>
                <div>
                  <p style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>WhatsApp Support</p>
                  <h4 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>9966203053</h4>
                  <p style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>Chat Directly on WhatsApp</p>
                </div>
              </a>

              <a href="mailto:rosenavaneethamenterprises@gmail.com" className="card card-hover" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: '#F8FAFC' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#4F46E5', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Mail style={{ width: '24px', height: '24px' }} />
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <p style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>Official Email</p>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A', margin: 0, wordBreak: 'break-all' }}>rosenavaneethamenterprises@gmail.com</h4>
                  <p style={{ fontSize: '0.75rem', color: '#4F46E5', fontWeight: 700 }}>Corporate & Partnership Queries</p>
                </div>
              </a>

            </div>

            <button 
              onClick={onOpenOfficeModal}
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center', fontWeight: 800, color: '#0F52BA' }}
            >
              <MapPin style={{ width: '18px', height: '18px' }} />
              View Office Locations & Map
            </button>

          </div>

          {/* Quick Contact Form */}
          <div>
            <div className="card" style={{ padding: '2rem', backgroundColor: '#F8FAFC', boxShadow: '0 12px 28px rgba(15,23,42,0.06)' }}>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>Quick Partner Inquiry Form</h3>
                <p style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>Fill in your details to get a callback from our merchant team within 2 hours.</p>
              </div>

              {submitted ? (
                <div style={{ padding: '1.5rem', borderRadius: '12px', background: '#ECFDF5', border: '1px solid #A7F3D0', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <CheckCircle2 style={{ width: '48px', height: '48px', color: '#059669', margin: '0 auto' }} />
                  <h4 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#065F46' }}>Inquiry Submitted Successfully!</h4>
                  <p style={{ fontSize: '0.75rem', color: '#047857' }}>Thank you, {formData.name}. Our onboarding manager will contact you at {formData.mobile} shortly.</p>
                  <button 
                    onClick={() => { setSubmitted(false); setFormData({ name: '', mobile: '', service: 'Loans', role: 'Merchant', message: '' }); }}
                    className="btn btn-secondary btn-sm"
                    style={{ margin: '0.5rem auto 0', width: 'fit-content' }}
                  >
                    Send Another Inquiry
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Full Name *</label>
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g. Ramesh Kumar"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Mobile Number *</label>
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

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Service Interested</label>
                      <select 
                        value={formData.service}
                        onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                        className="form-input"
                      >
                        <option value="Loans">Personal / Business Loans</option>
                        <option value="Franchise">ATM & CDM Franchise</option>
                        <option value="BBPS">BBPS Bill Payment System</option>
                        <option value="POS">PG & POS Solutions</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Partner Category</label>
                      <select 
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="form-input"
                      >
                        <option value="Merchant">Merchant / Retailer</option>
                        <option value="Distributor">Distributor</option>
                        <option value="SuperDistributor">Super Distributor</option>
                        <option value="Customer">Loan Customer</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Additional Message / Requirement</label>
                    <textarea 
                      rows="3" 
                      placeholder="Briefly describe your business location or loan requirement..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="form-input"
                    ></textarea>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    <Send style={{ width: '16px', height: '16px' }} />
                    Submit Partner Inquiry
                  </button>

                  <p style={{ fontSize: '0.6875rem', color: '#94A3B8', textAlign: 'center' }}>
                    🔒 Your information is secure under RONAV Technologies Privacy Policy.
                  </p>
                </form>
              )}

            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
