import React from 'react';

export default function RonavLogo({ size = 'medium', height, variant = 'default', className = '', style = {}, onClick }) {
  // Height sizing
  const defaultHeight = size === 'small' ? '28px' : size === 'large' ? '46px' : '34px';
  const logoHeight = height || defaultHeight;

  return (
    <div 
      className={`ronav-brand-logo ${className}`}
      onClick={onClick}
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        userSelect: 'none',
        lineHeight: 1,
        filter: variant === 'dark' || variant === 'white' ? 'brightness(0) invert(1)' : 'none',
        cursor: onClick ? 'pointer' : 'inherit',
        ...style 
      }}
    >
      <img 
        src="/ronav_official_logo_horizontal.png" 
        alt="RONAV TECHNOLOGIES" 
        style={{
          height: logoHeight,
          width: 'auto',
          maxWidth: '100%',
          objectFit: 'contain',
          display: 'block'
        }}
      />
    </div>
  );
}
