import React, { useState, useEffect, useRef } from 'react';
import { 
  UserPlus, 
  ShieldCheck, 
  Key, 
  Zap, 
  CheckCircle2, 
  ArrowRight,
  Phone,
  Gift,
  Smartphone,
  CheckCircle,
  FileText,
  Lock,
  Wallet,
  ArrowUpRight
} from 'lucide-react';

export default function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }); },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    const els = sectionRef.current?.querySelectorAll('.reveal');
    els?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const steps = [
    {
      num: '01',
      title: 'Merchant Registration',
      subtitle: 'Online Application or Direct Hotline',
      icon: UserPlus,
      color: '#0F52BA',
      bg: '#EFF6FF',
      border: '#BFDBFE',
      chips: [
        { label: '2-Min Digital Form', icon: Zap },
        { label: 'Direct Helpline 9966203053', icon: Phone },
        { label: 'FREE Onboarding', icon: Gift }
      ]
    },
    {
      num: '02',
      title: 'Fast KYC Approval',
      subtitle: 'Digital Verification Engine',
      icon: ShieldCheck,
      color: '#059669',
      bg: '#ECFDF5',
      border: '#A7F3D0',
      chips: [
        { label: 'Aadhaar / PAN Upload', icon: FileText },
        { label: 'GST & ITR Document Support', icon: CheckCircle2 },
        { label: 'Approval in 10 Mins', icon: Zap }
      ]
    },
    {
      num: '03',
      title: 'Portal Access & MID',
      subtitle: 'Unique Merchant Credentials',
      icon: Key,
      color: '#D97706',
      bg: '#FFFBEB',
      border: '#FDE68A',
      chips: [
        { label: 'Unique Merchant ID (MID)', icon: Key },
        { label: 'Mobile App Secured Login', icon: Smartphone },
        { label: 'Encrypted Credentials', icon: Lock }
      ]
    },
    {
      num: '04',
      title: 'Active Operations',
      subtitle: 'Process Txns & Earn Commissions',
      icon: Zap,
      color: '#4F46E5',
      bg: '#EEF2FF',
      border: '#C7D2FE',
      chips: [
        { label: 'Instant 24x7 Payouts', icon: Wallet },
        { label: 'High Commission Margins', icon: ArrowUpRight },
        { label: 'Live Virtual Wallet Telemetry', icon: Zap }
      ]
    }
  ];

  const handleNextStep = () => {
    setActiveStep((prev) => (prev + 1) % steps.length);
  };

  // Render the corresponding screen inside the mock smartphone
  const renderPhoneScreen = () => {
    switch(activeStep) {
      case 0:
        return (
          <div className="inner-screen-container" style={{ padding: '0.875rem', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
            <div style={{ textAlign: 'center', margin: 'auto 0' }}>
              <div className="inner-success-icon-box" style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981', margin: '0 auto 0.75rem', boxShadow: '0 4px 12px rgba(16,185,129,0.15)' }}>
                <CheckCircle className="inner-success-icon" style={{ width: '28px', height: '28px', fill: '#10B981', stroke: '#FFFFFF' }} />
              </div>
              <h4 className="inner-title" style={{ fontSize: '0.875rem', fontWeight: 900, color: '#0F172A', margin: '0 0 0.25rem' }}>Merchant Registration</h4>
              <p className="inner-subtitle" style={{ fontSize: '0.625rem', color: '#059669', fontWeight: 700, margin: '0 0 1rem' }}>Application Submitted Successfully!</p>
              
              <div className="inner-list-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', textAlign: 'left', background: '#FFFFFF', padding: '0.75rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.65rem' }}>
                  <CheckCircle2 style={{ width: '12px', height: '12px', color: '#10B981' }} />
                  <span style={{ fontWeight: 800, color: '#475569' }}>Digital Verification</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.65rem' }}>
                  <CheckCircle2 style={{ width: '12px', height: '12px', color: '#10B981' }} />
                  <span style={{ fontWeight: 800, color: '#475569' }}>Document Check</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.65rem' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '1.5px solid #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94A3B8' }} />
                  </div>
                  <span style={{ fontWeight: 700, color: '#94A3B8' }}>Account Activation</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="inner-screen-container" style={{ padding: '0.875rem', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
            <div style={{ textAlign: 'center', margin: 'auto 0' }}>
              <div className="inner-success-icon-box" style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6', margin: '0 auto 0.75rem', boxShadow: '0 4px 12px rgba(59,130,246,0.15)' }}>
                <ShieldCheck className="inner-success-icon" style={{ width: '28px', height: '28px', color: '#3B82F6' }} />
              </div>
              <h4 className="inner-title" style={{ fontSize: '0.875rem', fontWeight: 900, color: '#0F172A', margin: '0 0 0.25rem' }}>KYC Verification</h4>
              <p className="inner-subtitle" style={{ fontSize: '0.625rem', color: '#2563EB', fontWeight: 700, margin: '0 0 1rem' }}>Uploading Documents...</p>
              
              <div className="inner-list-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', textAlign: 'left', background: '#FFFFFF', padding: '0.75rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.625rem' }}>
                  <span style={{ fontWeight: 800, color: '#475569' }}>Aadhaar Card</span>
                  <span style={{ color: '#059669', fontWeight: 900, fontSize: '0.5625rem', background: '#ECFDF5', padding: '1px 4px', borderRadius: '4px' }}>VERIFIED</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.625rem' }}>
                  <span style={{ fontWeight: 800, color: '#475569' }}>PAN Card</span>
                  <span style={{ color: '#059669', fontWeight: 900, fontSize: '0.5625rem', background: '#ECFDF5', padding: '1px 4px', borderRadius: '4px' }}>VERIFIED</span>
                </div>
                
                <div style={{ marginTop: '0.375rem', height: '4px', background: '#E2E8F0', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', background: '#10B981', transition: 'width 300ms ease' }} />
                </div>
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="inner-screen-container" style={{ padding: '0.875rem', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
            <div style={{ textAlign: 'center', margin: 'auto 0' }}>
              <div className="inner-success-icon-box" style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706', margin: '0 auto 0.75rem', boxShadow: '0 4px 12px rgba(217,119,6,0.15)' }}>
                <Key className="inner-success-icon" style={{ width: '24px', height: '24px', color: '#D97706' }} />
              </div>
              <h4 className="inner-title" style={{ fontSize: '0.875rem', fontWeight: 900, color: '#0F172A', margin: '0 0 0.25rem' }}>Merchant Credentials</h4>
              <p className="inner-subtitle" style={{ fontSize: '0.625rem', color: '#D97706', fontWeight: 700, margin: '0 0 1rem' }}>Merchant ID Activated!</p>
              
              <div className="inner-list-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', textAlign: 'left', background: '#FFFFFF', padding: '0.75rem', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '0.625rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>User ID:</span>
                  <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>MID-996620</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Status:</span>
                  <strong style={{ color: '#059669', fontWeight: 900 }}>ACTIVE</strong>
                </div>
                
                <div style={{ marginTop: '0.375rem', background: '#F8FAFC', padding: '4px', borderRadius: '4px', textAlign: 'center', border: '1px dashed #BFDBFE' }}>
                  <span style={{ fontSize: '0.5rem', color: '#0F52BA', fontWeight: 800 }}>Password Sent via SMS</span>
                </div>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="inner-screen-container" style={{ padding: '0.5rem', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#F1F5F9' }}>
            {/* Mock Dashboard App Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem', background: '#FFFFFF', borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.5625rem', fontWeight: 900, color: '#0F52BA' }}>RONAV PAY</span>
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#0F52BA', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.45rem', fontWeight: 900 }}>M</div>
            </div>

            {/* Wallet Balance widget */}
            <div className="inner-wallet-card" style={{ padding: '0.75rem', background: 'linear-gradient(135deg, #0A192F 0%, #0F52BA 100%)', borderRadius: '12px', color: '#FFFFFF', boxShadow: '0 4px 10px rgba(15,82,186,0.15)' }}>
              <span style={{ fontSize: '0.5rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Virtual Wallet</span>
              <h5 className="inner-wallet-amt" style={{ fontSize: '1rem', fontWeight: 900, margin: '2px 0 4px', letterSpacing: '-0.02em' }}>₹45,820.00</h5>
              <div style={{ display: 'flex', justify: 'space-between', fontSize: '0.45rem', opacity: 0.9 }}>
                <span>Sales: ₹1,24,500</span>
                <span>Payouts: Completed</span>
              </div>
            </div>

            {/* Quick Actions Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.25rem', marginTop: '0.5rem' }}>
              {['Record Sale', 'Withdraw', 'Reports'].map((action, aIdx) => (
                <div key={aIdx} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '0.375rem 0', borderRadius: '6px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#EFF6FF', display: 'flex' }} />
                  <span style={{ fontSize: '0.45rem', fontWeight: 800, color: '#475569' }}>{action}</span>
                </div>
              ))}
            </div>

            {/* Successful Txn Ledger */}
            <div style={{ flexGrow: 1, background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '0.375rem', borderRadius: '8px', marginTop: '0.5rem', overflow: 'hidden' }}>
              <span style={{ fontSize: '0.5rem', fontWeight: 900, color: '#0F172A', display: 'block', marginBottom: '0.25rem' }}>Recent Earnings</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.47rem', padding: '0.25rem 0', borderBottom: '1px solid #F1F5F9' }}>
                <div>
                  <strong className="ledger-title" style={{ display: 'block', color: '#0F172A' }}>UPI Commission</strong>
                  <span className="ledger-subtitle" style={{ color: '#94A3B8' }}>TXN: UPI-92834</span>
                </div>
                <strong style={{ color: '#059669' }}>+₹12.50</strong>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <section 
      ref={sectionRef} 
      className="section-padding bg-slate-50" 
      style={{ 
        backgroundColor: '#F8FAFC', 
        width: '100%',
        backgroundImage: 'radial-gradient(rgba(15, 82, 186, 0.04) 1px, transparent 0)', 
        backgroundSize: '24px 24px'
      }}
    >
      <div className="container" style={{ maxWidth: '860px', margin: '0 auto', padding: '0 1rem' }}>
        
        {/* Section Header */}
        <div className="section-header reveal" style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.3125rem 0.75rem', background: '#E0F2FE', borderRadius: '50px', color: '#0284C7', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
            <Zap style={{ width: '13px', height: '13px' }} />
            <span>Guided Onboarding</span>
          </div>
          <h2 className="section-title" style={{ fontSize: 'clamp(1.75rem, 4.5vw, 2.25rem)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
            How to Get Started as a <span style={{ color: '#0F52BA' }}>RONAV Partner</span>
          </h2>
          <p className="section-subtitle" style={{ fontSize: '0.875rem', color: '#475569', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
            From application to active transactions in four simple steps.
          </p>
        </div>

        {/* Stepper Control Header Bar (1 --- 2 --- 3 --- 4) */}
        <div className="onboarding-stepper-header reveal">
          {steps.map((s, idx) => (
            <React.Fragment key={idx}>
              {/* Step Circle Button */}
              <button 
                onClick={() => setActiveStep(idx)}
                className={`stepper-circle-btn ${activeStep === idx ? 'is-active' : ''}`}
                style={{ '--step-color': s.color }}
              >
                <div className="step-number-bubble">
                  {idx + 1}
                </div>
                <span className="step-bubble-label">{s.title.split(' ')[0]}</span>
              </button>

              {/* Connecting Line (hidden after last item) */}
              {idx < steps.length - 1 && (
                <div className={`stepper-connecting-line ${activeStep > idx ? 'is-passed' : ''}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Interactive Split Columns Layout (Details left, Phone simulator right) */}
        <div className="onboarding-split-layout">
          
          {/* Left Column: Active Step Details Card */}
          <div className="onboarding-details-card card card-glow">
            <div>
              {/* Giant Numeric Header Tag */}
              <span className="details-huge-num" style={{ color: steps[activeStep].color }}>
                {steps[activeStep].num}
              </span>

              <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', marginBottom: '0.375rem', marginTop: '-0.5rem' }}>
                {steps[activeStep].title}
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#64748B', fontWeight: 700, marginBottom: '1.5rem' }}>
                {steps[activeStep].subtitle}
              </p>

              {/* Action Chips Checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
                {steps[activeStep].chips.map((chip, cIdx) => (
                  <div 
                    key={cIdx} 
                    style={{ 
                      fontSize: '0.8125rem', 
                      fontWeight: 800, 
                      padding: '0.625rem 0.875rem', 
                      background: '#FFFFFF', 
                      color: '#334155', 
                      borderRadius: '12px', 
                      border: `1.5px solid ${steps[activeStep].border}`, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                    }}
                  >
                    <chip.icon style={{ width: '15px', height: '15px', color: steps[activeStep].color, flexShrink: 0 }} />
                    <span>{chip.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Next Step Primary Button */}
            <button 
              onClick={handleNextStep}
              className="btn btn-slide-arrow btn-mobile-full"
              style={{ 
                backgroundColor: steps[activeStep].color, 
                color: '#FFFFFF',
                fontWeight: 800,
                padding: '0.75rem 1.5rem',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(15,82,186,0.1)'
              }}
            >
              <span>{activeStep === steps.length - 1 ? 'Start Over' : 'Next Step'}</span>
              <span className="btn-arrow-icon" style={{ display: 'inline-block' }}><ArrowRight style={{ width: '16px', height: '16px' }} /></span>
            </button>
          </div>

          {/* Right Column: Pure CSS Smartphone Simulator */}
          <div className="onboarding-simulator-wrapper">
            <div className="mock-smartphone">
              {/* Camera Notch */}
              <div className="phone-camera-notch" />
              
              {/* Speaker Notch */}
              <div className="phone-speaker-grille" />
              
              {/* Top Status Bar inside Screen */}
              <div className="phone-screen-status-bar">
                <span style={{ fontWeight: 800 }}>11:24</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <div style={{ width: '10px', height: '6px', background: '#64748B', borderRadius: '1px' }} />
                  <span style={{ fontSize: '0.45rem', fontWeight: 800 }}>100%</span>
                </div>
              </div>

              {/* Dynamic screen display */}
              <div className="phone-screen-content">
                {renderPhoneScreen()}
              </div>

              {/* Bottom Home Indicator Bar */}
              <div className="phone-home-indicator" />
            </div>
          </div>

        </div>

      </div>

      {/* Inline styles for Stepper & Phone Simulator */}
      <style>{`
        /* Timeline Stepper Header */
        .onboarding-stepper-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 600px;
          margin: 0 auto 2.5rem;
          padding: 0 1rem;
        }

        .stepper-circle-btn {
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.375rem;
          position: relative;
          z-index: 2;
        }

        .step-number-bubble {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #FFFFFF;
          border: 1.5px solid #E2E8F0;
          color: #64748B;
          font-size: 0.8125rem;
          font-weight: 900;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(0,0,0,0.02);
          transition: all 250ms ease;
        }

        .stepper-circle-btn.is-active .step-number-bubble {
          background: var(--step-color);
          border-color: var(--step-color);
          color: #FFFFFF;
          box-shadow: 0 6px 16px rgba(15, 82, 186, 0.2);
          transform: scale(1.08);
        }

        .step-bubble-label {
          font-size: 0.625rem;
          font-weight: 800;
          color: #94A3B8;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          transition: color 200ms ease;
        }

        .stepper-circle-btn.is-active .step-bubble-label {
          color: #0F172A;
          font-weight: 900;
        }

        .stepper-connecting-line {
          flex: 1;
          height: 2px;
          background-color: #E2E8F0;
          margin: 0 -0.5rem;
          margin-top: -12px;
          position: relative;
          z-index: 1;
          transition: background-color 300ms ease;
        }

        .stepper-connecting-line.is-passed {
          background-color: #93C5FD;
        }

        /* Split Columns Layout styling */
        .onboarding-split-layout {
          display: grid;
          grid-template-columns: 1.15fr 1fr;
          gap: 3rem;
          align-items: center;
          max-width: 860px;
          margin: 0 auto;
        }

        .onboarding-details-card {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 24px;
          padding: 2.25rem 2rem;
          min-height: 420px;
          box-shadow: 0 10px 30px rgba(15,23,42,0.04);
        }

        .details-huge-num {
          font-size: 3rem;
          font-weight: 950;
          opacity: 0.12;
          font-feature-settings: '"tnum"';
          line-height: 1;
          display: block;
          margin-bottom: 0.25rem;
        }

        /* Smartphone Simulator Container */
        .onboarding-simulator-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .mock-smartphone {
          position: relative;
          width: 240px;
          height: 420px;
          border-radius: 36px;
          border: 10px solid #0F172A;
          background: #FFFFFF;
          box-shadow: 0 20px 48px -12px rgba(15,23,42,0.15);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        /* Camera & speaker notch bar */
        .phone-camera-notch {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 100px;
          height: 16px;
          background: #0F172A;
          border-bottom-left-radius: 12px;
          border-bottom-right-radius: 12px;
          z-index: 10;
        }

        .phone-speaker-grille {
          position: absolute;
          top: 3px;
          left: 50%;
          transform: translateX(-50%);
          width: 32px;
          height: 3px;
          background: #334155;
          border-radius: 4px;
          z-index: 11;
        }

        .phone-screen-status-bar {
          height: 24px;
          padding: 0 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.5rem;
          color: #64748B;
          background: #F8FAFC;
          border-bottom: 1px solid #E2E8F0;
          padding-top: 4px;
          z-index: 1;
        }

        .phone-screen-content {
          flex-grow: 1;
          overflow: hidden;
          background-color: #F8FAFC;
        }

        .phone-home-indicator {
          position: absolute;
          bottom: 4px;
          left: 50%;
          transform: translateX(-50%);
          width: 80px;
          height: 4px;
          background: #0F172A;
          border-radius: 10px;
          z-index: 10;
        }

        /* Mobile specific layout settings */
        @media (max-width: 767px) {
          .onboarding-stepper-header {
            max-width: 100% !important;
            margin-bottom: 1.5rem !important;
          }
          .onboarding-split-layout {
            grid-template-columns: 1fr !important;
            gap: 2rem !important;
          }
          .onboarding-details-card {
            min-height: auto !important;
            padding: 1.5rem !important;
          }
          .stepper-connecting-line {
            margin-top: -8px !important;
          }

          /* Scale down Mock Smartphone on Mobile viewports */
          .mock-smartphone {
            width: 190px !important;
            height: 330px !important;
            border-radius: 28px !important;
            border-width: 8px !important;
            box-shadow: 0 12px 32px -8px rgba(15,23,42,0.12) !important;
          }
          .phone-camera-notch {
            width: 80px !important;
            height: 12px !important;
            border-bottom-left-radius: 8px !important;
            border-bottom-right-radius: 8px !important;
          }
          .phone-speaker-grille {
            width: 24px !important;
            height: 2px !important;
          }
          .phone-screen-status-bar {
            height: 20px !important;
            font-size: 0.45rem !important;
            padding: 0 0.75rem !important;
            padding-top: 2px !important;
          }
          .phone-home-indicator {
            width: 60px !important;
            height: 3px !important;
            bottom: 3px !important;
          }

          /* Downscale font sizes and padding in phone screen on mobile */
          .inner-screen-container {
            padding: 0.625rem !important;
          }
          .inner-success-icon-box {
            width: 36px !important;
            height: 36px !important;
            margin-bottom: 0.5rem !important;
          }
          .inner-success-icon {
            width: 22px !important;
            height: 22px !important;
          }
          .inner-title {
            font-size: 0.75rem !important;
          }
          .inner-subtitle {
            font-size: 0.5625rem !important;
            margin-bottom: 0.625rem !important;
          }
          .inner-list-card {
            padding: 0.5rem !important;
            border-radius: 8px !important;
            gap: 0.25rem !important;
          }
          .inner-list-card span {
            font-size: 0.5625rem !important;
          }

          /* Downscale dashboard details for Merchant Active Operations screen */
          .inner-wallet-card {
            padding: 0.5rem !important;
            border-radius: 8px !important;
          }
          .inner-wallet-amt {
            font-size: 0.8125rem !important;
          }
          .ledger-title {
            font-size: 0.42rem !important;
          }
          .ledger-subtitle {
            font-size: 0.38rem !important;
          }
        }
      `}</style>

    </section>
  );
}
