import React, { useState, useEffect } from 'react';

export default function RonavLogo({ size = 'medium', className = '', style = {} }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimated(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const isSmall = size === 'small';
  const isLarge = size === 'large';

  const logoHeight = isSmall ? '38px' : isLarge ? '52px' : 'var(--logo-height, 46px)';
  const fontSize = isSmall ? 'clamp(1.1rem, 3.2vw, 1.3rem)' : isLarge ? 'clamp(1.35rem, 4.2vw, 1.7rem)' : 'clamp(1.2rem, 3.8vw, 1.5rem)';
  const chevronSize = isSmall ? 'clamp(0.85rem, 2.5vw, 1rem)' : isLarge ? 'clamp(1.05rem, 3.3vw, 1.25rem)' : 'clamp(0.95rem, 3vw, 1.15rem)';
  const subFontSize = isSmall ? 'clamp(0.4rem, 1.2vw, 0.5rem)' : isLarge ? 'clamp(0.5rem, 1.5vw, 0.65rem)' : 'clamp(0.45rem, 1.4vw, 0.58rem)';
  const lineWidth = isSmall ? '8px' : isLarge ? '14px' : '12px';

  return (
    <div 
      className={`ronav-brand-logo ${className}`}
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '0.625rem', 
        userSelect: 'none',
        textAlign: 'left',
        ...style 
      }}
    >
      {/* 100% Vector Symmetrical TR Monogram Emblem (Zero Network Request, Never Breaks) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg 
          viewBox="0 0 100 100" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          style={{ 
            height: logoHeight, 
            width: logoHeight, 
            display: 'block',
            flexShrink: 0 
          }}
        >
          <defs>
            <linearGradient id="trGradBlueMaster" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0066FF" />
              <stop offset="100%" stopColor="#003399" />
            </linearGradient>
            <linearGradient id="trGradDarkMaster" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0A192F" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
          </defs>
          <rect x="10" y="22" width="6" height="6" fill="#0066FF" rx="1" />
          <rect x="16" y="28" width="6" height="6" fill="#0066FF" rx="1" />
          <rect x="11" y="34" width="6" height="6" fill="#0066FF" rx="1" />
          <rect x="18" y="37" width="10" height="10" fill="#0066FF" rx="1.5" />
          <rect x="24" y="29" width="10" height="10" fill="#0066FF" rx="1.5" />
          {/* T shape */}
          <path d="M24 44 H71 L63 54 H43 V82 H32 V54 H24 Z" fill="url(#trGradBlueMaster)" />
          {/* R sweep */}
          <path d="M26 20 H70 C85 20 90 32 90 42 C90 54 82 63 68 63 L88 84 H73 L58 63 H66 C75 63 78 57 78 42 C78 30 73 28 66 28 H34 Z" fill="url(#trGradDarkMaster)" />
        </svg>
      </div>

      {/* Letter-by-Letter Writing Animation Naming */}
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
          {/* R */}
          <span style={{
            display: 'inline-block',
            opacity: animated ? 1 : 0,
            transform: animated ? 'translateX(0)' : 'translateX(-6px)',
            transition: 'opacity 300ms cubic-bezier(0.16, 1, 0.3, 1) 300ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) 300ms'
          }}>R</span>
          
          {/* O */}
          <span style={{
            display: 'inline-block',
            opacity: animated ? 1 : 0,
            transform: animated ? 'translateX(0)' : 'translateX(-6px)',
            transition: 'opacity 300ms cubic-bezier(0.16, 1, 0.3, 1) 370ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) 370ms'
          }}>O</span>
          
          {/* N */}
          <span style={{
            display: 'inline-block',
            opacity: animated ? 1 : 0,
            transform: animated ? 'translateX(0)' : 'translateX(-6px)',
            transition: 'opacity 300ms cubic-bezier(0.16, 1, 0.3, 1) 440ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) 440ms'
          }}>N</span>
          
          {/* A (Inverted V Chevron) */}
          <span
            style={{
              display: 'inline-flex',
              opacity: animated ? 1 : 0,
              transform: animated ? 'translateX(0)' : 'translateX(-6px)',
              transition: 'opacity 300ms cubic-bezier(0.16, 1, 0.3, 1) 510ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) 510ms',
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
                <linearGradient id="logoTGradUniversal" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0066FF" />
                  <stop offset="100%" stopColor="#003399" />
                </linearGradient>
              </defs>
              <path d="M12 90 L50 15 L88 90" stroke="url(#logoTGradUniversal)" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          
          {/* V */}
          <span style={{
            display: 'inline-block',
            opacity: animated ? 1 : 0,
            transform: animated ? 'translateX(0)' : 'translateX(-6px)',
            transition: 'opacity 300ms cubic-bezier(0.16, 1, 0.3, 1) 580ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) 580ms'
          }}>V</span>
        </div>
        
        {/* TECHNOLOGIES with gradient accent lines */}
        <div 
          style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            opacity: animated ? 1 : 0,
            transform: animated ? 'translateY(0)' : 'translateY(3px)',
            transition: 'opacity 400ms cubic-bezier(0.16, 1, 0.3, 1) 750ms, transform 400ms cubic-bezier(0.16, 1, 0.3, 1) 750ms',
            marginTop: '3px'
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
