import React, { useState, useEffect, useRef } from 'react';

export default function SplashScreen({ onFinish }) {
  const [fading, setFading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const videoRef = useRef(null);

  const handleComplete = () => {
    if (completed) return;
    setCompleted(true);
    setFading(true);
    setTimeout(() => {
      onFinish();
    }, 450);
  };

  useEffect(() => {
    // Safety fallback timer set to 4.6 seconds (video duration is 4.0s)
    // Ensures video plays completely to the end even if browser events lag
    const fallbackTimer = setTimeout(() => {
      handleComplete();
    }, 4600);

    return () => clearTimeout(fallbackTimer);
  }, []);

  const handleLoadedMetadata = () => {
    if (videoRef.current && videoRef.current.duration) {
      // Dynamic safety fallback based on actual video duration
      const exactDurationMs = videoRef.current.duration * 1000;
      setTimeout(() => {
        handleComplete();
      }, exactDurationMs);
    }
  };

  return (
    <div
      onClick={handleComplete}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#070F1E',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fading ? 0 : 1,
        transition: 'opacity 450ms cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden',
        width: '100vw',
        height: '100vh',
        cursor: 'pointer',
        userSelect: 'none'
      }}
    >
      {/* 
        Scaled Video (1.09x zoom): 
        Pushes corner & edge AI watermarks (such as diamond symbols) completely outside the visible screen bounds.
      */}
      <video
        ref={videoRef}
        src="/splash.mp4"
        autoPlay
        playsInline
        muted
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleComplete}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          transform: 'scale(1.09)',
          transformOrigin: 'center center'
        }}
      />

      {/* Radial Vignette & Edge Shadow Overlay to seamlessly blend and mask any watermark artifacts */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(circle at center, transparent 45%, rgba(7, 15, 30, 0.5) 75%, #070F1E 100%)',
          boxShadow: 'inset 0 0 120px 40px #070F1E'
        }}
      />

      {/* Top & Bottom Dark Edge Bars for complete corner coverage */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '90px',
          background: 'linear-gradient(to bottom, #070F1E 0%, rgba(7,15,30,0.7) 60%, transparent 100%)',
          pointerEvents: 'none'
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '100px',
          background: 'linear-gradient(to top, #070F1E 0%, rgba(7,15,30,0.8) 60%, transparent 100%)',
          pointerEvents: 'none'
        }}
      />
    </div>
  );
}
