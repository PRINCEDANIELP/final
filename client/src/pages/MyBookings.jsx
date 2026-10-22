import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();

  const load = async () => {
    try {
      setLoading(true);
      const data = await api('/bookings/mine');
      setBookings(data || []);
      setLoading(false);
    } catch (err) {
      setMsg(err.message || 'Failed to load bookings');
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredBookings = bookings.filter((b) => {
    if (filter === 'ACTIVE') return b.status === 'CONFIRMED' || b.status === 'ACTIVE';
    if (filter === 'COMPLETED') return b.status === 'COMPLETED';
    return true;
  });

  const totalSpent = bookings.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
  const activeCount = bookings.filter((b) => b.status === 'CONFIRMED' || b.status === 'ACTIVE').length;

  const renderStatus = (status) => {
    if (status === 'CONFIRMED') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide bg-amber-100 text-amber-900 border border-amber-300">
          Confirmed · Ready
        </span>
      );
    }
    if (status === 'ACTIVE') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide bg-emerald-100 text-emerald-900 border border-emerald-300 relative">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
          Active · Parked
        </span>
      );
    }
    if (status === 'COMPLETED') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide bg-slate-200 text-slate-700">
          Completed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide bg-slate-100 text-slate-800 border border-slate-200">
        {status}
      </span>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            My Parking Passes & Bookings
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage your active reservations, digital passes, and payment receipts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer"
          >
            + Book New Spot
          </Link>
        </div>
      </div>

      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-sm font-semibold">
          {msg}
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-xs">
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Total Bookings
          </span>
          <span className="block text-2xl font-black text-slate-900 mt-1">
            {bookings.length}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-xs">
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Active Passes
          </span>
          <span className="block text-2xl font-black text-emerald-600 mt-1">
            {activeCount}
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4.5 shadow-xs">
          <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
            Total Spent
          </span>
          <span className="block text-2xl font-black text-slate-900 mt-1">
            ₹{totalSpent}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          className={`py-1.5 px-4 rounded-lg text-xs font-bold cursor-pointer transition-all ${
            filter === 'ALL'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
          }`}
          onClick={() => setFilter('ALL')}
        >
          All ({bookings.length})
        </button>
        <button
          className={`py-1.5 px-4 rounded-lg text-xs font-bold cursor-pointer transition-all ${
            filter === 'ACTIVE'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
          }`}
          onClick={() => setFilter('ACTIVE')}
        >
          Active / Upcoming ({activeCount})
        </button>
        <button
          className={`py-1.5 px-4 rounded-lg text-xs font-bold cursor-pointer transition-all ${
            filter === 'COMPLETED'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
          }`}
          onClick={() => setFilter('COMPLETED')}
        >
          Completed ({bookings.filter((b) => b.status === 'COMPLETED').length})
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center p-12 gap-3 text-slate-500">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="text-sm font-semibold">Loading your parking history...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredBookings.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
          <div className="w-14 h-14 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7h8m-8 4h8m-8 4h5M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-slate-900">No parking passes found</h3>
          <p className="text-slate-500 text-sm mt-1">
            {filter === 'ALL'
              ? "You haven't booked any parking spaces yet. Find an available slot in seconds!"
              : `No bookings found matching '${filter}'.`}
          </p>
          <button
            className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer"
            onClick={() => navigate('/')}
          >
            Search Nearby Parking
          </button>
        </div>
      )}

      {/* Booking List Cards */}
      <div className="flex flex-col gap-4">
        {filteredBookings.map((b) => {
          const spot = b.spot || {};
          const start = new Date(b.startTime);
          const end = new Date(b.endTime);

          return (
            <div
              className="bg-white border border-slate-200 border-l-4 border-l-emerald-600 rounded-2xl p-5 shadow-xs flex flex-col gap-4"
              key={b._id}
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3.5">
                  {((spot.photos && spot.photos[0]) || spot.photoUrl) && (
                    <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-slate-200 border border-slate-200">
                      <img
                        src={(spot.photos && spot.photos[0]) || spot.photoUrl}
                        alt={spot.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {renderStatus(b.status)}
                      <span className="font-mono text-xs font-bold text-slate-400">
                        #{b._id.slice(-6).toUpperCase()}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 leading-tight">
                      {spot.title || 'Parking Spot'}
                    </h3>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {spot.address || 'Address provided upon confirmation'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Total Paid
                  </span>
                  <span className="text-xl font-extrabold text-emerald-600">
                    ₹{b.totalAmount}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                    VEHICLE
                  </span>
                  <strong className="font-mono text-sm font-black text-slate-900">
                    {b.vehicleNumber}
                  </strong>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                    TIME SLOT
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} →{' '}
                    {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <small className="text-[11px] text-slate-500">
                    {start.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </small>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                    CHECK-IN OTP
                  </span>
                  <strong className="font-mono text-sm font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md inline-block w-fit">
                    {b.otp}
                  </strong>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer"
                  onClick={() => navigate(`/booking/${b._id}`, { state: { booking: b } })}
                >
                  View Digital Pass / Output Receipt →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
