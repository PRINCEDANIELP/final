import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { signInWithGoogle } from '../firebase.js';
import { api } from '../api.js';

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

  // Sync role if query parameter changes
  useEffect(() => {
    const qRole = searchParams.get('role');
    if (qRole === 'host' || qRole === 'driver') {
      setRole(qRole);
    }
  }, [searchParams]);

  // Helper to redirect user to appropriate portal based on role and profile completion status
  const handleRedirectAfterAuth = (authenticatedUser, wasRegistration = false) => {
    const isHostRole = authenticatedUser.role === 'host' || role === 'host';
    const cleanPhone = (authenticatedUser.phone || '').replace(/\D/g, '');
    const cleanAadhaar = (authenticatedUser.aadhaarNumber || '').replace(/\D/g, '');
    const hasAadhaarPhoto = Boolean(authenticatedUser.aadhaarPhotoUrl);
    const hasLocation = Boolean(authenticatedUser.city?.trim() || authenticatedUser.address?.trim());

    if (isHostRole) {
      // Host requirements: Name, 10-digit Phone, 12-digit Aadhaar, Aadhaar Photo Upload, Location (City/Address)
      const isHostProfileComplete = Boolean(
        authenticatedUser.name?.trim() &&
        cleanPhone.length >= 10 &&
        cleanAadhaar.length >= 12 &&
        hasAadhaarPhoto &&
        hasLocation
      );

      if (wasRegistration || !isHostProfileComplete) {
        // If profile details missing, route host to fill details first!
        window.location.href = wasRegistration ? '/profile?new=true' : '/profile?incomplete=true';
      } else {
        window.location.href = '/host';
      }
      return;
    }

    // Driver flow: check whether contact & KYC verification documents are completed
    const hasLicence = Boolean(
      authenticatedUser.licenceNumber && authenticatedUser.licenceNumber.trim().length >= 4
    );

    const isProfileComplete = Boolean(
      authenticatedUser.name?.trim() &&
      cleanPhone.length >= 10 &&
      cleanAadhaar.length >= 12 &&
      authenticatedUser.aadhaarPhotoUrl &&
      hasLicence &&
      authenticatedUser.licencePhotoUrl
    );

    if (wasRegistration || !isProfileComplete) {
      // First complete profile detail!
      window.location.href = wasRegistration ? '/profile?new=true' : '/profile?incomplete=true';
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
          : { email: email.trim(), password, role };

      const data = await api(path, {
        method: 'POST',
        body: payload,
      });

      if (!data || !data.token) {
        throw new Error('Authentication failed. Please check your credentials.');
      }

      // Persist auth token and user profile
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify({ ...data.user, role: role || data.user?.role }));

      // Redirect user directly based on role and profile completion
      handleRedirectAfterAuth({ ...data.user, role: role || data.user?.role }, mode === 'register');
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

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify({ ...data.user, role }));

      handleRedirectAfterAuth({ ...data.user, role }, false);
    } catch (err) {
      setError(err.message || 'Google Sign-in failed or was closed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="w-full min-h-[82vh] flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-7 sm:p-9 border border-slate-200/90 shadow-xl shadow-slate-200/50 mx-auto transition-all">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <img
            src="/logo.png"
            alt="Namma Spots"
            className="h-16 w-auto object-contain mb-3 drop-shadow-sm hover:scale-105 transition-transform"
          />
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            {mode === 'login'
              ? 'Sign in to access your parking reservations & portal'
              : 'Join Namma Spots to find or host parking spaces'}
          </p>
        </div>

        {/* Portal / Role Selector Toggle */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              I am signing in as:
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              {role === 'driver' ? '🚗 Driver Account' : '🅿️ Host Account'}
            </span>
          </div>

          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl gap-1 border border-slate-200/60">
            <button
              type="button"
              onClick={() => {
                setRole('driver');
                setError('');
              }}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                role === 'driver'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 bg-transparent'
              }`}
            >
              <span>🚗</span>
              <span>Driver</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRole('host');
                setError('');
              }}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                role === 'host'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 bg-transparent'
              }`}
            >
              <span>🅿️</span>
              <span>Host</span>
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs (Sign In vs Create Account) */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-5 gap-1 border border-slate-200/60">
          <button
            type="button"
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

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          className="w-full flex items-center justify-center gap-2.5 bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm cursor-pointer shadow-xs transition-all disabled:opacity-60"
          title="Sign in with Google"
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
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
          <span>{googleLoading ? 'Connecting...' : `Continue with Google (${role === 'host' ? 'Host' : 'Driver'})`}</span>
        </button>

        {/* Divider */}
        <div className="flex items-center my-4 before:content-[''] before:flex-1 before:border-b before:border-slate-200 after:content-[''] after:flex-1 after:border-b after:border-slate-200">
          <span className="px-3 text-slate-400 text-[10px] font-bold tracking-wider uppercase">OR WITH EMAIL</span>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {role === 'host' ? 'Host / Owner Full Name' : 'Driver Full Name'}
              </label>
              <input
                type="text"
                placeholder={role === 'host' ? 'e.g. Sundar Raman' : 'e.g. Rahul Sharma'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={mode === 'register'}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              placeholder={role === 'host' ? 'host@example.com' : 'driver@example.com'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                Password
              </label>
              {mode === 'register' && (
                <span className="text-[10px] text-slate-400 font-medium">Min. 6 characters</span>
              )}
            </div>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3.5 py-2.5 pr-12 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-slate-400"
              />
              <button
                type="button"
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
            disabled={loading || googleLoading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-700/20 hover:shadow-lg cursor-pointer mt-1 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : mode === 'login' ? (
              <span>Sign In as {role === 'host' ? 'Host' : 'Driver'}</span>
            ) : (
              <span>Create {role === 'host' ? 'Host' : 'Driver'} Account</span>
            )}
          </button>
        </form>

        {/* Feedback Messages */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-semibold text-center flex items-center justify-center gap-1.5">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
        {infoMsg && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold text-center flex items-center justify-center gap-1.5">
            <span>✓</span>
            <span>{infoMsg}</span>
          </div>
        )}

        {/* Footer Toggle Mode Link */}
        <div className="text-center mt-6 pt-4 border-t border-slate-100">
          <button
            type="button"
            className="text-xs text-emerald-600 hover:text-emerald-700 font-bold cursor-pointer hover:underline transition-colors"
            onClick={() => {
              setError('');
              setInfoMsg('');
              setMode(mode === 'login' ? 'register' : 'login');
            }}
          >
            {mode === 'login'
              ? "Don't have an account? Sign up here"
              : 'Already have an account? Sign in here'}
          </button>
        </div>
      </div>
    </div>
  );
}
