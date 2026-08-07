import React, { useState, useEffect, useRef } from 'react';
import { Users, TrendingUp, Landmark, Building2 } from 'lucide-react';

export default function StatisticsSection() {
  const [counts, setCounts] = useState({ merchants: 0, volume: 0, disbursed: 0, outlets: 0 });
  const [hasTriggered, setHasTriggered] = useState(false);
  const sectionRef = useRef(null);

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
    <section ref={sectionRef} className="section-padding" style={{ backgroundColor: '#0A192F', color: '#FFFFFF', width: '100%' }}>
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
          
          <div className="card" style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', textAlign: 'center', padding: '1.25rem 0.5rem' }}>
            <div className="icon-badge" style={{ margin: '0 auto 0.5rem', backgroundColor: 'rgba(15,82,186,0.3)', color: '#93C5FD', borderColor: 'rgba(147,197,253,0.3)', width: '32px', height: '32px' }}>
              <Users style={{ width: '16px', height: '16px' }} />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#FFFFFF', margin: '0.125rem 0', fontFeatureSettings: '"tnum"' }}>
              {counts.merchants.toLocaleString()}+
            </h3>
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#93C5FD', margin: 0 }}>Active Merchants</p>
            <p style={{ fontSize: '0.5625rem', color: '#64748B', marginTop: '1px' }}>Retailers & Distributors</p>
          </div>

          <div className="card" style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', textAlign: 'center', padding: '1.25rem 0.5rem' }}>
            <div className="icon-badge" style={{ margin: '0 auto 0.5rem', backgroundColor: 'rgba(5,150,105,0.3)', color: '#34D399', borderColor: 'rgba(52,211,153,0.3)', width: '32px', height: '32px' }}>
              <TrendingUp style={{ width: '16px', height: '16px' }} />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#34D399', margin: '0.125rem 0', fontFeatureSettings: '"tnum"' }}>
              ₹{counts.volume}L
            </h3>
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#34D399', margin: 0 }}>Daily Volume</p>
            <p style={{ fontSize: '0.5625rem', color: '#64748B', marginTop: '1px' }}>Processed Daily</p>
          </div>

          <div className="card" style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', textAlign: 'center', padding: '1.25rem 0.5rem' }}>
            <div className="icon-badge" style={{ margin: '0 auto 0.5rem', backgroundColor: 'rgba(217,119,6,0.3)', color: '#FCD34D', borderColor: 'rgba(252,211,77,0.3)', width: '32px', height: '32px' }}>
              <Landmark style={{ width: '16px', height: '16px' }} />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#FCD34D', margin: '0.125rem 0', fontFeatureSettings: '"tnum"' }}>
              ₹{counts.disbursed} Cr
            </h3>
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#FCD34D', margin: 0 }}>Credit Disbursed</p>
            <p style={{ fontSize: '0.5625rem', color: '#64748B', marginTop: '1px' }}>Personal & Business</p>
          </div>

          <div className="card" style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)', textAlign: 'center', padding: '1.25rem 0.5rem' }}>
            <div className="icon-badge" style={{ margin: '0 auto 0.5rem', backgroundColor: 'rgba(79,70,229,0.3)', color: '#A5B4FC', borderColor: 'rgba(165,180,252,0.3)', width: '32px', height: '32px' }}>
              <Building2 style={{ width: '16px', height: '16px' }} />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#A5B4FC', margin: '0.125rem 0', fontFeatureSettings: '"tnum"' }}>
              {counts.outlets}+
            </h3>
            <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#A5B4FC', margin: 0 }}>ATM Outlets</p>
            <p style={{ fontSize: '0.5625rem', color: '#64748B', marginTop: '1px' }}>Live Outlets</p>
          </div>

        </div>

      </div>
    </section>
  );
}
