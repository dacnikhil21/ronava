import React, { useState } from 'react';
import { ShieldCheck, Users, Landmark, Building2, Receipt, CreditCard, LogOut, ArrowUpRight, Check, XCircle, Search, Filter, AlertCircle } from 'lucide-react';

export default function AdminDashboardPage({ onLogout }) {
  const [activeTab, setActiveTab] = useState('loans');

  const loanApplications = [
    { name: 'Ravi Kumar (Sri Sai Retailers)', phone: '9848022338', type: 'Business Loan', amount: '₹5,00,000', status: 'Under Review', date: '16 May 2025' },
    { name: 'Suresh Verma (Verma Kirana)', phone: '9949011223', type: 'Personal Loan', amount: '₹1,50,000', status: 'New', date: '16 May 2025' },
    { name: 'Anil Reddy (Reddy Mobile Shop)', phone: '9701033445', type: 'Business Loan', amount: '₹10,00,000', status: 'Approved', date: '15 May 2025' }
  ];

  const withdrawals = [
    { merchant: 'Ravi Retail Store', mid: 'RONAV12345', amount: '₹15,450.00', bank: 'SBI Bank (****1234)', date: '16 May 2025 10:30 AM' },
    { merchant: 'Lakshmi General Store', mid: 'RONAV67890', amount: '₹28,900.00', bank: 'HDFC Bank (****5678)', date: '16 May 2025 09:15 AM' }
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans text-slate-100" style={{ width: '100%', overflowX: 'hidden' }}>
      
      {/* Executive Command Center Navigation */}
      <header style={{ borderBottom: '1px solid #1E293B', backgroundColor: '#070F1E', padding: '0.625rem 0' }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="brand-icon-box" style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#DC2626' }}>
              <span>R</span>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ fontWeight: 900, fontSize: '0.9375rem', color: '#FFFFFF' }}>RONAV ADMIN</span>
                <span style={{ fontSize: '0.5rem', fontWeight: 800, padding: '0.0625rem 0.25rem', background: 'rgba(220,38,38,0.2)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '3px' }}>
                  SUPER ADMIN
                </span>
              </div>
              <p style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#64748B', margin: 0 }}>ECOSYSTEM COMMAND CENTER</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.6875rem', color: '#34D399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34D399' }}></span>
              Network Live: 2,538 Merchants
            </span>
            <button 
              onClick={onLogout}
              className="btn btn-ghost btn-sm" 
              style={{ color: '#FCA5A5', minHeight: '32px' }}
            >
              <LogOut style={{ width: '14px', height: '14px' }} />
              <span>Exit Portal</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Executive Body */}
      <main style={{ padding: '1.25rem 0', flexGrow: 1 }}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* 7 Metric Executive Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.625rem' }}>
            <div style={{ padding: '0.75rem', borderRadius: '12px', background: '#1E293B', border: '1px solid #334155' }}>
              <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Loan Apps</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FCD34D', margin: '2px 0 0' }}>18</h3>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '12px', background: '#1E293B', border: '1px solid #334155' }}>
              <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>ATM Requests</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#93C5FD', margin: '2px 0 0' }}>12</h3>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '12px', background: '#1E293B', border: '1px solid #334155' }}>
              <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>BBPS Txns</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#34D399', margin: '2px 0 0' }}>256</h3>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '12px', background: '#1E293B', border: '1px solid #334155' }}>
              <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>PG & POS Txns</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#A5B4FC', margin: '2px 0 0' }}>1,245</h3>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '12px', background: '#1E293B', border: '1px solid #334155' }}>
              <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>ATM Txns</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#93C5FD', margin: '2px 0 0' }}>48</h3>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '12px', background: '#1E293B', border: '1px solid #334155' }}>
              <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Total Merchants</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FFFFFF', margin: '2px 0 0' }}>2,538</h3>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '12px', background: '#1E293B', border: '1px solid #334155' }}>
              <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>Withdrawals</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#FCA5A5', margin: '2px 0 0' }}>23</h3>
            </div>
          </div>

          {/* Application Requests Table */}
          <div style={{ padding: '1rem', borderRadius: '16px', background: '#1E293B', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Application Management Table</h3>
              
              <div style={{ display: 'flex', gap: '0.25rem', background: '#0F172A', padding: '2px', borderRadius: '6px' }}>
                <button onClick={() => setActiveTab('loans')} style={{ border: 'none', background: activeTab === 'loans' ? '#0F52BA' : 'transparent', color: '#FFF', fontSize: '0.625rem', fontWeight: 700, padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>Loan Applications</button>
                <button onClick={() => setActiveTab('franchise')} style={{ border: 'none', background: activeTab === 'franchise' ? '#0F52BA' : 'transparent', color: '#FFF', fontSize: '0.625rem', fontWeight: 700, padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>Franchise Requests</button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #334155', color: '#94A3B8', fontSize: '0.625rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '0.5rem' }}>Applicant Name</th>
                    <th style={{ padding: '0.5rem' }}>Mobile</th>
                    <th style={{ padding: '0.5rem' }}>Type</th>
                    <th style={{ padding: '0.5rem' }}>Amount</th>
                    <th style={{ padding: '0.5rem' }}>Status</th>
                    <th style={{ padding: '0.5rem' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loanApplications.map((app, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '0.625rem 0.5rem', fontWeight: 700 }}>{app.name}</td>
                      <td style={{ padding: '0.625rem 0.5rem', color: '#94A3B8' }}>{app.phone}</td>
                      <td style={{ padding: '0.625rem 0.5rem' }}>{app.type}</td>
                      <td style={{ padding: '0.625rem 0.5rem', fontWeight: 800, color: '#34D399' }}>{app.amount}</td>
                      <td style={{ padding: '0.625rem 0.5rem' }}>
                        <span style={{ fontSize: '0.5625rem', fontWeight: 800, padding: '0.125rem 0.375rem', background: app.status === 'Approved' ? 'rgba(52,211,153,0.2)' : 'rgba(252,211,77,0.2)', color: app.status === 'Approved' ? '#34D399' : '#FCD34D', borderRadius: '4px' }}>
                          {app.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.625rem 0.5rem', color: '#94A3B8' }}>{app.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Merchant Withdrawal Approvals */}
          <div style={{ padding: '1rem', borderRadius: '16px', background: '#1E293B', border: '1px solid #334155' }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.875rem' }}>Pending Merchant Payout Approvals</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {withdrawals.map((w, idx) => (
                <div key={idx} style={{ padding: '0.625rem 0.875rem', borderRadius: '8px', background: '#0F172A', border: '1px solid #334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <strong style={{ fontSize: '0.75rem', color: '#FFFFFF', display: 'block' }}>{w.merchant} ({w.mid})</strong>
                    <span style={{ fontSize: '0.625rem', color: '#94A3B8' }}>Bank: {w.bank} • Requested: {w.date}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <strong style={{ fontSize: '0.9375rem', color: '#34D399' }}>{w.amount}</strong>
                    <button className="btn btn-primary btn-sm" style={{ backgroundColor: '#059669', minHeight: '30px', fontSize: '0.6875rem' }}>Approve Payout</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: '#FCA5A5', minHeight: '30px', fontSize: '0.6875rem' }}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>

      <footer style={{ borderTop: '1px solid #1E293B', padding: '0.75rem 0', textAlign: 'center', fontSize: '0.6875rem', color: '#64748B' }}>
        RONAV Technologies Ecosystem Governance Terminal
      </footer>

    </div>
  );
}
