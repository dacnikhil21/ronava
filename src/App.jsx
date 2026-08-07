import React, { useState, useEffect } from 'react';
import SplashScreen from './components/SplashScreen';
import CommandPalette from './components/CommandPalette';
import CopyToast from './components/CopyToast';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import TrustBar from './components/TrustBar';
import BusinessNetwork from './components/BusinessNetwork';
import ServicesSection from './components/ServicesSection';
import WhyChooseUs from './components/WhyChooseUs';
import HowItWorks from './components/HowItWorks';
import StatisticsSection from './components/StatisticsSection';
import VisionMission from './components/VisionMission';
import Testimonials from './components/Testimonials';
import FAQSection from './components/FAQSection';
import ContactSection from './components/ContactSection';
import Footer from './components/Footer';
import OfficeLocatorModal from './components/OfficeLocatorModal';
import MerchantLoginPage from './components/MerchantLoginPage';
import MerchantDashboardPage from './components/MerchantDashboardPage';
import AdminLoginPage from './components/AdminLoginPage';
import AdminDashboardPage from './components/AdminDashboardPage';

// Dedicated Page Imports
import AboutPage from './components/AboutPage';
import ServicesPage from './components/ServicesPage';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentView, setCurrentView] = useState('home'); // 'home' | 'about' | 'services' | 'merchant-login' | 'merchant-dashboard' | 'admin-login' | 'admin-dashboard'
  const [officeModalOpen, setOfficeModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // Global Motion Observer: Auto-triggers scroll reveal animations across sections
  useEffect(() => {
    if (showSplash || currentView !== 'home') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    const elements = document.querySelectorAll('.reveal-on-scroll, section, .card');
    elements.forEach((el) => {
      if (!el.classList.contains('reveal-on-scroll')) {
        el.classList.add('reveal-on-scroll');
      }
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [showSplash, currentView]);

  const handleShowToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 2500);
  };

  const handleOpenLogin = (type) => {
    if (type === 'merchant') setCurrentView('merchant-login');
    else if (type === 'admin') setCurrentView('admin-login');
  };

  const handleMerchantLoginSuccess = (userData) => {
    setCurrentUser(userData || { name: 'Ravi Store', mid: 'RONAV12345' });
    setCurrentView('merchant-dashboard');
    handleShowToast('✓ Welcome back! Logged into Merchant Workspace.');
  };

  const handleAdminLoginSuccess = () => {
    setCurrentView('admin-dashboard');
    handleShowToast('✓ Authenticated: Admin Command Center Active.');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView('home');
    handleShowToast('Logged out of platform.');
  };

  // If splash video screen is active
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // Standalone Fullscreen Portals (Merchant Login, Merchant Dashboard, Admin Login, Admin Dashboard)
  if (currentView === 'merchant-login') {
    return (
      <MerchantLoginPage 
        onLoginSuccess={handleMerchantLoginSuccess}
        onBackToHome={() => setCurrentView('home')}
      />
    );
  }

  if (currentView === 'merchant-dashboard') {
    return (
      <MerchantDashboardPage 
        user={currentUser}
        onLogout={handleLogout}
        onNavigate={(view) => setCurrentView(view)}
      />
    );
  }

  if (currentView === 'admin-login') {
    return (
      <AdminLoginPage 
        onLoginSuccess={handleAdminLoginSuccess}
        onBackToHome={() => setCurrentView('home')}
      />
    );
  }

  if (currentView === 'admin-dashboard') {
    return (
      <AdminDashboardPage 
        onLogout={handleLogout}
        onNavigate={(view) => setCurrentView(view)}
      />
    );
  }

  // Unified Main Layout with Persistent Navbar & Footer for Home, About, and Services pages
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans relative">
      {/* Toast Notification Helper */}
      <CopyToast message={toastMessage} onClose={() => setToastMessage('')} />

      {/* ⌘K Command Palette Modal */}
      <CommandPalette 
        isOpen={commandPaletteOpen} 
        onClose={() => setCommandPaletteOpen(false)}
        onOpenLogin={handleOpenLogin}
      />

      {/* UNIFIED PERSISTENT NAVBAR (Never morphs or changes) */}
      <Navbar 
        onOpenLogin={handleOpenLogin}
        onOpenOfficeModal={() => setOfficeModalOpen(true)}
        onNavigate={(view) => setCurrentView(view)}
      />

      {/* Page View Router */}
      <main className="flex-grow">
        {currentView === 'home' && (
          <>
            <Hero onOpenLogin={handleOpenLogin} onShowToast={handleShowToast} />
            <TrustBar />
            <ServicesSection onOpenLogin={handleOpenLogin} onShowToast={handleShowToast} />
            <BusinessNetwork onOpenLogin={handleOpenLogin} />
            <WhyChooseUs />
            <HowItWorks />
            <StatisticsSection />
            <VisionMission />
            <Testimonials />
            <FAQSection />
            <ContactSection onShowToast={handleShowToast} />
          </>
        )}

        {currentView === 'about' && (
          <AboutPage 
            onOpenLogin={handleOpenLogin}
          />
        )}

        {currentView === 'services' && (
          <ServicesPage 
            onOpenLogin={handleOpenLogin}
          />
        )}
      </main>

      {/* UNIFIED PERSISTENT FOOTER */}
      <Footer 
        onOpenLogin={handleOpenLogin}
        onOpenOfficeModal={() => setOfficeModalOpen(true)}
      />

      {/* Office Locator Modal */}
      <OfficeLocatorModal 
        isOpen={officeModalOpen}
        onClose={() => setOfficeModalOpen(false)}
      />
    </div>
  );
}
