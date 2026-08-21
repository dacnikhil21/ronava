import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, 
  X, 
  Phone, 
  ChevronDown, 
  Landmark, 
  Building2, 
  Zap, 
  CreditCard, 
  Layers, 
  ArrowRight,
  ArrowLeft
} from 'lucide-react';

export default function Navbar({ onOpenLogin, onNavigate, currentView = 'home' }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [servicesDropdownOpen, setServicesDropdownOpen] = useState(false);
  const [mobileServicesAccordionOpen, setMobileServicesAccordionOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const [animated, setAnimated] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    setNavVisible(true);
    const timer = setTimeout(() => {
      setAnimated(true);
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setServicesDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNavClick = (viewName) => {
    setMobileMenuOpen(false);
    setServicesDropdownOpen(false);
    onNavigate(viewName);
  };

  const isDedicatedPage = currentView && currentView !== 'home';

  const servicesList = [
    {
      id: 'service-loans',
      icon: <Landmark style={{ width: '18px', height: '18px' }} />,
      color: '#059669',
      bgColor: '#ECFDF5',
      title: 'Personal & Business Loans',
      tag: '₹50K - ₹1 Cr Capital',
      desc: 'No payslips required personal credit & GST business financing.'
    },
    {
      id: 'service-atm',
      icon: <Building2 style={{ width: '18px', height: '18px' }} />,
      color: '#0F52BA',
      bgColor: '#EFF6FF',
      title: 'ATM & CDM Franchise',
      tag: 'High Monthly ROI',
      desc: 'White-label ATM & Cash Deposit Machine commercial setup.'
    },
    {
      id: 'service-bbps',
      icon: <Zap style={{ width: '18px', height: '18px' }} />,
      color: '#D97706',
      bgColor: '#FFFBEB',
      title: 'BBPS Utility Bill Payments',
      tag: 'Instant Commission',
      desc: 'Electricity, water, gas, and mobile bills instant processing.'
    },
    {
      id: 'service-pos',
      icon: <CreditCard style={{ width: '18px', height: '18px' }} />,
      color: '#7C3AED',
      bgColor: '#F5F3FF',
      title: 'Payment Gateway & POS',
      tag: 'Card Swipe & QR',
      desc: 'Android smart POS terminals, soundboxes & online checkout SDK.'
    }
  ];

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
      <div className="container navbar-container" style={{ padding: 'var(--nav-padding) 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        
        {/* Left Side: Dedicated Back Button on Sub-pages & Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }} className="nav-brand-wrapper">
          {isDedicatedPage && (
            <button 
              onClick={() => handleNavClick('home')}
              style={{
                background: '#EFF6FF',
                border: '1px solid #BFDBFE',
                cursor: 'pointer',
                padding: '0.35rem 0.625rem',
                borderRadius: '8px',
                color: '#0F52BA',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontWeight: 800,
                fontSize: '0.75rem',
                flexShrink: 0,
                transition: 'all 150ms ease'
              }}
              title="Go back to Home"
            >
              <ArrowLeft style={{ width: '16px', height: '16px' }} />
              <span className="desktop-only">Back</span>
            </button>
          )}

          <button 
            onClick={() => handleNavClick('home')}
            className="navbar-brand-btn"
            style={{ 
              background: 'none', 
              border: 'none', 
              cursor: 'pointer', 
              padding: 0, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              textAlign: 'left'
            }}
          >
          {/* Symmetrical Vector TR Monogram Symbol */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img 
              src="/logo_tr_transparent.png" 
              alt="TR Monogram" 
              style={{ 
                height: 'var(--logo-height)', 
                width: 'auto', 
                display: 'block',
                flexShrink: 0 
              }} 
            />
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
                  <defs>
                    <linearGradient id="logoTGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0066FF" />
                      <stop offset="100%" stopColor="#003399" />
                    </linearGradient>
                  </defs>
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
              <div style={{ height: '2px', width: '12px', background: 'linear-gradient(90deg, #0066FF, transparent)', borderRadius: '1px' }} />
            </div>
          </div>
        </button>
      </div>

        {/* Desktop Navigation Links */}
        <nav className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <button onClick={() => handleNavClick('home')} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            Home
          </button>

          <button onClick={() => handleNavClick('about')} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            About Us
          </button>

          {/* Interactive Services Dropdown */}
          <div 
            ref={dropdownRef}
            style={{ position: 'relative' }}
            onMouseEnter={() => setServicesDropdownOpen(true)}
            onMouseLeave={() => setServicesDropdownOpen(false)}
          >
            <button 
              onClick={() => setServicesDropdownOpen(!servicesDropdownOpen)}
              className="nav-link" 
              style={{ 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.25rem',
                color: servicesDropdownOpen ? '#0F52BA' : undefined 
              }}
            >
              <span>Services</span>
              <ChevronDown style={{ 
                width: '14px', 
                height: '14px', 
                transition: 'transform 200ms ease', 
                transform: servicesDropdownOpen ? 'rotate(180deg)' : 'none' 
              }} />
            </button>

            {/* Desktop Dropdown Popover */}
            {servicesDropdownOpen && (
              <div 
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: '-80px',
                  width: '380px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 20px 40px -10px rgba(15,23,42,0.15)',
                  padding: '0.75rem',
                  zIndex: 999,
                  animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                }}
              >
                <div style={{ padding: '0.25rem 0.5rem 0.5rem', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.625rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    FINANCIAL SERVICES
                  </span>
                  <button 
                    onClick={() => handleNavClick('services')}
                    style={{ background: 'none', border: 'none', color: '#0F52BA', fontSize: '0.6875rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
                  >
                    <span>View All Hub</span>
                    <ArrowRight style={{ width: '12px', height: '12px' }} />
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.5rem' }}>
                  {servicesList.map((service) => (
                    <button
                      key={service.id}
                      onClick={() => handleNavClick(service.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                        padding: '0.625rem',
                        borderRadius: '10px',
                        border: '1px solid transparent',
                        background: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 150ms ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#F8FAFC';
                        e.currentTarget.style.borderColor = '#E2E8F0';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.borderColor = 'transparent';
                      }}
                    >
                      <div style={{ 
                        width: '34px', 
                        height: '34px', 
                        borderRadius: '8px', 
                        background: service.bgColor, 
                        color: service.color, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        flexShrink: 0 
                      }}>
                        {service.icon}
                      </div>

                      <div style={{ flexGrow: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <strong style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A' }}>{service.title}</strong>
                          <span style={{ fontSize: '0.5625rem', fontWeight: 800, color: service.color, background: service.bgColor, padding: '1px 6px', borderRadius: '10px' }}>{service.tag}</span>
                        </div>
                        <p style={{ fontSize: '0.6875rem', color: '#64748B', margin: '2px 0 0', lineHeight: 1.3 }}>{service.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <a href="#network" className="nav-link">Business Network</a>
          <a href="#why-us" className="nav-link">Why Choose Us</a>
        </nav>

        <div className="nav-actions-desktop">
          <button 
            onClick={() => onOpenLogin('merchant')}
            className="btn btn-primary btn-sm"
            style={{ fontWeight: 800, padding: '0.5rem 1.25rem' }}
          >
            Partner Login →
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

      {/* Mobile Drawer with Services Accordion */}
      {mobileMenuOpen && (
        <div className="mobile-drawer" style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', maxHeight: '85vh', overflowY: 'auto' }}>
          <button onClick={() => handleNavClick('home')} className="mobile-drawer-link" style={{ background: 'none', border: 'none', textAlign: 'left' }}>
            Home
          </button>

          <button onClick={() => handleNavClick('about')} className="mobile-drawer-link" style={{ background: 'none', border: 'none', textAlign: 'left' }}>
            About Us
          </button>

          {/* Expandable Services Group */}
          <div>
            <button 
              onClick={() => setMobileServicesAccordionOpen(!mobileServicesAccordionOpen)}
              className="mobile-drawer-link" 
              style={{ 
                background: 'none', 
                border: 'none', 
                textAlign: 'left', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                width: '100%'
              }}
            >
              <span>Services</span>
              <ChevronDown style={{ 
                width: '16px', 
                height: '16px', 
                transform: mobileServicesAccordionOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 200ms ease'
              }} />
            </button>

            {mobileServicesAccordionOpen && (
              <div style={{ backgroundColor: '#F8FAFC', padding: '0.5rem 1rem', borderRadius: '12px', margin: '0.25rem 0 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {servicesList.map((service) => (
                  <button
                    key={service.id}
                    onClick={() => handleNavClick(service.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '0.625rem',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: service.bgColor, color: service.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {service.icon}
                    </div>
                    <div>
                      <strong style={{ fontSize: '0.75rem', color: '#0F172A', display: 'block' }}>{service.title}</strong>
                      <span style={{ fontSize: '0.625rem', color: service.color, fontWeight: 700 }}>{service.tag}</span>
                    </div>
                  </button>
                ))}

                <button
                  onClick={() => handleNavClick('services')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    background: '#EFF6FF',
                    color: '#0F52BA',
                    border: '1px solid #BFDBFE',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  <span>View All Services Overview →</span>
                </button>
              </div>
            )}
          </div>

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
              style={{ width: '100%', justifyContent: 'center', fontWeight: 800 }}
            >
              Partner Portal Login →
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
