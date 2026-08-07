import React from 'react';
import { ArrowRight, ShieldCheck, TrendingUp, Users, Headphones, Activity } from 'lucide-react';

export default function Hero({ onOpenLogin, onShowToast }) {
  return (
    <section 
      className="hero-section" 
      style={{ 
        width: '100%', 
        minHeight: 'calc(100vh - var(--scroll-margin-top))', 
        display: 'flex', 
        flexDirection: 'column', 
        justify: 'space-between',
        backgroundColor: '#060B1E',
        backgroundImage: 'radial-gradient(circle at 75% 30%, rgba(15, 82, 186, 0.25) 0%, rgba(6, 11, 30, 0.95) 70%), url("/hero_bg.png")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        paddingTop: 'var(--section-pad-top)',
        paddingBottom: 'var(--section-pad-bottom)',
        color: '#FFFFFF'
      }}
    >
      <div className="container hero-grid" style={{ width: '100%', flexGrow: 1, alignItems: 'center', gap: 'var(--grid-gap)' }}>
        
        {/* Left Column: Hero Content & CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '580px' }}>
          
          {/* Heritage Tag (Clean line, zero heavy capsules) */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem', color: '#93C5FD', fontWeight: 600 }}>
            <span style={{ padding: '0.2rem 0.5rem', background: '#0F52BA', color: '#FFFFFF', borderRadius: '4px', fontSize: '0.6875rem', fontWeight: 900, letterSpacing: '0.05em' }}>
              SINCE 2021
            </span>
            <span>India's Trusted FinTech Partner</span>
          </div>

          {/* Main Headline */}
          <h1 style={{ fontSize: 'var(--text-h1)', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.1, margin: 0, letterSpacing: '-0.03em' }}>
            Empowering Businesses.<br />
            <span style={{ color: '#38BDF8' }}>Enriching Lives.</span>
          </h1>

          {/* Subtitle */}
          <p style={{ fontSize: 'var(--text-body)', lineHeight: 1.6, color: '#94A3B8', fontWeight: 400, margin: 0 }}>
            India's most reliable digital platform for Distributors, Retailers & Merchants with high-margin financial services and instant settlements.
          </p>

          {/* 4 Stat Items Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--grid-gap)', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <ShieldCheck style={{ width: '22px', height: '22px', color: '#0F52BA', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: '0.875rem', color: '#FFFFFF', display: 'block', fontWeight: 800 }}>100% Secure</strong>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Bank-grade Security</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <TrendingUp style={{ width: '22px', height: '22px', color: '#38BDF8', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: '0.875rem', color: '#FFFFFF', display: 'block', fontWeight: 800 }}>High Returns</strong>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Maximize Your Earnings</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <Users style={{ width: '22px', height: '22px', color: '#818CF8', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: '0.875rem', color: '#FFFFFF', display: 'block', fontWeight: 800 }}>2,500+ Merchants</strong>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Across South India</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <Headphones style={{ width: '22px', height: '22px', color: '#34D399', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontSize: '0.875rem', color: '#FFFFFF', display: 'block', fontWeight: 800 }}>24x7 Support</strong>
                <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Always Here for You</span>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.5rem' }}>
            <button 
              onClick={() => onOpenLogin('merchant')}
              className="btn btn-primary btn-lg"
              style={{ fontWeight: 800, backgroundColor: '#0F52BA', minHeight: '50px', padding: '0 1.75rem', boxShadow: '0 8px 24px rgba(15, 82, 186, 0.45)' }}
            >
              <span>Become a Merchant</span>
              <ArrowRight style={{ width: '18px', height: '18px' }} />
            </button>

            <a 
              href="#services"
              className="btn btn-lg"
              style={{ fontWeight: 700, minHeight: '50px', padding: '0 1.5rem', backgroundColor: 'rgba(255, 255, 255, 0.08)', color: '#FFFFFF', border: '1px solid rgba(255, 255, 255, 0.2)', backdropFilter: 'blur(8px)' }}
            >
              Explore Services
            </a>
          </div>

          {/* Bottom Live System Status Pill */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', backgroundColor: 'rgba(15, 23, 42, 0.7)', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '24px', fontSize: '0.75rem', color: '#94A3B8', marginTop: '0.75rem' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: '#10B981', fontWeight: 700 }}>
              <span className="status-pulse-dot" style={{ backgroundColor: '#10B981' }}></span>
              <span>All Financial Gateway Systems Operational</span>
            </span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>|</span>
            <span style={{ color: '#38BDF8', fontWeight: 700 }}>99.99% Monthly Uptime</span>
          </div>

        </div>

        {/* Right Column: Master 3D FinTech Ecosystem Diagram with Mobile Smartphone Mockup */}
        <div style={{ width: '100%', position: 'relative' }}>
          <div 
            style={{ 
              borderRadius: '24px', 
              overflow: 'hidden', 
              boxShadow: '0 25px 60px -10px rgba(0,0,0,0.6)', 
              border: '1px solid rgba(255, 255, 255, 0.15)',
              backgroundColor: '#070E22'
            }}
          >
            <img 
              src="/ronav_3d_ecosystem_master.png" 
              alt="RONAV Technologies Master FinTech 3D Ecosystem & Smartphone App" 
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </div>
        </div>

      </div>
    </section>
  );
}
