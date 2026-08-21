import React, { useState } from 'react';
import { 
  Landmark, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight, 
  Send, 
  Calculator, 
  Percent, 
  Calendar, 
  Building2, 
  Users, 
  FileText,
  Phone,
  Clock
} from 'lucide-react';

export default function ServiceLoansPage({ onOpenLogin, onBack, onShowToast }) {
  // Calculator state
  const [loanAmount, setLoanAmount] = useState(500000);
  const [tenureMonths, setTenureMonths] = useState(24);
  const [interestRate, setInterestRate] = useState(11.5);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    loanType: 'Personal Loan (No Payslips)',
    partnerCategory: 'Merchant / Retailer',
    amount: '₹5,00,000',
    incomeType: 'Self-Employed / Shop Owner',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);

  // EMI Calculation formula
  const monthlyRate = interestRate / (12 * 100);
  const emi = Math.round(
    (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
    (Math.pow(1 + monthlyRate, tenureMonths) - 1)
  );
  const totalPayment = emi * tenureMonths;
  const totalInterest = totalPayment - loanAmount;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.mobile) return;

    // Save lead to shared localStorage for Admin Dashboard
    const newInquiry = {
      id: 'LN-' + Math.floor(1000 + Math.random() * 9000),
      name: formData.name,
      phone: formData.mobile,
      type: formData.loanType,
      amount: formData.amount,
      status: 'New',
      date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      creditScore: 750,
      docStatus: 'Pending Admin Review',
      businessType: formData.partnerCategory,
      remarks: formData.message || 'Submitted via Dedicated Loans Page'
    };

    try {
      const existing = JSON.parse(localStorage.getItem('ronav_loan_inquiries') || '[]');
      localStorage.setItem('ronav_loan_inquiries', JSON.stringify([newInquiry, ...existing]));
    } catch (err) {
      console.error(err);
    }

    setSubmitted(true);
    if (onShowToast) onShowToast('✓ Loan inquiry submitted to Admin for credential review!');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" style={{ width: '100%', paddingTop: 'calc(var(--section-pad-top))' }}>
      
      {/* Main Container */}
      <main className="flex-grow" style={{ padding: '0.75rem 0 4rem' }}>
        <div className="container" style={{ maxWidth: '1080px', margin: '0 auto', padding: '0 1rem' }}>
          
          {/* Hero Section (Starts cleanly right below header) */}
          <div 
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: '2rem',
              alignItems: 'center',
              backgroundColor: '#071630',
              backgroundImage: 'radial-gradient(circle at 80% 20%, rgba(5, 150, 105, 0.25) 0%, rgba(7, 22, 48, 0.95) 75%), url("/hero_bg.png")',
              backgroundSize: 'cover',
              padding: '2.5rem 2rem',
              borderRadius: '24px',
              color: '#FFFFFF',
              marginBottom: '2.5rem',
              boxShadow: '0 20px 48px rgba(15,23,42,0.25)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
            className="dedicated-service-hero"
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.625rem', background: 'rgba(5,150,105,0.25)', border: '1px solid #059669', borderRadius: '20px', fontSize: '0.6875rem', fontWeight: 800, color: '#34D399' }}>
                  <Landmark style={{ width: '14px', height: '14px' }} />
                  <span>RONAV CREDIT FINANCING</span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', padding: '0.25rem 0.625rem', background: 'rgba(52, 211, 153, 0.15)', border: '1px solid rgba(52, 211, 153, 0.4)', borderRadius: '20px', fontSize: '0.6875rem', fontWeight: 800, color: '#A7F3D0' }}>
                  <span>● ZERO PAYSLIP DELAY • INSTANT DISBURSAL</span>
                </div>
              </div>

              <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.15, margin: '0 0 0.75rem', letterSpacing: '-0.02em' }}>
                Personal & Business <br />
                <span style={{ color: '#34D399' }}>Loans up to ₹1 Crore.</span>
              </h1>

              <p style={{ fontSize: '0.875rem', color: '#94A3B8', lineHeight: 1.6, margin: '0 0 1.5rem', maxWidth: '520px' }}>
                Flexible working capital and retail credit tailored for Merchants, Retailers, and Individuals across South India without rigid payslip demands.
              </p>

              {/* Stat Highlights */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.06)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ fontSize: '0.6875rem', color: '#94A3B8', display: 'block', fontWeight: 700 }}>PERSONAL LOANS</span>
                  <strong style={{ fontSize: '1.125rem', color: '#34D399', fontWeight: 900 }}>₹50K to ₹50 Lakhs</strong>
                  <span style={{ fontSize: '0.625rem', color: '#CBD5E1', display: 'block' }}>Without payslips based on salary</span>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.06)', padding: '0.75rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ fontSize: '0.6875rem', color: '#94A3B8', display: 'block', fontWeight: 700 }}>BUSINESS LOANS</span>
                  <strong style={{ fontSize: '1.125rem', color: '#38BDF8', fontWeight: 900 }}>₹1 Lakh to ₹1 Crore</strong>
                  <span style={{ fontSize: '0.625rem', color: '#CBD5E1', display: 'block' }}>Via GST, Bank statements & ITR</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <a 
                  href="#loan-apply-form"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#059669', borderColor: '#047857', fontWeight: 800, padding: '0.75rem 1.5rem', borderRadius: '10px' }}
                >
                  <span>Apply for Loan Now</span>
                  <ArrowRight style={{ width: '16px', height: '16px' }} />
                </a>

                <a 
                  href="tel:9966203053"
                  className="btn btn-secondary"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF', borderColor: 'rgba(255,255,255,0.2)', fontWeight: 700 }}
                >
                  <Phone style={{ width: '16px', height: '16px' }} />
                  <span>Call 9966203053</span>
                </a>
              </div>
            </div>

            {/* 3D Illustration */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <img 
                src="/loans_rupee.png" 
                alt="Personal and Business Loans" 
                style={{ width: '100%', maxWidth: '280px', height: 'auto', objectFit: 'contain', filter: 'drop-shadow(0 15px 30px rgba(0,0,0,0.5))' }}
              />
            </div>
          </div>

          {/* Interactive Loan EMI Calculator & Key Benefits */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '2rem', marginBottom: '3rem' }} className="responsive-split-grid">
            
            {/* EMI Calculator */}
            <div className="card" style={{ padding: '1.75rem', backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 8px 24px rgba(15,23,42,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calculator style={{ width: '20px', height: '20px' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Loan EMI Calculator</h3>
                  <p style={{ fontSize: '0.6875rem', color: '#64748B', margin: 0 }}>Estimate your monthly repayment installment</p>
                </div>
              </div>

              {/* Amount Slider */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155' }}>Loan Amount</label>
                  <span style={{ fontSize: '0.875rem', fontWeight: 900, color: '#059669' }}>₹{loanAmount.toLocaleString('en-IN')}</span>
                </div>
                <input 
                  type="range" 
                  min="50000" 
                  max="5000000" 
                  step="50000"
                  value={loanAmount} 
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#059669', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: '#94A3B8', marginTop: '2px' }}>
                  <span>₹50K</span>
                  <span>₹50 Lakhs</span>
                </div>
              </div>

              {/* Tenure Slider */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155' }}>Tenure (Months)</label>
                  <span style={{ fontSize: '0.875rem', fontWeight: 900, color: '#0F52BA' }}>{tenureMonths} Months ({Math.floor(tenureMonths / 12)} Yrs)</span>
                </div>
                <input 
                  type="range" 
                  min="6" 
                  max="60" 
                  step="6"
                  value={tenureMonths} 
                  onChange={(e) => setTenureMonths(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#0F52BA', cursor: 'pointer' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: '#94A3B8', marginTop: '2px' }}>
                  <span>6 Months</span>
                  <span>60 Months</span>
                </div>
              </div>

              {/* Calculation Results Card */}
              <div style={{ backgroundColor: '#F8FAFC', padding: '1rem', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center', gap: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 700, display: 'block' }}>MONTHLY EMI</span>
                  <strong style={{ fontSize: '1rem', color: '#059669', fontWeight: 900 }}>₹{emi.toLocaleString('en-IN')}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 700, display: 'block' }}>TOTAL INTEREST</span>
                  <strong style={{ fontSize: '0.875rem', color: '#D97706', fontWeight: 800 }}>₹{totalInterest.toLocaleString('en-IN')}</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.625rem', color: '#64748B', fontWeight: 700, display: 'block' }}>TOTAL AMOUNT</span>
                  <strong style={{ fontSize: '0.875rem', color: '#0F172A', fontWeight: 800 }}>₹{totalPayment.toLocaleString('en-IN')}</strong>
                </div>
              </div>
            </div>

            {/* Why Borrow via RONAV */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>
                Why Borrow through <span style={{ color: '#059669' }}>RONAV Credit</span>?
              </h3>
              
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <ShieldCheck style={{ width: '22px', height: '22px', color: '#059669', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ fontSize: '0.8125rem', color: '#0F172A', display: 'block' }}>No Payslip Hurdle</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Personal loans approved based on bank turnover and cash flow, even without traditional payslips.</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <Clock style={{ width: '22px', height: '22px', color: '#0F52BA', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ fontSize: '0.8125rem', color: '#0F172A', display: 'block' }}>24 to 48 Hour Disbursals</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Rapid verification with direct bank deposit to your verified account.</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <Percent style={{ width: '22px', height: '22px', color: '#7C3AED', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ fontSize: '0.8125rem', color: '#0F172A', display: 'block' }}>Competitive FinTech Rates</strong>
                  <span style={{ fontSize: '0.75rem', color: '#64748B' }}>Institutional interest rates starting from 11.5% p.a. with zero prepayment penalty options.</span>
                </div>
              </div>
            </div>

          </div>

          {/* Direct Dedicated Inquiry & Application Form (Service pre-set with no redundant dropdown) */}
          <div id="loan-apply-form" style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', border: '1px solid #E2E8F0', padding: '2rem', boxShadow: '0 12px 32px rgba(15,23,42,0.06)' }}>
            
            <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#059669', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                DIRECT ONLINE APPLICATION
              </span>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0F172A', margin: '0.25rem 0' }}>
                Apply for Personal & Business Loans
              </h2>
              <p style={{ fontSize: '0.8125rem', color: '#64748B', margin: 0 }}>
                Fill out the application below. The RONAV Admin team will verify your details, generate your Merchant Access ID, and coordinate disbursal.
              </p>
            </div>

            {submitted ? (
              <div style={{ padding: '2rem', borderRadius: '16px', background: '#ECFDF5', border: '1px solid #A7F3D0', textAlign: 'center' }}>
                <CheckCircle2 style={{ width: '56px', height: '56px', color: '#059669', margin: '0 auto 1rem' }} />
                <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#065F46', margin: '0 0 0.5rem' }}>
                  Loan Application Successfully Submitted!
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#047857', maxWidth: '540px', margin: '0 auto 1.5rem', lineHeight: 1.6 }}>
                  Thank you, <strong>{formData.name}</strong>. Your loan request for <strong>{formData.amount}</strong> has been transmitted to the RONAV Admin Command Center. An onboarding manager will review your submission and provide your partner credentials.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <button 
                    onClick={() => setSubmitted(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Submit Another Application
                  </button>
                  <button 
                    onClick={onBack}
                    className="btn btn-primary btn-sm"
                    style={{ backgroundColor: '#059669' }}
                  >
                    Return to Homepage
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '720px', margin: '0 auto' }}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="responsive-two-col">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Full Name *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Ramesh Kumar"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Mobile Number *</label>
                    <input 
                      type="tel" 
                      required 
                      placeholder="10-digit Mobile No."
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="responsive-two-col">
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Required Loan Amount (₹) *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. ₹5,00,000"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">City & State</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Hyderabad / AP & TS"
                      value={formData.city || ''}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Additional Requirement (Optional)</label>
                  <textarea 
                    rows="2" 
                    placeholder="Enter any specific note for fast loan processing..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="form-input"
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ backgroundColor: '#059669', borderColor: '#047857', width: '100%', justifyContent: 'center', height: '50px', fontSize: '1rem', fontWeight: 800, boxShadow: '0 8px 24px rgba(5,150,105,0.35)' }}
                >
                  <span>Submit Loan Application to Admin</span>
                  <Send style={{ width: '16px', height: '16px' }} />
                </button>

                <p style={{ fontSize: '0.75rem', color: '#94A3B8', textAlign: 'center', margin: 0 }}>
                  🔒 Fast verification. Your data is strictly encrypted under RONAV Financial Services.
                </p>
              </form>
            )}

          </div>

        </div>
      </main>

      <style>{`
        @media (max-width: 767px) {
          .dedicated-service-hero {
            grid-template-columns: 1fr !important;
            padding: 2rem 1.25rem !important;
            border-radius: 16px !important;
            margin-bottom: 1.5rem !important;
          }
          .responsive-split-grid {
            grid-template-columns: 1fr !important;
          }
          .responsive-two-col {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

    </div>
  );
}
