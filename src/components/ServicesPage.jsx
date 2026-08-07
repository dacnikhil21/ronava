import React from 'react';
import { Landmark, Building2, Receipt, QrCode, ArrowLeft } from 'lucide-react';

export default function ServicesPage({ onOpenLogin, onBack }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" style={{ width: '100%' }}>
      
      {/* Services Overview Content */}
      <main className="flex-grow section-padding" style={{ padding: '2rem 0 3rem' }}>
        <div className="container">
          
          {/* Back Navigation Action */}
          <div style={{ marginBottom: '1.25rem' }}>
            <button 
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'none',
                border: 'none',
                color: '#0F52BA',
                fontWeight: 800,
                fontSize: '0.875rem',
                cursor: 'pointer',
                padding: '0.375rem 0.75rem 0.375rem 0',
                borderRadius: '8px',
                transition: 'all 200ms ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#0052CC';
                e.currentTarget.style.transform = 'translateX(-3px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#0F52BA';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <ArrowLeft style={{ width: '16px', height: '16px' }} />
              <span>Go Back to Home</span>
            </button>
          </div>
          
          {/* Dedicated Image Banner */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', alignItems: 'center', marginBottom: '3rem' }}>
            <div>
              <span className="section-tag">ENTERPRISE SOLUTIONS HUB</span>
              <h1 style={{ fontSize: '2.25rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.2, marginBottom: '1rem' }}>
                Complete Financial Solutions for Retailers & Merchants
              </h1>
              <p style={{ fontSize: '0.9375rem', color: '#334155', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                From high-margin loans without payslips to BBPS bill collections, Android POS machines, and turnkey ATM/CDM franchise setups.
              </p>
            </div>

            {/* Dedicated Services Hero Picture */}
            <div style={{ borderRadius: '20px', overflow: 'hidden', boxShadow: '0 12px 32px -4px rgba(15,23,42,0.12)', border: '1px solid #E2E8F0' }}>
              <img 
                src="/services_hero.png" 
                alt="RONAV Financial Services Hub POS and ATM Setup" 
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>
          </div>

          {/* Detailed Service Cards */}
          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            
            {/* 1. Loans Card */}
            <div className="card" style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: '1.5px', padding: '1.75rem', borderRadius: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Landmark style={{ width: '28px', height: '28px', color: '#059669' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#065F46' }}>1. Personal & Business Loans</h3>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#064E3B', lineHeight: 1.6, marginBottom: '1rem' }}>
                Personal Loans from ₹50,000 to ₹50 Lakhs based on bank statements (even without payslips). Business Loans up to ₹1 Crore via GST returns & ITR.
              </p>
              <button onClick={() => onOpenLogin('merchant')} className="btn btn-primary btn-sm" style={{ backgroundColor: '#059669' }}>
                Apply for Loan Credit →
              </button>
            </div>

            {/* 2. ATM/CDM Franchise */}
            <div className="card" style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: '1.5px', padding: '1.75rem', borderRadius: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Building2 style={{ width: '28px', height: '28px', color: '#0F52BA' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E40AF' }}>2. ATM & CDM Franchise</h3>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#1E3A8A', lineHeight: 1.6, marginBottom: '1rem' }}>
                Low capital investment with high transaction returns. Complete hardware installation, maintenance, and cash deposit support.
              </p>
              <button onClick={() => onOpenLogin('merchant')} className="btn btn-primary btn-sm" style={{ backgroundColor: '#0F52BA' }}>
                Setup Franchise Outlet →
              </button>
            </div>

            {/* 3. BBPS Bill Pay */}
            <div className="card" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: '1.5px', padding: '1.75rem', borderRadius: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Receipt style={{ width: '28px', height: '28px', color: '#D97706' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#92400E' }}>3. BBPS Utility Bill Pay</h3>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#78350F', lineHeight: 1.6, marginBottom: '1rem' }}>
                One-stop Bharat Bill Payment System enabling store owners to collect electricity, mobile postpaid, DTH, and FASTag bills with instant receipt generation.
              </p>
              <button onClick={() => onOpenLogin('merchant')} className="btn btn-primary btn-sm" style={{ backgroundColor: '#D97706' }}>
                Collect BBPS Bills →
              </button>
            </div>

            {/* 4. PG & POS */}
            <div className="card" style={{ backgroundColor: '#EEF2FF', borderColor: '#C7D2FE', borderWidth: '1.5px', padding: '1.75rem', borderRadius: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <QrCode style={{ width: '28px', height: '28px', color: '#4F46E5' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#3730A3' }}>4. Payment Gateway & POS</h3>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#312E81', lineHeight: 1.6, marginBottom: '1rem' }}>
                Accept payments anywhere with Android POS devices, dynamic UPI QR codes, and instant same-day wallet settlements.
              </p>
              <button onClick={() => onOpenLogin('merchant')} className="btn btn-primary btn-sm" style={{ backgroundColor: '#4F46E5' }}>
                Request POS Machine →
              </button>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}
