import React from 'react';
import { Phone, Mail, ShieldCheck, Activity } from 'lucide-react';

export default function Footer({ onOpenLogin, onOpenOfficeModal }) {
  return (
    <footer className="footer">
      <div className="container">
        
        {/* Live System Operational Banner */}
        <div style={{ padding: '0.625rem 1rem', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 800, color: '#34D399' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34D399', boxShadow: '0 0 8px #34D399' }}></span>
            <span>ALL FINANCIAL GATEWAYS OPERATIONAL</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.6875rem', color: '#94A3B8' }}>
            <Activity style={{ width: '14px', height: '14px', color: '#38BDF8' }} />
            <span>99.99% Monthly Settlement Uptime • 24x7 Engine</span>
          </div>
        </div>

        {/* Main Footer Grid */}
        <div className="footer-grid">
          
          {/* Brand & Corporate Mission */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="brand-icon-box">
                <span>R</span>
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.125rem', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span>RONAV</span>
                  <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '0.125rem 0.375rem', background: 'rgba(255,255,255,0.1)', color: '#BFDBFE', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)' }}>EST. 2021</span>
                </div>
                <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.05em' }}>TECHNOLOGIES</p>
              </div>
            </div>

            <p style={{ fontSize: '0.8125rem', color: '#94A3B8', lineHeight: 1.65, marginBottom: '1.25rem' }}>
              RONAV Technologies (Established 2021) is an enterprise financial services platform empowering business owners, retailers, and distributors across India with credit, bill collection, and cash deposit solutions.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#34D399', fontWeight: 700 }}>
              <ShieldCheck style={{ width: '16px', height: '16px' }} />
              <span>100% Encrypted & Bank-Grade Security</span>
            </div>
          </div>

          {/* Quick Navigation */}
          <div>
            <h4 className="footer-heading">Quick Navigation</h4>
            <ul className="footer-list">
              <li><a href="#" className="footer-link">Home Page</a></li>
              <li><a href="#services" className="footer-link">Services Overview</a></li>
              <li><a href="#network" className="footer-link">Business Network</a></li>
              <li><a href="#why-us" className="footer-link">Why Choose Us</a></li>
              <li><a href="#contact" className="footer-link">Contact Matrix</a></li>
            </ul>
          </div>

          {/* Core Services */}
          <div>
            <h4 className="footer-heading">Financial Services</h4>
            <ul className="footer-list">
              <li><a href="#services" className="footer-link">Personal Loans (50k–50L)</a></li>
              <li><a href="#services" className="footer-link">Business Loans (1L–1Cr)</a></li>
              <li><a href="#services" className="footer-link">ATM & CDM Franchise</a></li>
              <li><a href="#services" className="footer-link">BBPS Utility Bill Pay</a></li>
              <li><a href="#services" className="footer-link">PG & POS Machine</a></li>
            </ul>
          </div>

          {/* Portals & Support */}
          <div>
            <h4 className="footer-heading">Portals & Contact</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '1.25rem' }}>
              <button 
                onClick={() => onOpenLogin('merchant')} 
                className="btn btn-secondary btn-sm"
                style={{ justifyContent: 'flex-start', color: '#0F52BA', fontWeight: 800 }}
              >
                Merchant Login Gateway →
              </button>

              <button 
                onClick={() => onOpenLogin('admin')} 
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'flex-start', color: '#94A3B8' }}
              >
                🔒 Admin Portal Access
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.75rem', color: '#94A3B8' }}>
              <p style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <Phone style={{ width: '14px', height: '14px', color: '#38BDF8' }} />
                <span>9966203053</span>
              </p>
              <p style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <Mail style={{ width: '14px', height: '14px', color: '#38BDF8' }} />
                <span>rosenavaneethamenterprises@gmail.com</span>
              </p>
            </div>
          </div>

        </div>

        {/* Sub-Footer Legal Copyright */}
        <div style={{ paddingTop: '1.5rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', fontSize: '0.75rem' }}>
          <p>© 2021 – {new Date().getFullYear()} RONAV TECHNOLOGIES. All Rights Reserved.</p>
          <div style={{ display: 'flex', gap: '1.25rem' }}>
            <a href="#" className="footer-link">Privacy Policy</a>
            <a href="#" className="footer-link">Terms of Service</a>
            <button onClick={onOpenOfficeModal} className="footer-link" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}>
              Office Locator Map
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
}
