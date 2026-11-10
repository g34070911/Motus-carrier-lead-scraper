import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import SearchPortal from './components/SearchPortal';
import AdminPortal from './components/AdminPortal';
import CarrierModal from './components/CarrierModal';
import AuthModal from './components/AuthModal';
import PlanUpgradeModal from './components/PlanUpgradeModal';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('search');
  const [selectedCarrier, setSelectedCarrier] = useState(null);
  
  // Modals
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [upgradeErrorData, setUpgradeErrorData] = useState(null);

  // Secret admin portal flag — activated when URL hash contains the secret path
  const [adminSecretUnlocked, setAdminSecretUnlocked] = useState(false);

  useEffect(() => {
    checkCurrentUser();

    // Check URL for secret admin access hash
    // Admin accesses the portal via: /#/admin-secure-2026
    const checkSecretHash = () => {
      if (window.location.hash === '#/admin-secure-2026') {
        setAdminSecretUnlocked(true);
        setIsAuthOpen(true);
        // Clear hash from URL so it's not visible
        window.history.replaceState(null, '', window.location.pathname);
      }
    };
    checkSecretHash();
    window.addEventListener('hashchange', checkSecretHash);
    return () => window.removeEventListener('hashchange', checkSecretHash);
  }, []);

  const checkCurrentUser = async () => {
    const token = localStorage.getItem('motus_token');
    if (!token) return;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setUser(data.user);
      } else {
        localStorage.removeItem('motus_token');
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('motus_token');
    setUser(null);
    setActiveTab('search');
    setAdminSecretUnlocked(false);
  };

  const handleRequireUpgrade = (reasonCode, errorData) => {
    setUpgradeErrorData({ code: reasonCode, ...errorData });
    setIsUpgradeOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f8fafc', color: '#0f172a' }}>
      
      {/* Navbar */}
      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {activeTab === 'search' && (
          <SearchPortal
            user={user}
            onSelectCarrier={(carrier) => setSelectedCarrier(carrier)}
            onRequireUpgrade={handleRequireUpgrade}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}

        {activeTab === 'admin_users' && (
          <AdminPortal user={user} activeSubTab="users" />
        )}

        {activeTab === 'admin_pdf' && (
          <AdminPortal user={user} activeSubTab="pdf" />
        )}

        {activeTab === 'admin_analytics' && (
          <AdminPortal user={user} activeSubTab="analytics" />
        )}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-xs" style={{ borderTop: '1px solid #e2e8f0', background: '#ffffff', color: '#94a3b8' }}>
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 MOTUS Carrier Scraper & Lead Intelligence System. All rights reserved.</p>
          <p className="font-mono" style={{ color: '#6366f1' }}>Scraping Engine: motus.dot.gov</p>
        </div>
      </footer>

      {/* Carrier Details Profile Modal */}
      <CarrierModal
        carrier={selectedCarrier}
        onClose={() => setSelectedCarrier(null)}
      />

      {/* Authentication Signin/Signup Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => { setIsAuthOpen(false); setAdminSecretUnlocked(false); }}
        adminSecretUnlocked={adminSecretUnlocked}
        onLoginSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          setIsAuthOpen(false);
          setAdminSecretUnlocked(false);
          if (loggedInUser.role === 'admin') {
            setActiveTab('admin_users');
          }
        }}
      />

      {/* Plan Upgrade / Locked Service Modal */}
      <PlanUpgradeModal
        isOpen={isUpgradeOpen}
        onClose={() => setIsUpgradeOpen(false)}
        errorData={upgradeErrorData}
      />

    </div>
  );
}
