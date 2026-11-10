import React from 'react';
import { Truck, ShieldCheck, Database, BarChart3, UploadCloud, Users, LogIn, LogOut, Sparkles, AlertTriangle } from 'lucide-react';

export default function Navbar({ user, activeTab, setActiveTab, onOpenAuth, onLogout }) {
  return (
    <header className="sticky top-0 z-40" style={{ background: '#ffffff', borderBottom: '1px solid #e2e8f0', boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        
        {/* Brand Logo */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('search')}>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/25">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold tracking-tight font-outfit" style={{ color: '#0f172a' }}>MOTUS</span>
              <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd' }}>LEAD PRO</span>
            </div>
            <p className="text-xs" style={{ color: '#64748b' }}>Carrier Intelligence & Scraper</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center space-x-1 rounded-xl p-1" style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
          <button
            onClick={() => setActiveTab('search')}
            className="flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-all"
            style={activeTab === 'search'
              ? { background: '#4f46e5', color: '#ffffff', boxShadow: '0 2px 8px rgba(79,70,229,0.3)' }
              : { color: '#475569', background: 'transparent' }}
          >
            <Database className="h-4 w-4" />
            <span>Search Leads</span>
          </button>

          {user && user.role === 'admin' && (
            <>
              <button
                onClick={() => setActiveTab('admin_users')}
                className="flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-all"
                style={activeTab === 'admin_users'
                  ? { background: '#4f46e5', color: '#ffffff', boxShadow: '0 2px 8px rgba(79,70,229,0.3)' }
                  : { color: '#475569', background: 'transparent' }}
              >
                <Users className="h-4 w-4" style={{ color: activeTab === 'admin_users' ? '#fff' : '#10b981' }} />
                <span>User Management</span>
              </button>

              <button
                onClick={() => setActiveTab('admin_pdf')}
                className="flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-all"
                style={activeTab === 'admin_pdf'
                  ? { background: '#4f46e5', color: '#ffffff', boxShadow: '0 2px 8px rgba(79,70,229,0.3)' }
                  : { color: '#475569', background: 'transparent' }}
              >
                <UploadCloud className="h-4 w-4" style={{ color: activeTab === 'admin_pdf' ? '#fff' : '#6366f1' }} />
                <span>PDF Scraper Engine</span>
              </button>

              <button
                onClick={() => setActiveTab('admin_analytics')}
                className="flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-medium transition-all"
                style={activeTab === 'admin_analytics'
                  ? { background: '#4f46e5', color: '#ffffff', boxShadow: '0 2px 8px rgba(79,70,229,0.3)' }
                  : { color: '#475569', background: 'transparent' }}
              >
                <BarChart3 className="h-4 w-4" style={{ color: activeTab === 'admin_analytics' ? '#fff' : '#8b5cf6' }} />
                <span>Analytics</span>
              </button>
            </>
          )}
        </nav>

        {/* User Auth & Plan Badge */}
        <div className="flex items-center space-x-3">
          {user ? (
            <div className="flex items-center space-x-3">
              {/* Plan Status Badge */}
              {user.role === 'admin' ? (
                <div className="hidden sm:flex items-center space-x-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Admin / Owner</span>
                </div>
              ) : user.plan === 'premium' ? (
                <div className="hidden sm:flex items-center space-x-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: '#f0fdf4', color: '#059669', border: '1px solid #a7f3d0' }}>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Premium (Unlimited)</span>
                </div>
              ) : user.plan === 'trial' ? (
                <div className="hidden sm:flex items-center space-x-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe' }}>
                  <span>Trial ({user.scraped_today || 0}/1,000 Today)</span>
                </div>
              ) : (
                <div className="hidden sm:flex items-center space-x-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Pending Activation</span>
                </div>
              )}

              {/* User Profile Info */}
              <div className="flex items-center space-x-2 rounded-xl p-1.5 px-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold" style={{ background: '#e0e7ff', color: '#4f46e5' }}>
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-left hidden lg:block">
                  <p className="text-xs font-semibold leading-tight" style={{ color: '#1e293b' }}>{user.name}</p>
                  <p className="text-[10px]" style={{ color: '#94a3b8' }}>{user.email}</p>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                title="Log Out"
                className="flex h-9 w-9 items-center justify-center rounded-xl transition-all"
                style={{ border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b' }}
                onMouseOver={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626'; }}
                onMouseOut={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center space-x-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In / Register</span>
            </button>
          )}
        </div>

      </div>
    </header>
  );
}
