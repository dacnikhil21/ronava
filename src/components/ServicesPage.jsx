import React from 'react';
import { 
  Landmark, 
  Building2, 
  Zap, 
  QrCode, 
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';

export default function ServicesPage({ onOpenLogin, onBack }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans services-page-wrapper" style={{ width: '100%', paddingTop: 'calc(var(--section-pad-top) + 30px)' }}>
      
      {/* Main Container */}
      <main className="flex-grow" style={{ padding: '2rem 0 4rem' }}>
        <div className="container" style={{ maxWidth: '960px', margin: '0 auto', padding: '0 1rem' }}>
          
          {/* Back Navigation Bar */}
          <div style={{ marginBottom: '2rem' }}>
            <button 
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'none',
                border: 'none',
                color: '#0F52BA',
                fontWeight: 800,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                padding: '0.375rem 0.75rem 0.375rem 0',
                borderRadius: '8px',
                transition: 'all 200ms ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#0052CC';
                e.currentTarget.style.transform = 'translateX(-3px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#0F52BA';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <ArrowLeft style={{ width: '14px', height: '14px' }} />
              <span>Go Back to Home</span>
            </button>
          </div>

          {/* Hero Banner (Layered Background Card Layout) */}
          <div className="services-hero-section" style={{ marginBottom: '3.5rem' }}>
            
            {/* Left Content Column */}
            <div className="services-hero-text-container" style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Solution Hub Badge (Capsule styling removed) */}
              <div className="services-hero-pill-badge" style={{ background: 'none', border: 'none', padding: 0, marginBottom: '1rem' }}>
                <ShieldCheck className="services-hero-badge-icon" style={{ width: '15px', height: '15px' }} />
                <span className="services-hero-badge-text">ENTERPRISE SOLUTIONS HUB</span>
              </div>

              {/* Primary Heading */}
              <h1 className="services-hero-title">
                Complete Financial<br />
                Solutions for <span className="services-hero-title-accent">Retailers</span><br />
                & Merchants.
              </h1>

              {/* Description Body */}
              <p className="services-hero-description">
                From high-margin loans without payslips to BBPS bill collections, Android POS machines, and turnkey ATM/CDM franchise setups.
              </p>
            </div>

            {/* Right Image Column (Desktop only, hidden on mobile) */}
            <div className="desktop-only services-hero-image-card">
              <img 
                src="/services_hero.png" 
                alt="RONAV Financial Services Hub POS and ATM Setup" 
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>

          </div>

          {/* Detailed Service Cards Grid */}
          <div className="services-grid-cards reveal-scale" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
            
            {/* Card 1: Loans (Emerald Green Theme) */}
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
                justifyContent: 'space-between'
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

                {/* Centered 3D Illustration */}
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
              <div style={{ paddingTop: '1rem', borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.5rem' }}>
                <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#059669', letterSpacing: '0.08em', textTransform: 'uppercase' }}>RONAV SECURE</span>
                <button onClick={() => onOpenLogin('merchant')} className="btn btn-primary btn-mobile-full" style={{ backgroundColor: '#059669', borderColor: '#047857', width: '100%', justifyContent: 'center', fontWeight: 800, padding: '0.75rem 1.25rem', borderRadius: '12px' }}>
                  Apply for Loan Credit →
                </button>
              </div>
            </div>

            {/* Card 2: ATM & CDM Franchise (Royal Navy Blue Theme) */}
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

                {/* Centered 3D Illustration */}
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
                </ul>
              </div>

              {/* Action Footer */}
              <div style={{ paddingTop: '1rem', borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.5rem' }}>
                <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#0F52BA', letterSpacing: '0.08em', textTransform: 'uppercase' }}>HIGH MARGIN</span>
                <button onClick={() => onOpenLogin('merchant')} className="btn btn-primary btn-mobile-full" style={{ backgroundColor: '#0F52BA', width: '100%', justifyContent: 'center', fontWeight: 800, padding: '0.75rem 1.25rem', borderRadius: '12px' }}>
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
                    <span>Earn commission on every successful bill transaction processed.</span>
                  </li>
                </ul>
              </div>

              {/* Action Footer */}
              <div style={{ paddingTop: '1rem', borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.5rem' }}>
                <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#D97706', letterSpacing: '0.08em', textTransform: 'uppercase' }}>COMMISSION PER TXN</span>
                <button onClick={() => onOpenLogin('merchant')} className="btn btn-primary btn-mobile-full" style={{ backgroundColor: '#D97706', borderColor: '#B45309', width: '100%', justifyContent: 'center', fontWeight: 800, padding: '0.75rem 1.25rem', borderRadius: '12px' }}>
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
                    <span><strong style={{ color: '#7C3AED' }}>POS Machines:</strong> Deploy card swipe terminals at your outlet for all payments.</span>
                  </li>
                  <li style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.78125rem', color: '#334155', lineHeight: 1.5 }}>
                    <ShieldCheck style={{ width: '18px', height: '18px', color: '#7C3AED', flexShrink: 0, marginTop: '1px' }} />
                    <span>Full payment gateway for online businesses with instant settlement.</span>
                  </li>
                </ul>
              </div>

              {/* Action Footer */}
              <div style={{ paddingTop: '1rem', borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.5rem' }}>
                <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#7C3AED', letterSpacing: '0.08em', textTransform: 'uppercase' }}>INSTANT SETTLEMENT</span>
                <button onClick={() => onOpenLogin('merchant')} className="btn btn-primary btn-mobile-full" style={{ backgroundColor: '#7C3AED', borderColor: '#6D28D9', width: '100%', justifyContent: 'center', fontWeight: 800, padding: '0.75rem 1.25rem', borderRadius: '12px' }}>
                  Get PG & POS Setup →
                </button>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Embedded Style Tag for Responsive Rules */}
      <style>{`
        /* Desktop Default Hero layout */
        .services-hero-section {
          display: grid;
          grid-template-columns: 1.25fr 1fr;
          gap: 2.5rem;
          align-items: center;
        }
        .services-hero-image-card {
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 48px -8px rgba(15,23,42,0.14);
          border: 1px solid #E2E8F0;
          display: block;
        }
        .services-hero-title {
          font-size: clamp(1.85rem, 4.5vw, 2.5rem);
          font-weight: 900;
          color: #0F172A;
          line-height: 1.15;
          margin-bottom: 1rem;
          letter-spacing: -0.02em;
        }
        .services-hero-description {
          font-size: 0.9375rem;
          color: #475569;
          line-height: 1.65;
          margin: 0;
        }
        .services-hero-pill-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          color: #D97706;
          font-size: 0.6875rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        /* Detailed service cards grid */
        .services-grid-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
        }

        /* Mobile layout override */
        @media (max-width: 767px) {
          .services-hero-section {
            grid-template-columns: 1fr !important;
            background: linear-gradient(135deg, rgba(10, 25, 47, 0.40) 0%, rgba(15, 82, 186, 0.40) 100%), url("/services_hero.png") no-repeat center center;
            background-size: cover;
            background-position: center;
            border-radius: 24px;
            padding: 2.5rem 1.5rem !important;
            border: 1px solid #E2E8F0;
            box-shadow: 0 10px 30px rgba(15,23,42,0.04);
          }
          .services-hero-image-card {
            display: none !important;
          }
          .services-hero-text-container {
            background: none !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .services-hero-badge-icon {
            color: #FCD34D !important;
          }
          .services-hero-badge-text {
            color: #FCD34D !important;
            text-shadow: 0 1px 3px rgba(0,0,0,0.8);
          }
          .services-hero-title {
            font-size: 1.85rem !important;
            color: #FFFFFF !important;
            text-shadow: 0 2px 4px rgba(0,0,0,0.8), 0 0 12px rgba(0,0,0,0.2) !important;
          }
          .services-hero-title-accent {
            color: #38BDF8 !important;
          }
          .services-hero-description {
            color: #E2E8F0 !important;
            text-shadow: 0 1px 3px rgba(0,0,0,0.8) !important;
          }

          .services-grid-cards {
            grid-template-columns: 1fr !important;
            gap: 1.5rem !important;
          }

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
        }
      `}</style>

    </div>
  );
}
