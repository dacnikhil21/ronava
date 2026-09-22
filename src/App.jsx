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

// Helpers to detect deep routes immediately on initial load
const isAdminPath = () => {
  if (typeof window === 'undefined') return false;
  const path = (window.location.pathname || '').toLowerCase();
  const hash = (window.location.hash || '').toLowerCase();
  return path.startsWith('/admin') || hash.includes('admin');
};

const isMerchantPath = () => {
  if (typeof window === 'undefined') return false;
  const path = (window.location.pathname || '').toLowerCase();
  const hash = (window.location.hash || '').toLowerCase();
  return path.startsWith('/merchant') || hash.includes('merchant');
};

const getInitialView = () => {
  if (typeof window !== 'undefined') {
    const hash = (window.location.hash || '').replace('#', '').toLowerCase();
    const savedView = sessionStorage.getItem('ronav_current_view');
    const savedUser = sessionStorage.getItem('ronav_merchant_user');

    if (isAdminPath()) {
      const hasAdminAuth = sessionStorage.getItem('ronav_admin_session') === 'true';
      return hasAdminAuth ? 'admin-dashboard' : 'admin-login';
    }
    if (hash === 'admin-dashboard' && sessionStorage.getItem('ronav_admin_session') === 'true') {
      return 'admin-dashboard';
    }
    if (hash === 'admin-login') {
      return 'admin-login';
    }

    if (savedUser && (savedView === 'merchant-dashboard' || hash === 'merchant-dashboard')) {
      try {
        const u = JSON.parse(savedUser);
        if (u?.role === 'ADMIN' || u?.id === 'ADM001' || u?.user?.role === 'ADMIN' || u?.id?.startsWith('ADM')) {
          sessionStorage.setItem('ronav_admin_session', 'true');
          sessionStorage.setItem('ronav_current_view', 'admin-dashboard');
          sessionStorage.removeItem('ronav_merchant_user');
          return 'admin-dashboard';
        }
      } catch (_) {}
      return 'merchant-dashboard';
    }

    if (isMerchantPath() || hash === 'merchant-login' || savedView === 'merchant-login') {
      return 'merchant-login';
    }

    if (hash && ['about', 'services', 'contact', 'service-loans', 'service-atm', 'service-bbps', 'service-pos'].includes(hash)) {
      return hash;
    }
    if (savedView && savedView !== 'home') {
      return savedView;
    }
  }
  return 'home';
};

const shouldShowSplashInitially = () => {
  if (typeof window === 'undefined') return false;
  if (isAdminPath() || isMerchantPath()) return false;
  const hash = (window.location.hash || '').toLowerCase();
  if (hash.includes('merchant') || hash.includes('admin')) return false;
  const savedView = sessionStorage.getItem('ronav_current_view');
  if (savedView && savedView !== 'home') return false;
  const savedMerchant = sessionStorage.getItem('ronav_merchant_user');
  if (savedMerchant) return false;
  if (sessionStorage.getItem('ronav_splash_seen') === 'true') return false;
  return true;
};

