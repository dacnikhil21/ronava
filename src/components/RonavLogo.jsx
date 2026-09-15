import React from 'react';

export default function RonavLogo({ size = 'medium', height, variant = 'default', className = '', style = {}, onClick }) {
  // Height sizing
  const defaultHeight = size === 'small' ? '28px' : size === 'large' ? '46px' : '38px';
  const logoHeight = height || defaultHeight;
  const numHeight = parseInt(logoHeight, 10) || 38;
  const isWhite = variant === 'white' || variant === 'dark';

  return (
    <div 
      className={`ronav-brand-logo ${className}`}
      onClick={onClick}
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: `${Math.max(6, Math.round(numHeight * 0.2))}px`,
        userSelect: 'none',
        lineHeight: 1,
        cursor: onClick ? 'pointer' : 'inherit',
        ...style 
      }}
    >
      {/* 1254x1254 Ultra-HD Official Emblem (Never Blurry) */}
      <img 
        src="/logo_tr_transparent.png" 
        alt="RONAV" 
        style={{
          height: logoHeight,
          width: logoHeight,
          objectFit: 'contain',
          display: 'block',
          flexShrink: 0,
          filter: isWhite ? 'brightness(0) invert(1)' : 'none'
        }}
      />

      {/* Crisp Native Vector Typography (100% Vector Crisp on Retina & Mobile Screens) */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
          fontWeight: 900,
          fontSize: `${Math.round(numHeight * 0.46)}px`,
          letterSpacing: '0.07em',
          lineHeight: 1.05,
          color: isWhite ? '#FFFFFF' : '#0A192F',
          display: 'flex',
          alignItems: 'center'
        }}>
          RON<span style={{ color: isWhite ? '#93C5FD' : '#0F52BA', marginLeft: '1px', marginRight: '1px' }}>Λ</span>V
        </div>
        <div style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
          fontWeight: 800,
          fontSize: `${Math.max(7, Math.round(numHeight * 0.19))}px`,
          letterSpacing: '0.22em',
          lineHeight: 1,
          color: isWhite ? '#94A3B8' : '#475569',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          marginTop: `${Math.max(2, Math.round(numHeight * 0.08))}px`
        }}>
          <span style={{ width: '7px', height: '1.5px', background: isWhite ? '#93C5FD' : '#0F52BA', borderRadius: '1px', flexShrink: 0 }} />
          <span>TECHNOLOGIES</span>
          <span style={{ width: '7px', height: '1.5px', background: isWhite ? '#93C5FD' : '#0F52BA', borderRadius: '1px', flexShrink: 0 }} />
        </div>
      </div>
    </div>
  );
}
