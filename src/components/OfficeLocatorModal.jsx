import React from 'react';
import { X, MapPin, Phone, Mail, MessageSquare, ExternalLink } from 'lucide-react';

export default function OfficeLocatorModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid #E2E8F0', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', borderRadius: '8px', background: '#EFF6FF', color: '#0F52BA' }}>
              <MapPin style={{ width: '20px', height: '20px' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>RONAV Technologies Offices</h3>
              <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>Official Head Office & Regional Support Hubs</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '0.375rem', borderRadius: '6px' }}>
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Office Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
          <div className="card" style={{ padding: '1rem', backgroundColor: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '0.125rem 0.5rem', background: '#DBEAFE', color: '#1E40AF', borderRadius: '4px', width: 'fit-content', textTransform: 'uppercase' }}>
              HEAD OFFICE — HYDERABAD
            </span>
            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>RONAV Technologies Corporate Center</h4>
            <p style={{ fontSize: '0.75rem', color: '#475569', margin: 0 }}>
              Main Commercial Hub, Banjara Hills / HITECH City Corridor, Hyderabad, Telangana — 500081
            </p>
            <div style={{ paddingTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.75rem', fontWeight: 700, borderTop: '1px solid #E2E8F0' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#0F52BA' }}><Phone style={{ width: '14px', height: '14px' }} /> 9966203053</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#059669' }}><MessageSquare style={{ width: '14px', height: '14px' }} /> 9966203053</span>
            </div>
          </div>

          <div className="card" style={{ padding: '1rem', backgroundColor: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '0.125rem 0.5rem', background: '#E2E8F0', color: '#334155', borderRadius: '4px', width: 'fit-content', textTransform: 'uppercase' }}>
              REGIONAL OPERATIONAL HUB
            </span>
            <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Rosenavaneetham Enterprises</h4>
            <p style={{ fontSize: '0.75rem', color: '#475569', margin: 0, wordBreak: 'break-all' }}>
              Direct Contact Email: <strong style={{ color: '#0F172A' }}>rosenavaneethamenterprises@gmail.com</strong>
            </p>
          </div>
        </div>

        {/* Visual Location Card */}
        <div style={{ padding: '1.25rem', borderRadius: '16px', background: 'linear-gradient(135deg, #0A192F 0%, #0F52BA 100%)', color: '#FFFFFF', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
          <MapPin style={{ width: '32px', height: '32px', color: '#60A5FA' }} />
          <div>
            <h4 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Hyderabad Corporate Location Map</h4>
            <p style={{ fontSize: '0.75rem', color: '#BFDBFE', marginTop: '0.25rem' }}>Mon–Sat: 9:00 AM – 7:00 PM IST | Direct Merchant Desk</p>
          </div>
          <a 
            href="https://maps.google.com/?q=Hyderabad" 
            target="_blank" 
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm"
          >
            Open in Google Maps
            <ExternalLink style={{ width: '14px', height: '14px' }} />
          </a>
        </div>

      </div>
    </div>
  );
}
