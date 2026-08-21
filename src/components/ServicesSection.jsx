import React, { useState, useEffect, useRef } from 'react';
import { 
  Landmark, 
  Building2, 
  Receipt, 
  CreditCard, 
  ShieldCheck, 
  Calculator,
  Zap,
  QrCode
} from 'lucide-react';

export default function ServicesSection({ onOpenLogin, onShowToast, onNavigate }) {
  const [loanAmount, setLoanAmount] = useState(500000);
  const [dailyTxns, setDailyTxns] = useState(50);
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    const els = sectionRef.current?.querySelectorAll('.reveal, .reveal-scale');
    els?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Dynamic calculations
  const estimatedCommission = Math.round((loanAmount * 0.015) + (dailyTxns * 12 * 30));
  const disbursalDays = loanAmount <= 200000 ? '24 Hours' : '48–72 Hours';

  return (
    <section id="services" ref={sectionRef} className="section-padding bg-white" style={{ width: '100%', padding: '4rem 0' }}>
      <div className="container" style={{ maxWidth: '860px', margin: '0 auto', padding: '0 1rem' }}>
        
        {/* Section Header */}
        <div className="section-header reveal" style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <span className="section-tag">COMPREHENSIVE FINTECH ECOSYSTEM</span>
          <h2 className="section-title" style={{ fontSize: 'clamp(1.75rem, 4.5vw, 2.25rem)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
            All Merchant Financial Solutions{' '}
            <span style={{ color: '#0F52BA' }}>Under One Roof</span>
          </h2>
          <p className="section-subtitle" style={{ fontSize: '0.875rem', color: '#475569', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
            Empowering business owners, retailers, and distributors with comprehensive, high-commission financial services since 2021.
          </p>
        </div>

        {/* Core Services Grid (Design 1 - Exact Layout Sync) */}
        <div className="services-grid-design1 reveal-scale" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
          
          {/* Card 1: Loans (Emerald Green Theme - Design 1) */}
          <div 
            className="service-card-design1" 
            style={{ 
              backgroundColor: '#FFFFFF', 
              borderColor: '#E2E8F0',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderRadius: '24px',
              padding: '1.75rem',
              boxShadow: '0 10px 30px rgba(15,23,42,0.04)',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between'
            }}
          >
            <div>
              {/* Tagline Badge Pill */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.625rem', background: '#ECFDF5', color: '#059669', borderRadius: '20px', border: '1px solid #A7F3D0', fontSize: '0.625rem', fontWeight: 800, marginBottom: '1rem' }}>
                <span>HIGH CONVERSION</span>
              </div>

              {/* Header Icon */}
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#059669', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Landmark style={{ width: '20px', height: '20px' }} />
              </div>

              {/* Title & Limits */}
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', marginBottom: '0.25rem' }}>
                1. Personal & Business Loans
              </h3>
              <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#059669', marginBottom: '0.75rem', letterSpacing: '0.03em' }}>
                ₹50K – ₹1 CRORE CAPITAL
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Flexible credit solutions tailored for individuals and business owners without rigid documentation hurdles.
              </p>

              {/* Centered 3D Illustration (Rupee + Plant + Checkmark) */}
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '1rem 0 1.5rem' }}>
                <img 
                  src="/loans_rupee.png" 
                  alt="Personal & Business Loans 3D Illustration" 
                  style={{ width: '100%', maxWidth: '210px', height: 'auto', objectFit: 'contain' }}
                />
              </div>

              {/* Clean Checkmark Bullet List */}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.78125rem', color: '#334155', lineHeight: 1.5 }}>
                  <ShieldCheck style={{ width: '18px', height: '18px', color: '#059669', flexShrink: 0, marginTop: '1px' }} />
                  <span><strong style={{ color: '#059669' }}>Personal Loans:</strong> ₹50,000 to ₹50 Lakhs based on salary (even without payslips).</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.78125rem', color: '#334155', lineHeight: 1.5 }}>
                  <ShieldCheck style={{ width: '18px', height: '18px', color: '#059669', flexShrink: 0, marginTop: '1px' }} />
                  <span><strong style={{ color: '#059669' }}>Business Loans:</strong> ₹1 Lakh to ₹1 Crore via GST returns, Banking statements & ITR.</span>
                </li>
              </ul>
            </div>

            {/* Action Footer */}
            <div style={{ paddingTop: '1rem', borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#059669', letterSpacing: '0.08em', textTransform: 'uppercase' }}>RONAV SECURE</span>
              <button onClick={() => onNavigate && onNavigate('service-loans')} className="btn btn-primary btn-mobile-full" style={{ backgroundColor: '#059669', borderColor: '#047857', width: '100%', justifyContent: 'center', fontWeight: 800, padding: '0.75rem 1.25rem', borderRadius: '12px' }}>
                Apply for Loan Credit →
              </button>
            </div>
          </div>

          {/* Card 2: ATM & CDM Franchise (Royal Navy Blue Theme - Design 1) */}
          <div 
            className="service-card-design1" 
            style={{ 
              backgroundColor: '#FFFFFF', 
              borderColor: '#E2E8F0',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderRadius: '24px',
              padding: '1.75rem',
              boxShadow: '0 10px 30px rgba(15,23,42,0.04)',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between'
            }}
          >
            <div>
              {/* Tagline Badge Pill */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.625rem', background: '#EFF6FF', color: '#0F52BA', borderRadius: '20px', border: '1px solid #BFDBFE', fontSize: '0.625rem', fontWeight: 800, marginBottom: '1rem' }}>
                <span>PASSIVE INCOME</span>
              </div>

              {/* Header Icon */}
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#0F52BA', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Building2 style={{ width: '20px', height: '20px' }} />
              </div>

              {/* Title & Limits */}
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', marginBottom: '0.25rem' }}>
                2. ATM & CDM Franchise
              </h3>
              <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F52BA', marginBottom: '0.75rem', letterSpacing: '0.03em' }}>
                LOW CAPEX • HIGH RETURNS
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Setup WLA (White Label ATM) & Cash Deposit Machines at your commercial premises with high return margins.
              </p>

              {/* Centered 3D Illustration (ATM Lobby Machine) */}
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '1rem 0 1.5rem' }}>
                <img 
                  src="/atm_lobby.png" 
                  alt="ATM & CDM Franchise 3D Illustration" 
                  style={{ width: '100%', maxWidth: '210px', height: 'auto', objectFit: 'contain' }}
                />
              </div>

              {/* Clean Checkmark Bullet List */}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.78125rem', color: '#334155', lineHeight: 1.5 }}>
                  <ShieldCheck style={{ width: '18px', height: '18px', color: '#0F52BA', flexShrink: 0, marginTop: '1px' }} />
                  <span>Earn fixed transaction commission on every cash withdrawal & deposit.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.78125rem', color: '#334155', lineHeight: 1.5 }}>
                  <ShieldCheck style={{ width: '18px', height: '18px', color: '#0F52BA', flexShrink: 0, marginTop: '1px' }} />
                  <span>High uptime machines with 24/7 monitoring & support.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.78125rem', color: '#334155', lineHeight: 1.5 }}>
                  <ShieldCheck style={{ width: '18px', height: '18px', color: '#0F52BA', flexShrink: 0, marginTop: '1px' }} />
                  <span>Multiple revenue streams with minimal operational effort.</span>
                </li>
              </ul>
            </div>

            {/* Action Footer */}
            <div style={{ paddingTop: '1rem', borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#0F52BA', letterSpacing: '0.08em', textTransform: 'uppercase' }}>HIGH MARGIN</span>
              <button onClick={() => onNavigate && onNavigate('service-atm')} className="btn btn-primary btn-mobile-full" style={{ backgroundColor: '#0F52BA', width: '100%', justifyContent: 'center', fontWeight: 800, padding: '0.75rem 1.25rem', borderRadius: '12px' }}>
                Enquire for Franchise →
              </button>
            </div>
          </div>

          {/* Card 3: BBPS Bill Payments (Amber/Orange Theme) */}
          <div 
            className="service-card-design1" 
            style={{ 
              backgroundColor: '#FFFFFF', 
              borderColor: '#E2E8F0',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderRadius: '24px',
              padding: '1.75rem',
              boxShadow: '0 10px 30px rgba(15,23,42,0.04)',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between'
            }}
          >
            <div>
              {/* Tagline Badge Pill */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.625rem', background: '#FFFBEB', color: '#D97706', borderRadius: '20px', border: '1px solid #FDE68A', fontSize: '0.625rem', fontWeight: 800, marginBottom: '1rem' }}>
                <span>INSTANT PAYMENTS</span>
              </div>

              {/* Header Icon */}
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#D97706', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Zap style={{ width: '20px', height: '20px' }} />
              </div>

              {/* Title & Limits */}
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', marginBottom: '0.25rem' }}>
                3. BBPS Bill Payments
              </h3>
              <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#D97706', marginBottom: '0.75rem', letterSpacing: '0.03em' }}>
                ELECTRICITY • MOBILE • WATER • MORE
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Accept and process all utility bill payments instantly through the Bharat Bill Payment System with zero delay.
              </p>

              {/* Centered 3D Illustration */}
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '1rem 0 1.5rem' }}>
                <img 
                  src="/bbps_bills.png" 
                  alt="BBPS Bill Payments 3D Illustration" 
                  style={{ width: '100%', maxWidth: '210px', height: 'auto', objectFit: 'contain' }}
                />
              </div>

              {/* Clean Checkmark Bullet List */}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.78125rem', color: '#334155', lineHeight: 1.5 }}>
                  <ShieldCheck style={{ width: '18px', height: '18px', color: '#D97706', flexShrink: 0, marginTop: '1px' }} />
                  <span><strong style={{ color: '#D97706' }}>Electricity & Water:</strong> Pay any state board electricity and water bills in seconds.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.78125rem', color: '#334155', lineHeight: 1.5 }}>
                  <ShieldCheck style={{ width: '18px', height: '18px', color: '#D97706', flexShrink: 0, marginTop: '1px' }} />
                  <span><strong style={{ color: '#D97706' }}>Mobile Recharge:</strong> Prepaid, postpaid, DTH, and broadband recharges across all operators.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.78125rem', color: '#334155', lineHeight: 1.5 }}>
                  <ShieldCheck style={{ width: '18px', height: '18px', color: '#D97706', flexShrink: 0, marginTop: '1px' }} />
                  <span>Earn commission on every successful bill transaction processed.</span>
                </li>
              </ul>
            </div>

            {/* Action Footer */}
            <div style={{ paddingTop: '1rem', borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#D97706', letterSpacing: '0.08em', textTransform: 'uppercase' }}>COMMISSION PER TXN</span>
              <button onClick={() => onNavigate && onNavigate('service-bbps')} className="btn btn-primary btn-mobile-full" style={{ backgroundColor: '#D97706', borderColor: '#B45309', width: '100%', justifyContent: 'center', fontWeight: 800, padding: '0.75rem 1.25rem', borderRadius: '12px' }}>
                Start Collecting Bills →
              </button>
            </div>
          </div>

          {/* Card 4: Payment Gateway & POS (Violet/Purple Theme) */}
          <div 
            className="service-card-design1" 
            style={{ 
              backgroundColor: '#FFFFFF', 
              borderColor: '#E2E8F0',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderRadius: '24px',
              padding: '1.75rem',
              boxShadow: '0 10px 30px rgba(15,23,42,0.04)',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between'
            }}
          >
            <div>
              {/* Tagline Badge Pill */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.625rem', background: '#F5F3FF', color: '#7C3AED', borderRadius: '20px', border: '1px solid #DDD6FE', fontSize: '0.625rem', fontWeight: 800, marginBottom: '1rem' }}>
                <span>ALL-IN-ONE PAYMENTS</span>
              </div>

              {/* Header Icon */}
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#7C3AED', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <QrCode style={{ width: '20px', height: '20px' }} />
              </div>

              {/* Title & Limits */}
              <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0F172A', marginBottom: '0.25rem' }}>
                4. PG & POS Solutions
              </h3>
              <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#7C3AED', marginBottom: '0.75rem', letterSpacing: '0.03em' }}>
                QR • CARD SWIPE • UPI • ONLINE
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                Accept digital payments anywhere with QR codes, POS machines, and a full payment gateway integration for your business.
              </p>

              {/* Centered 3D Illustration */}
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '1rem 0 1.5rem' }}>
                <img 
                  src="/pos_gateway.png" 
                  alt="Payment Gateway & POS 3D Illustration" 
                  style={{ width: '100%', maxWidth: '210px', height: 'auto', objectFit: 'contain' }}
                />
              </div>

              {/* Clean Checkmark Bullet List */}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.78125rem', color: '#334155', lineHeight: 1.5 }}>
                  <ShieldCheck style={{ width: '18px', height: '18px', color: '#7C3AED', flexShrink: 0, marginTop: '1px' }} />
                  <span><strong style={{ color: '#7C3AED' }}>POS Machines:</strong> Deploy card swipe terminals at your outlet for all card & contactless payments.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.78125rem', color: '#334155', lineHeight: 1.5 }}>
                  <ShieldCheck style={{ width: '18px', height: '18px', color: '#7C3AED', flexShrink: 0, marginTop: '1px' }} />
                  <span><strong style={{ color: '#7C3AED' }}>QR & UPI:</strong> Generate static/dynamic QR codes for instant UPI collection from any customer.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.78125rem', color: '#334155', lineHeight: 1.5 }}>
                  <ShieldCheck style={{ width: '18px', height: '18px', color: '#7C3AED', flexShrink: 0, marginTop: '1px' }} />
                  <span>Full payment gateway for online businesses with instant settlement support.</span>
                </li>
              </ul>
            </div>

            {/* Action Footer */}
            <div style={{ paddingTop: '1rem', borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#7C3AED', letterSpacing: '0.08em', textTransform: 'uppercase' }}>INSTANT SETTLEMENT</span>
              <button onClick={() => onNavigate && onNavigate('service-pos')} className="btn btn-primary btn-mobile-full" style={{ backgroundColor: '#7C3AED', borderColor: '#6D28D9', width: '100%', justifyContent: 'center', fontWeight: 800, padding: '0.75rem 1.25rem', borderRadius: '12px' }}>
                Enquire for PG & POS →
              </button>
            </div>
          </div>

        </div>

        {/* Interactive Loan & Commission Estimator Widget */}
        <div className="card" style={{ padding: '1.5rem', borderRadius: '20px', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: '#FFFFFF', border: '1px solid #334155', boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#0F52BA', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calculator style={{ width: '18px', height: '18px' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Interactive Merchant Revenue & Loan Estimator</h3>
              <p style={{ fontSize: '0.6875rem', color: '#94A3B8', margin: 0 }}>Drag the sliders to calculate your estimated credit line & monthly commission earnings</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
            {/* Slider 1: Loan Requirement */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontWeight: 800, marginBottom: '0.375rem' }}>
                <span>Desired Loan Credit:</span>
                <span style={{ color: '#34D399', fontFeatureSettings: '"tnum"' }}>₹{loanAmount.toLocaleString('en-IN')}</span>
              </div>
              <input 
                type="range" 
                min="50000" 
                max="10000000" 
                step="50000"
                value={loanAmount} 
                onChange={(e) => setLoanAmount(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#059669', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: '#94A3B8', marginTop: '0.25rem' }}>
                <span>₹50K</span>
                <span>₹50 Lakhs</span>
                <span>₹1 Crore</span>
              </div>
            </div>

            {/* Slider 2: Daily Bill / POS Txns */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontWeight: 800, marginBottom: '0.375rem' }}>
                <span>Daily BBPS / POS Transactions:</span>
                <span style={{ color: '#60A5FA', fontFeatureSettings: '"tnum"' }}>{dailyTxns} Txns/Day</span>
              </div>
              <input 
                type="range" 
                min="10" 
                max="300" 
                step="5"
                value={dailyTxns} 
                onChange={(e) => setDailyTxns(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#0F52BA', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: '#94A3B8', marginTop: '0.25rem' }}>
                <span>10 Txns</span>
                <span>150 Txns</span>
                <span>300 Txns</span>
              </div>
            </div>
          </div>

          {/* Computed Results Banner */}
          <div className="estimator-results-banner" style={{ marginTop: '1.25rem', padding: '1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', textAlign: 'center' }}>
            <div>
              <span style={{ fontSize: '0.625rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>Est. Disbursal Timeline</span>
              <h4 style={{ fontSize: '1rem', fontWeight: 900, color: '#34D399', margin: '2px 0 0' }}>{disbursalDays}</h4>
            </div>

            <div>
              <span style={{ fontSize: '0.625rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>Est. Monthly Earnings</span>
              <h4 style={{ fontSize: '1.125rem', fontWeight: 900, color: '#FCD34D', margin: '2px 0 0', fontFeatureSettings: '"tnum"' }}>₹{estimatedCommission.toLocaleString('en-IN')}/mo</h4>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <button 
                onClick={() => onNavigate && onNavigate('service-loans')} 
                className="btn btn-primary btn-sm" 
                style={{ width: '100%', backgroundColor: '#0F52BA', cursor: 'pointer', border: 'none' }}
              >
                Apply with this Estimate →
              </button>
            </div>
          </div>

        </div>

      </div>

      <style>{`
        @media (max-width: 767px) {
          .service-card-design1 {
            padding: 1rem !important;
            border-radius: 16px !important;
          }

          .service-card-design1 h3 {
            font-size: 1.05rem !important;
            margin-bottom: 0.15rem !important;
          }

          .service-card-design1 > div > p:first-of-type {
            font-size: 0.6875rem !important;
            margin-bottom: 0.5rem !important;
          }

          .service-card-design1 > div > p:last-of-type {
            font-size: 0.75rem !important;
            margin-bottom: 0.75rem !important;
          }

          .service-card-design1 img {
            max-width: 140px !important;
          }

          .service-card-design1 ul {
            gap: 0.5rem !important;
            margin-bottom: 0.75rem !important;
          }

          .service-card-design1 ul li {
            font-size: 0.725rem !important;
          }

          .service-card-design1 > div > div:first-child {
            margin-bottom: 0.625rem !important;
          }

          .estimator-results-banner {
            grid-template-columns: 1fr !important;
            gap: 1rem !important;
          }
        }

      `}</style>
    </section>
  );
}
