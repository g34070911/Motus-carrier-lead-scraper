import React, { useState, useRef, useEffect } from 'react';
import { X, LogIn, UserPlus, ShieldCheck, KeyRound, Mail, User, Eye, EyeOff, ArrowRight, RefreshCw } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// AuthModal — Standard user Sign In / Register with OTP verification
//             Admin portal is accessed via SECRET URL hash: /#/admin-secure-2026
// ─────────────────────────────────────────────────────────────────────────────

export default function AuthModal({ isOpen, onClose, onLoginSuccess, adminSecretUnlocked = false }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'otp' | 'admin'

  // Auto-switch to admin mode when secret URL was used
  useEffect(() => {
    if (isOpen && adminSecretUnlocked) {
      setMode('admin');
    }
  }, [isOpen, adminSecretUnlocked]);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]         = useState('');
  const [otp, setOtp]           = useState(['', '', '', '', '', '']);
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [debugOtp, setDebugOtp] = useState(''); // for dev: shows OTP returned by server

  // Admin secret access state
  const [adminEmail, setAdminEmail]   = useState('');
  const [adminPw, setAdminPw]         = useState('');
  const [adminKey, setAdminKey]       = useState('');
  const [adminPwShow, setAdminPwShow] = useState(false);

  const otpRefs = useRef([]);

  if (!isOpen) return null;

  const resetForm = () => {
    setEmail(''); setPassword(''); setName('');
    setOtp(['', '', '', '', '', '']);
    setError(''); setSuccess(''); setDebugOtp('');
    setAdminEmail(''); setAdminPw(''); setAdminKey('');
  };

  const switchMode = (m) => { resetForm(); setMode(m); };

  // ── OTP input handlers ────────────────────────────────────────────────────
  const handleOtpChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus();
    }
  };

  const otpCode = otp.join('');

  // ── Step 1: Send OTP ─────────────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setDebugOtp(data.debugOtp || '');
        setSuccess(`Verification code sent! Check your email (or see debug code below).`);
        setMode('otp');
      } else {
        setError(data.error || 'Failed to send verification code.');
      }
    } catch (err) {
      setError('Connection error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Complete Registration with OTP ────────────────────────────────
  const handleRegisterOtp = async (e) => {
    e.preventDefault();
    if (otpCode.length !== 6) { setError('Please enter the complete 6-digit code.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim(), name: name.trim(), otp: otpCode })
      });
      let data = {};
      const raw = await res.text();
      try { data = JSON.parse(raw); } catch (_) { throw new Error(`Server error ${res.status}`); }
      if (res.ok) {
        localStorage.setItem('motus_token', data.token);
        onLoginSuccess(data.user);
        onClose();
      } else {
        setError(data.error || 'Registration failed.');
      }
    } catch (err) {
      setError('Connection error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Login ─────────────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim() })
      });
      let data = {};
      const raw = await res.text();
      try { data = JSON.parse(raw); } catch (_) { throw new Error(`Server error ${res.status}`); }
      if (res.ok) {
        localStorage.setItem('motus_token', data.token);
        onLoginSuccess(data.user);
        onClose();
      } else {
        setError(data.error || 'Authentication failed.');
      }
    } catch (err) {
      setError('Connection error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Admin Secure Login ────────────────────────────────────────────────────
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!adminKey.trim()) { setError('Admin security key is required.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/admin-secure-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: adminEmail.trim() || 'admin@motus.com',
          password: adminPw.trim() || 'admin123',
          adminKey: adminKey.trim()
        })
      });
      let data = {};
      const raw = await res.text();
      try { data = JSON.parse(raw); } catch (_) { throw new Error(`Server error ${res.status}`); }
      if (res.ok) {
        localStorage.setItem('motus_token', data.token);
        onLoginSuccess(data.user);
        onClose();
      } else {
        setError(data.error || 'Admin authentication failed.');
      }
    } catch (err) {
      setError('Connection error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Shared input style ────────────────────────────────────────────────────
  const inputStyle = {
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    color: '#0f172a',
    borderRadius: '10px',
    padding: '10px 14px 10px 40px',
    fontSize: '14px',
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.2s'
  };

  const labelStyle = {
    fontSize: '11px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    display: 'block',
    marginBottom: '6px'
  };

  // ── OTP Step UI ───────────────────────────────────────────────────────────
  if (mode === 'otp') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)' }}>
        <div className="relative w-full max-w-md rounded-2xl p-8 space-y-6" style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18)' }}>
          <button onClick={onClose} className="absolute top-5 right-5 p-1.5 rounded-lg transition-all" style={{ background: '#f1f5f9', color: '#64748b' }}>
            <X className="h-4 w-4" />
          </button>

          <div className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
              <KeyRound className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-xl font-bold font-outfit" style={{ color: '#0f172a' }}>Verify Your Email</h2>
            <p className="text-xs" style={{ color: '#64748b' }}>Enter the 6-digit code sent to <span className="font-bold" style={{ color: '#4f46e5' }}>{email}</span></p>
          </div>

          {success && <div className="rounded-xl p-3 text-xs font-semibold" style={{ background: '#f0fdf4', border: '1px solid #a7f3d0', color: '#059669' }}>{success}</div>}
          {debugOtp && (
            <div className="rounded-xl p-3 text-xs font-mono text-center" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#d97706' }}>
              🔐 Dev OTP Code: <span className="text-lg font-black tracking-widest">{debugOtp}</span>
            </div>
          )}
          {error && <div className="rounded-xl p-3 text-xs font-semibold" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>{error}</div>}

          <form onSubmit={handleRegisterOtp} className="space-y-5">
            <div className="flex justify-center gap-3">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => otpRefs.current[i] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  className="text-center text-xl font-black rounded-xl transition-all"
                  style={{
                    width: '46px', height: '52px',
                    border: digit ? '2px solid #4f46e5' : '1.5px solid #cbd5e1',
                    background: digit ? '#eef2ff' : '#f8fafc',
                    color: '#0f172a',
                    outline: 'none',
                    boxShadow: digit ? '0 0 0 3px rgba(79,70,229,0.15)' : 'none'
                  }}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length !== 6}
              className="w-full flex items-center justify-center space-x-2 rounded-xl py-3 text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}
            >
              <span>{loading ? 'Verifying...' : 'Complete Registration'}</span>
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <div className="text-center">
            <button onClick={() => { setMode('register'); setOtp(['','','','','','']); setError(''); setSuccess(''); }} className="text-xs font-semibold" style={{ color: '#4f46e5' }}>
              ← Back to registration
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Admin Secret Access UI ────────────────────────────────────────────────
  if (mode === 'admin') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(8px)' }}>
        <div className="relative w-full max-w-md rounded-2xl p-8 space-y-6" style={{ background: '#ffffff', border: '1px solid #ddd6fe', boxShadow: '0 24px 48px -12px rgba(109,40,217,0.2)' }}>
          <button onClick={onClose} className="absolute top-5 right-5 p-1.5 rounded-lg" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
            <X className="h-4 w-4" />
          </button>

          <div className="text-center space-y-2">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <h2 className="text-xl font-bold font-outfit" style={{ color: '#0f172a' }}>Admin Portal Access</h2>
            <p className="text-xs" style={{ color: '#64748b' }}>Restricted to authorized system administrators only.</p>
          </div>

          {error && <div className="rounded-xl p-3 text-xs font-semibold" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>{error}</div>}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label style={labelStyle}>Admin Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4" style={{ color: '#94a3b8' }} />
                <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@motus.com" style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Admin Password</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 h-4 w-4" style={{ color: '#94a3b8' }} />
                <input
                  type={adminPwShow ? 'text' : 'password'}
                  value={adminPw}
                  onChange={e => setAdminPw(e.target.value)}
                  placeholder="••••••••"
                  style={{ ...inputStyle, paddingRight: '42px' }}
                />
                <button type="button" onClick={() => setAdminPwShow(!adminPwShow)} className="absolute right-3 top-2.5" style={{ color: '#94a3b8' }}>
                  {adminPwShow ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Security Access Key <span style={{ color: '#dc2626' }}>*</span></label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-2.5 h-4 w-4" style={{ color: '#7c3aed' }} />
                <input
                  type="password"
                  value={adminKey}
                  onChange={e => setAdminKey(e.target.value)}
                  placeholder="Enter admin security key"
                  style={{ ...inputStyle, borderColor: '#ddd6fe' }}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 rounded-xl py-3 text-sm font-bold text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', boxShadow: '0 4px 12px rgba(124,58,237,0.3)' }}
            >
              <ShieldCheck className="h-4 w-4" />
              <span>{loading ? 'Authenticating...' : 'Access Admin Portal'}</span>
            </button>
          </form>

          <div className="text-center">
            <button onClick={() => switchMode('login')} className="text-xs font-semibold" style={{ color: '#64748b' }}>
              ← Back to user login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Login / Register UI ──────────────────────────────────────────────
  const isRegister = mode === 'register';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="relative w-full max-w-md rounded-2xl p-8 space-y-6" style={{ background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.18)' }}>

        {/* Close Button */}
        <button onClick={onClose} className="absolute top-5 right-5 p-1.5 rounded-lg transition-all" style={{ background: '#f1f5f9', color: '#64748b' }}>
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}>
            {isRegister ? <UserPlus className="h-6 w-6 text-white" /> : <LogIn className="h-6 w-6 text-white" />}
          </div>
          <h2 className="text-xl font-bold font-outfit" style={{ color: '#0f172a' }}>
            {isRegister ? 'Create Account' : 'Sign In to MOTUS'}
          </h2>
          <p className="text-xs" style={{ color: '#64748b' }}>
            {isRegister
              ? 'Register with email verification. Account starts pending admin plan activation.'
              : 'Sign in to access carrier leads, scrapers, and CSV exporter.'}
          </p>
        </div>

        {error && (
          <div className="rounded-xl p-3 text-xs font-semibold" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={isRegister ? handleSendOtp : handleLogin} className="space-y-4">
          {isRegister && (
            <div>
              <label style={labelStyle}>Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4" style={{ color: '#94a3b8' }} />
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" style={inputStyle} required />
              </div>
            </div>
          )}

          <div>
            <label style={labelStyle}>Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4" style={{ color: '#94a3b8' }} />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@company.com" style={inputStyle} required />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-2.5 h-4 w-4" style={{ color: '#94a3b8' }} />
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{ ...inputStyle, paddingRight: '42px' }}
                required
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-2.5" style={{ color: '#94a3b8' }}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 rounded-xl py-3 text-sm font-bold text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' }}
          >
            {loading
              ? <><RefreshCw className="h-4 w-4 animate-spin" /><span>Please wait...</span></>
              : isRegister
                ? <><span>Send Verification Code</span><ArrowRight className="h-4 w-4" /></>
                : <><LogIn className="h-4 w-4" /><span>Sign In</span></>
            }
          </button>
        </form>

        {/* Quick Fill Demo Logins (only show on login) */}
        {!isRegister && (
          <div className="pt-2 space-y-2" style={{ borderTop: '1px solid #f1f5f9' }}>
            <p className="text-[11px] font-semibold text-center uppercase tracking-wider" style={{ color: '#94a3b8' }}>Quick Demo Fill</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setEmail('john@logistics.com'); setPassword('user123'); }}
                className="px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                style={{ background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe' }}
              >
                Trial User Demo
              </button>
              <button
                type="button"
                onClick={() => { setEmail('sarah@freightco.com'); setPassword('user123'); }}
                className="px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}
              >
                Pending User Demo
              </button>
            </div>
          </div>
        )}

        {/* Toggle Mode */}
        <div className="flex flex-col items-center space-y-2 pt-1">
          <button
            onClick={() => switchMode(isRegister ? 'login' : 'register')}
            className="text-xs font-semibold underline"
            style={{ color: '#4f46e5' }}
          >
            {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Register here"}
          </button>
        </div>

      </div>
    </div>
  );
}
