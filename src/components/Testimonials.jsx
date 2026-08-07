import React, { useState } from 'react';
import { Star, Quote } from 'lucide-react';

export default function Testimonials() {
  const [activeIndex, setActiveIndex] = useState(0);

  const testimonials = [
    {
      name: 'Ravi Kumar',
      role: 'Retail Merchant (MID: RONAV12345)',
      location: 'Hyderabad, Telangana',
      quote: 'Got my ₹10 Lakh business loan approved smoothly based on GST returns without payslip hassles. Now using RONAV POS and BBPS daily to serve customers.',
      stars: 5
    },
    {
      name: 'Suresh Reddy',
      role: 'Distributor Partner',
      location: 'Vijayawada, Andhra Pradesh',
      quote: 'Managing over 45 retailers across my area. The instant wallet balance transfer engine and 24x7 support line (9966203053) ensure zero operational downtime.',
      stars: 5
    },
    {
      name: 'Anil Verma',
      role: 'Super Distributor',
      location: 'Secunderabad, Telangana',
      quote: 'The high-margin ATM/CDM franchise returns and transparent admin reporting give complete confidence to our distribution network since 2021.',
      stars: 5
    }
  ];

  return (
    <section className="section-padding bg-slate-50" style={{ width: '100%', padding: '2rem 0' }}>
      <div className="container">
        
        {/* Section Header */}
        <div className="section-header" style={{ marginBottom: '1.25rem' }}>
          <span className="section-tag">SUCCESS STORIES</span>
          <h2 className="section-title" style={{ fontSize: '1.5rem' }}>Trusted by Retailers & Distributors Across South India</h2>
          <p className="section-subtitle" style={{ fontSize: '0.8125rem' }}>
            Real feedback from business owners growing their earnings with RONAV Technologies.
          </p>
        </div>

        {/* Mobile View ONLY: Compact Swiper Slider */}
        <div className="mobile-only">
          <div className="card" style={{ padding: '1rem', borderRadius: '16px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', gap: '0.125rem', color: '#F59E0B' }}>
                {[...Array(testimonials[activeIndex].stars)].map((_, i) => (
                  <Star key={i} style={{ width: '14px', height: '14px', fill: '#F59E0B' }} />
                ))}
              </div>
              <Quote style={{ width: '18px', height: '18px', color: '#BFDBFE' }} />
            </div>

            <p style={{ fontSize: '0.8125rem', color: '#334155', fontStyle: 'italic', lineHeight: 1.5, marginBottom: '0.75rem' }}>
              "{testimonials[activeIndex].quote}"
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #F1F5F9' }}>
              <div>
                <strong style={{ fontSize: '0.75rem', color: '#0F172A', display: 'block' }}>{testimonials[activeIndex].name}</strong>
                <span style={{ fontSize: '0.625rem', color: '#64748B' }}>{testimonials[activeIndex].role}</span>
              </div>
              <span style={{ fontSize: '0.5625rem', fontWeight: 800, padding: '0.125rem 0.375rem', background: '#ECFDF5', color: '#059669', borderRadius: '4px', border: '1px solid #A7F3D0' }}>
                ✓ Verified
              </span>
            </div>
          </div>

          {/* Swiper Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.375rem', marginTop: '0.75rem' }}>
            {testimonials.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                style={{
                  width: activeIndex === idx ? '16px' : '6px',
                  height: '6px',
                  borderRadius: '3px',
                  background: activeIndex === idx ? '#0F52BA' : '#CBD5E1',
                  border: 'none',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>
        </div>

        {/* Desktop ONLY 3-Column Grid */}
        <div className="desktop-only grid-3" style={{ gap: '1rem' }}>
          {testimonials.map((t, idx) => (
            <div 
              key={idx}
              className="card card-hover"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: '#E2E8F0',
                padding: '1.25rem',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                  <div style={{ display: 'flex', gap: '0.125rem', color: '#F59E0B' }}>
                    {[...Array(t.stars)].map((_, i) => (
                      <Star key={i} style={{ width: '14px', height: '14px', fill: '#F59E0B' }} />
                    ))}
                  </div>
                  <Quote style={{ width: '18px', height: '18px', color: '#BFDBFE' }} />
                </div>

                <p style={{ fontSize: '0.8125rem', color: '#334155', fontStyle: 'italic', lineHeight: 1.5, marginBottom: '1rem' }}>
                  "{t.quote}"
                </p>
              </div>

              <div style={{ paddingTop: '0.625rem', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <strong style={{ fontSize: '0.75rem', color: '#0F172A', display: 'block' }}>{t.name}</strong>
                  <span style={{ fontSize: '0.625rem', color: '#64748B' }}>{t.role}</span>
                </div>
                <span style={{ fontSize: '0.5625rem', fontWeight: 800, padding: '0.125rem 0.375rem', background: '#ECFDF5', color: '#059669', borderRadius: '4px', border: '1px solid #A7F3D0' }}>
                  ✓ Verified
                </span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
