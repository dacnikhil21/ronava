import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Network, 
  Store, 
  ShoppingBag, 
  User, 
  ShieldCheck, 
  Zap, 
  FileText, 
  Building2, 
  Droplet, 
  CreditCard, 
  Headphones, 
  ArrowLeft, 
  ArrowRight, 
  MapPin,
  TrendingUp
} from 'lucide-react';

export default function AboutPage({ onOpenLogin, onBack }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    setAnimated(true);
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans about-page-wrapper" style={{ width: '100%' }}>
      
      {/* Main Container */}
      <main className="flex-grow" style={{ padding: '2rem 0 4rem' }}>
        <div className="container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1rem' }}>
          
          {/* Back Navigation Bar */}
          <div style={{ marginBottom: '1.5rem' }}>
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

          {/* Hero Banner Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2.5rem', alignItems: 'center', marginBottom: '2.5rem' }}>
            
            {/* Left Content Column */}
            <div>
              {/* Trust Badge */}
              <div 
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.375rem', 
                  padding: '0.3125rem 0.75rem', 
                  background: '#EFF6FF', 
                  border: '1px solid #BFDBFE', 
                  borderRadius: '50px', 
                  color: '#0F52BA', 
                  fontSize: '0.6875rem', 
                  fontWeight: 800, 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.04em', 
                  marginBottom: '1.25rem' 
                }}
              >
                <ShieldCheck style={{ width: '13px', height: '13px', color: '#0F52BA' }} />
                <span>SINCE 2021 | HERITAGE & TRUST</span>
              </div>

              {/* Primary Heading */}
              <h1 
                style={{ 
                  fontSize: 'clamp(1.85rem, 4.5vw, 2.5rem)', 
                  fontWeight: 900, 
                  color: '#0F172A', 
                  lineHeight: 1.15, 
                  marginBottom: '1rem',
                  letterSpacing: '-0.02em'
                }}
              >
                Building India's<br />
                Trusted <span style={{ color: '#0F52BA' }}>Merchant</span><br />
                Financial Network.
              </h1>

              {/* Subheading with blue line accent */}
              <div style={{ marginBottom: '1.25rem' }}>
                <p 
                  style={{ 
                    fontSize: '0.9375rem', 
                    fontWeight: 800, 
                    color: '#0F52BA', 
                    margin: 0,
                    paddingBottom: '0.25rem',
                    borderBottom: '2px solid #0F52BA',
                    display: 'inline-block'
                  }}
                >
                  Empowering Businesses. Enriching Lives.
                </p>
              </div>

              {/* Description Body */}
              <p style={{ fontSize: '0.9375rem', color: '#475569', lineHeight: 1.65, margin: 0 }}>
                RONAV Technologies is an enterprise FinTech platform connecting Merchants, Distributors, Retailers and Financial Services through one secure ecosystem.
              </p>
            </div>

            {/* Right Image Facade Column */}
            <div 
              style={{ 
                borderRadius: '24px', 
                overflow: 'hidden', 
                boxShadow: '0 20px 48px -8px rgba(15,23,42,0.14)', 
                border: '1px solid #E2E8F0',
                position: 'relative'
              }}
            >
              <img 
                src="/about_hero.png" 
                alt="RONAV Corporate Office Facade" 
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>

          </div>

          {/* 4-Tier Interactive Stats Row */}
          <div className="stats-card-container">
            
            {/* Stat 1 */}
            <div className="stat-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0.5rem 1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.625rem', color: '#0F52BA' }}>
                <Users style={{ width: '20px', height: '20px' }} />
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', margin: 0, lineHeight: 1.1 }}>2,538+</h3>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', margin: '0.25rem 0 0.5rem' }}>Active Merchants</p>
              <div style={{ width: '28px', height: '3px', background: '#0F52BA', borderRadius: '2px' }}></div>
            </div>

            {/* Stat 2 */}
            <div className="stat-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0.5rem 1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.625rem', color: '#059669' }}>
                <TrendingUp style={{ width: '20px', height: '20px' }} />
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', margin: 0, lineHeight: 1.1 }}>₹50Cr+</h3>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', margin: '0.25rem 0 0.5rem' }}>Transaction Volume</p>
              <div style={{ width: '28px', height: '3px', background: '#059669', borderRadius: '2px' }}></div>
            </div>

            {/* Stat 3 */}
            <div className="stat-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0.5rem 1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.625rem', color: '#7C3AED' }}>
                <Building2 style={{ width: '20px', height: '20px' }} />
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', margin: 0, lineHeight: 1.1 }}>250+</h3>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', margin: '0.25rem 0 0.5rem' }}>ATM / CDM Network</p>
              <div style={{ width: '28px', height: '3px', background: '#7C3AED', borderRadius: '2px' }}></div>
            </div>

            {/* Stat 4 */}
            <div className="stat-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0.5rem 1rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.625rem', color: '#D97706' }}>
                <MapPin style={{ width: '20px', height: '20px' }} />
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', margin: 0, lineHeight: 1.1 }}>AP & TS</h3>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', margin: '0.25rem 0 0.5rem' }}>Operating Across 2 States</p>
              <div style={{ width: '28px', height: '3px', background: '#D97706', borderRadius: '2px' }}></div>
            </div>

          </div>

          {/* Ecosystem Flow Section */}
          <div style={{ marginBottom: '3.5rem' }}>
            {/* Header Tag */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
              <div style={{ height: '1.5px', width: '28px', background: 'linear-gradient(90deg, transparent, #0F52BA)', borderRadius: '1px' }} />
              <h2 style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#0F52BA', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>OUR ECOSYSTEM</h2>
              <div style={{ height: '1.5px', width: '28px', background: 'linear-gradient(90deg, #0F52BA, transparent)', borderRadius: '1px' }} />
            </div>

            {/* Flow Map */}
            <div className="ecosystem-flow-container">
              
              {/* Node 1 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '1.5px solid #BFDBFE', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F52BA' }}>
                  <Users style={{ width: '24px', height: '24px' }} />
                </div>
                <strong style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', marginTop: '0.5rem' }}>Super<br />Distributor</strong>
              </div>

              {/* Arrow */}
              <ArrowRight className="ecosystem-arrow" style={{ width: '20px', height: '20px', color: '#93C5FD' }} />

              {/* Node 2 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '1.5px solid #BFDBFE', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F52BA' }}>
                  <Network style={{ width: '24px', height: '24px' }} />
                </div>
                <strong style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', marginTop: '0.5rem' }}>Distributor</strong>
              </div>

              {/* Arrow */}
              <ArrowRight className="ecosystem-arrow" style={{ width: '20px', height: '20px', color: '#93C5FD' }} />

              {/* Node 3 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '1.5px solid #BFDBFE', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F52BA' }}>
                  <Store style={{ width: '24px', height: '24px' }} />
                </div>
                <strong style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', marginTop: '0.5rem' }}>Retailer</strong>
              </div>

              {/* Arrow */}
              <ArrowRight className="ecosystem-arrow" style={{ width: '20px', height: '20px', color: '#93C5FD' }} />

              {/* Node 4 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '1.5px solid #BFDBFE', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F52BA' }}>
                  <ShoppingBag style={{ width: '24px', height: '24px' }} />
                </div>
                <strong style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', marginTop: '0.5rem' }}>Merchant</strong>
              </div>

              {/* Arrow */}
              <ArrowRight className="ecosystem-arrow" style={{ width: '20px', height: '20px', color: '#93C5FD' }} />

              {/* Node 5 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', border: '1.5px solid #BFDBFE', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F52BA' }}>
                  <User style={{ width: '24px', height: '24px' }} />
                </div>
                <strong style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A', marginTop: '0.5rem' }}>Customer</strong>
              </div>

            </div>
          </div>

          {/* Why Choose Us Grid */}
          <div style={{ marginBottom: '3.5rem' }}>
            {/* Header Tag */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
              <div style={{ height: '1.5px', width: '28px', background: 'linear-gradient(90deg, transparent, #0F52BA)', borderRadius: '1px' }} />
              <h2 style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#0F52BA', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>WHY CHOOSE RONAV?</h2>
              <div style={{ height: '1.5px', width: '28px', background: 'linear-gradient(90deg, #0F52BA, transparent)', borderRadius: '1px' }} />
            </div>

            {/* Grid Container */}
            <div className="why-us-items-card">
              
              {/* Item 1 */}
              <div className="why-item" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F52BA', flexShrink: 0 }}>
                  <ShieldCheck style={{ width: '16px', height: '16px' }} />
                </div>
                <strong style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>Secure Payment Infrastructure</strong>
              </div>

              {/* Item 2 */}
              <div className="why-item" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', flexShrink: 0 }}>
                  <Zap style={{ width: '16px', height: '16px' }} />
                </div>
                <strong style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>Instant Settlements</strong>
              </div>

              {/* Item 3 */}
              <div className="why-item" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED', flexShrink: 0 }}>
                  <FileText style={{ width: '16px', height: '16px' }} />
                </div>
                <strong style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>Loan Services</strong>
              </div>

              {/* Item 4 */}
              <div className="why-item" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706', flexShrink: 0 }}>
                  <Building2 style={{ width: '16px', height: '16px' }} />
                </div>
                <strong style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>ATM & CDM Franchise</strong>
              </div>

              {/* Item 5 */}
              <div className="why-item" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F52BA', flexShrink: 0 }}>
                  <Droplet style={{ width: '16px', height: '16px' }} />
                </div>
                <strong style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>BBPS</strong>
              </div>

              {/* Item 6 */}
              <div className="why-item" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0369A1', flexShrink: 0 }}>
                  <CreditCard style={{ width: '16px', height: '16px' }} />
                </div>
                <strong style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>PG & POS Solutions</strong>
              </div>

              {/* Item 7 */}
              <div className="why-item" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626', flexShrink: 0 }}>
                  <Headphones style={{ width: '16px', height: '16px' }} />
                </div>
                <strong style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>Enterprise Support</strong>
              </div>

            </div>
          </div>

          {/* Bottom Quotation Callout */}
          <div 
            style={{ 
              padding: '2.5rem 1.5rem', 
              borderRadius: '24px', 
              background: 'linear-gradient(135deg, #0A192F 0%, #0F52BA 100%)', 
              color: '#FFFFFF', 
              textAlign: 'center', 
              position: 'relative', 
              overflow: 'hidden', 
              boxShadow: '0 12px 36px rgba(15,82,186,0.25)' 
            }}
          >
            {/* World Grid Dot Pattern Overlay */}
            <div 
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                bottom: 0, 
                opacity: 0.1, 
                backgroundImage: 'radial-gradient(circle, #FFF 1px, transparent 1px)', 
                backgroundSize: '16px 16px' 
              }} 
            />

            {/* Quote Symbol Badge */}
            <div 
              style={{ 
                margin: '0 auto 1.25rem', 
                width: '40px', 
                height: '40px', 
                borderRadius: '50%', 
                background: '#0066FF', 
                color: '#FFFFFF', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontWeight: 900, 
                fontSize: '1.5rem', 
                lineHeight: 1, 
                boxShadow: '0 4px 12px rgba(0,102,255,0.4)',
                position: 'relative',
                zIndex: 2
              }}
            >
              “
            </div>

            {/* Quote Texts */}
            <h3 style={{ fontSize: '1.1875rem', fontWeight: 800, color: '#FFFFFF', margin: '0 0 0.375rem', position: 'relative', zIndex: 2 }}>
              We don't just process payments.
            </h3>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#38BDF8', margin: 0, position: 'relative', zIndex: 2 }}>
              We build financial opportunities.
            </h2>

            {/* Separator Accent */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem', position: 'relative', zIndex: 2 }}>
              <div style={{ height: '1px', width: '32px', background: 'rgba(255,255,255,0.2)' }} />
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0066FF' }} />
              <div style={{ height: '1px', width: '32px', background: 'rgba(255,255,255,0.2)' }} />
            </div>

          </div>

        </div>
      </main>

      {/* Embedded Style Tag for Responsive Rules */}
      <style>{`
        /* 4-Stat grid styling */
        .stats-card-container {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 24px;
          padding: 1.5rem;
          box-shadow: 0 10px 30px rgba(15,23,42,0.04);
          margin-top: 2rem;
          margin-bottom: 3.5rem;
          gap: 1rem;
        }

        /* Ecosystem row container */
        .ecosystem-flow-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          padding: 1rem 0;
        }

        /* Why Choose Us Grid */
        .why-us-items-card {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 0.75rem;
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 24px;
          padding: 1.5rem;
          box-shadow: 0 10px 30px rgba(15,23,42,0.04);
        }

        /* Responsive Breakpoints */
        @media (max-width: 900px) {
          .stats-card-container {
            grid-template-columns: 1fr 1fr;
            gap: 1.5rem;
          }
          .ecosystem-flow-container {
            flex-direction: column;
            gap: 1.5rem;
            align-items: center;
          }
          .ecosystem-arrow {
            transform: rotate(90deg);
          }
        }

        @media (max-width: 480px) {
          .stats-card-container {
            grid-template-columns: 1fr;
          }
          .why-us-items-card {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

    </div>
  );
}
