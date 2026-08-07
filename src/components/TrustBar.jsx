import React from 'react';
import { Users, ShieldCheck, TrendingUp, Headphones } from 'lucide-react';

export default function TrustBar() {
  const trustItems = [
    {
      icon: Users,
      title: 'Trusted by Thousands',
      subtitle: 'Active Merchants & Distributors',
      color: '#0F52BA',
      badgeBg: '#EFF6FF'
    },
    {
      icon: ShieldCheck,
      title: 'Secure & Reliable',
      subtitle: 'Bank-grade Encrypted Platform',
      color: '#059669',
      badgeBg: '#ECFDF5'
    },
    {
      icon: TrendingUp,
      title: 'High Returns',
      subtitle: 'Guaranteed Commission Margins',
      color: '#D97706',
      badgeBg: '#FFFBEB'
    },
    {
      icon: Headphones,
      title: '24x7 Support',
      subtitle: 'Helpline: 9966203053',
      color: '#4F46E5',
      badgeBg: '#EEF2FF'
    }
  ];

  // Duplicate list to create seamless infinite marquee auto-scroll loop
  const marqueeItems = [...trustItems, ...trustItems, ...trustItems];

  return (
    <section 
      style={{ 
        width: '100%', 
        padding: '1rem 0', 
        backgroundColor: '#0A192F', 
        borderTop: '1px solid rgba(255,255,255,0.1)', 
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        overflow: 'hidden'
      }}
    >
      <div style={{ width: '100%', overflow: 'hidden' }}>
        
        {/* Continuous Auto-Scrolling Marquee Track */}
        <div className="marquee-track">
          {marqueeItems.map((item, idx) => {
            const IconComponent = item.icon;
            return (
              <div
                key={idx}
                style={{
                  minWidth: '220px',
                  maxWidth: '260px',
                  flex: '0 0 auto',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '14px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem'
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: item.badgeBg,
                    color: item.color,
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'center',
                    flexShrink: 0
                  }}
                >
                  <IconComponent style={{ width: '18px', height: '18px' }} />
                </div>

                <div style={{ overflow: 'hidden' }}>
                  <h4 style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#FFFFFF', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {item.title}
                  </h4>
                  <p style={{ fontSize: '0.6875rem', color: '#94A3B8', margin: '2px 0 0 0', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {item.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
