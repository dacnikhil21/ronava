import React from 'react';

export default function RonavLogo({ size = 'medium', className = '', style = {} }) {
  const isSmall = size === 'small';
  const isLarge = size === 'large';

  const imgHeight = isSmall ? '24px' : isLarge ? '40px' : '32px';
  const fontSize = isSmall ? '1.1rem' : isLarge ? '1.5rem' : '1.25rem';
  const chevronSize = isSmall ? '0.85rem' : isLarge ? '1.15rem' : '0.95rem';
  const subFontSize = isSmall ? '0.42rem' : isLarge ? '0.58rem' : '0.5rem';
  const lineWidth = isSmall ? '8px' : isLarge ? '14px' : '10px';

  return (
    <div 
      className={`ronav-brand-logo ${className}`}
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '0.5rem', 
        userSelect: 'none',
        textAlign: 'left',
        ...style 
      }}
    >
      {/* Symmetrical Vector TR Monogram Symbol */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img 
          src="/logo_tr_transparent.png" 
          alt="RONAV" 
          style={{ 
            height: imgHeight, 
            width: 'auto', 
            display: 'block',
            flexShrink: 0 
          }} 
        />
      </div>

      {/* Official Typography: RONAV + TECHNOLOGIES */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div 
          style={{ 
            fontSize: fontSize, 
            fontWeight: 900, 
            color: '#0A192F', 
            letterSpacing: '0.04em', 
            lineHeight: 1, 
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <span>R</span>
          <span>O</span>
          <span>N</span>
          <span
            style={{
              display: 'inline-flex',
              width: chevronSize,
              height: chevronSize,
              marginRight: '2px',
              marginLeft: '2px',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', display: 'block' }}>
              <defs>
                <linearGradient id="ronavSharedLogoTGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0066FF" />
                  <stop offset="100%" stopColor="#003399" />
                </linearGradient>
              </defs>
              <path d="M12 90 L50 15 L88 90" stroke="url(#ronavSharedLogoTGrad)" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>V</span>
        </div>
        
        {/* TECHNOLOGIES with gradient accent lines */}
        <div 
          style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            marginTop: '2px'
          }}
        >
          <div style={{ height: '2px', width: lineWidth, background: 'linear-gradient(90deg, transparent, #0066FF)', borderRadius: '1px' }} />
          <span 
            style={{ 
              fontSize: subFontSize, 
              fontWeight: 800, 
              color: '#475569', 
              letterSpacing: '0.16em', 
              lineHeight: 1
            }}
          >
            TECHNOLOGIES
          </span>
          <div style={{ height: '2px', width: lineWidth, background: 'linear-gradient(90deg, #0066FF, transparent)', borderRadius: '1px' }} />
        </div>
      </div>
    </div>
  );
}
