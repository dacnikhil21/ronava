import React, { useState, useEffect } from 'react';
import { Menu, X, Phone } from 'lucide-react';

export default function Navbar({ onOpenLogin, onNavigate }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > 60 || mobileMenuOpen) {
        setNavVisible(true);
      } else {
        setNavVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [mobileMenuOpen]);

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
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
        >
          <img 
            src="/ronav_official_logo.png" 
            alt="RONAV Technologies Official Logo" 
            style={{ 
              height: 'var(--logo-height)', 
              maxHeight: 'var(--logo-height)', 
              width: 'auto', 
              display: 'block', 
              objectFit: 'contain'
            }}
          />
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
