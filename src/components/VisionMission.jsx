import React, { useEffect, useRef } from 'react';
import { Target, Compass, CheckCircle2 } from 'lucide-react';

export default function VisionMission() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    const elements = sectionRef.current?.querySelectorAll('.reveal');
    elements?.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="section-padding"
      style={{ backgroundColor: '#FFFFFF', padding: '3.5rem 0', width: '100%' }}
    >
      <div className="container" style={{ maxWidth: '860px', margin: '0 auto', padding: '0 1rem' }}>

        {/* Vertical Stack of the two Horizontal Illustrated Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Card 1: Our Mission (Light Blue Theme) */}
          <div 
            className="mission-vision-card"
            style={{
              backgroundColor: '#EFF6FF',
              borderColor: '#BFDBFE',
              borderWidth: '1.5px',
              borderStyle: 'solid',
              borderRadius: '20px',
              padding: '1.75rem 2rem',
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr',
              alignItems: 'center',
              gap: '2rem',
              boxShadow: '0 10px 30px rgba(15,82,186,0.01)'
            }}
          >
            {/* Left Content Column */}
            <div>
              {/* Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#0F52BA', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Target style={{ width: '13px', height: '13px' }} />
                </div>
                <span style={{ fontSize: '0.625rem', fontWeight: 900, color: '#0F52BA', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  OUR MISSION
                </span>
              </div>

              {/* Title */}
              <h3 className="vm-card-title" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#1E40AF', margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
                Democratize Business Credit
              </h3>

              {/* Description */}
              <p style={{ fontSize: '0.8125rem', color: '#1E3A8A', lineHeight: 1.6, marginBottom: '1.125rem' }}>
                Empower every retailer with accessible working capital, high-margin BBPS capabilities, and turnkey ATM operations.
              </p>

              {/* Clean bullet-free list items (No capsules) */}
              <div className="vm-checklist-row">
                <div className="vm-chip vm-chip-blue">
                  <CheckCircle2 className="vm-chip-icon" />
                  <span>Zero Payout Delay</span>
                </div>
                <div className="vm-chip vm-chip-blue">
                  <CheckCircle2 className="vm-chip-icon" />
                  <span>Accessible Working Capital</span>
                </div>
                <div className="vm-chip vm-chip-blue">
                  <CheckCircle2 className="vm-chip-icon" />
                  <span>Inclusive Growth</span>
                </div>
              </div>
            </div>

            {/* Right Illustration Column (3D Upward Growth Chart + Coins image) */}
            <div className="vm-illustration-box">
              <img 
                src="/mission_chart.png" 
                alt="Our Mission Illustration" 
                className="vm-svg-chart"
                style={{ 
                  width: '100%', 
                  height: 'auto', 
                  maxWidth: '180px', 
                  objectFit: 'contain',
                  margin: '0 auto',
                  display: 'block'
                }} 
              />
            </div>

          </div>

          {/* Card 2: Strategic Vision (Light Green Theme) */}
          <div 
            className="mission-vision-card"
            style={{
              backgroundColor: '#ECFDF5',
              borderColor: '#A7F3D0',
              borderWidth: '1.5px',
              borderStyle: 'solid',
              borderRadius: '20px',
              padding: '1.75rem 2rem',
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr',
              alignItems: 'center',
              gap: '2rem',
              boxShadow: '0 10px 30px rgba(5,150,105,0.01)'
            }}
          >
            {/* Left Content Column */}
            <div>
              {/* Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '6px', backgroundColor: '#059669', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Compass style={{ width: '13px', height: '13px' }} />
                </div>
                <span style={{ fontSize: '0.625rem', fontWeight: 900, color: '#059669', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  STRATEGIC VISION
                </span>
              </div>

              {/* Title */}
              <h3 className="vm-card-title" style={{ fontSize: '1.45rem', fontWeight: 900, color: '#065F46', margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
                India's Most Trusted Network
              </h3>

              {/* Description */}
              <p style={{ fontSize: '0.8125rem', color: '#064E3B', lineHeight: 1.6, marginBottom: '1.125rem' }}>
                Build India's most trusted 3-tier distributor-merchant network, processing ₹100 Cr+ monthly with 100% transparency.
              </p>

              {/* Clean bullet-free list items (No capsules) */}
              <div className="vm-checklist-row">
                <div className="vm-chip vm-chip-green">
                  <CheckCircle2 className="vm-chip-icon" />
                  <span>3-Tier Ecosystem</span>
                </div>
                <div className="vm-chip vm-chip-green">
                  <CheckCircle2 className="vm-chip-icon" />
                  <span>100% Transparency</span>
                </div>
                <div className="vm-chip vm-chip-green">
                  <CheckCircle2 className="vm-chip-icon" />
                  <span>Sustainable Growth</span>
                </div>
              </div>
            </div>

            {/* Right Illustration Column (Stylized India Map Outline image) */}
            <div className="vm-illustration-box">
              <div className="vm-india-map-container" style={{ position: 'relative', width: '120px', height: '120px', margin: '0 auto' }}>
                <img 
                  src="/vision_map.png" 
                  alt="Strategic Vision Illustration" 
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'contain',
                    display: 'block'
                  }} 
                />
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Embedded CSS for Horizontal Card checklist and responsive flow */}
      <style>{`
        /* Checklist items row display */
        .vm-checklist-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        /* Clean text layout items (no capsule backgrounds, borders, shadows, or padding) */
        .vm-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.78125rem;
          font-weight: 800;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }

        .vm-chip-blue {
          color: #1E3A8A;
        }

        .vm-chip-green {
          color: #064E3B;
        }

        .vm-chip-icon {
          width: 14px;
          height: 14px;
          flex-shrink: 0;
        }

        .vm-chip-blue .vm-chip-icon {
          color: #0F52BA;
        }

        .vm-chip-green .vm-chip-icon {
          color: #059669;
        }

        .vm-illustration-box {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Mobile responsive stacking and compact scaling rules */
        @media (max-width: 767px) {
          .mission-vision-card {
            grid-template-columns: 1fr !important;
            gap: 1.25rem !important;
            padding: 1.25rem !important;
            border-radius: 16px !important;
          }
          
          .vm-card-title {
            font-size: 1.25rem !important;
          }

          .vm-checklist-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 0.5rem !important;
          }

          .vm-chip {
            font-size: 0.75rem !important;
          }

          .vm-svg-chart {
            max-width: 130px !important;
          }

          .vm-india-map-container {
            width: 90px !important;
            height: 90px !important;
          }
        }
      `}</style>

    </section>
  );
}
