import React, { useState, useEffect, useRef } from 'react';
import { Star, Quote } from 'lucide-react';

export default function Testimonials() {
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible'); }); },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );
    const els = sectionRef.current?.querySelectorAll('.reveal, .reveal-scale');
    els?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

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
    <section ref={sectionRef} className="section-padding section-cinematic" style={{ width: '100%' }}>
      <div className="container">
        
        {/* Section Header */}
        <div className="section-header reveal" style={{ marginBottom: '2.5rem' }}>
          <span className="section-tag" style={{ backgroundColor: 'rgba(15, 82, 186, 0.25)', color: '#93C5FD', borderColor: 'rgba(147, 197, 253, 0.3)' }}>SUCCESS STORIES</span>
          <h2 className="section-title" style={{ color: '#FFFFFF' }}>
            Trusted by Retailers &amp;{' '}
            <span className="text-gradient-gold">Distributors</span>
          </h2>
          <p className="section-subtitle" style={{ color: '#94A3B8' }}>
            Real feedback from business owners growing their earnings with RONAV Technologies.
          </p>
        </div>

        {/* Mobile View ONLY: Compact Swiper Slider */}
        <div className="mobile-only">
          <div className="card-dark-glow reveal-scale" style={{ padding: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.125rem', color: '#F59E0B' }}>
                {[...Array(testimonials[activeIndex].stars)].map((_, i) => (
                  <Star key={i} style={{ width: '14px', height: '14px', fill: '#F59E0B' }} />
                ))}
              </div>
              <Quote style={{ width: '18px', height: '18px', color: 'rgba(147, 197, 253, 0.3)' }} />
            </div>

            <p style={{ fontSize: '0.8125rem', color: '#E2E8F0', fontStyle: 'italic', lineHeight: 1.55, marginBottom: '1rem' }}>
              "{testimonials[activeIndex].quote}"
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <strong style={{ fontSize: '0.75rem', color: '#FFFFFF', display: 'block' }}>{testimonials[activeIndex].name}</strong>
                <span style={{ fontSize: '0.625rem', color: '#94A3B8' }}>{testimonials[activeIndex].role}</span>
              </div>
              <span style={{ fontSize: '0.5625rem', fontWeight: 800, padding: '0.125rem 0.375rem', background: 'rgba(5, 150, 105, 0.2)', color: '#34D399', borderRadius: '4px', border: '1px solid rgba(52, 211, 153, 0.3)' }}>
                ✓ Verified
              </span>
            </div>
          </div>

          {/* Swiper Dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.375rem', marginTop: '1rem' }}>
            {testimonials.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                style={{
                  width: activeIndex === idx ? '16px' : '6px',
                  height: '6px',
                  borderRadius: '3px',
                  background: activeIndex === idx ? '#93C5FD' : 'rgba(255,255,255,0.2)',
                  border: 'none',
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>
        </div>

        {/* Desktop ONLY 3-Column Grid */}
        <div className="desktop-only grid-3 reveal-scale" style={{ gap: '1.25rem' }}>
          {testimonials.map((t, idx) => (
            <div 
              key={idx}
              className="card-dark-glow"
              style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                  <div style={{ display: 'flex', gap: '0.125rem', color: '#F59E0B' }}>
                    {[...Array(t.stars)].map((_, i) => (
                      <Star key={i} style={{ width: '14px', height: '14px', fill: '#F59E0B' }} />
                    ))}
                  </div>
                  <Quote style={{ width: '18px', height: '18px', color: 'rgba(147, 197, 253, 0.2)' }} />
                </div>

                <p style={{ fontSize: '0.8125rem', color: '#E2E8F0', fontStyle: 'italic', lineHeight: 1.55, marginBottom: '1.25rem' }}>
                  "{t.quote}"
                </p>
              </div>

              <div style={{ paddingTop: '0.875rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <strong style={{ fontSize: '0.75rem', color: '#FFFFFF', display: 'block' }}>{t.name}</strong>
                  <span style={{ fontSize: '0.625rem', color: '#94A3B8' }}>{t.role}</span>
                </div>
                <span style={{ fontSize: '0.5625rem', fontWeight: 800, padding: '0.125rem 0.375rem', background: 'rgba(5, 150, 105, 0.2)', color: '#34D399', borderRadius: '4px', border: '1px solid rgba(52, 211, 153, 0.3)' }}>
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
