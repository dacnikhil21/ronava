import React from 'react';
import { Award, Users, ShieldCheck, Landmark } from 'lucide-react';

export default function AboutPage({ onOpenLogin }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" style={{ width: '100%' }}>
      
      {/* About Us Content */}
      <main className="flex-grow section-padding" style={{ padding: '3rem 0' }}>
        <div className="container">
          
          {/* Hero Header with Dedicated Image */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', alignItems: 'center', marginBottom: '3rem' }}>
            <div>
              <span className="section-tag">SINCE 2021 | HERITAGE & TRUST</span>
              <h1 style={{ fontSize: '2.25rem', fontWeight: 900, color: '#0F172A', lineHeight: 1.2, marginBottom: '1rem' }}>
                Empowering Businesses. Enriching Lives Across South India.
              </h1>
              <p style={{ fontSize: '0.9375rem', color: '#334155', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                Established in 2021, <strong>RONAV Technologies</strong> is an enterprise FinTech platform dedicated to bridging traditional banking infrastructure with local merchant networks across Telangana and Andhra Pradesh.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ padding: '0.5rem 0.875rem', background: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '0.75rem', fontWeight: 800, color: '#0F52BA' }}>
                  🏆 Established 2021
                </div>
                <div style={{ padding: '0.5rem 0.875rem', background: '#ECFDF5', borderRadius: '8px', border: '1px solid #A7F3D0', fontSize: '0.75rem', fontWeight: 800, color: '#059669' }}>
                  👥 2,538+ Active Merchants
                </div>
              </div>
            </div>

            {/* Dedicated About Us Hero Image */}
            <div style={{ borderRadius: '20px', overflow: 'hidden', boxShadow: '0 12px 32px -4px rgba(15,23,42,0.12)', border: '1px solid #E2E8F0' }}>
              <img 
                src="/about_hero.png" 
                alt="RONAV Corporate Leadership & Heritage Center" 
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>
          </div>

          {/* Core Values */}
          <div className="grid-3" style={{ gap: '1.25rem' }}>
            <div className="card" style={{ padding: '1.5rem', backgroundColor: '#FFFFFF', borderRadius: '18px' }}>
              <Award style={{ width: '28px', height: '28px', color: '#0F52BA', marginBottom: '0.75rem' }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.375rem' }}>Institutional Integrity</h3>
              <p style={{ fontSize: '0.8125rem', color: '#64748B', lineHeight: 1.5 }}>
                Zero hidden charges, transparent commission ledgers, and 100% bank-grade PCI-DSS security compliance.
              </p>
            </div>

            <div className="card" style={{ padding: '1.5rem', backgroundColor: '#FFFFFF', borderRadius: '18px' }}>
              <Users style={{ width: '28px', height: '28px', color: '#059669', marginBottom: '0.75rem' }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.375rem' }}>4-Tier Network Governance</h3>
              <p style={{ fontSize: '0.8125rem', color: '#64748B', lineHeight: 1.5 }}>
                Connecting Super Distributors, Distributors, Retailers, and Merchants in a unified financial operating model.
              </p>
            </div>

            <div className="card" style={{ padding: '1.5rem', backgroundColor: '#FFFFFF', borderRadius: '18px' }}>
              <Landmark style={{ width: '28px', height: '28px', color: '#D97706', marginBottom: '0.75rem' }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.375rem' }}>Turnkey Financial Access</h3>
              <p style={{ fontSize: '0.8125rem', color: '#64748B', lineHeight: 1.5 }}>
                Providing personal and business credit line access without payslip hurdles to empower merchant growth.
              </p>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
