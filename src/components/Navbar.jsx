import React, { useState, useEffect } from 'react';
import { Menu, X, Phone } from 'lucide-react';

export default function Navbar({ onOpenLogin, onNavigate }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    // Standard visibility: always visible on viewport mount
    setNavVisible(true);
    
    // Trigger letter-by-letter naming animation
    const timer = setTimeout(() => {
      setAnimated(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const handleNavClick = (viewName) => {
    setMobileMenuOpen(false);
    onNavigate(viewName);
  };

  return (
    <header 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
        boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.08)',
        transform: navVisible ? 'translateY(0)' : 'translateY(-100%)',
        opacity: navVisible ? 1 : 0,
        pointerEvents: navVisible ? 'auto' : 'none',
        transition: 'transform 350ms cubic-bezier(0.16, 1, 0.3, 1), opacity 350ms ease'
      }}
    >
      <div className="container navbar-container" style={{ padding: 'var(--nav-padding) 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        
        <button 
          onClick={() => handleNavClick('home')}
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            padding: 0, 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.625rem',
            textAlign: 'left'
          }}
        >
          {/* Symmetrical Vector TR Monogram Symbol (Official Shape) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg 
              viewBox="0 0 120 100" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg" 
              style={{ 
                height: 'var(--logo-height)', 
                width: 'auto', 
                flexShrink: 0 
              }}
            >
              <defs>
                <linearGradient id="logoTGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0066FF" />
                  <stop offset="100%" stopColor="#003399" />
                </linearGradient>
                <linearGradient id="logoRGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0A1E3F" />
                  <stop offset="100%" stopColor="#051024" />
                </linearGradient>
              </defs>
              
              {/* Scattered Pixel Blocks */}
              <rect x="15" y="22" width="6" height="6" fill="#0066FF" />
              <rect x="23" y="29" width="6" height="6" fill="#0066FF" />
              <rect x="31" y="31" width="8" height="7" fill="#0066FF" />
              <rect x="17" y="36" width="6" height="6" fill="#0066FF" />
              <rect x="25" y="41" width="8" height="7" fill="#0066FF" />

              {/* T Horizontal Bar (with slanted right cut) */}
              <path d="M32 38 H90 L80 50 H32 Z" fill="url(#logoTGrad)" />
              
              {/* T Vertical Stem */}
              <path d="M55 50 H67 V90 H55 Z" fill="url(#logoTGrad)" />

              {/* R Upper Monogram Curve */}
              <path 
                d="M57 22 H82 C96 22 106 34 106 48 C106 62 96 74 82 74 H67" 
                fill="none" 
                stroke="url(#logoRGrad)" 
                strokeWidth="12" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />

              {/* R Leg */}
              <path 
                d="M74 72 L98 94" 
                fill="none" 
                stroke="url(#logoRGrad)" 
                strokeWidth="12" 
                strokeLinecap="round" 
              />
            </svg>
          </div>

          {/* Letter-by-Letter Writing Animation Naming */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div 
              style={{ 
                fontSize: 'clamp(1.2rem, 3.8vw, 1.5rem)', 
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
                transition: `opacity 300ms cubic-bezier(0.16, 1, 0.3, 1) 300ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) 300ms`
              }}>R</span>
              {/* O */}
              <span style={{
                display: 'inline-block',
                opacity: animated ? 1 : 0,
                transform: animated ? 'translateX(0)' : 'translateX(-6px)',
                transition: `opacity 300ms cubic-bezier(0.16, 1, 0.3, 1) 370ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) 370ms`
              }}>O</span>
              {/* N */}
              <span style={{
                display: 'inline-block',
                opacity: animated ? 1 : 0,
                transform: animated ? 'translateX(0)' : 'translateX(-6px)',
                transition: `opacity 300ms cubic-bezier(0.16, 1, 0.3, 1) 440ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) 440ms`
              }}>N</span>
              {/* A (Inverted V Chevron) */}
              <span
                style={{
                  display: 'inline-flex',
                  opacity: animated ? 1 : 0,
                  transform: animated ? 'translateX(0)' : 'translateX(-6px)',
                  transition: `opacity 300ms cubic-bezier(0.16, 1, 0.3, 1) 510ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) 510ms`,
                  width: 'clamp(0.95rem, 3vw, 1.15rem)',
                  height: 'clamp(0.95rem, 3vw, 1.15rem)',
                  marginRight: '2px',
                  marginLeft: '2px',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', display: 'block' }}>
                  <path d="M12 90 L50 15 L88 90" stroke="url(#logoTGrad)" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              {/* V */}
              <span style={{
                display: 'inline-block',
                opacity: animated ? 1 : 0,
                transform: animated ? 'translateX(0)' : 'translateX(-6px)',
                transition: `opacity 300ms cubic-bezier(0.16, 1, 0.3, 1) 580ms, transform 300ms cubic-bezier(0.16, 1, 0.3, 1) 580ms`
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
                transition: `opacity 400ms cubic-bezier(0.16, 1, 0.3, 1) 750ms, transform 400ms cubic-bezier(0.16, 1, 0.3, 1) 750ms`,
                marginTop: '3px'
              }}
            >
              {/* Accent Line Left */}
              <div style={{ height: '2px', width: '12px', background: 'linear-gradient(90deg, transparent, #0066FF)', borderRadius: '1px' }} />
              <span 
                style={{ 
                  fontSize: 'clamp(0.45rem, 1.4vw, 0.58rem)', 
                  fontWeight: 800, 
                  color: '#475569', 
                  letterSpacing: '0.16em', 
                  lineHeight: 1
                }}
              >
                TECHNOLOGIES
              </span>
              {/* Accent Line Right */}
              <div style={{ height: '2px', width: '12px', background: 'linear-gradient(90deg, #0066FF, transparent)', borderRadius: '1px' }} />
            </div>
          </div>
        </button>

        <nav className="nav-links-desktop">
          <button onClick={() => handleNavClick('home')} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            Home
          </button>
          <button onClick={() => handleNavClick('about')} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            About Us
          </button>
          <button onClick={() => handleNavClick('services')} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            Services
          </button>
          <a href="#network" className="nav-link">Business Network</a>
          <a href="#why-us" className="nav-link">Why Choose Us</a>
        </nav>

        <div className="nav-actions-desktop">
          <button 
            onClick={() => onOpenLogin('merchant')}
            className="btn btn-ghost btn-sm"
            style={{ fontWeight: 700 }}
          >
            Merchant Login
          </button>

          <button 
            onClick={() => onOpenLogin('admin')}
            className="btn btn-ghost btn-sm"
            style={{ fontWeight: 700, color: '#64748B' }}
          >
            Admin Login
          </button>

          <button 
            onClick={() => onOpenLogin('merchant')}
            className="btn btn-primary btn-sm"
          >
            Become a Merchant →
          </button>
        </div>

        <div className="mobile-nav-toggle" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <a 
            href="tel:9966203053" 
            style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#EFF6FF', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
            title="Direct Merchant Hotline"
          >
            <Phone style={{ width: '18px', height: '18px' }} />
          </a>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: '#0F172A' }}
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X style={{ width: '26px', height: '26px' }} /> : <Menu style={{ width: '26px', height: '26px' }} />}
          </button>
        </div>

      </div>

      {mobileMenuOpen && (
        <div className="mobile-drawer" style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0' }}>
          <button onClick={() => handleNavClick('home')} className="mobile-drawer-link" style={{ background: 'none', border: 'none', textAlign: 'left' }}>
            Home
          </button>
          <button onClick={() => handleNavClick('about')} className="mobile-drawer-link" style={{ background: 'none', border: 'none', textAlign: 'left' }}>
            About Us
          </button>
          <button onClick={() => handleNavClick('services')} className="mobile-drawer-link" style={{ background: 'none', border: 'none', textAlign: 'left' }}>
            Services
          </button>
          <a href="#network" onClick={() => setMobileMenuOpen(false)} className="mobile-drawer-link">
            Business Network
          </a>
          <a href="#why-us" onClick={() => setMobileMenuOpen(false)} className="mobile-drawer-link">
            Why Choose Us
          </a>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9' }}>
            <button 
              onClick={() => { setMobileMenuOpen(false); onOpenLogin('merchant'); }}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Become a Merchant Partner →
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button 
                onClick={() => { setMobileMenuOpen(false); onOpenLogin('merchant'); }}
                className="btn btn-secondary btn-sm"
              >
                Merchant Login
              </button>
              <button 
                onClick={() => { setMobileMenuOpen(false); onOpenLogin('admin'); }}
                className="btn btn-secondary btn-sm"
              >
                Admin Login
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
