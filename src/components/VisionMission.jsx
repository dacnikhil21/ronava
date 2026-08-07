import React, { useEffect, useRef } from 'react';
import { Target, Compass, CheckCircle2 } from 'lucide-react';

export default function VisionMission() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    const elements = sectionRef.current?.querySelectorAll('.reveal, .reveal-left, .reveal-scale');
    elements?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="section-padding"
      style={{ background: 'linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)', width: '100%' }}
    >
      <div className="container">

        <div className="section-header reveal" style={{ marginBottom: '2.5rem' }}>
          <span className="section-tag">CORPORATE HERITAGE &amp; VISION</span>
          <h2 className="section-title" style={{ letterSpacing: '-0.02em' }}>
            Driving Last-Mile Financial Inclusion{' '}
            <span className="text-gradient-blue">Since 2021</span>
          </h2>
          <p className="section-subtitle">
            Founded to bridge the gap between traditional banking infrastructure and local retail businesses across India.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', alignItems: 'stretch' }}>

          <div
            className="reveal-left"
            style={{
              background: 'linear-gradient(145deg, #070F1E 0%, #0A192F 60%, #0F2345 100%)',
              borderRadius: '20px',
              padding: '2rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '1.5rem',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '300px'
            }}
          >
            <div style={{ position: 'absolute', bottom: '-1rem', right: '-0.5rem', fontSize: 'clamp(4rem, 16vw, 7rem)', fontWeight: 900, color: 'rgba(255,255,255,0.04)', lineHeight: 1, letterSpacing: '-0.04em', userSelect: 'none', pointerEvents: 'none' }}>
              2021
            </div>
            <div style={{ position: 'absolute', top: '-30%', left: '-10%', width: '60%', height: '60%', background: 'radial-gradient(ellipse, rgba(15,82,186,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#93C5FD', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '0.75rem' }}>
                EST. 2021 — HYDERABAD
              </span>
              <h3 style={{ fontSize: 'clamp(1.25rem, 4vw, 1.875rem)', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.2, letterSpacing: '-0.025em', margin: '0 0 1rem' }}>
                Built for India's{' '}
                <span className="text-gradient-blue">next billion</span>{' '}
                merchants
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#94A3B8', lineHeight: 1.65, margin: 0 }}>
                RONAV Technologies was established in 2021 with a singular focus — make enterprise-grade financial services accessible to every retailer, distributor, and merchant across South India.
              </p>
            </div>

            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {['2,500+ Merchants', '₹33L Daily Volume', '184 ATM Outlets'].map((stat) => (
                <span key={stat} style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#BFDBFE', background: 'rgba(15,82,186,0.2)', border: '1px solid rgba(15,82,186,0.35)', borderRadius: '20px', padding: '0.25rem 0.75rem' }}>
                  {stat}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="reveal card card-glow" style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: '1.5px', padding: '1.5rem', borderRadius: '16px', transitionDelay: '80ms' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#0F52BA', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target style={{ width: '20px', height: '20px' }} />
                </div>
                <span style={{ fontSize: '0.5625rem', fontWeight: 800, padding: '0.125rem 0.625rem', background: '#FFFFFF', color: '#0F52BA', borderRadius: '20px', border: '1px solid #BFDBFE', letterSpacing: '0.06em' }}>OUR MISSION</span>
              </div>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: '#1E40AF', marginBottom: '0.625rem' }}>Democratize Business Credit</h3>
              <p style={{ fontSize: '0.8125rem', color: '#1E3A8A', lineHeight: 1.6, marginBottom: '0.875rem' }}>
                Empower every retailer with accessible working capital, high-margin BBPS capabilities, and turnkey ATM operations.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {['Zero Payout Delay Guarantee', 'Accessible Working Capital'].map((item) => (
                  <div key={item} style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.375rem 0.625rem', background: '#FFFFFF', color: '#0F52BA', borderRadius: '6px', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <CheckCircle2 style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="reveal card card-glow" style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: '1.5px', padding: '1.5rem', borderRadius: '16px', transitionDelay: '160ms' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#059669', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Compass style={{ width: '20px', height: '20px' }} />
                </div>
                <span style={{ fontSize: '0.5625rem', fontWeight: 800, padding: '0.125rem 0.625rem', background: '#FFFFFF', color: '#059669', borderRadius: '20px', border: '1px solid #A7F3D0', letterSpacing: '0.06em' }}>STRATEGIC VISION</span>
              </div>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 800, color: '#065F46', marginBottom: '0.625rem' }}>India's Most Trusted Network</h3>
              <p style={{ fontSize: '0.8125rem', color: '#064E3B', lineHeight: 1.6, marginBottom: '0.875rem' }}>
                Build India's most trusted 3-tier distributor-merchant network, processing Rs.100 Cr+ monthly with 100% transparency.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {['3-Tier Ecosystem Connectivity', '100% Operational Transparency'].map((item) => (
                  <div key={item} style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.375rem 0.625rem', background: '#FFFFFF', color: '#059669', borderRadius: '6px', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <CheckCircle2 style={{ width: '13px', height: '13px', flexShrink: 0 }} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
