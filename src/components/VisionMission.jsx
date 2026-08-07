import React from 'react';
import { Target, Compass, CheckCircle2 } from 'lucide-react';

export default function VisionMission() {
  return (
    <section className="section-padding bg-white" style={{ width: '100%' }}>
      <div className="container">
        
        {/* Section Header */}
        <div className="section-header">
          <span className="section-tag">CORPORATE HERITAGE & VISION</span>
          <h2 className="section-title">Driving Last-Mile Financial Inclusion Since 2021</h2>
          <p className="section-subtitle">
            Founded in 2021, RONAV Technologies was established to bridge the gap between traditional banking infrastructure and local retail businesses.
          </p>
        </div>

        {/* 2-Column Highlighted Vision & Mission Grid */}
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
          
          {/* Core Mission Card (Royal Blue Accent Tint) */}
          <div 
            className="card card-hover"
            style={{
              backgroundColor: '#EFF6FF',
              borderColor: '#BFDBFE',
              borderWidth: '1.5px',
              padding: '1.75rem',
              borderRadius: '20px',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#0F52BA', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target style={{ width: '22px', height: '22px' }} />
                </div>
                <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '0.125rem 0.5rem', background: '#FFFFFF', color: '#0F52BA', borderRadius: '20px', border: '1px solid #BFDBFE' }}>
                  OUR MISSION
                </span>
              </div>

              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E40AF', marginBottom: '0.75rem' }}>
                Our Core Mission
              </h3>
              
              <p style={{ fontSize: '0.875rem', color: '#1E3A8A', lineHeight: 1.65, marginBottom: '1.25rem' }}>
                To empower every retailer and merchant with accessible working capital, high-margin BBPS bill collection capabilities, and turnkey ATM franchise operations.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.375rem 0.625rem', background: '#FFFFFF', color: '#0F52BA', borderRadius: '6px', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <CheckCircle2 style={{ width: '14px', height: '14px' }} />
                  <span>Democratize Business Credit Access</span>
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.375rem 0.625rem', background: '#FFFFFF', color: '#0F52BA', borderRadius: '6px', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <CheckCircle2 style={{ width: '14px', height: '14px' }} />
                  <span>0 Payout Delay Guarantee</span>
                </div>
              </div>
            </div>
          </div>

          {/* Strategic Vision Card (Emerald Green Accent Tint) */}
          <div 
            className="card card-hover"
            style={{
              backgroundColor: '#ECFDF5',
              borderColor: '#A7F3D0',
              borderWidth: '1.5px',
              padding: '1.75rem',
              borderRadius: '20px',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#059669', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Compass style={{ width: '22px', height: '22px' }} />
                </div>
                <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '0.125rem 0.5rem', background: '#FFFFFF', color: '#059669', borderRadius: '20px', border: '1px solid #A7F3D0' }}>
                  STRATEGIC VISION
                </span>
              </div>

              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#065F46', marginBottom: '0.75rem' }}>
                Our Strategic Vision
              </h3>
              
              <p style={{ fontSize: '0.875rem', color: '#064E3B', lineHeight: 1.65, marginBottom: '1.25rem' }}>
                To build India's most trusted 3-tier distributor-merchant operational network, processing over ₹100 Crore in monthly transactions with 100% transparency.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.375rem 0.625rem', background: '#FFFFFF', color: '#059669', borderRadius: '6px', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <CheckCircle2 style={{ width: '14px', height: '14px' }} />
                  <span>3-Tier Ecosystem Connectivity</span>
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.375rem 0.625rem', background: '#FFFFFF', color: '#059669', borderRadius: '6px', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <CheckCircle2 style={{ width: '14px', height: '14px' }} />
                  <span>100% Operational Transparency</span>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