export default function App() {
  const [showSplash, setShowSplash] = useState(shouldShowSplashInitially);
  const [currentView, setCurrentView] = useState(getInitialView); // 'home' | 'about' | 'services' | 'contact' | 'service-loans' | 'service-atm' | 'service-bbps' | 'service-pos' | 'merchant-login' | 'merchant-dashboard' | 'admin-login' | 'admin-dashboard'
  const [officeModalOpen, setOfficeModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('ronav_merchant_user');
        if (saved) return JSON.parse(saved);
      } catch (_) {}
    }
    return null;
  });

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

  // Ensure scroll top on page view switches
  useEffect(() => {
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [currentView]);

  // Listen to URL and hash changes for deep routes
  useEffect(() => {
    const handleRouteChange = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = (window.location.hash || '').replace('#', '').toLowerCase();

      if (path.startsWith('/admin') || hash.includes('admin')) {
        setShowSplash(false);
        const hasAdminAuth = typeof window !== 'undefined' && sessionStorage.getItem('ronav_admin_session') === 'true';
        setCurrentView(hasAdminAuth ? 'admin-dashboard' : 'admin-login');
        return;
      }

      if (hash === 'merchant-dashboard') {
        const savedUser = sessionStorage.getItem('ronav_merchant_user');
        if (savedUser) {
          setShowSplash(false);
          setCurrentView('merchant-dashboard');
          return;
        }
      }

      if (hash === 'merchant-login') {
        setShowSplash(false);
        setCurrentView('merchant-login');
        return;
      }

      if (hash && ['about', 'services', 'contact', 'service-loans', 'service-atm', 'service-bbps', 'service-pos'].includes(hash)) {
        setShowSplash(false);
        setCurrentView(hash);
        return;
      }
    };

    handleRouteChange();
    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('hashchange', handleRouteChange);
    };
  }, []);

  const handleShowToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 2500);
  };

  const handleNavigate = (view) => {
    setCurrentView(view);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ronav_current_view', view);
      if (view === 'home') {
        if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
      } else {
        window.location.hash = `#${view}`;
      }
    }
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  };

  const handleOpenLogin = (type = 'merchant') => {
    if (type === 'admin') {
      window.history.pushState({}, '', '/admin');
      if (typeof window !== 'undefined') sessionStorage.setItem('ronav_current_view', 'admin-login');
      setCurrentView('admin-login');
    } else {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('ronav_current_view', 'merchant-login');
        window.location.hash = '#merchant-login';
      }
      setCurrentView('merchant-login');
    }
  };

  const handleMerchantLoginSuccess = (userData) => {
    const user = userData || { name: 'Ravi Enterprise', mid: 'RONAV12345', role: 'Retailer' };
    
    // If Administrator logs in, route directly to the Admin Command Center
    if (user?.role === 'ADMIN' || user?.id === 'ADM001' || user?.user?.role === 'ADMIN' || user?.id?.startsWith('ADM')) {
      handleAdminLoginSuccess();
      return;
    }

    setCurrentUser(user);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ronav_merchant_user', JSON.stringify(user));
      sessionStorage.setItem('ronav_current_view', 'merchant-dashboard');
      window.location.hash = '#merchant-dashboard';
    }
    setCurrentView('merchant-dashboard');
    handleShowToast(`✓ Welcome back! Logged in as ${user?.role || 'Retailer'}.`);
  };

  const handleAdminLoginSuccess = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ronav_admin_session', 'true');
      sessionStorage.setItem('ronav_current_view', 'admin-dashboard');
    }
    window.history.pushState({}, '', '/admin');
    setCurrentView('admin-dashboard');
    handleShowToast('✓ Authenticated: Admin Command Center Active.');
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('ronav_admin_session');
      sessionStorage.removeItem('ronav_merchant_user');
      sessionStorage.removeItem('ronav_current_view');
      sessionStorage.removeItem('ronav_merchant_active_tab');
    }
    if (window.location.pathname.toLowerCase().startsWith('/admin')) {
      window.history.pushState({}, '', '/');
    } else if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    setCurrentUser(null);
    setCurrentView('home');
    handleShowToast('Logged out of platform.');
  };

  const handleBackToHome = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('ronav_current_view', 'home');
      if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
    }
    if (window.location.pathname.toLowerCase().startsWith('/admin')) {
      window.history.pushState({}, '', '/');
    }
    setCurrentView('home');
  };

  // If splash video screen is active
  if (showSplash) {
    return (
      <SplashScreen 
        onFinish={() => {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('ronav_splash_seen', 'true');
          }
          setShowSplash(false);
        }} 
      />
    );
  }

  // Standalone Fullscreen Portals (Merchant Login, Merchant Dashboard, Admin Login, Admin Dashboard)
  if (currentView === 'merchant-login') {
    return (
      <MerchantLoginPage 
        onLoginSuccess={handleMerchantLoginSuccess}
        onBackToHome={handleBackToHome}
        onNavigate={handleNavigate}
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
