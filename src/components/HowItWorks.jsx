import React, { useState } from 'react';
import { UserPlus, ShieldCheck, Key, Zap, CheckCircle2, ArrowRight } from 'lucide-react';

export default function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      num: '01',
      title: 'Merchant Registration',
      subtitle: 'Online Application or Direct Hotline',
      icon: UserPlus,
      color: '#0F52BA',
      bg: '#EFF6FF',
      border: '#BFDBFE',
      chips: ['⚡ 2-Min Digital Form', '📞 Direct Helpline 9966203053', 'FREE Onboarding']
    },
    {
      num: '02',
      title: 'Fast KYC Approval',
      subtitle: 'Digital Verification Engine',
      icon: ShieldCheck,
      color: '#059669',
      bg: '#ECFDF5',
      border: '#A7F3D0',
      chips: ['🛡️ Aadhaar / PAN Upload', '💼 GST & ITR Support', '⚡ Approval in 10 Mins']
    },
    {
      num: '03',
      title: 'Portal Access & MID',
      subtitle: 'Unique Merchant Credentials',
      icon: Key,
      color: '#D97706',
      bg: '#FFFBEB',
      border: '#FDE68A',
      chips: ['🔑 Unique Merchant ID (MID)', '📱 Mobile & Desktop App', '🔒 Encrypted Password']
    },
    {
      num: '04',
      title: 'Active Operations & Earnings',
      subtitle: 'Process Txns & Earn Commissions',
      icon: Zap,
      color: '#4F46E5',
      bg: '#EEF2FF',
      border: '#C7D2FE',
      chips: ['💰 Instant 24x7 Payouts', '📈 High Commission Margins', '📊 Live Wallet Telemetry']
    }
  ];

  return (
    <section className="section-padding bg-slate-50" style={{ width: '100%' }}>
      <div className="container">
        
        {/* Section Header */}
        <div className="section-header">
          <span className="section-tag">GUIDED ONBOARDING PROTOCOL</span>
          <h2 className="section-title">How to Get Started as a RONAV Partner</h2>
          <p className="section-subtitle">
            From application to active transactions in four simple, guided steps.
          </p>
        </div>

        {/* Mobile View ONLY: Single Active Step Card */}
        <div className="mobile-only" style={{ marginBottom: '1rem' }}>
          {/* Step Selector Pills */}
          <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'center', marginBottom: '1rem' }}>
            {steps.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setActiveStep(idx)}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '20px',
                  border: activeStep === idx ? `1.5px solid ${s.color}` : '1px solid #E2E8F0',
                  background: activeStep === idx ? s.bg : '#FFFFFF',
                  color: activeStep === idx ? s.color : '#64748B',
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                Step {s.num}
              </button>
            ))}
          </div>

          {/* Single Active Step Card ONLY */}
          <div 
            className="card" 
            style={{ 
              backgroundColor: steps[activeStep].bg, 
              borderColor: steps[activeStep].border,
              borderWidth: '1.5px',
              padding: '1.25rem',
              borderRadius: '16px',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: steps[activeStep].color, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {React.createElement(steps[activeStep].icon, { style: { width: '22px', height: '22px' } })}
              </div>
              <span style={{ fontSize: '2rem', fontWeight: 900, color: steps[activeStep].color, opacity: 0.35, fontFeatureSettings: '"tnum"' }}>
                {steps[activeStep].num}
              </span>
            </div>

            <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.25rem' }}>
              {steps[activeStep].title}
            </h3>
            <p style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '1rem' }}>
              {steps[activeStep].subtitle}
            </p>

            {/* Feature Chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {steps[activeStep].chips.map((chip, cIdx) => (
                <div key={cIdx} style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.375rem 0.625rem', background: '#FFFFFF', color: steps[activeStep].color, borderRadius: '6px', border: `1px solid ${steps[activeStep].border}`, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <CheckCircle2 style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                  <span>{chip}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: `1px solid ${steps[activeStep].border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.6875rem', fontWeight: 800, color: steps[activeStep].color }}>
              <span>STEP {steps[activeStep].num} OF 04 ACTIVE</span>
              <button 
                onClick={() => setActiveStep((activeStep + 1) % steps.length)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 800, color: steps[activeStep].color, display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}
              >
                <span>Next Step</span>
                <ArrowRight style={{ width: '14px', height: '14px' }} />
              </button>
            </div>
          </div>
        </div>

        {/* Desktop ONLY 4-Column Grid */}
        <div className="desktop-only grid-4" style={{ gap: '1.25rem' }}>
          {steps.map((s, idx) => (
            <div 
              key={idx}
              className="card card-hover"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: s.border,
                borderWidth: '1.5px',
                padding: '1.5rem',
                borderRadius: '18px',
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between',
                position: 'relative'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: s.bg, color: s.color, border: `1px solid ${s.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <s.icon style={{ width: '22px', height: '22px' }} />
                  </div>
                  <span style={{ fontSize: '2.25rem', fontWeight: 900, color: s.color, opacity: 0.25, fontFeatureSettings: '"tnum"' }}>
                    {s.num}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.25rem' }}>
                  {s.title}
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '1.25rem' }}>
                  {s.subtitle}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1.25rem' }}>
                  {s.chips.map((chip, cIdx) => (
                    <div key={cIdx} style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.5rem', background: s.bg, color: s.color, borderRadius: '6px', border: `1px solid ${s.border}`, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <CheckCircle2 style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                      <span>{chip}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.6875rem', fontWeight: 800, color: s.color }}>
                <span>STEP {s.num} OF 04</span>
                <ArrowRight style={{ width: '14px', height: '14px' }} />
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
