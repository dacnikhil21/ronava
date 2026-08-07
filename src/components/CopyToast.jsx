import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export default function CopyToast({ message, onClose }) {
  if (!message) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        backgroundColor: '#0F172A',
        color: '#FFFFFF',
        padding: '0.625rem 1rem',
        borderRadius: '30px',
        boxShadow: '0 10px 25px -5px rgba(15,23,42,0.4)',
        border: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.8125rem',
        fontWeight: 700,
        animation: 'toastSlideIn 250ms cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <CheckCircle2 style={{ width: '16px', height: '16px', color: '#34D399' }} />
      <span>{message}</span>
    </div>
  );
}
