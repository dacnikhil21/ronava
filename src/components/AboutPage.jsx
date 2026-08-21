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
  TrendingUp,
  Target,
  Compass,
  CheckCircle2
} from 'lucide-react';

// Reusable on-mount count-up counter component
function Counter({ end, duration = 1200, prefix = "", suffix = "", formatComma = false }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setCount(end);
      }
    };
    window.requestAnimationFrame(step);
  }, [end, duration]);

  const displayVal = formatComma ? count.toLocaleString('en-IN') : count;
  return <span>{prefix}{displayVal}{suffix}</span>;
}

export default function AboutPage({ onOpenLogin, onBack }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    setAnimated(true);
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans about-page-wrapper" style={{ width: '100%', paddingTop: 'calc(var(--section-pad-top))' }}>
      
      {/* Main Container */}
      <main className="flex-grow" style={{ padding: '0.75rem 0 4rem' }}>
        <div className="container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1rem' }}>
          
          {/* Hero Banner (Layered Background Card Layout) */}
          <div className="about-hero-section">
            
            {/* Left Content Column */}
            <div className="about-hero-text-container" style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Trust Badge */}
              <div className="about-hero-pill-badge" style={{ background: 'none', border: 'none', padding: 0 }}>
                <ShieldCheck className="about-hero-badge-icon" style={{ width: '15px', height: '15px' }} />
                <span className="about-hero-badge-text">SINCE 2021 | HERITAGE & TRUST</span>
              </div>

              {/* Primary Heading */}
              <h1 className="about-hero-title">
                Building India's<br />
                Trusted <span className="about-hero-title-accent">Merchant</span><br />
                Financial Network.
              </h1>

              {/* Subheading with blue line accent */}
              <div style={{ marginBottom: '1.25rem' }}>
                <p className="about-hero-subheading">
                  Empowering Businesses. Enriching Lives.
                </p>
              </div>

              {/* Description Body */}
              <p className="about-hero-description">
                RONAV Technologies is an enterprise FinTech platform connecting Merchants, Distributors, Retailers and Financial Services through one secure ecosystem.
              </p>

              {/* Action CTAs (Contact Us + Explore Services) */}
              <div className="about-hero-ctas" style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <a 
                  href="#contact"
                  onClick={onBack}
                  className="btn btn-primary btn-lg btn-mobile-full"
                  style={{ fontWeight: 800, backgroundColor: '#0F52BA', minHeight: '48px', padding: '0 1.5rem', boxShadow: '0 8px 24px rgba(15, 82, 186, 0.45)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', textDecoration: 'none' }}
                >
                  <span>Contact Us</span>
                  <ArrowRight style={{ width: '18px', height: '18px' }} />
                </a>

                <button 
                  onClick={onBack}
                  className="btn btn-lg btn-mobile-full"
                  style={{ fontWeight: 700, minHeight: '48px', padding: '0 1.5rem', backgroundColor: '#F1F5F9', color: '#0F172A', border: '1px solid #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  Explore Services
                </button>
              </div>
            </div>

            {/* Right Image Column (Desktop only, hidden on mobile) */}
            <div className="about-hero-image-card">
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
            <div className="stat-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0.5rem 0.25rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem', color: '#0F52BA' }}>
                <Users style={{ width: '18px', height: '18px' }} />
              </div>
              <h3 style={{ fontSize: 'clamp(1rem, 2.8vw, 1.35rem)', fontWeight: 900, color: '#0F172A', margin: 0, lineHeight: 1.1 }}>
                <Counter end={2538} suffix="+" formatComma={true} />
              </h3>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#64748B', margin: '0.25rem 0 0.5rem' }}>Active Merchants</p>
              <div style={{ width: '20px', height: '3px', background: '#0F52BA', borderRadius: '2px' }}></div>
            </div>

            {/* Stat 2 */}
            <div className="stat-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0.5rem 0.25rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem', color: '#059669' }}>
                <TrendingUp style={{ width: '18px', height: '18px' }} />
              </div>
              <h3 style={{ fontSize: 'clamp(1rem, 2.8vw, 1.35rem)', fontWeight: 900, color: '#0F172A', margin: 0, lineHeight: 1.1 }}>
                <Counter end={50} prefix="₹" suffix="Cr+" />
              </h3>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#64748B', margin: '0.25rem 0 0.5rem' }}>Txn Volume</p>
              <div style={{ width: '20px', height: '3px', background: '#059669', borderRadius: '2px' }}></div>
            </div>

            {/* Stat 3 */}
            <div className="stat-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0.5rem 0.25rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem', color: '#7C3AED' }}>
                <Building2 style={{ width: '18px', height: '18px' }} />
              </div>
              <h3 style={{ fontSize: 'clamp(1rem, 2.8vw, 1.35rem)', fontWeight: 900, color: '#0F172A', margin: 0, lineHeight: 1.1 }}>
                <Counter end={250} suffix="+" />
              </h3>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#64748B', margin: '0.25rem 0 0.5rem' }}>ATM / CDM Network</p>
              <div style={{ width: '20px', height: '3px', background: '#7C3AED', borderRadius: '2px' }}></div>
            </div>

            {/* Stat 4 */}
            <div className="stat-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0.5rem 0.25rem' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem', color: '#D97706' }}>
                <MapPin style={{ width: '18px', height: '18px' }} />
              </div>
              <h3 style={{ fontSize: 'clamp(1.05rem, 2.8vw, 1.35rem)', fontWeight: 900, color: '#0F172A', margin: 0, lineHeight: 1.1 }}>AP & TS</h3>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#64748B', margin: '0.25rem 0 0.5rem' }}>Active 2 States</p>
              <div style={{ width: '20px', height: '3px', background: '#D97706', borderRadius: '2px' }}></div>
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
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', border: '1.5px solid #BFDBFE', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F52BA' }}>
                  <Users style={{ width: '18px', height: '18px' }} />
                </div>
                <strong style={{ fontSize: '0.6rem', fontWeight: 800, color: '#0F172A', marginTop: '0.375rem' }}>Super Distributor</strong>
              </div>

              {/* Arrow */}
              <ArrowRight className="ecosystem-arrow" style={{ width: '16px', height: '16px', color: '#93C5FD' }} />

              {/* Node 2 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', border: '1.5px solid #BFDBFE', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F52BA' }}>
                  <Network style={{ width: '18px', height: '18px' }} />
                </div>
                <strong style={{ fontSize: '0.6rem', fontWeight: 800, color: '#0F172A', marginTop: '0.375rem' }}>Distributor</strong>
              </div>

              {/* Arrow */}
              <ArrowRight className="ecosystem-arrow" style={{ width: '16px', height: '16px', color: '#93C5FD' }} />

              {/* Node 3 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', border: '1.5px solid #BFDBFE', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F52BA' }}>
                  <Store style={{ width: '18px', height: '18px' }} />
                </div>
                <strong style={{ fontSize: '0.6rem', fontWeight: 800, color: '#0F172A', marginTop: '0.375rem' }}>Retailer</strong>
              </div>

              {/* Arrow */}
              <ArrowRight className="ecosystem-arrow" style={{ width: '16px', height: '16px', color: '#93C5FD' }} />

              {/* Node 4 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', border: '1.5px solid #BFDBFE', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F52BA' }}>
                  <ShoppingBag style={{ width: '18px', height: '18px' }} />
                </div>
                <strong style={{ fontSize: '0.6rem', fontWeight: 800, color: '#0F172A', marginTop: '0.375rem' }}>Merchant</strong>
              </div>

              {/* Arrow */}
              <ArrowRight className="ecosystem-arrow" style={{ width: '16px', height: '16px', color: '#93C5FD' }} />

              {/* Node 5 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ width: '42px', height: '42px', borderRadius: '50%', border: '1.5px solid #BFDBFE', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F52BA' }}>
                  <User style={{ width: '18px', height: '18px' }} />
                </div>
                <strong style={{ fontSize: '0.6rem', fontWeight: 800, color: '#0F172A', marginTop: '0.375rem' }}>Customer</strong>
              </div>

            </div>
          </div>

          {/* Strategic Mission & Vision Section */}
          <div style={{ marginBottom: '3.5rem' }}>
            {/* Header Tag */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
              <div style={{ height: '1.5px', width: '28px', background: 'linear-gradient(90deg, transparent, #0F52BA)', borderRadius: '1px' }} />
              <h2 style={{ fontSize: '0.8125rem', fontWeight: 900, color: '#0F52BA', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>MISSION & VISION</h2>
              <div style={{ height: '1.5px', width: '28px', background: 'linear-gradient(90deg, #0F52BA, transparent)', borderRadius: '1px' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Card 1: Our Mission */}
              <div 
                className="mission-vision-card"
                style={{
                  backgroundColor: '#EFF6FF',
                  borderColor: '#BFDBFE',
                  borderWidth: '1.5px',
                  borderStyle: 'solid',
                  borderRadius: '20px',
                  padding: '1.75rem 2rem',
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1fr',
                  alignItems: 'center',
                  gap: '2rem',
                  boxShadow: '0 10px 30px rgba(15,82,186,0.01)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#0F52BA', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Target style={{ width: '13px', height: '13px' }} />
                    </div>
                    <span style={{ fontSize: '0.625rem', fontWeight: 900, color: '#0F52BA', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      OUR MISSION
                    </span>
                  </div>

                  <h3 className="vm-card-title" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#1E40AF', margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
                    Democratize Business Credit
                  </h3>

                  <p style={{ fontSize: '0.8125rem', color: '#1E3A8A', lineHeight: 1.6, marginBottom: '1.125rem' }}>
                    Empower every retailer with accessible working capital, high-margin BBPS capabilities, and turnkey ATM operations.
                  </p>

                  <div className="vm-checklist-row">
                    <div className="vm-chip vm-chip-blue">
                      <CheckCircle2 className="vm-chip-icon" />
                      <span>Zero Payout Delay</span>
                    </div>
                    <div className="vm-chip vm-chip-blue">
                      <CheckCircle2 className="vm-chip-icon" />
                      <span>Accessible Working Capital</span>
                    </div>
                    <div className="vm-chip vm-chip-blue">
                      <CheckCircle2 className="vm-chip-icon" />
                      <span>Inclusive Growth</span>
                    </div>
                  </div>
                </div>

                <div className="vm-illustration-box">
                  <img 
                    src="/mission_chart.png" 
                    alt="Our Mission Illustration" 
                    className="vm-svg-chart"
                    style={{ 
                      width: '100%', 
                      height: 'auto', 
                      maxWidth: '180px', 
                      objectFit: 'contain', 
                      margin: '0 auto',
                      display: 'block' 
                    }} 
                  />
                </div>
              </div>

              {/* Card 2: Strategic Vision */}
              <div 
                className="mission-vision-card"
                style={{
                  backgroundColor: '#ECFDF5',
                  borderColor: '#A7F3D0',
                  borderWidth: '1.5px',
                  borderStyle: 'solid',
                  borderRadius: '20px',
                  padding: '1.75rem 2rem',
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1fr',
                  alignItems: 'center',
                  gap: '2rem',
                  boxShadow: '0 10px 30px rgba(5,150,105,0.01)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#059669', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Compass style={{ width: '13px', height: '13px' }} />
                    </div>
                    <span style={{ fontSize: '0.625rem', fontWeight: 900, color: '#059669', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      STRATEGIC VISION
                    </span>
                  </div>

                  <h3 className="vm-card-title" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#065F46', margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
                    India's Most Trusted Network
                  </h3>

                  <p style={{ fontSize: '0.8125rem', color: '#064E3B', lineHeight: 1.6, marginBottom: '1.125rem' }}>
                    Build India's most trusted 3-tier distributor-merchant network, processing ₹100 Cr+ monthly with 100% transparency.
                  </p>

                  <div className="vm-checklist-row">
                    <div className="vm-chip vm-chip-green">
                      <CheckCircle2 className="vm-chip-icon" />
                      <span>3-Tier Ecosystem</span>
                    </div>
                    <div className="vm-chip vm-chip-green">
                      <CheckCircle2 className="vm-chip-icon" />
                      <span>100% Transparency</span>
                    </div>
                    <div className="vm-chip vm-chip-green">
                      <CheckCircle2 className="vm-chip-icon" />
                      <span>Sustainable Growth</span>
                    </div>
                  </div>
                </div>

                <div className="vm-illustration-box">
                  <div className="vm-india-map-container" style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto' }}>
                    <img 
                      src="/vision_map.png" 
                      alt="Strategic Vision Illustration" 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'contain',
                        display: 'block' 
                      }} 
                    />
                  </div>
                </div>
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
              <div className="why-item reveal-left" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.75rem', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F52BA', flexShrink: 0 }}>
                  <ShieldCheck style={{ width: '14px', height: '14px' }} />
                </div>
                <strong style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>Secure Payment Infrastructure</strong>
              </div>

              {/* Item 2 */}
              <div className="why-item reveal-right" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.75rem', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', flexShrink: 0 }}>
                  <Zap style={{ width: '14px', height: '14px' }} />
                </div>
                <strong style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>Instant Settlements</strong>
              </div>

              {/* Item 3 */}
              <div className="why-item reveal-left" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.75rem', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7C3AED', flexShrink: 0 }}>
                  <FileText style={{ width: '14px', height: '14px' }} />
                </div>
                <strong style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>Loan Services</strong>
              </div>

              {/* Item 4 */}
              <div className="why-item reveal-right" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.75rem', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706', flexShrink: 0 }}>
                  <Building2 style={{ width: '14px', height: '14px' }} />
                </div>
                <strong style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>ATM & CDM Franchise</strong>
              </div>

              {/* Item 5 */}
              <div className="why-item reveal-left" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.75rem', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F52BA', flexShrink: 0 }}>
                  <Droplet style={{ width: '14px', height: '14px' }} />
                </div>
                <strong style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>BBPS</strong>
              </div>

              {/* Item 6 */}
              <div className="why-item reveal-right" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.75rem', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#E0F2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0369A1', flexShrink: 0 }}>
                  <CreditCard style={{ width: '14px', height: '14px' }} />
                </div>
                <strong style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0F172A' }}>PG & POS Solutions</strong>
              </div>

              {/* Item 7 */}
              <div className="why-item reveal-left" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 0.75rem', background: '#F8FAFC', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626', flexShrink: 0 }}>
                  <Headphones style={{ width: '14px', height: '14px' }} />
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
        /* Desktop Default Hero layout */
        .about-hero-section {
          display: grid;
          grid-template-columns: 1.25fr 1fr;
          gap: 2.5rem;
          align-items: center;
          margin-bottom: 2.5rem;
        }
        .about-hero-image-card {
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 20px 48px -8px rgba(15,23,42,0.14);
          border: 1px solid #E2E8F0;
        }
        .about-hero-title {
          font-size: clamp(1.85rem, 4.5vw, 2.5rem);
          font-weight: 900;
          color: #0F172A;
          line-height: 1.15;
          margin-bottom: 1rem;
          letter-spacing: -0.02em;
        }
        .about-hero-description {
          font-size: 0.9375rem;
          color: #475569;
          line-height: 1.65;
          margin: 0;
        }
        .about-hero-pill-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.3125rem 0.75rem;
          background: #EFF6FF;
          border: 1px solid #BFDBFE;
          border-radius: 50px;
          color: #0F52BA;
          font-size: 0.6875rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 1.25rem;
        }
        .about-hero-subheading {
          font-size: 0.9375rem;
          font-weight: 800;
          color: #0F52BA;
          margin: 0;
          padding-bottom: 0.25rem;
          border-bottom: 2px solid #0F52BA;
          display: inline-block;
        }

        /* 4-Stat card grid container */
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
          gap: 0.5rem;
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

        /* Checklist items row display */
        .vm-checklist-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        /* Clean text layout items */
        .vm-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.78125rem;
          font-weight: 800;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }

        .vm-chip-blue {
          color: #1E3A8A;
        }

        .vm-chip-green {
          color: #064E3B;
        }

        .vm-chip-icon {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
        }

        .vm-chip-blue .vm-chip-icon {
          color: #0F52BA;
        }

        .vm-chip-green .vm-chip-icon {
          color: #059669;
        }

        .vm-illustration-box {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Mobile layout override */
        @media (max-width: 767px) {
          .mission-vision-card {
            grid-template-columns: 1fr !important;
            gap: 1.25rem !important;
            padding: 1.25rem !important;
            border-radius: 16px !important;
          }
          
          .vm-card-title {
            font-size: 1.25rem !important;
          }

          .vm-checklist-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 0.5rem !important;
          }

          .vm-chip {
            font-size: 0.75rem !important;
          }

          .vm-svg-chart {
            max-width: 130px !important;
          }

          .vm-india-map-container {
            width: 90px !important;
            height: 90px !important;
          }

          .about-hero-section {
            grid-template-columns: 1fr !important;
            background: linear-gradient(135deg, rgba(10, 25, 47, 0.40) 0%, rgba(15, 82, 186, 0.40) 100%), url("/about_hero.png") no-repeat center center;
            background-size: cover;
            background-position: center;
            border-radius: 24px;
            padding: 2.5rem 1.5rem !important;
            border: 1px solid #E2E8F0;
            box-shadow: 0 10px 30px rgba(15,23,42,0.04);
          }
          .about-hero-image-card {
            display: none !important;
          }
          .about-hero-text-container {
            background: none !important;
            backdrop-filter: none !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .about-hero-badge-icon {
            color: #93C5FD !important;
          }
          .about-hero-badge-text {
            color: #93C5FD !important;
            text-shadow: 0 1px 3px rgba(0,0,0,0.8);
          }
          .about-hero-title {
            font-size: 1.85rem !important;
            color: #FFFFFF !important;
            text-shadow: 0 2px 4px rgba(0,0,0,0.8), 0 0 12px rgba(0,0,0,0.2) !important;
          }
          .about-hero-title-accent {
            color: #38BDF8 !important;
          }
          .about-hero-subheading {
            color: #93C5FD !important;
            border-bottom: 2px solid #93C5FD !important;
            text-shadow: 0 1px 3px rgba(0,0,0,0.8);
          }
          .about-hero-description {
            color: #E2E8F0 !important;
            text-shadow: 0 1px 3px rgba(0,0,0,0.8) !important;
          }

          /* Keep stats row in 4 columns without wrapping */
          .stats-card-container {
            grid-template-columns: repeat(4, 1fr) !important;
            padding: 1rem 0.5rem !important;
            gap: 0.25rem !important;
            margin-bottom: 2.5rem !important;
          }

          /* Keep ecosystem row horizontal without wrapping */
          .ecosystem-flow-container {
            flex-direction: row !important;
            justify-content: space-between !important;
            gap: 0.125rem !important;
          }
          .ecosystem-arrow {
            transform: none !important;
            width: 12px !important;
            height: 12px !important;
          }

          /* Make Why Choose Us a compact 2-column grid on mobile */
          .why-us-items-card {
            grid-template-columns: 1fr 1fr !important;
            gap: 0.5rem !important;
            padding: 1rem !important;
          }
        }

        @media (max-width: 480px) {
          .why-us-items-card {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

    </div>
  );
}
