import React, { useState, useEffect } from 'react';
import { Search, X, Landmark, Building2, Receipt, CreditCard, User, ShieldCheck, Phone, ChevronRight } from 'lucide-react';

export default function CommandPalette({ isOpen, onClose, onOpenLogin }) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent toggles state
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    { title: 'Personal & Business Loans (50k–1Cr)', icon: Landmark, color: '#059669', link: '#services', desc: 'Apply without rigid payslip hurdles' },
    { title: 'ATM & CDM Franchise Setup', icon: Building2, color: '#0F52BA', link: '#services', desc: 'Setup WLA Cash Machines' },
    { title: 'BBPS Utility Bill Payments', icon: Receipt, color: '#D97706', link: '#services', desc: 'Electricity, Mobile, Postpaid, DTH' },
    { title: 'Payment Gateway & POS Machines', icon: CreditCard, color: '#4F46E5', link: '#services', desc: 'QR Code & Mobile Swiping Terminals' },
    { title: 'Merchant Login Gateway', icon: User, color: '#0F52BA', action: () => { onClose(); onOpenLogin('merchant'); }, desc: 'Access operational wallet & payouts' },
    { title: 'Admin Command Center Login', icon: ShieldCheck, color: '#DC2626', action: () => { onClose(); onOpenLogin('admin'); }, desc: 'Ecosystem governance & audit logs' },
    { title: 'Call Direct Hotline: 9966203053', icon: Phone, color: '#059669', href: 'tel:9966203053', desc: 'Instant support desk' }
  ];

  const filtered = actions.filter(a => a.title.toLowerCase().includes(query.toLowerCase()) || a.desc.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '560px',
          padding: 0,
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: '#FFFFFF',
          boxShadow: '0 25px 50px -12px rgba(15,23,42,0.35)',
          border: '1px solid #CBD5E1',
          animation: 'commandPaletteScale 200ms cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Search Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0.875rem 1.125rem', borderBottom: '1px solid #E2E8F0', gap: '0.75rem', backgroundColor: '#F8FAFC' }}>
          <Search style={{ width: '18px', height: '18px', color: '#0F52BA', flexShrink: 0 }} />
          <input 
            type="text"
            placeholder="Search financial services, loans, logins, support (⌘K)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#0F172A'
            }}
          />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: '0.125rem' }}>
            <X style={{ width: '18px', height: '18px' }} />
          </button>
        </div>

        {/* Action Results */}
        <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '0.5rem' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748B', fontSize: '0.875rem' }}>
              No matching financial services found.
            </div>
          ) : (
            filtered.map((item, idx) => (
              <div 
                key={idx}
                onClick={() => {
                  if (item.action) item.action();
                  else if (item.href) window.location.href = item.href;
                  else if (item.link) {
                    onClose();
                    window.location.href = item.link;
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'background-color 150ms ease',
                  marginBottom: '2px'
                }}
                className="command-item-hover"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${item.color}15`, border: `1px solid ${item.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, flexShrink: 0 }}>
                    <item.icon style={{ width: '16px', height: '16px' }} />
                  </div>
                  <div>
                    <h5 style={{ fontSize: '0.8125rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>{item.title}</h5>
                    <p style={{ fontSize: '0.6875rem', color: '#64748B', margin: 0 }}>{item.desc}</p>
                  </div>
                </div>
                <ChevronRight style={{ width: '14px', height: '14px', color: '#94A3B8' }} />
              </div>
            ))
          )}
        </div>

        {/* Footer Hint */}
        <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid #F1F5F9', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.6875rem', color: '#64748B' }}>
          <span>Navigate with <strong>↑ ↓</strong> and <strong>Enter</strong></span>
          <span style={{ fontWeight: 700, color: '#0F52BA' }}>RONAV Search Engine</span>
        </div>
      </div>
    </div>
  );
}
