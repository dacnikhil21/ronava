import React from 'react';
import { Zap, TrendingUp, Landmark, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function WhyChooseUs() {
  const pillars = [
    {
      icon: Zap,
      title: 'Instant Settlements 24x7',
      metric: '0.2s Payout',
      color: '#0F52BA',
      bg: '#EFF6FF',
      border: '#BFDBFE',
      chips: ['⚡ Zero Payout Delay', '🏦 Direct Bank Deposit']
    },
    {
      icon: TrendingUp,
      title: 'Industry-Leading Margins',
      metric: 'High Margins',
      color: '#059669',
      bg: '#ECFDF5',
      border: '#A7F3D0',
      chips: ['📈 Max Store Revenue', '💰 Daily Wallet Credits']
    },
    {
      icon: Landmark,
      title: 'Loans Without Payslips',
      metric: '₹50K - ₹1 Cr',
      color: '#D97706',
      bg: '#FFFBEB',
      border: '#FDE68A',
      chips: ['💼 Bank Statement KYC', '⚡ 24-48 Hr Disbursal']
    },
    {
      icon: ShieldCheck,
      title: 'Bank-Grade Security',
      metric: '256-Bit SSL',
      color: '#4F46E5',
      bg: '#EEF2FF',
      border: '#C7D2FE',
      chips: ['🔒 PCI-DSS Compliant', '🛡️ Fraud Protection']
    }
  ];

  return (
    <section id="why-us" className="section-padding bg-white" style={{ width: '100%', padding: '2.5rem 0' }}>
      <div className="container">
        
        {/* Section Header */}
        <div className="section-header" style={{ marginBottom: '1.5rem' }}>
          <span className="section-tag">INSTITUTIONAL TRUST PILLARS</span>
          <h2 className="section-title">Why Merchants Choose RONAV Technologies</h2>
          <p className="section-subtitle">
            Engineered to eliminate complexity, increase trust, and boost profit margins for merchants.
          </p>
        </div>

        {/* Side-by-Side 4-Column Grid on Desktop, 2x2 Grid on Mobile */}
        <div className="mobile-app-sales-grid" style={{ gap: '1rem' }}>
          {pillars.map((p, idx) => (
            <div 
              key={idx}
              className="card card-hover"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: p.border,
                borderWidth: '1.5px',
                padding: '1.125rem',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: p.bg, color: p.color, border: `1px solid ${p.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p.icon style={{ width: '18px', height: '18px' }} />
                  </div>
                  <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '0.125rem 0.5rem', background: p.bg, color: p.color, borderRadius: '12px', border: `1px solid ${p.border}` }}>
                    {p.metric}
                  </span>
                </div>

                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.625rem' }}>
                  {p.title}
                </h3>

                {/* Feature Chips */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {p.chips.map((chip, cIdx) => (
                    <div key={cIdx} style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '0.25rem 0.5rem', background: p.bg, color: p.color, borderRadius: '6px', border: `1px solid ${p.border}`, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <CheckCircle2 style={{ width: '12px', height: '12px', flexShrink: 0 }} />
                      <span>{chip}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Indicator */}
              <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.625rem', color: '#059669', fontWeight: 800 }}>
                <span>● 24x7 OPERATIONAL</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
