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
import FaqSection from './components/FaqSection';
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
import ServiceLoansPage from './components/ServiceLoansPage';
import ServiceAtmPage from './components/ServiceAtmPage';
import ServiceBbpsPage from './components/ServiceBbpsPage';
import ServicePosPage from './components/ServicePosPage';
import ContactPage from './components/ContactPage';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [currentView, setCurrentView] = useState('home'); // 'home' | 'about' | 'services' | 'contact' | 'service-loans' | 'service-atm' | 'service-bbps' | 'service-pos' | 'merchant-login' | 'merchant-dashboard' | 'admin-login' | 'admin-dashboard'
  const [officeModalOpen, setOfficeModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // Global Motion Observer: Auto-triggers scroll reveal animations across sections
  useEffect(() => {
    if (showSplash) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
          }
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px -20px 0px' }
    );

    const elements = document.querySelectorAll('.reveal-on-scroll, .reveal-left, .reveal-right, section, .card, .service-card');
    elements.forEach((el) => {
      if (
        !el.classList.contains('reveal-on-scroll') && 
        !el.classList.contains('reveal-left') && 
        !el.classList.contains('reveal-right')
      ) {
        el.classList.add('reveal-on-scroll');
      }
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [showSplash, currentView]);

  // Listen to URL changes for secure /admin access
  useEffect(() => {
    const checkAdminRoute = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      if (path === '/admin' || path === '/admin/' || hash === '#/admin' || hash === '#admin') {
        setCurrentView((prev) => (prev === 'admin-dashboard' ? 'admin-dashboard' : 'admin-login'));
      }
    };

    checkAdminRoute();
    window.addEventListener('popstate', checkAdminRoute);
    window.addEventListener('hashchange', checkAdminRoute);
    return () => {
      window.removeEventListener('popstate', checkAdminRoute);
      window.removeEventListener('hashchange', checkAdminRoute);
    };
  }, []);

  const handleShowToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 2500);
  };

  const handleNavigate = (view) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setCurrentView(view);
  };

  const handleOpenLogin = (type = 'merchant') => {
    if (type === 'admin') {
      window.history.pushState({}, '', '/admin');
      setCurrentView('admin-login');
    } else {
      setCurrentView('merchant-login');
    }
  };

  const handleMerchantLoginSuccess = (userData) => {
    setCurrentUser(userData || { name: 'Ravi Enterprise', mid: 'RONAV12345', role: 'Retailer' });
    setCurrentView('merchant-dashboard');
    handleShowToast(`✓ Welcome back! Logged in as ${userData?.role || 'Retailer'}.`);
  };

  const handleAdminLoginSuccess = () => {
    window.history.pushState({}, '', '/admin');
    setCurrentView('admin-dashboard');
    handleShowToast('✓ Authenticated: Admin Command Center Active.');
  };

  const handleLogout = () => {
    if (window.location.pathname.toLowerCase().startsWith('/admin')) {
      window.history.pushState({}, '', '/');
    }
    setCurrentUser(null);
    setCurrentView('home');
    handleShowToast('Logged out of platform.');
  };

  const handleBackToHome = () => {
    if (window.location.pathname.toLowerCase().startsWith('/admin')) {
      window.history.pushState({}, '', '/');
    }
    setCurrentView('home');
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
        onBackToHome={handleBackToHome}
      />
    );
  }

  if (currentView === 'merchant-dashboard') {
    return (
      <MerchantDashboardPage 
        user={currentUser}
        onLogout={handleLogout}
        onNavigate={(view) => handleNavigate(view)}
      />
    );
  }

  if (currentView === 'admin-login') {
    return (
      <AdminLoginPage 
        onLoginSuccess={handleAdminLoginSuccess}
        onBackToHome={handleBackToHome}
      />
    );
  }

  if (currentView === 'admin-dashboard') {
    return (
      <AdminDashboardPage 
        onLogout={handleLogout}
        onNavigate={(view) => handleNavigate(view)}
      />
    );
  }

  // Unified Main Layout with Persistent Navbar & Footer for Home, About, Services & Dedicated Service Pages
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

      {/* UNIFIED PERSISTENT NAVBAR */}
      <Navbar 
        onOpenLogin={handleOpenLogin}
        onOpenOfficeModal={() => setOfficeModalOpen(true)}
        onNavigate={handleNavigate}
        currentView={currentView}
      />

      {/* Page View Router */}
      <main className="flex-grow">
        {currentView === 'home' && (
          <>
            <Hero onOpenLogin={handleOpenLogin} onShowToast={handleShowToast} onNavigate={handleNavigate} />
            <TrustBar />
            <ServicesSection onOpenLogin={handleOpenLogin} onShowToast={handleShowToast} onNavigate={handleNavigate} />
            <BusinessNetwork onOpenLogin={handleOpenLogin} />
            <WhyChooseUs />
            <HowItWorks />
            <StatisticsSection />
            <VisionMission />
            <Testimonials />
            <FaqSection />
            <ContactSection onShowToast={handleShowToast} />
          </>
        )}

        {currentView === 'about' && (
          <AboutPage 
            onOpenLogin={handleOpenLogin}
            onBack={() => handleNavigate('home')}
          />
        )}

        {currentView === 'services' && (
          <ServicesPage 
            onOpenLogin={handleOpenLogin}
            onBack={() => handleNavigate('home')}
            onNavigate={handleNavigate}
          />
        )}

        {currentView === 'contact' && (
          <ContactPage 
            onOpenLogin={handleOpenLogin}
            onBack={() => handleNavigate('home')}
            onShowToast={handleShowToast}
          />
        )}

        {/* 4 Dedicated Standalone Service Pages */}
        {currentView === 'service-loans' && (
          <ServiceLoansPage 
            onOpenLogin={handleOpenLogin}
            onBack={() => handleNavigate('home')}
            onShowToast={handleShowToast}
          />
        )}

        {currentView === 'service-atm' && (
          <ServiceAtmPage 
            onOpenLogin={handleOpenLogin}
            onBack={() => handleNavigate('home')}
            onShowToast={handleShowToast}
          />
        )}

        {currentView === 'service-bbps' && (
          <ServiceBbpsPage 
            onOpenLogin={handleOpenLogin}
            onBack={() => handleNavigate('home')}
            onShowToast={handleShowToast}
          />
        )}

        {currentView === 'service-pos' && (
          <ServicePosPage 
            onOpenLogin={handleOpenLogin}
            onBack={() => handleNavigate('home')}
            onShowToast={handleShowToast}
          />
        )}
      </main>

      {/* UNIFIED PERSISTENT FOOTER */}
      <Footer 
        onOpenLogin={handleOpenLogin}
        onOpenOfficeModal={() => setOfficeModalOpen(true)}
        onNavigate={handleNavigate}
      />

      {/* Office Locator Modal */}
      <OfficeLocatorModal 
        isOpen={officeModalOpen}
        onClose={() => setOfficeModalOpen(false)}
      />
    </div>
  );
}
