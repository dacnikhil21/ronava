import React, { useState, useEffect, useRef } from 'react';
import { 
  Network, 
  ShieldCheck, 
  Users, 
  Rocket, 
  ChevronRight,
  Star
} from 'lucide-react';

export default function BusinessNetwork() {
  const [activeRole, setActiveRole] = useState(0);
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }); },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    const els = sectionRef.current?.querySelectorAll('.reveal, .reveal-scale');
    els?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const roles = [
    {
      title: 'Master',
      tierText: 'Tier 1 Executive',
      color: '#7C3AED',
      bg: '#F5F3FF',
      border: '#DDD6FE',
      image: '/sd_building.png',
      hasCrown: true
    },
    {
      title: 'Super Distributor',
      tierText: 'Tier 2 Enterprise',
      color: '#0F52BA',
      bg: '#EFF6FF',
      border: '#BFDBFE',
      image: '/d_building.png',
      hasCrown: false
    },
    {
      title: 'DIST Franchise',
      tierText: 'Tier 3 District',
      color: '#0284C7',
      bg: '#F0F9FF',
      border: '#BAE6FD',
      image: '/r_building.png',
      hasCrown: false
    },
    {
      title: 'Distributor',
      tierText: 'Tier 4 Area',
      color: '#059669',
      bg: '#ECFDF5',
      border: '#A7F3D0',
      image: '/m_building.png',
      hasCrown: false
    },
    {
      title: 'Retailer',
      tierText: 'Tier 5 Merchant',
      color: '#D97706',
      bg: '#FFFBEB',
      border: '#FDE68A',
      image: '/r_building.png',
      hasCrown: false
    }
  ];

  return (
    <section 
      id="network" 
      ref={sectionRef} 
      className="section-padding" 
      style={{ 
        background: 'radial-gradient(circle at 50% 30%, #F0F9FF 0%, #FFFFFF 85%)', 
        width: '100%',
        padding: '5rem 0'
      }}
    >
      <div className="container" style={{ maxWidth: '860px', margin: '0 auto', padding: '0 1rem' }}>
        
        {/* Section Header */}
        <div className="section-header reveal" style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.3125rem 0.75rem', background: '#EFF6FF', borderRadius: '50px', color: '#0F52BA', fontSize: '0.6875rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem' }}>
            <Network style={{ width: '13px', height: '13px' }} />
            <span>5-Tier Integrated Network</span>
          </div>
          <h2 className="section-title" style={{ fontSize: 'clamp(1.75rem, 4.5vw, 2.25rem)', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
            Integrated <span style={{ color: '#0F52BA' }}>Network Architecture</span>
          </h2>
          <p className="section-subtitle" style={{ fontSize: '0.875rem', color: '#475569', maxWidth: '640px', margin: '0 auto', lineHeight: 1.6 }}>
            Connecting Master, Super Distributors, DIST Franchise, Distributors, and Retailers in a unified financial ecosystem.
          </p>
        </div>

        {/* 4-Tier Visual Horizontal Nodes Flow */}
        <div className="network-flow-wrapper reveal-scale" style={{ marginBottom: '4.5rem' }}>
          {roles.map((role, idx) => (
            <React.Fragment key={idx}>
              {/* Node Card Container */}
              <div 
                onClick={() => setActiveRole(idx)}
                className={`network-node-btn ${activeRole === idx ? 'is-active' : ''}`}
                style={{
                  '--node-color': role.color,
                  '--node-bg': role.bg,
                  '--node-border': role.border,
                  cursor: 'pointer'
                }}
              >
                {/* Crown badge for Super Distributor */}
                {role.hasCrown && (
                  <div className="node-crown-badge">
                    <Star style={{ width: '8px', height: '8px', fill: '#FFFFFF', stroke: '#FFFFFF' }} />
                  </div>
                )}
                
                {/* Circular Icon container with premium inner highlight/shadow */}
                <div className="node-circle-icon">
                  <img 
                    src={role.image} 
                    alt={role.title} 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: 'contain',
                      borderRadius: '50%',
                      padding: '1px'
                    }} 
                  />
                  
                  {/* Connecting Arrow absolute-positioned to center-right of the circle container */}
                  {idx < roles.length - 1 && (
                    <div className="network-flow-arrow">
                      <ChevronRight style={{ width: '14px', height: '14px' }} />
                    </div>
                  )}
                </div>

                {/* Node Labels */}
                <span className="node-label-title">{role.title}</span>
                <span className="node-label-tier">{role.tierText}</span>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Bottom Horizontal Indicators Bar (Glassmorphic) */}
        <div className="network-indicators-bar reveal">
          <div className="indicator-item">
            <Users className="indicator-icon" />
            <strong className="indicator-text">Unified Network</strong>
          </div>
          
          <div className="indicator-separator" />
          
          <div className="indicator-item">
            <Rocket className="indicator-icon" />
            <strong className="indicator-text">Scalable Growth</strong>
          </div>
          
          <div className="indicator-separator" />
          
          <div className="indicator-item">
            <ShieldCheck className="indicator-icon" />
            <strong className="indicator-text">Transparent Operations</strong>
          </div>
        </div>

      </div>

      {/* Inline styles for responsive network flow mapping */}
      <style>{`
        /* Flow Row Container */
        .network-flow-wrapper {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          max-width: 760px;
          margin: 0 auto;
          gap: 0.25rem;
        }

        /* Circular Node Button styles */
        .network-node-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          position: relative;
          padding: 0.5rem 0.125rem;
          max-width: 120px;
          transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        .node-crown-badge {
          position: absolute;
          top: -2px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
          background: #F59E0B;
          border-radius: 50%;
          width: 14px;
          height: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(245,158,11,0.4);
        }

        .node-circle-icon {
          width: 66px;
          height: 66px;
          border-radius: 50%;
          border: 1.5px solid #E2E8F0;
          background: #FFFFFF;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 0.75rem;
          box-shadow: 0 4px 12px rgba(15,23,42,0.03);
          transition: all 250ms cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }

        /* Outline highlighting and scaling when hovered/active */
        .network-node-btn:hover .node-circle-icon {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(15, 82, 186, 0.08);
          border-color: #BFDBFE;
        }

        .network-node-btn.is-active .node-circle-icon {
          border-color: var(--node-color);
          box-shadow: 0 0 0 4px var(--node-bg), 0 8px 24px rgba(15, 82, 186, 0.15);
          transform: scale(1.05) translateY(-2px);
        }

        .node-label-title {
          font-size: 0.78125rem;
          font-weight: 800;
          color: #0F172A;
          margin-bottom: 0.25rem;
          line-height: 1.25;
        }

        .node-label-tier {
          font-size: 0.5625rem;
          font-weight: 800;
          color: #1E3A8A;
          background: #EFF6FF;
          padding: 2px 8px;
          border-radius: 20px;
          white-space: nowrap;
        }

        /* Absolute positioned arrow relative ONLY to the circle icon */
        .network-flow-arrow {
          position: absolute;
          left: calc(100% + 14px); /* Pushes the arrow exactly into the center gap between circles */
          top: 50%;
          transform: translateY(-50%);
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #93C5FD;
          pointer-events: none;
        }

        /* Glassmorphic bottom indicators bar */
        .network-indicators-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(239, 246, 255, 0.85);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(191, 219, 254, 0.6);
          border-radius: 16px;
          padding: 1.125rem 2rem;
          max-width: 760px;
          margin: 0 auto;
          box-shadow: 0 8px 32px rgba(15, 82, 186, 0.03);
        }

        .indicator-item {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          flex: 1;
          justify-content: center;
        }

        .indicator-icon {
          width: 18px;
          height: 18px;
          color: #0F52BA;
        }

        .indicator-text {
          font-size: 0.78125rem;
          font-weight: 800;
          color: #1E3A8A;
        }

        .indicator-separator {
          width: 1px;
          height: 20px;
          background-color: rgba(191, 219, 254, 0.8);
        }

        /* Mobile specific layouts */
        @media (max-width: 767px) {
          .network-flow-wrapper {
            gap: 0.05rem !important;
            justify-content: space-around !important;
          }
          .network-node-btn {
            max-width: 60px !important;
            padding: 0.25rem 0 !important;
          }
          .node-circle-icon {
            width: 44px !important;
            height: 44px !important;
            margin-bottom: 0.25rem !important;
          }
          .node-label-title {
            font-size: 0.53rem !important;
            max-width: 58px;
            line-height: 1.15;
          }
          .node-label-tier {
            font-size: 0.44rem !important;
            padding: 1px 3px !important;
          }
          .network-flow-arrow {
            left: calc(100% + 2px) !important;
          }
          .network-flow-arrow svg {
            width: 9px !important;
            height: 9px !important;
          }
          /* Keep Indicators Bar Horizontal on Mobile */
          .network-indicators-bar {
            padding: 0.875rem 0.5rem !important;
            gap: 0.25rem !important;
          }
          .indicator-text {
            font-size: 0.6rem !important;
            white-space: nowrap;
          }
          .indicator-icon {
            width: 14px !important;
            height: 14px !important;
          }
          .indicator-separator {
            height: 14px !important;
          }
        }
      `}</style>

    </section>
  );
}
