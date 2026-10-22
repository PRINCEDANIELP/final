import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import Auth from './pages/Auth.jsx';
import Search from './pages/Search.jsx';
import Host from './pages/Host.jsx';
import BookingOutput from './pages/BookingOutput.jsx';
import MyBookings from './pages/MyBookings.jsx';
import Profile from './pages/Profile.jsx';
import { logoutUser } from './firebase.js';

function NavigationBar({ user, logout }) {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;
  const isHost = user?.role === 'host';
  const isDriver = user && !isHost;

  return (
    <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs print:hidden">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link to={isHost ? '/host' : '/'} className="flex items-center gap-2.5 text-slate-900 no-underline shrink-0">
          <img src="/logo.png" alt="Namma Spots" className="h-10 sm:h-12 w-auto object-contain" />
          <span className="text-xl font-black tracking-tight text-slate-900">Namma Spots</span>
          <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200 hidden sm:inline-block">
            {isHost ? 'Host Portal' : 'Smart Parking'}
          </span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              {/* Desktop Navigation Links */}
              <div className="hidden md:flex items-center gap-1.5">
                {isDriver && (
                  <>
                    <Link
                      to="/"
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                        isActive('/')
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'text-slate-700 hover:text-emerald-700 hover:bg-slate-100'
                      }`}
                    >
                      Find Parking
                    </Link>
                    <Link
                      to="/my-bookings"
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                        isActive('/my-bookings')
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'text-slate-700 hover:text-emerald-700 hover:bg-slate-100'
                      }`}
                    >
                      My Bookings
                    </Link>
                    <Link
                      to="/output"
                      className={`inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                        isActive('/output') || isActive('/booking')
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'text-slate-700 hover:text-emerald-700 hover:bg-slate-100'
                      }`}
                    >
                      Digital Pass
                    </Link>
                  </>
                )}

                {isHost && (
                  <Link
                    to="/host"
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                      isActive('/host')
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'text-slate-700 hover:text-emerald-700 hover:bg-slate-100'
                    }`}
                  >
                    Host Dashboard
                  </Link>
                )}

                <Link
                  to="/profile"
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                    isActive('/profile')
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'text-slate-700 hover:text-emerald-700 hover:bg-slate-100'
                  }`}
                  title="Profile & KYC Verification"
                >
                  Profile & ID
                  {user.isVerified ? (
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded-full">
                      Verified
                    </span>
                  ) : (
                    <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-1.5 py-0.5 rounded-full">
                      Verify ID
                    </span>
                  )}
                </Link>
              </div>

              {/* User Identity Pill */}
              <div className="hidden lg:flex items-center gap-2 py-1 px-2.5 bg-slate-100 border border-slate-200 rounded-full">
                <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                  {user.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
                <span className="text-xs font-bold text-slate-800 max-w-[110px] truncate">{user.name}</span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded uppercase bg-slate-200 text-slate-700">
                  {isHost ? 'Host' : 'Driver'}
                </span>
              </div>

              <button
                onClick={logout}
                className="bg-white border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                title="Sign out"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold px-3.5 py-1.5 rounded-lg transition-colors shadow-xs"
            >
              Sign In
            </Link>
          )}
        </nav>
      </div>

      {/* Mobile Horizontal Navigation Bar for Authenticated Users */}
      {user && (
        <div className="md:hidden flex items-center gap-1.5 px-3 py-2 bg-slate-50 border-t border-slate-200 overflow-x-auto no-scrollbar print:hidden">
          {isDriver && (
            <>
              <Link
                to="/"
                className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors ${
                  isActive('/') ? 'bg-emerald-600 text-white' : 'text-slate-700 bg-white border border-slate-200'
                }`}
              >
                🔍 Find Parking
              </Link>
              <Link
                to="/my-bookings"
                className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors ${
                  isActive('/my-bookings') ? 'bg-emerald-600 text-white' : 'text-slate-700 bg-white border border-slate-200'
                }`}
              >
                📋 My Bookings
              </Link>
              <Link
                to="/output"
                className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors ${
                  isActive('/output') || isActive('/booking')
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-700 bg-white border border-slate-200'
                }`}
              >
                🎫 Digital Pass
              </Link>
            </>
          )}

          {isHost && (
            <Link
              to="/host"
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors ${
                isActive('/host') ? 'bg-emerald-600 text-white' : 'text-slate-700 bg-white border border-slate-200'
              }`}
            >
              🅿️ Host Dashboard
            </Link>
          )}

          <Link
            to="/profile"
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-colors ${
              isActive('/profile') ? 'bg-emerald-600 text-white' : 'text-slate-700 bg-white border border-slate-200'
            }`}
          >
            👤 Profile & ID
          </Link>
        </div>
      )}
    </header>
  );
}

export default function App() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const isHost = user?.role === 'host';

  const logout = async () => {
    await logoutUser();
    window.location.href = '/login';
  };

  return (
    <BrowserRouter>
      <NavigationBar user={user} logout={logout} />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Routes>
          <Route path="/login" element={<Auth />} />

          {/* Find Parking: Accessible to Driver authenticated users */}
          <Route
            path="/"
            element={
              user ? (
                isHost ? <Navigate to="/host" replace /> : <Search />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* Host Dashboard: Accessible to Host authenticated users */}
          <Route
            path="/host"
            element={
              user ? (
                isHost ? <Host /> : <Navigate to="/" replace />
              ) : (
                <Navigate to="/login?role=host" replace />
              )
            }
          />

          {/* Booking Output Page: Accessible directly or via ID */}
          <Route path="/booking/:id" element={<BookingOutput />} />
          <Route path="/booking" element={<BookingOutput />} />
          <Route path="/output" element={<BookingOutput />} />

          {/* Driver My Bookings */}
          <Route
            path="/my-bookings"
            element={
              user ? (
                isHost ? <Navigate to="/host" replace /> : <MyBookings />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          {/* Driver & Host Profile & ID Verification */}
          <Route
            path="/profile"
            element={user ? <Profile /> : <Navigate to="/login" replace />}
          />

          <Route path="*" element={<Navigate to={isHost ? '/host' : '/'} replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
