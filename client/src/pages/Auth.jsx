import React, { useState, useEffect, useDebugValue } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  signInWithGoogle,
  registerWithFirebase,
  loginWithFirebase,
  getFirebaseErrorMessage,
} from '../firebase.js';
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
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [licenceNumber, setLicenceNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');

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
      if (mode === 'register') {
        // 1. First, register user in Firebase Auth
        let fbUid = '';
        try {
          const fbUser = await registerWithFirebase(email, password, name);
          if (fbUser && fbUser.uid) {
            fbUid = fbUser.uid;
          }
        } catch (fbErr) {
          if (fbErr.code === 'auth/email-already-in-use') {
            setError('This email is already registered. Please sign in with your password.');
            setMode('login');
            setPassword('');
            setLoading(false);
            return;
          }
          if (fbErr.code === 'auth/weak-password' || fbErr.code === 'auth/invalid-email') {
            setError(getFirebaseErrorMessage(fbErr));
            setLoading(false);
            return;
          }
          console.warn('[Firebase Register note]:', fbErr.message);
        }

        // 2. Persist full driver / host registration details in database
        const payload = {
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          phone: phone.trim(),
          city: city.trim(),
          address: address.trim(),
          licenceNumber: licenceNumber.trim(),
          vehicleNumber: vehicleNumber.trim(),
          firebaseUid: fbUid,
        };

        const data = await api('/auth/register', {
          method: 'POST',
          body: payload,
        });

        if (!data || !data.user) {
          throw new Error('Registration failed. Please try again.');
        }

        // Account successfully created in DB and Firebase!
        // Transition to Sign In mode, clear password, and prompt user
        setPassword('');
        setMode('login');
        setInfoMsg(
          data.message ||
            'Account created successfully in database and Firebase! Please sign in with your email and password.'
        );
        return;
      }

      // 2. Sign In mode:
      // First verify credentials against backend database (MongoDB Atlas)
      const data = await api('/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password },
      });

      if (!data || !data.token) {
        throw new Error('Invalid email or password. Please check your credentials.');
      }

      // Also authenticate with Firebase Auth to keep Firebase session active
      try {
        await loginWithFirebase(email, password, data.user?.name);
      } catch (fbLoginErr) {
        console.warn('[Firebase Login note]:', fbLoginErr.message);
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
      setError(getFirebaseErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth Sign-In (with popup + domain resilience for Vercel)
  const handleGoogleSignIn = async () => {
    setError('');
    setInfoMsg('');
    setGoogleLoading(true);
    try {
      // 1. Request Google sign-in passing selected role and current input values
      const gResult = await signInWithGoogle(role, email, name);

      // If user deliberately closed popup, show friendly non-blocking notice
      if (gResult.cancelled) {
        setInfoMsg(gResult.message || 'Google sign-in window was closed.');
        setGoogleLoading(false);
        return;
      }

      // 2. Synchronize Google account with backend MongoDB Atlas
      const data = await api('/auth/google', {
        method: 'POST',
        body: {
          email: gResult.email,
          name: gResult.displayName || (role === 'host' ? 'Google Host' : 'Google Driver'),
          uid: gResult.uid,
          photoUrl: gResult.photoURL,
          role,
        },
      });

      if (!data || !data.token) {
        throw new Error('Failed to synchronize Google account with database.');
      }

      const serverUser = data.user || {};
      const actualRole = serverUser.role || role || 'driver';
      const userProfile = { ...serverUser, role: actualRole };

      // Persist auth token and user profile
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(userProfile));
      window.dispatchEvent(new Event('auth-change'));

      // Redirect user directly to authorized portal
      handleRedirectAfterAuth(userProfile);
    } catch (err) {
      setError(getFirebaseErrorMessage(err));
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
        {/* Top accent border */}
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
              ? 'Sign in to access your Namma Spots portal'
              : `Register your new ${role === 'host' ? 'Host' : 'Driver'} account in database`}
          </p>
        </div>

        {/* Mode Selector Tabs (Sign In vs Create Account) */}
        <div className="flex bg-slate-100/70 p-1 rounded-xl mb-4 gap-1 border border-slate-200/50">
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

        {/* Account Role Selector (Only shown or highlighted for clarity) */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
              {mode === 'register' ? 'Account Type' : 'Select Portal'}
            </span>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              {role === 'driver' ? 'Driver Account' : 'Space Host'}
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
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                role === 'driver'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              {/* Clean Car Vector SVG */}
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.9 2 11.2 2 11.5V16c0 .6.4 1 1 1h2" />
                <circle cx="7" cy="17" r="2" />
                <circle cx="17" cy="17" r="2" />
              </svg>
              <span className="truncate">Driver Portal</span>
            </button>

            <button
              type="button"
              id="role-host-btn"
              onClick={() => {
                setRole('host');
                setError('');
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                role === 'host'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              {/* Clean Parking P Vector SVG */}
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="4" />
                <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
              </svg>
              <span className="truncate">Host Dashboard</span>
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-semibold text-center flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4 text-red-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}
        {infoMsg && (
          <div
            role="status"
            className="mb-4 p-3.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold text-center flex items-center justify-center gap-2 shadow-xs"
          >
            <svg className="w-4 h-4 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{infoMsg}</span>
          </div>
        )}

        {/* Google 1-Click Sign-In */}
        <button
          type="button"
          id="google-signin-btn"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          className="w-full flex items-center justify-center gap-2.5 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50/80 hover:border-slate-400 py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm cursor-pointer shadow-xs transition-all disabled:opacity-60 mb-4"
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

        <div className="flex items-center mb-4 before:content-[''] before:flex-1 before:border-b before:border-slate-200 after:content-[''] after:flex-1 after:border-b after:border-slate-200">
          <span className="px-3 text-slate-400 text-[10px] font-bold tracking-wider uppercase">
            OR WITH EMAIL
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" data-testid="auth-form">
          {mode === 'register' && (
            <>
              {/* Full Name */}
              <div>
                <label htmlFor="auth-name" className="block text-xs font-bold text-slate-700 mb-1">
                  {role === 'host' ? 'Host / Owner Full Name' : 'Driver Full Name'}
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <input
                    id="auth-name"
                    type="text"
                    placeholder={role === 'host' ? 'e.g. Sundar Raman' : 'e.g. Rahul Sharma'}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Mobile Phone Number */}
              <div>
                <label htmlFor="auth-phone" className="block text-xs font-bold text-slate-700 mb-1">
                  Mobile Phone Number
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </span>
                  <input
                    id="auth-phone"
                    type="tel"
                    placeholder="+91 98401 23456"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* City / Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="auth-city" className="block text-xs font-bold text-slate-700 mb-1">
                    City / Town
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 pointer-events-none">
                      <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </span>
                    <input
                      id="auth-city"
                      type="text"
                      placeholder="e.g. Chennai"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="auth-detail" className="block text-xs font-bold text-slate-700 mb-1">
                    {role === 'host' ? 'Bay Address' : 'Vehicle Number'}
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 pointer-events-none">
                      <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="5" width="20" height="14" rx="2" />
                        <line x1="2" y1="10" x2="22" y2="10" />
                      </svg>
                    </span>
                    {role === 'host' ? (
                      <input
                        id="auth-detail"
                        type="text"
                        placeholder="e.g. T. Nagar"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400"
                      />
                    ) : (
                      <input
                        id="auth-detail"
                        type="text"
                        placeholder="TN09AB1234"
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400"
                      />
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Email Address */}
          <div>
            <label htmlFor="auth-email" className="block text-xs font-bold text-slate-700 mb-1">
              Email Address
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 pointer-events-none">
                <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </span>
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

          {/* Password */}
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
              <span className="absolute left-3.5 pointer-events-none">
                <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full pl-10 pr-11 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400"
              />
              <button
                type="button"
                id="toggle-password-btn"
                className="absolute right-3 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                    <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                    <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                    <line x1="2" y1="2" x2="22" y2="22" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
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
                <span>{mode === 'register' ? 'Creating Account in DB...' : 'Signing In...'}</span>
              </>
            ) : mode === 'login' ? (
              <span>Sign In</span>
            ) : (
              <span>Create {role === 'host' ? 'Host' : 'Driver'} Account</span>
            )}
          </button>
        </form>

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
                New user? First{' '}
                <strong className="text-emerald-600 hover:underline">Create an Account</strong>
              </>
            ) : (
              <>
                Already registered?{' '}
                <strong className="text-emerald-600 hover:underline">Sign In here</strong>
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
