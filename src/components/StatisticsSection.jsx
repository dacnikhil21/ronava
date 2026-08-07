import React, { useState, useEffect, useRef } from 'react';
import { Users, TrendingUp, Landmark, Building2 } from 'lucide-react';

export default function StatisticsSection() {
  const [counts, setCounts] = useState({ merchants: 0, volume: 0, disbursed: 0, outlets: 0 });
  const [hasTriggered, setHasTriggered] = useState(false);
  const sectionRef = useRef(null);

  // Scroll-reveal observer for card animations
  useEffect(() => {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    const els = sectionRef.current?.querySelectorAll('.reveal');
    els?.forEach((el) => revealObserver.observe(el));
    return () => revealObserver.disconnect();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasTriggered) {
          setHasTriggered(true);
          startCountAnimation();
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, [hasTriggered]);

  const startCountAnimation = () => {
    let start = 0;
    const duration = 1600;
    const steps = 40;
    const intervalTime = duration / steps;

    const timer = setInterval(() => {
      start += 1;
      const progress = start / steps;
      
      setCounts({
        merchants: Math.round(2538 * progress),
        volume: Number((33.45 * progress).toFixed(2)),
        disbursed: Number((15.8 * progress).toFixed(1)),
        outlets: Math.round(184 * progress)
      });

      if (start >= steps) {
        clearInterval(timer);
        setCounts({ merchants: 2538, volume: 33.45, disbursed: 15.8, outlets: 184 });
      }
    }, intervalTime);
  };

  return (
    <section ref={sectionRef} className="section-padding section-cinematic" style={{ color: '#FFFFFF', width: '100%' }}>
      <div className="container">
        
        <div className="section-header">
          <span className="section-tag" style={{ backgroundColor: 'rgba(15, 82, 186, 0.3)', color: '#93C5FD', borderColor: 'rgba(147, 197, 253, 0.3)' }}>
            INSTITUTIONAL METRICS TELEMETRY
          </span>
          <h2 className="section-title" style={{ color: '#FFFFFF' }}>Driving Financial Growth Across South India</h2>
          <p className="section-subtitle" style={{ color: '#94A3B8' }}>
            Real-time ecosystem statistics reflecting merchant network trust and transaction velocity.
          </p>
        </div>

        {/* 2x2 Grid on Mobile, 4-Col Grid on Desktop */}
        <div className="mobile-app-sales-grid">
          
          <div className="card card-dark-glow reveal" style={{ textAlign: 'center', padding: '1.75rem 1rem', transitionDelay: '0ms' }}>
            <div className="icon-badge" style={{ margin: '0 auto 0.75rem', backgroundColor: 'rgba(15,82,186,0.3)', color: '#93C5FD', borderColor: 'rgba(147,197,253,0.3)', width: '40px', height: '40px' }}>
              <Users style={{ width: '18px', height: '18px' }} />
            </div>
            <h3 style={{ fontSize: 'clamp(1.75rem, 6vw, 2.5rem)', fontWeight: 900, color: '#FFFFFF', margin: '0.125rem 0', fontFeatureSettings: '"tnum"', letterSpacing: '-0.03em', lineHeight: 1 }}>
              {counts.merchants.toLocaleString()}+
            </h3>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#93C5FD', margin: '0.375rem 0 2px' }}>Active Merchants</p>
            <p style={{ fontSize: '0.5625rem', color: '#64748B', marginTop: 0 }}>Retailers &amp; Distributors</p>
          </div>

          <div className="card card-dark-glow reveal" style={{ textAlign: 'center', padding: '1.75rem 1rem', transitionDelay: '80ms' }}>
            <div className="icon-badge" style={{ margin: '0 auto 0.75rem', backgroundColor: 'rgba(5,150,105,0.3)', color: '#34D399', borderColor: 'rgba(52,211,153,0.3)', width: '40px', height: '40px' }}>
              <TrendingUp style={{ width: '18px', height: '18px' }} />
            </div>
            <h3 style={{ fontSize: 'clamp(1.75rem, 6vw, 2.5rem)', fontWeight: 900, color: '#34D399', margin: '0.125rem 0', fontFeatureSettings: '"tnum"', letterSpacing: '-0.03em', lineHeight: 1 }}>
              ₹{counts.volume}L
            </h3>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34D399', margin: '0.375rem 0 2px' }}>Daily Volume</p>
            <p style={{ fontSize: '0.5625rem', color: '#64748B', marginTop: 0 }}>Processed Daily</p>
          </div>

          <div className="card card-dark-glow reveal" style={{ textAlign: 'center', padding: '1.75rem 1rem', transitionDelay: '160ms' }}>
            <div className="icon-badge" style={{ margin: '0 auto 0.75rem', backgroundColor: 'rgba(217,119,6,0.3)', color: '#FCD34D', borderColor: 'rgba(252,211,77,0.3)', width: '40px', height: '40px' }}>
              <Landmark style={{ width: '18px', height: '18px' }} />
            </div>
            <h3 style={{ fontSize: 'clamp(1.75rem, 6vw, 2.5rem)', fontWeight: 900, color: '#FCD34D', margin: '0.125rem 0', fontFeatureSettings: '"tnum"', letterSpacing: '-0.03em', lineHeight: 1 }}>
              ₹{counts.disbursed} Cr
            </h3>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#FCD34D', margin: '0.375rem 0 2px' }}>Credit Disbursed</p>
            <p style={{ fontSize: '0.5625rem', color: '#64748B', marginTop: 0 }}>Personal &amp; Business</p>
          </div>

          <div className="card card-dark-glow reveal" style={{ textAlign: 'center', padding: '1.75rem 1rem', transitionDelay: '240ms' }}>
            <div className="icon-badge" style={{ margin: '0 auto 0.75rem', backgroundColor: 'rgba(79,70,229,0.3)', color: '#A5B4FC', borderColor: 'rgba(165,180,252,0.3)', width: '40px', height: '40px' }}>
              <Building2 style={{ width: '18px', height: '18px' }} />
            </div>
            <h3 style={{ fontSize: 'clamp(1.75rem, 6vw, 2.5rem)', fontWeight: 900, color: '#A5B4FC', margin: '0.125rem 0', fontFeatureSettings: '"tnum"', letterSpacing: '-0.03em', lineHeight: 1 }}>
              {counts.outlets}+
            </h3>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#A5B4FC', margin: '0.375rem 0 2px' }}>ATM Outlets</p>
            <p style={{ fontSize: '0.5625rem', color: '#64748B', marginTop: 0 }}>Live &amp; Operational</p>
          </div>

        </div>

      </div>
    </section>
  );
}
