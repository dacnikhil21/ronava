import React, { useState } from 'react';
import { Landmark, Building2, Receipt, CreditCard, ArrowRight, ShieldCheck, Zap, Calculator } from 'lucide-react';

export default function ServicesSection({ onOpenLogin, onShowToast }) {
  const [loanAmount, setLoanAmount] = useState(500000); // 5 Lakhs default
  const [dailyTxns, setDailyTxns] = useState(50);

  // Dynamic calculations
  const estimatedCommission = Math.round((loanAmount * 0.015) + (dailyTxns * 12 * 30));
  const disbursalDays = loanAmount <= 200000 ? '24 Hours' : '48–72 Hours';

  return (
    <section id="services" className="section-padding bg-white" style={{ width: '100%' }}>
      <div className="container">
        
        {/* Section Header */}
        <div className="section-header">
          <span className="section-tag">COMPREHENSIVE FINTECH ECOSYSTEM</span>
          <h2 className="section-title">All Merchant Financial Solutions Under One Roof</h2>
          <p className="section-subtitle">
            Empowering business owners, retailers, and distributors with comprehensive, high-commission financial services since 2021.
          </p>
        </div>

        {/* Core Services 2x2 Grid with Distinct Color Systems */}
        <div className="services-grid" style={{ marginBottom: '2.5rem' }}>
          
          {/* Service 1: Loans (Emerald Green Theme) */}
          <div 
            className="card card-hover" 
            style={{ 
              backgroundColor: '#ECFDF5', 
              borderColor: '#A7F3D0',
              borderWidth: '1.5px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div className="icon-badge" style={{ backgroundColor: '#059669', color: '#FFFFFF', borderColor: '#047857' }}>
                  <Landmark style={{ width: '20px', height: '20px' }} />
                </div>
                <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '0.125rem 0.5rem', background: '#FFFFFF', color: '#059669', borderRadius: '20px', border: '1px solid #A7F3D0' }}>
                  HIGH CONVERSION
                </span>
              </div>

              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#065F46', marginBottom: '0.25rem' }}>
                1. Personal & Business Loans
              </h3>
              <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#047857', marginBottom: '0.75rem', letterSpacing: '0.03em' }}>
                ₹50K – ₹1 CRORE CAPITAL
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#064E3B', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                Flexible credit solutions tailored for individuals and business owners without rigid documentation hurdles.
              </p>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.75rem', color: '#065F46', marginBottom: '1.5rem' }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
                  <ShieldCheck style={{ width: '16px', height: '16px', color: '#059669', flexShrink: 0, marginTop: '2px' }} />
                  <span><strong>Personal Loans:</strong> ₹50,000 to ₹50 Lakhs based on salary (even without payslips).</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
                  <ShieldCheck style={{ width: '16px', height: '16px', color: '#059669', flexShrink: 0, marginTop: '2px' }} />
                  <span><strong>Business Loans:</strong> ₹1 Lakh to ₹1 Crore via GST returns, Banking statements & ITR.</span>
                </li>
              </ul>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid #A7F3D0' }}>
              <a href="#contact" className="btn btn-primary btn-sm" style={{ backgroundColor: '#059669', borderColor: '#047857' }}>
                Apply for Loan Credit →
              </a>
              <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#047857' }}>RONAV SECURE</span>
            </div>
          </div>

          {/* Service 2: ATM & CDM Franchise (Royal Navy Blue Theme) */}
          <div 
            className="card card-hover" 
            style={{ 
              backgroundColor: '#EFF6FF', 
              borderColor: '#BFDBFE',
              borderWidth: '1.5px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div className="icon-badge" style={{ backgroundColor: '#0F52BA', color: '#FFFFFF', borderColor: '#0A3E90' }}>
                  <Building2 style={{ width: '20px', height: '20px' }} />
                </div>
                <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '0.125rem 0.5rem', background: '#FFFFFF', color: '#0F52BA', borderRadius: '20px', border: '1px solid #BFDBFE' }}>
                  PASSIVE INCOME
                </span>
              </div>

              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#1E40AF', marginBottom: '0.25rem' }}>
                2. ATM & CDM Franchise
              </h3>
              <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#1D4ED8', marginBottom: '0.75rem', letterSpacing: '0.03em' }}>
                LOW CAPEX • HIGH RETURNS
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#1E3A8A', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                Setup WLA (White Label ATM) & Cash Deposit Machines at your commercial premises with high return margins.
              </p>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.75rem', color: '#1E40AF', marginBottom: '1.5rem' }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
                  <ShieldCheck style={{ width: '16px', height: '16px', color: '#0F52BA', flexShrink: 0, marginTop: '2px' }} />
                  <span>Earn fixed transaction commission on every cash withdrawal & deposit.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
                  <ShieldCheck style={{ width: '16px', height: '16px', color: '#0F52BA', flexShrink: 0, marginTop: '2px' }} />
                  <span>Low capital requirement with complete hardware support & store footfall boost.</span>
                </li>
              </ul>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid #BFDBFE' }}>
              <a href="#contact" className="btn btn-primary btn-sm" style={{ backgroundColor: '#0F52BA' }}>
                Setup ATM/CDM Outlet →
              </a>
              <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#1D4ED8' }}>HIGH MARGIN</span>
            </div>
          </div>

          {/* Service 3: BBPS Bill Payments (Amber Gold Theme) */}
          <div 
            className="card card-hover" 
            style={{ 
              backgroundColor: '#FFFBEB', 
              borderColor: '#FDE68A',
              borderWidth: '1.5px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div className="icon-badge" style={{ backgroundColor: '#D97706', color: '#FFFFFF', borderColor: '#B45309' }}>
                  <Receipt style={{ width: '20px', height: '20px' }} />
                </div>
                <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '0.125rem 0.5rem', background: '#FFFFFF', color: '#D97706', borderRadius: '20px', border: '1px solid #FDE68A' }}>
                  DAILY REVENUE
                </span>
              </div>

              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#92400E', marginBottom: '0.25rem' }}>
                3. BBPS Utility Bill Pay
              </h3>
              <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#B45309', marginBottom: '0.75rem', letterSpacing: '0.03em' }}>
                ELECTRICITY • MOBILE • DTH • POSTPAID
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#78350F', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                One-stop Bharat Bill Payment System enabling retailers to collect bills and earn instant settlements.
              </p>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.75rem', color: '#92400E', marginBottom: '1.5rem' }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
                  <ShieldCheck style={{ width: '16px', height: '16px', color: '#D97706', flexShrink: 0, marginTop: '2px' }} />
                  <span>Instant receipt generation for customer bill payments with high success rates.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
                  <ShieldCheck style={{ width: '16px', height: '16px', color: '#D97706', flexShrink: 0, marginTop: '2px' }} />
                  <span>Real-time wallet balance credit on every bill processed.</span>
                </li>
              </ul>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid #FDE68A' }}>
              <a href="#contact" className="btn btn-primary btn-sm" style={{ backgroundColor: '#D97706', borderColor: '#B45309' }}>
                Access BBPS Services →
              </a>
              <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#B45309' }}>INSTANT PAY</span>
            </div>
          </div>

          {/* Service 4: Payment Gateway & POS (Indigo Purple Theme) */}
          <div 
            className="card card-hover" 
            style={{ 
              backgroundColor: '#EEF2FF', 
              borderColor: '#C7D2FE',
              borderWidth: '1.5px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div className="icon-badge" style={{ backgroundColor: '#4F46E5', color: '#FFFFFF', borderColor: '#3730A3' }}>
                  <CreditCard style={{ width: '20px', height: '20px' }} />
                </div>
                <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '0.125rem 0.5rem', background: '#FFFFFF', color: '#4F46E5', borderRadius: '20px', border: '1px solid #C7D2FE' }}>
                  OMNICHANNEL
                </span>
              </div>

              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#3730A3', marginBottom: '0.25rem' }}>
                4. Payment Gateway & POS
              </h3>
              <p style={{ fontSize: '0.75rem', fontWeight: 800, color: '#4338CA', marginBottom: '0.75rem', letterSpacing: '0.03em' }}>
                QR CODE • POS MACHINE • APIS
              </p>
              <p style={{ fontSize: '0.8125rem', color: '#312E81', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                Accept payments anywhere with Android POS devices, dynamic UPI QR codes, and seamless gateway integrations.
              </p>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.75rem', color: '#3730A3', marginBottom: '1.5rem' }}>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
                  <ShieldCheck style={{ width: '16px', height: '16px', color: '#4F46E5', flexShrink: 0, marginTop: '2px' }} />
                  <span>Supports Credit Cards, Debit Cards, NetBanking, and UPI payments.</span>
                </li>
                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
                  <ShieldCheck style={{ width: '16px', height: '16px', color: '#4F46E5', flexShrink: 0, marginTop: '2px' }} />
                  <span>Same-day settlement options into any primary merchant bank account.</span>
                </li>
              </ul>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid #C7D2FE' }}>
              <a href="#contact" className="btn btn-primary btn-sm" style={{ backgroundColor: '#4F46E5', borderColor: '#3730A3' }}>
                Get POS Machine & Gateway →
              </a>
              <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#4338CA' }}>FAST SETTLE</span>
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
          <div style={{ marginTop: '1.25rem', padding: '1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', textAlign: 'center' }}>
            <div>
              <span style={{ fontSize: '0.625rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>Est. Disbursal Timeline</span>
              <h4 style={{ fontSize: '1rem', fontWeight: 900, color: '#34D399', margin: '2px 0 0' }}>{disbursalDays}</h4>
            </div>

            <div>
              <span style={{ fontSize: '0.625rem', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>Est. Monthly Earnings</span>
              <h4 style={{ fontSize: '1.125rem', fontWeight: 900, color: '#FCD34D', margin: '2px 0 0', fontFeatureSettings: '"tnum"' }}>₹{estimatedCommission.toLocaleString('en-IN')}/mo</h4>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <a href="#contact" className="btn btn-primary btn-sm" style={{ width: '100%', backgroundColor: '#0F52BA' }}>
                Apply with this Estimate →
              </a>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
