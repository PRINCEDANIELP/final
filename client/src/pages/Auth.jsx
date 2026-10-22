import React, { useState, useEffect, useDebugValue } from 'react';
import { useSearchParams } from 'react-router-dom';
import { signInWithGoogle } from '../firebase.js';
import { api } from '../api.js';

// Custom hook to provide clean debugging information inside React Developer Tools
function useAuthDebugger({ mode, role, email, loading, error }) {
  useDebugValue({
    portal: role === 'host' ? 'Host Dashboard' : 'Driver Portal',
    mode,
    email: email || '(empty)',
    loading,
    hasError: Boolean(error),
  });
}

export default function Auth() {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role') === 'host' ? 'host' : 'driver';

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [role, setRole] = useState(initialRole); // 'driver' | 'host'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Hook for React Developer Toolkit inspection
  useAuthDebugger({ mode, role, email, loading, error });

  // Sync role if query parameter changes
  useEffect(() => {
    const qRole = searchParams.get('role');
    if (qRole === 'host' || qRole === 'driver') {
      setRole(qRole);
    }
  }, [searchParams]);

  // Helper to redirect user to appropriate authorized portal
  const handleRedirectAfterAuth = (authenticatedUser) => {
    const isHostRole = authenticatedUser?.role === 'host';
    if (isHostRole) {
      window.location.href = '/host';
    } else {
      window.location.href = '/';
    }
  };

  // Email/Password login or registration
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfoMsg('');
    setLoading(true);

    try {
      const path = mode === 'register' ? '/auth/register' : '/auth/login';
      const payload =
        mode === 'register'
          ? { email: email.trim(), password, name: name.trim(), role }
          : { email: email.trim(), password };

      const data = await api(path, {
        method: 'POST',
        body: payload,
      });

      if (!data || !data.token) {
        throw new Error('Authentication failed. Please check your credentials.');
      }

      // Preserve genuine user role returned from MongoDB Atlas
      const serverUser = data.user || {};
      const actualRole = serverUser.role || (mode === 'register' ? role : 'driver');
      const userProfile = { ...serverUser, role: actualRole };

      // Persist auth token and user profile
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(userProfile));

      // Notify app components of auth state change
      window.dispatchEvent(new Event('auth-change'));

      // Redirect user directly to their authorized portal
      handleRedirectAfterAuth(userProfile);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth Sign-In
  const handleGoogleSignIn = async () => {
    setError('');
    setInfoMsg('');
    setGoogleLoading(true);
    try {
      const fbUser = await signInWithGoogle();
      const data = await api('/auth/google', {
        method: 'POST',
        body: {
          email: fbUser.email,
          name: fbUser.displayName || 'Google User',
          uid: fbUser.uid,
          photoUrl: fbUser.photoURL,
          role,
        },
      });

      if (!data || !data.token) {
        throw new Error('Failed to authenticate with Google.');
      }

      const serverUser = data.user || {};
      const actualRole = serverUser.role || role || 'driver';
      const userProfile = { ...serverUser, role: actualRole };

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(userProfile));
      window.dispatchEvent(new Event('auth-change'));

      handleRedirectAfterAuth(userProfile);
    } catch (err) {
      setError(err.message || 'Google Sign-in failed or was closed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div
      data-component="Auth"
      data-portal={role}
      data-mode={mode}
      className="w-full flex items-center justify-center min-h-[78vh] py-8 px-4"
    >
      <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xl shadow-slate-200/50 mx-auto relative overflow-hidden">
        {/* Subtle top accent border */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />

        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6 pt-1">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50/80 border border-emerald-100 flex items-center justify-center p-2 mb-3 shadow-xs">
            <img
              src="/logo.png"
              alt="Namma Spots"
              className="h-full w-full object-contain"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            {mode === 'login' ? 'Welcome Back' : 'Create an Account'}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-xs">
            {mode === 'login'
              ? `Sign in to access your ${role === 'host' ? 'Host Dashboard' : 'Driver Portal'}`
              : `Join Namma Spots as a ${role === 'host' ? 'Parking Host' : 'Driver'}`}
          </p>
        </div>

        {/* Portal / Role Selector Tabs */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              Select Account Type
            </span>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              {role === 'driver' ? 'Looking for Parking' : 'Renting Out a Space'}
            </span>
          </div>

          <div className="grid grid-cols-2 bg-slate-100/80 p-1.5 rounded-2xl gap-1.5 border border-slate-200/60">
            <button
              type="button"
              id="role-driver-btn"
              onClick={() => {
                setRole('driver');
                setError('');
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                role === 'driver'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <span className="text-base">🚗</span>
              <span className="truncate">Driver Portal</span>
            </button>

            <button
              type="button"
              id="role-host-btn"
              onClick={() => {
                setRole('host');
                setError('');
              }}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                role === 'host'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <span className="text-base">🅿️</span>
              <span className="truncate">Host Dashboard</span>
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs (Sign In vs Create Account) */}
        <div className="flex bg-slate-100/70 p-1 rounded-xl mb-5 gap-1 border border-slate-200/50">
          <button
            type="button"
            id="mode-login-btn"
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'bg-transparent text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => {
              setMode('login');
              setError('');
              setInfoMsg('');
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            id="mode-register-btn"
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'bg-transparent text-slate-600 hover:text-slate-900'
            }`}
            onClick={() => {
              setMode('register');
              setError('');
              setInfoMsg('');
            }}
          >
            Create Account
          </button>
        </div>

        {/* Google 1-Click Sign-In */}
        <button
          type="button"
          id="google-signin-btn"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          className="w-full flex items-center justify-center gap-2.5 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50/80 hover:border-slate-400 py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm cursor-pointer shadow-xs transition-all disabled:opacity-60"
          title={`Sign in with Google as ${role === 'host' ? 'Host' : 'Driver'}`}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" className="shrink-0">
            <path
              fill="#EA4335"
              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
            />
            <path
              fill="#FBBC05"
              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
            />
          </svg>
          <span className="font-bold">
            {googleLoading ? 'Connecting...' : `Continue with Google (${role === 'host' ? 'Host' : 'Driver'})`}
          </span>
        </button>

        <div className="flex items-center my-4.5 before:content-[''] before:flex-1 before:border-b before:border-slate-200 after:content-[''] after:flex-1 after:border-b after:border-slate-200">
          <span className="px-3 text-slate-400 text-[10px] font-bold tracking-wider uppercase">
            OR WITH EMAIL
          </span>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5" data-testid="auth-form">
          {mode === 'register' && (
            <div>
              <label htmlFor="auth-name" className="block text-xs font-bold text-slate-700 mb-1">
                {role === 'host' ? 'Host / Owner Full Name' : 'Driver Full Name'}
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-slate-400 text-sm pointer-events-none">👤</span>
                <input
                  id="auth-name"
                  type="text"
                  placeholder={role === 'host' ? 'e.g. Sundar Raman' : 'e.g. Rahul Sharma'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={mode === 'register'}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="block text-xs font-bold text-slate-700 mb-1">
              Email Address
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-400 text-sm pointer-events-none">✉️</span>
              <input
                id="auth-email"
                type="email"
                placeholder={role === 'host' ? 'host@nammaspot.com' : 'driver@nammaspot.com'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="auth-password" className="block text-xs font-bold text-slate-700">
                Password
              </label>
              {mode === 'register' && (
                <span className="text-[10px] text-slate-400">At least 6 characters</span>
              )}
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-400 text-sm pointer-events-none">🔒</span>
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full pl-10 pr-12 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400"
              />
              <button
                type="button"
                id="toggle-password-btn"
                className="absolute right-2 px-2 py-1 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            id="auth-submit-btn"
            disabled={loading || googleLoading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-600/15 hover:shadow-lg hover:shadow-emerald-600/25 cursor-pointer mt-2 disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Authenticating...</span>
              </>
            ) : mode === 'login' ? (
              <span>Sign In</span>
            ) : (
              <span>Create {role === 'host' ? 'Host' : 'Driver'} Account</span>
            )}
          </button>
        </form>

        {/* Feedback Messages */}
        {error && (
          <div
            role="alert"
            className="mt-3.5 p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-semibold text-center flex items-center justify-center gap-2"
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
        {infoMsg && (
          <div
            role="status"
            className="mt-3.5 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold text-center flex items-center justify-center gap-2"
          >
            <span>✓</span>
            <span>{infoMsg}</span>
          </div>
        )}

        {/* Toggle Mode Link */}
        <div className="text-center mt-5 pt-4 border-t border-slate-100">
          <button
            type="button"
            id="toggle-auth-mode-btn"
            className="text-xs text-slate-600 hover:text-emerald-700 font-semibold cursor-pointer"
            onClick={() => {
              setError('');
              setInfoMsg('');
              setMode(mode === 'login' ? 'register' : 'login');
            }}
          >
            {mode === 'login' ? (
              <>
                New to Namma Spots?{' '}
                <strong className="text-emerald-600 hover:underline">Create an account</strong>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <strong className="text-emerald-600 hover:underline">Sign in</strong>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Explicit displayName for React Developer Tools
Auth.displayName = 'Auth';
