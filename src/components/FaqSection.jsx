import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle, CheckCircle2 } from 'lucide-react';

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);

  const faqs = [
    {
      q: 'What documents are required for Personal & Business Loans?',
      a: 'For Personal Loans up to ₹50 Lakhs, basic Aadhaar, PAN card, and 6 months bank statement are sufficient—even without payslips. For Business Loans up to ₹1 Crore, GST returns, 12 months bank statements, and ITR documents are required.',
      category: 'LOANS & CREDIT',
      chips: ['Aadhaar/PAN', 'Bank Statements', 'No Payslip Required']
    },
    {
      q: 'How does the ATM & CDM Franchise commission settlement work?',
      a: 'You earn a fixed transaction commission on every cash withdrawal and cash deposit performed at your franchise machine. All earnings accumulate in your Virtual Wallet in real time and can be transferred to your bank account anytime with 0 payout delay.',
      category: 'ATM FRANCHISE',
      chips: ['Real-Time Wallet', 'Fixed Txn Fee', 'Instant Bank Settlement']
    },
    {
      q: 'What utility bills can be paid using the BBPS service?',
      a: 'Through the Bharat Bill Payment System (BBPS) integration, merchants can collect payments for Electricity, Water, Gas, Mobile Postpaid, DTH, Broadband, FASTag, and Credit Card bills with instant digital receipts.',
      category: 'BBPS UTILITY',
      chips: ['Electricity & Gas', 'Mobile & DTH', 'Instant Receipts']
    },
    {
      q: 'How quickly can I get a POS Machine & Payment Gateway QR code?',
      a: 'Once your merchant registration and digital KYC verification are complete (usually within 10 to 30 minutes), your dynamic UPI QR code is activated immediately. Physical Android POS devices are dispatched within 24 to 48 hours.',
      category: 'POS & GATEWAY',
      chips: ['Instant Dynamic QR', '24-48 Hr POS Dispatch', 'Omnichannel']
    }
  ];

  return (
    <section className="section-padding bg-slate-50" style={{ width: '100%' }}>
      <div className="container" style={{ maxWidth: '840px' }}>
        
        {/* Section Header */}
        <div className="section-header">
          <span className="section-tag">KNOWLEDGE BASE & SUPPORT</span>
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-subtitle">
            Get instant answers regarding merchant onboarding, loan credit, BBPS, and franchise terms.
          </p>
        </div>

        {/* Interactive Accordion Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {faqs.map((faq, idx) => (
            <div 
              key={idx}
              className="card"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: openIndex === idx ? '#BFDBFE' : '#E2E8F0',
                borderWidth: openIndex === idx ? '1.5px' : '1px',
                padding: '1.125rem 1.25rem',
                borderRadius: '16px',
                boxShadow: openIndex === idx ? '0 8px 20px -4px rgba(15,82,186,0.1)' : '0 1px 3px rgba(0,0,0,0.04)',
                cursor: 'pointer'
              }}
              onClick={() => setOpenIndex(openIndex === idx ? -1 : idx)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.5625rem', fontWeight: 800, padding: '0.125rem 0.5rem', background: '#EFF6FF', color: '#0F52BA', borderRadius: '4px', border: '1px solid #BFDBFE' }}>
                    {faq.category}
                  </span>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                    {faq.q}
                  </h3>
                </div>
                {openIndex === idx ? <ChevronUp style={{ width: '18px', height: '18px', color: '#0F52BA', flexShrink: 0 }} /> : <ChevronDown style={{ width: '18px', height: '18px', color: '#64748B', flexShrink: 0 }} />}
              </div>

              {openIndex === idx && (
                <div style={{ marginTop: '0.875rem', paddingTop: '0.875rem', borderTop: '1px solid #F1F5F9' }}>
                  <p style={{ fontSize: '0.8125rem', color: '#334155', lineHeight: 1.6, marginBottom: '0.75rem' }}>
                    {faq.a}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {faq.chips.map((chip, cIdx) => (
                      <span key={cIdx} style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '0.125rem 0.5rem', background: '#ECFDF5', color: '#059669', borderRadius: '4px', border: '1px solid #A7F3D0', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <CheckCircle2 style={{ width: '12px', height: '12px' }} />
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
