import React, { useEffect, useRef } from 'react';
import { Zap, TrendingUp, Landmark, ShieldCheck, ArrowRight } from 'lucide-react';

export default function WhyChooseUs() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    const elements = sectionRef.current?.querySelectorAll('.reveal, .reveal-scale');
    elements?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const pillars = [
    {
      icon: Zap,
      title: 'Instant Settlements',
      metric: '0.2s',
      label: 'Payout Speed',
      desc: 'Zero-delay payouts credited directly to your bank account 24x7.',
      color: '#60A5FA',
      glow: 'rgba(96, 165, 250, 0.12)',
      accent: '#3B82F6'
    },
    {
      icon: TrendingUp,
      title: 'Industry-Leading Margins',
      metric: 'High',
      label: 'Commission Rate',
      desc: 'Earn maximum store revenue on every BBPS collection and transaction.',
      color: '#34D399',
      glow: 'rgba(52, 211, 153, 0.12)',
      accent: '#10B981'
    },
    {
      icon: Landmark,
      title: 'Loans Without Payslips',
      metric: '₹1 Cr',
      label: 'Max Credit Line',
      desc: 'Personal & Business loans approved in 24-48 hrs via bank statements.',
      color: '#FCD34D',
      glow: 'rgba(252, 211, 77, 0.12)',
      accent: '#F59E0B'
    },
    {
      icon: ShieldCheck,
      title: 'Bank-Grade Security',
      metric: '256-Bit',
      label: 'SSL Encrypted',
      desc: 'PCI-DSS compliant infrastructure with real-time fraud detection.',
      color: '#C4B5FD',
      glow: 'rgba(196, 181, 253, 0.12)',
      accent: '#8B5CF6'
    }
  ];

  return (
    <section id="why-us" ref={sectionRef} className="section-padding section-cinematic">
      <div className="container" style={{ position: 'relative', zIndex: 1 }}>

        {/* Section Header */}
        <div className="section-header reveal" style={{ marginBottom: '2.5rem' }}>
          <span className="section-tag" style={{ backgroundColor: 'rgba(15,82,186,0.25)', color: '#93C5FD', borderColor: 'rgba(147,197,253,0.3)' }}>
            INSTITUTIONAL TRUST PILLARS
          </span>
          <h2 className="section-title" style={{ color: '#FFFFFF', letterSpacing: '-0.025em' }}>
            Why Merchants Choose{' '}
            <span className="text-gradient-blue">RONAV</span>
          </h2>
          <p className="section-subtitle" style={{ color: '#94A3B8' }}>
            Engineered to eliminate complexity, increase trust, and boost profit margins for merchants.
          </p>
        </div>

        {/* 4-Pillar Card Grid */}
        <div className="mobile-app-sales-grid">
          {pillars.map((p, idx) => (
            <div
              key={idx}
              className="reveal card-dark-glow"
              style={{
                padding: 'var(--card-padding)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                background: `linear-gradient(145deg, rgba(255,255,255,0.04) 0%, ${p.glow} 100%)`,
                transitionDelay: `${idx * 80}ms`
              }}
            >
              {/* Icon + Metric */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: p.glow, border: `1px solid ${p.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <p.icon style={{ width: '22px', height: '22px', color: p.color }} />
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)', fontWeight: 900, color: p.color, lineHeight: 1, letterSpacing: '-0.02em' }}>{p.metric}</div>
                  <div style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#64748B', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{p.label}</div>
                </div>
              </div>

              {/* Text */}
              <div>
                <h3 style={{ fontSize: 'var(--text-card-title)', fontWeight: 800, color: '#F1F5F9', marginBottom: '0.375rem', lineHeight: 1.3 }}>{p.title}</h3>
                <p style={{ fontSize: '0.8125rem', color: '#94A3B8', lineHeight: 1.6, margin: 0 }}>{p.desc}</p>
              </div>

              {/* Live dot */}
              <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="glow-dot" style={{ background: p.accent, boxShadow: `0 0 0 0 ${p.accent}80` }} />
                <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: p.color, letterSpacing: '0.08em' }}>LIVE 24x7</span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA Banner */}
        <div
          className="reveal"
          style={{
            marginTop: '2.5rem',
            padding: '1.5rem',
            borderRadius: '16px',
            background: 'rgba(15,82,186,0.12)',
            border: '1px solid rgba(15,82,186,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            transitionDelay: '320ms'
          }}
        >
          <div>
            <p style={{ fontSize: 'var(--text-h3)', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Ready to start earning with RONAV?</p>
            <p style={{ fontSize: '0.8125rem', color: '#94A3B8', margin: '4px 0 0' }}>Join 2,500+ merchants already growing their business.</p>
          </div>
          <a href="#contact" className="btn btn-primary btn-slide-arrow btn-mobile-full" style={{ fontWeight: 800, minHeight: '46px', padding: '0 1.5rem', backgroundColor: '#0F52BA', gap: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span>Get Started Today</span>
            <span className="btn-arrow-icon"><ArrowRight style={{ width: '17px', height: '17px' }} /></span>
          </a>
        </div>

      </div>
    </section>
  );
}


