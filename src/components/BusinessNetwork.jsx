import React, { useState } from 'react';
import { Network, ShieldCheck, ArrowRight, Award, CheckCircle2 } from 'lucide-react';

export default function BusinessNetwork({ onOpenLogin }) {
  const [activeRole, setActiveRole] = useState(0);

  const roles = [
    {
      title: 'Super Distributor',
      desc: 'Regional Master Partner managing a network of Distributors across districts.',
      chips: ['👑 Highest Master Margin', '🌐 District Network Override', '📊 Enterprise Portal Governance'],
      color: '#0F52BA',
      bg: '#EFF6FF',
      border: '#BFDBFE'
    },
    {
      title: 'Distributor',
      desc: 'Local Hub Operator onboarding Retailers and Merchants within commercial zones.',
      chips: ['📈 Sub-Broker Commission Fills', '🤝 Retailer Onboarding Rights', '🚀 High Daily Volume Payouts'],
      color: '#059669',
      bg: '#ECFDF5',
      border: '#A7F3D0'
    },
    {
      title: 'Retailer',
      desc: 'Store Owner offering BBPS, Money Transfer, and Loan Credit applications to footfall customers.',
      chips: ['🛒 Store Revenue Boost', '⚡ Instant Customer Receipt', '💰 Daily Commission Credit'],
      color: '#D97706',
      bg: '#FFFBEB',
      border: '#FDE68A'
    },
    {
      title: 'Merchant Partner',
      desc: 'Business Enterprise utilizing RONAV Virtual Wallet, POS Machines, and ATM Franchises.',
      chips: ['💼 Instant Payout Settlements', '💳 POS & Dynamic QR Gateway', '🔑 Unique Merchant ID (MID)'],
      color: '#4F46E5',
      bg: '#EEF2FF',
      border: '#C7D2FE'
    }
  ];

  return (
    <section id="network" className="section-padding" style={{ backgroundColor: '#F8FAFC', width: '100%' }}>
      <div className="container">
        
        {/* Section Header */}
        <div className="section-header">
          <span className="section-tag">4-TIER BUSINESS NETWORK</span>
          <h2 className="section-title">Integrated Network Architecture</h2>
          <p className="section-subtitle">
            Connecting Super Distributors, Distributors, Retailers, and Merchants in a unified financial ecosystem.
          </p>
        </div>

        {/* Interactive Role Selector Tabs */}
        <div style={{ display: 'flex', gap: '0.375rem', overflowX: 'auto', paddingBottom: '0.75rem', marginBottom: '1.5rem', justifyContent: 'center', scrollbarWidth: 'none' }}>
          {roles.map((r, idx) => (
            <button
              key={idx}
              onClick={() => setActiveRole(idx)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                border: activeRole === idx ? `1.5px solid ${r.color}` : '1px solid #E2E8F0',
                background: activeRole === idx ? r.bg : '#FFFFFF',
                color: activeRole === idx ? r.color : '#475569',
                fontWeight: 800,
                fontSize: '0.8125rem',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                boxShadow: activeRole === idx ? '0 4px 12px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 200ms ease'
              }}
            >
              {r.title}
            </button>
          ))}
        </div>

        {/* Highlighted Selected Role Card */}
        <div 
          className="card card-hover"
          style={{
            backgroundColor: roles[activeRole].bg,
            borderColor: roles[activeRole].border,
            borderWidth: '1.5px',
            padding: '1.75rem',
            borderRadius: '20px',
            maxWidth: '800px',
            margin: '0 auto',
            boxShadow: '0 12px 28px -4px rgba(15,23,42,0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: roles[activeRole].color, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                <Network style={{ width: '22px', height: '22px' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                  {roles[activeRole].title}
                </h3>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: roles[activeRole].color }}>
                  Tier {activeRole + 1} Enterprise Role
                </span>
              </div>
            </div>

            <button 
              onClick={() => onOpenLogin('merchant')}
              className="btn btn-primary btn-sm" 
              style={{ backgroundColor: roles[activeRole].color }}
            >
              Join as {roles[activeRole].title} →
            </button>
          </div>

          <p style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            {roles[activeRole].desc}
          </p>

          {/* Visual Feature Chips */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
            {roles[activeRole].chips.map((chip, cIdx) => (
              <div key={cIdx} style={{ padding: '0.5rem 0.75rem', background: '#FFFFFF', borderRadius: '8px', border: `1px solid ${roles[activeRole].border}`, fontSize: '0.75rem', fontWeight: 800, color: roles[activeRole].color, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <CheckCircle2 style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                <span>{chip}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
