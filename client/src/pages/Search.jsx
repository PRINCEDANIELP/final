import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import {
  LOCATION_PRESETS,
  resolveUserLocation,
  searchLocationByQuery,
  haversineKm,
} from '../utils/location.js';
import LocationChips from '../components/LocationChips.jsx';
import LightboxModal from '../components/LightboxModal.jsx';

const TYPES = ['ALL', 'BIKE', 'HATCHBACK', 'SEDAN', 'SUV'];

function formatLocalDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

// Check if a driver's profile is complete before allowing spot reservations
function getDriverProfileStatus(user) {
  if (!user) return { isComplete: false, missing: ['Login Required'], hasPhone: false, hasAadhaar: false, hasLicence: false };
  const missing = [];
  const cleanPhone = (user.phone || '').replace(/\D/g, '');
  const cleanAadhaar = (user.aadhaarNumber || '').replace(/\D/g, '');
  const hasLicenceNum = Boolean(user.licenceNumber && user.licenceNumber.trim().length >= 4);

  if (!user.name?.trim()) missing.push('Full Name');
  if (!cleanPhone || cleanPhone.length < 10) missing.push('10-Digit Mobile Number');
  if (!cleanAadhaar || cleanAadhaar.length < 12) missing.push('12-Digit Aadhaar Number');
  if (!user.aadhaarPhotoUrl) missing.push('Aadhaar Document Photo');
  if (!hasLicenceNum) missing.push('Driving Licence Number');
  if (!user.licencePhotoUrl) missing.push('Driving Licence Document Photo');

  const hasPhone = Boolean(cleanPhone && cleanPhone.length >= 10);
  const hasAadhaar = Boolean(cleanAadhaar && cleanAadhaar.length >= 12 && user.aadhaarPhotoUrl);
  const hasLicence = Boolean(hasLicenceNum && user.licencePhotoUrl);

  return {
    isComplete: missing.length === 0,
    missing,
    hasPhone,
    hasAadhaar,
    hasLicence,
  };
}

export default function Search() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookSpotId = searchParams.get('bookSpot');

  const [spots, setSpots] = useState([]);
  const [vehicleType, setVehicleType] = useState('ALL');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Default coordinates (auto-updated on mount via multi-tier GPS)
  const [coords, setCoords] = useState({
    lat: 10.7181,
    lng: 79.0849,
    label: 'Vallam / Thanjavur, Tamil Nadu',
  });

  const [selected, setSelected] = useState(null);
  const [profilePromptSpot, setProfilePromptSpot] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [cardPhotoIndex, setCardPhotoIndex] = useState({});
  const [galleryModal, setGalleryModal] = useState(null); // { spot, activeIndex }

  const openGallery = (spot, index = 0) => {
    setGalleryModal({ spot, activeIndex: index });
  };

  const closeGallery = () => {
    setGalleryModal(null);
  };

  const nextCardPhoto = (spotId, totalPhotos) => {
    setCardPhotoIndex((prev) => ({
      ...prev,
      [spotId]: ((prev[spotId] || 0) + 1) % totalPhotos,
    }));
  };

  const prevCardPhoto = (spotId, totalPhotos) => {
    setCardPhotoIndex((prev) => ({
      ...prev,
      [spotId]: ((prev[spotId] || 0) - 1 + totalPhotos) % totalPhotos,
    }));
  };

  const user = JSON.parse(localStorage.getItem('user') || 'null');

  // Default times: starting in 15 mins, duration 2 hours
  const now = new Date();
  const defaultStart = new Date(now.getTime() + 15 * 60000);
  const defaultEnd = new Date(defaultStart.getTime() + 2 * 3600000);

  const [booking, setBooking] = useState({
    driverName: user?.name || '',
    driverPhone: user?.phone || '',
    vehicleNumber: 'TN49AB1234',
    startTime: formatLocalDateTime(defaultStart),
    endTime: formatLocalDateTime(defaultEnd),
  });

  const fetchSpots = async (latitude, longitude, type = vehicleType) => {
    setLoading(true);
    try {
      const typeParam = type && type !== 'ALL' ? `&vehicleType=${type}` : '';
      const data = await api(
        `/spots/nearby?lat=${latitude}&lng=${longitude}&radius=50000${typeParam}`
      );

      const processed = (data || []).map((spot) => {
        const sLng = spot.location?.coordinates?.[0] || 79.0849;
        const sLat = spot.location?.coordinates?.[1] || 10.7181;
        const distKm = haversineKm(latitude, longitude, sLat, sLng);
        const distText = distKm < 1 ? `${Math.round(distKm * 1000)} m away` : `${distKm.toFixed(1)} km away`;
        return { ...spot, calculatedDistanceKm: distKm, distanceText: distText };
      });

      // Sort strictly closest first
      processed.sort((a, b) => a.calculatedDistanceKm - b.calculatedDistanceKm);
      setSpots(processed);

      if (processed.length === 0) {
        setMsg(`No parking spots found within 50 km.`);
      }
    } catch (err) {
      setMsg(err.message || 'Error fetching spots');
    } finally {
      setLoading(false);
    }
  };

  // Auto-detect user's physical location immediately on page load
  useEffect(() => {
    let isMounted = true;

    const initLocationAndSpots = async () => {
      setGpsLoading(true);
      try {
        const loc = await resolveUserLocation();
        if (!isMounted) return;

        setCoords({
          lat: loc.lat,
          lng: loc.lng,
          label: loc.label,
        });

        await fetchSpots(loc.lat, loc.lng, vehicleType);

        if (!loc.isFallback) {
          const precision = loc.accuracy ? ` (±${loc.accuracy}m)` : '';
          setMsg(`✓ Location Detected: ${loc.label} via ${loc.tier}${precision}`);
        }
      } catch (err) {
        console.warn('Initial geolocation notice:', err);
        if (!isMounted) return;
        await fetchSpots(coords.lat, coords.lng, vehicleType);
      } finally {
        if (isMounted) setGpsLoading(false);
      }
    };

    initLocationAndSpots();
    return () => {
      isMounted = false;
    };
  }, []);

  // Manual High-Precision Hardware & Multi-tier GPS Trigger
  const searchWithGPS = async () => {
    setGpsLoading(true);
    setMsg('Detecting precise device GPS coordinates...');
    try {
      const loc = await resolveUserLocation();
      setCoords({
        lat: loc.lat,
        lng: loc.lng,
        label: loc.label,
      });
      await fetchSpots(loc.lat, loc.lng, vehicleType);
      const precision = loc.accuracy ? ` (±${loc.accuracy}m precision)` : '';
      setMsg(`✓ Precise Location Found: ${loc.label}${precision}`);
    } catch (err) {
      setMsg(`Location request: ${err.message}. Showing nearby spots.`);
    } finally {
      setGpsLoading(false);
    }
  };

  // Quick preset click handler
  const handleSelectPreset = (preset) => {
    setCoords({ lat: preset.lat, lng: preset.lng, label: preset.name });
    fetchSpots(preset.lat, preset.lng, vehicleType);
    setMsg(`✓ Showing parking spaces in ${preset.name}`);
  };

  // Real-time client-side instant filtering across query, vehicle category, and amenities
  const filteredSpots = spots.filter((spot) => {
    // 1. Vehicle category filter
    if (vehicleType && vehicleType !== 'ALL') {
      if (Array.isArray(spot.vehicleTypes) && !spot.vehicleTypes.includes(vehicleType)) {
        return false;
      }
    }

    // 2. Real-time query matching
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;

    const matchTitle = (spot.title || '').toLowerCase().includes(q);
    const matchAddress = (spot.address || '').toLowerCase().includes(q);
    const matchArea = (spot.area || '').toLowerCase().includes(q);
    const matchCity = (spot.city || '').toLowerCase().includes(q);
    const matchPincode = (spot.pincode || '').toLowerCase().includes(q);
    const matchHost = (spot.contactName || '').toLowerCase().includes(q);
    const matchAmenities =
      Array.isArray(spot.amenities) && spot.amenities.some((a) => a.toLowerCase().includes(q));

    return matchTitle || matchAddress || matchArea || matchCity || matchPincode || matchHost || matchAmenities;
  });

  const clearSearch = () => {
    setSearchQuery('');
    setMsg('');
  };

  const handleCustomSearch = async (e) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    // 1. If spots already match locally, keep focus and give feedback
    if (filteredSpots.length > 0) {
      setMsg(`Showing ${filteredSpots.length} matching parking spot${filteredSpots.length > 1 ? 's' : ''} for '${query}'.`);
      return;
    }

    setLoading(true);
    setMsg(`Searching coordinates for '${query}'...`);

    // 2. Direct match against loaded spots by title or address
    const matchingSpot = spots.find(
      (s) =>
        s.title?.toLowerCase().includes(query.toLowerCase()) ||
        s.address?.toLowerCase().includes(query.toLowerCase()) ||
        s.area?.toLowerCase().includes(query.toLowerCase()) ||
        s.city?.toLowerCase().includes(query.toLowerCase())
    );

    if (matchingSpot && matchingSpot.location?.coordinates) {
      const sLng = matchingSpot.location.coordinates[0];
      const sLat = matchingSpot.location.coordinates[1];
      setCoords({ lat: sLat, lng: sLng, label: matchingSpot.title });
      await fetchSpots(sLat, sLng, vehicleType);
      setMsg(`✓ Located parking bay: ${matchingSpot.title} (${matchingSpot.address})`);
      setLoading(false);
      return;
    }

    // 3. Query location via multi-tier geocoder
    try {
      const loc = await searchLocationByQuery(query);
      if (loc) {
        setCoords({ lat: loc.lat, lng: loc.lng, label: loc.label });
        await fetchSpots(loc.lat, loc.lng, vehicleType);
        setMsg(`✓ Located area: ${loc.label} (${loc.lat.toFixed(4)}° N, ${loc.lng.toFixed(4)}° E)`);
      } else {
        setMsg(`Could not pinpoint '${query}'. Showing available spots nearby.`);
        await fetchSpots(coords.lat, coords.lng, vehicleType);
      }
    } catch (err) {
      setMsg(`Search network notice: ${err.message}. Showing nearby spots.`);
    } finally {
      setLoading(false);
    }
  };


  const handleTypeChange = (e) => {
    const newType = e.target.value;
    setVehicleType(newType);
    fetchSpots(coords.lat, coords.lng, newType);
  };

  const calculateEstimate = () => {
    if (!selected) return 0;
    const s = new Date(booking.startTime);
    const e = new Date(booking.endTime);
    const hours = Math.max(1, Math.ceil((e - s) / 3600000));
    return isNaN(hours) ? selected.hourlyRate : hours * selected.hourlyRate;
  };

  // Automatically open booking drawer if returning from profile completion (?bookSpot=xyz)
  useEffect(() => {
    if (bookSpotId && spots.length > 0 && !selected) {
      const match = spots.find((s) => String(s._id) === String(bookSpotId));
      if (match) {
        handleOpenBooking(match);
      }
    }
  }, [bookSpotId, spots]);

  const handleOpenBooking = (spot) => {
    const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
    if (!currentUser) {
      navigate('/login');
      return;
    }

    const status = getDriverProfileStatus(currentUser);
    if (!status.isComplete) {
      setProfilePromptSpot(spot);
      return;
    }

    const sTime = new Date(Date.now() + 5 * 60000);
    const eTime = new Date(sTime.getTime() + 2 * 3600000);
    setBooking({
      driverName: currentUser?.name || booking.driverName || 'Driver',
      driverPhone: currentUser?.phone || booking.driverPhone || '',
      vehicleNumber: booking.vehicleNumber || 'TN49AB1234',
      startTime: formatLocalDateTime(sTime),
      endTime: formatLocalDateTime(eTime),
    });
    setBookingError('');
    setSelected(spot);
  };

  const book = async (e) => {
    e.preventDefault();
    setBookingError('');
    setMsg('');
    setBookingLoading(true);

    const activeUser = JSON.parse(localStorage.getItem('user') || 'null');
    if (!activeUser) {
      navigate('/login');
      return;
    }

    const status = getDriverProfileStatus(activeUser);
    if (!status.isComplete) {
      setBookingError(`Profile completion required: Please add ${status.missing.join(', ')} before reserving a parking bay.`);
      setProfilePromptSpot(selected);
      setBookingLoading(false);
      return;
    }

    const s = new Date(booking.startTime);
    const end = new Date(booking.endTime);

    if (isNaN(s.getTime()) || isNaN(end.getTime())) {
      setBookingError('Please enter valid start and end reservation times.');
      setBookingLoading(false);
      return;
    }

    if (end <= s) {
      setBookingError('End Time must be after Start Time. Please adjust reservation duration.');
      setBookingLoading(false);
      return;
    }

    try {
      const b = await api('/bookings', {
        method: 'POST',
        body: {
          spotId: selected._id,
          driverName: (booking.driverName || '').trim() || (activeUser?.name || 'Driver'),
          driverPhone: (booking.driverPhone || '').trim() || (activeUser?.phone || ''),
          vehicleNumber: (booking.vehicleNumber || 'TN49AB1234').trim().toUpperCase(),
          startTime: s.toISOString(),
          endTime: end.toISOString(),
          aadhaarNumber: activeUser?.aadhaarNumber || '',
          aadhaarPhotoUrl: activeUser?.aadhaarPhotoUrl || '',
          licenceName: activeUser?.licenceName || activeUser?.name || '',
          licenceNumber: activeUser?.licenceNumber || '',
          licencePhotoUrl: activeUser?.licencePhotoUrl || '',
          isKycVerified: Boolean(activeUser?.aadhaarNumber && activeUser?.licenceNumber),
        },
      });

      // Clear selection and navigate immediately to the Output Page (Booking Confirmation & Digital Parking Pass)
      setSelected(null);
      navigate(`/booking/${b._id}`, { state: { booking: b } });
    } catch (err) {
      setBookingError(err.message || 'Failed to complete booking. Please try again.');
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Hero Search Section */}
      <div className="bg-gradient-to-br from-white to-emerald-50/50 border border-emerald-200 rounded-3xl p-6 sm:p-8 shadow-xs">
        <span className="inline-block bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full mb-3">
          Instant Parking Reservation
        </span>

        {/* Profile Completion Requirement Banner */}
        {(() => {
          const u = JSON.parse(localStorage.getItem('user') || 'null');
          if (!u) return null;
          const status = getDriverProfileStatus(u);
          if (status.isComplete) return null;
          return (
            <div className="mb-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-200/70 text-amber-900 flex items-center justify-center font-black shrink-0 text-xs">
                  ID
                </div>
                <div>
                  <strong className="block text-sm text-amber-900 font-extrabold mb-0.5">
                    Profile Completion Required to Book Parking
                  </strong>
                  <span>
                    To reserve parking bays, drivers must complete their contact details, 12-digit Aadhaar, and Driving Licence with photos. (Missing: <strong>{status.missing.join(', ')}</strong>)
                  </span>
                </div>
              </div>
              <Link
                to="/profile?incomplete=true"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl transition-colors shrink-0 shadow-xs flex items-center gap-1.5"
              >
                <span>Complete Profile Now</span>
                <span>→</span>
              </Link>
            </div>
          );
        })()}

        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Find Nearby Parking Spaces
        </h2>
        <p className="text-slate-500 text-sm mt-1">
          Real-time peer-to-peer parking spots. Instant OTP gate pass upon booking.
        </p>

        {/* Primary Controls Row */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 mt-6 items-end">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Vehicle Category</span>
              {vehicleType !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => {
                    setVehicleType('ALL');
                    fetchSpots(coords.lat, coords.lng, 'ALL');
                  }}
                  className="text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer"
                >
                  Reset to All
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => {
                const count =
                  t === 'ALL'
                    ? spots.length
                    : spots.filter((s) => Array.isArray(s.vehicleTypes) && s.vehicleTypes.includes(t)).length;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setVehicleType(t);
                      fetchSpots(coords.lat, coords.lng, t);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                      vehicleType === t
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                    }`}
                  >
                    <span>{t}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                        vehicleType === t
                          ? 'bg-emerald-700 text-emerald-100'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={searchWithGPS}
              type="button"
              className={`px-4 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-slate-800 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                gpsLoading ? 'cursor-wait opacity-75' : ''
              }`}
              title="Use GPS or Network IP to detect exact location"
              disabled={gpsLoading}
            >
              {gpsLoading ? 'Detecting GPS...' : '📍 Use My GPS'}
            </button>
            <button
              onClick={() => fetchSpots(coords.lat, coords.lng, vehicleType)}
              type="button"
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all cursor-pointer"
            >
              Refresh Spots
            </button>
          </div>
        </div>

        {/* Custom Location & Real-Time Spot Search Bar */}
        <form onSubmit={handleCustomSearch} className="mt-4">
          <div className="flex items-center bg-white border border-slate-300 rounded-xl overflow-hidden focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all shadow-xs">
            <span className="px-3.5 text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by spot name, address, town, or amenities (e.g. Vallam, CCTV, Covered, Bay 3...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-2.5 pr-2 text-sm text-slate-900 outline-none border-none bg-transparent"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="px-2.5 py-1 text-slate-400 hover:text-slate-700 text-xs font-black cursor-pointer"
                title="Clear search query"
              >
                ✕
              </button>
            )}
            <button
              type="submit"
              className="bg-slate-900 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-3 transition-colors shrink-0 cursor-pointer"
            >
              Search Area
            </button>
          </div>
        </form>

        {/* Popular Quick Search Filter Chips */}
        <div className="flex items-center gap-1.5 mt-2.5 flex-wrap text-xs">
          <span className="text-slate-500 font-semibold text-[11px]">Quick filters:</span>
          {['Vallam', 'Thanjavur', 'CCTV Monitored', 'Covered Roof', 'Gated Security', 'EV Charging'].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setSearchQuery(tag)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all cursor-pointer ${
                searchQuery.toLowerCase() === tag.toLowerCase()
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {tag}
            </button>
          ))}
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="text-[11px] text-red-600 font-bold hover:underline ml-1 cursor-pointer"
            >
              Clear Filter
            </button>
          )}
        </div>

        {/* 1-Click Popular Location Preset Chips */}
        <LocationChips
          activeCoords={coords}
          onSelectPreset={handleSelectPreset}
          onAutoDetectGps={searchWithGPS}
          gpsLoading={gpsLoading}
        />

        <div className="mt-3">
          <small className="text-xs text-slate-500">
            Viewing available spots near: <strong className="text-slate-800">{coords.label}</strong> (Lat: {coords.lat?.toFixed(4)}, Lng: {coords.lng?.toFixed(4)})
          </small>
        </div>
      </div>


      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-sm font-semibold flex items-center justify-between gap-2">
          <span>{msg}</span>
          <button
            type="button"
            onClick={() => setMsg('')}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Loading Spinner */}
      {loading && (
        <div className="flex flex-col items-center justify-center p-12 gap-3 text-slate-500">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="text-sm font-semibold">Scanning nearby verified parking spots in {coords.label}...</p>
        </div>
      )}

      {/* Spots Grid Header */}
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-bold text-slate-900">
            Available Spots ({filteredSpots.length})
          </h3>
          {searchQuery && (
            <span className="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              Filtered by "{searchQuery}"
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="text-xs text-slate-600 hover:text-emerald-700 font-bold underline cursor-pointer"
            >
              Show All ({spots.length})
            </button>
          )}
          <span className="text-xs font-semibold text-slate-500">Sorted by nearest distance</span>
        </div>
      </div>

      {/* Empty Search Results State */}
      {filteredSpots.length === 0 && !loading && (
        <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-xs flex flex-col items-center justify-center max-w-xl mx-auto my-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl font-black mb-3">
            🔍
          </div>
          <h4 className="text-lg font-bold text-slate-900 mb-1">
            {searchQuery ? `No parking spaces found matching "${searchQuery}"` : 'No parking spaces found'}
          </h4>
          <p className="text-sm text-slate-500 mb-5 max-w-md">
            {searchQuery
              ? 'Try checking for typos, using a broader search term like "Vallam", or clearing your filters.'
              : `No spots currently match the "${vehicleType}" category in this 50 km radius.`}
          </p>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            {(searchQuery || vehicleType !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setVehicleType('ALL');
                  fetchSpots(coords.lat, coords.lng, 'ALL');
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Reset All Filters & Show All Spots
              </button>
            )}
            <button
              type="button"
              onClick={searchWithGPS}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-300 transition-colors cursor-pointer"
            >
              📍 Re-scan Device GPS
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredSpots.map((s) => {
          const spotPhotos = Array.isArray(s.photos) && s.photos.length > 0
            ? s.photos
            : (s.photoUrl ? [s.photoUrl] : []);
          const currIdx = cardPhotoIndex[s._id] || 0;
          const currentImg = spotPhotos[currIdx] || null;

          return (
            <div
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between"
              key={s._id}
            >
              {/* Photo Showcase Top Banner */}
              <div className="relative h-44 w-full bg-slate-900 overflow-hidden group">
                {currentImg ? (
                  <>
                    <img
                      src={currentImg}
                      alt={s.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                      onClick={() => openGallery(s, currIdx)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

                    {/* Photo count badge / View all */}
                    <button
                      type="button"
                      onClick={() => openGallery(s, currIdx)}
                      className="absolute top-2.5 right-2.5 bg-slate-900/80 hover:bg-slate-900 text-white text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-xs border border-white/20 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                      title="Click to view all photos"
                    >
                      <span>{currIdx + 1}/{spotPhotos.length}</span>
                    </button>

                    {/* Quick navigation arrows if multiple photos */}
                    {spotPhotos.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            prevCardPhoto(s._id, spotPhotos.length);
                          }}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border border-white/20"
                          title="Previous photo"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            nextCardPhoto(s._id, spotPhotos.length);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border border-white/20"
                          title="Next photo"
                        >
                          ›
                        </button>
                        {/* Dot indicators */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 pointer-events-none">
                          {spotPhotos.map((_, pIdx) => (
                            <span
                              key={pIdx}
                              className={`h-1.5 rounded-full transition-all ${pIdx === currIdx ? 'bg-white w-3' : 'bg-white/50 w-1.5'
                                }`}
                            />
                          ))}
                        </div>
                      </>
                    )}

                    {/* Click to expand hint overlay */}
                    <button
                      type="button"
                      onClick={() => openGallery(s, currIdx)}
                      className="absolute bottom-2 left-2 text-[10px] font-bold text-white bg-black/50 hover:bg-black/70 px-2 py-0.5 rounded backdrop-blur-xs cursor-pointer border border-white/10 flex items-center gap-1"
                    >
                      <span>View All Photos</span>
                    </button>
                  </>
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-emerald-800 to-slate-900 flex items-center justify-between p-4 text-white">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 p-1">
                        <img src="/logo.png" alt="Namma Spots" className="h-20 w-auto object-contain" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Portico Bay</span>
                        <p className="text-xs font-semibold text-white/90">Gated Parking Space</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold bg-white/15 px-2 py-1 rounded-full border border-white/10">
                      Verified Host
                    </span>
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-1.5">
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      Verified Host
                    </span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {s.distanceText || (s.distance ? (s.distance < 1000 ? `${Math.round(s.distance)} m away` : `${(s.distance / 1000).toFixed(1)} km away`) : 'Nearby')}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 leading-snug">{s.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{s.address}</p>
                  <p className="text-xs text-slate-600 mt-1.5 flex items-center gap-1.5 font-medium">
                    <span>Host: <strong className="text-slate-800">{s.contactName || 'Verified Host'}</strong></span>
                  </p>

                  <div className="flex gap-1.5 flex-wrap my-3">
                    {(s.vehicleTypes || ['SEDAN']).map((vt) => (
                      <span
                        className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded"
                        key={vt}
                      >
                        {vt}
                      </span>
                    ))}
                    {(s.amenities || []).slice(0, 3).map((am) => (
                      <span
                        key={am}
                        className="text-[10px] font-semibold bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 rounded"
                      >
                        {am}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-slate-100 pt-3 mt-2">
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-sm font-bold text-slate-900">₹</span>
                    <span className="text-2xl font-black text-slate-900">{s.hourlyRate}</span>
                    <span className="text-xs text-slate-500">/hour</span>
                  </div>
                  {(() => {
                    const u = JSON.parse(localStorage.getItem('user') || 'null');
                    const isComplete = u ? getDriverProfileStatus(u).isComplete : false;
                    return isComplete ? (
                      <button
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1"
                        onClick={() => handleOpenBooking(s)}
                      >
                        <span>Book This Slot</span>
                        <span>→</span>
                      </button>
                    ) : (
                      <button
                        className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                        onClick={() => handleOpenBooking(s)}
                        title="Complete Profile & ID Verification to Book"
                      >
                        <span>Complete Profile to Book</span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Booking Form Drawer / Modal */}
      {selected && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            className="w-full max-w-lg bg-white rounded-2xl p-6 sm:p-7 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto"
            onSubmit={book}
          >
            <div className="flex justify-between items-start mb-5 pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                  Confirm Reservation
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">{selected.title}</h3>
                <p className="text-xs text-slate-500">{selected.address}</p>
              </div>
              <button
                type="button"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
                onClick={() => setSelected(null)}
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Spot Photo Preview Header inside Booking Drawer */}
              {(() => {
                const selPhotos = Array.isArray(selected.photos) && selected.photos.length > 0
                  ? selected.photos
                  : (selected.photoUrl ? [selected.photoUrl] : []);
                if (!selPhotos.length) return null;
                return (
                  <div className="mb-1">
                    <div className="relative h-40 w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-200">
                      <img
                        src={selPhotos[0]}
                        alt={selected.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                      <button
                        type="button"
                        onClick={() => openGallery(selected, 0)}
                        className="absolute bottom-2.5 right-2.5 bg-slate-900/90 hover:bg-black text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-white/20 flex items-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <svg className="w-3.5 h-3.5 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>View All {selPhotos.length} Photos</span>
                      </button>
                    </div>
                    {selPhotos.length > 1 && (
                      <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                        {selPhotos.map((p, idx) => (
                          <img
                            key={idx}
                            src={p}
                            alt=""
                            onClick={() => openGallery(selected, idx)}
                            className="w-16 h-12 object-cover rounded-lg border-2 border-slate-200 hover:border-emerald-500 cursor-pointer shrink-0"
                            title="Click to view full photo"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Driver Contact Details */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col gap-3">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                  Driver Contact Details
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Kumar"
                      value={booking.driverName}
                      onChange={(e) => setBooking({ ...booking, driverName: e.target.value })}
                      required
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Contact Phone / Mobile *
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. +91 98401 23456"
                      value={booking.driverPhone}
                      onChange={(e) => setBooking({ ...booking, driverPhone: e.target.value })}
                      required
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Vehicle Registration Number (India) *
                </label>
                <input
                  placeholder="e.g. TN49AB1234 or TN09BX4521"
                  value={booking.vehicleNumber}
                  onChange={(e) =>
                    setBooking({ ...booking, vehicleNumber: e.target.value.toUpperCase() })
                  }
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Start Time
                  </label>
                  <input
                    type="datetime-local"
                    value={booking.startTime}
                    onChange={(e) => setBooking({ ...booking, startTime: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:border-emerald-600 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    End Time
                  </label>
                  <input
                    type="datetime-local"
                    value={booking.endTime}
                    onChange={(e) => setBooking({ ...booking, endTime: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:border-emerald-600 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:hidden"
                  />
                </div>
              </div>

              {/* Quick Duration Preset Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-500 mr-1">Quick Duration:</span>
                {[1, 2, 3, 4, 8].map((hrs) => (
                  <button
                    key={hrs}
                    type="button"
                    onClick={() => {
                      const s = new Date(booking.startTime || Date.now());
                      const e = new Date(s.getTime() + hrs * 3600000);
                      setBooking((prev) => ({ ...prev, endTime: formatLocalDateTime(e) }));
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer"
                  >
                    +{hrs} {hrs === 1 ? 'Hour' : 'Hours'}
                  </button>
                ))}
              </div>

              {/* Estimate Calculation */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">Rate:</span>
                  <span className="font-semibold text-slate-900">₹{selected.hourlyRate} / hour</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 font-bold">Estimated Total:</span>
                  <strong className="text-emerald-700 text-lg font-black">₹{calculateEstimate()}</strong>
                </div>
                {selected.contactName && (
                  <div className="flex justify-between text-xs text-slate-600 pt-2 border-t border-slate-200">
                    <span>Host:</span>
                    <strong>{selected.contactName}</strong>
                  </div>
                )}
                {selected.instructions && (
                  <div className="text-xs text-sky-800 bg-sky-50 border border-sky-200 rounded-lg p-2.5 mt-1">
                    <strong>Gate Note:</strong> {selected.instructions}
                  </div>
                )}

                {/* Driver KYC Verification Badge in Booking Drawer */}
                <div className="pt-2 border-t border-slate-200">
                  {(() => {
                    const u = JSON.parse(localStorage.getItem('user') || '{}');
                    const isKycComplete = Boolean(u.aadhaarNumber && u.licenceNumber);
                    return isKycComplete ? (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between text-xs text-emerald-800">
                        <span className="flex items-center gap-1.5 font-bold">
                          <span>✓</span>
                          <span>Verified Driver ID Attached (Aadhaar & Licence)</span>
                        </span>
                        <Link to="/profile" className="text-[11px] underline font-bold hover:text-emerald-900">
                          Edit
                        </Link>
                      </div>
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center justify-between text-xs text-amber-800">
                        <span>ID Verification pending</span>
                        <Link to="/profile" className="text-[11px] underline font-bold hover:text-amber-900">
                          Add Aadhaar & Licence →
                        </Link>
                      </div>
                    );
                  })()}
                </div>

                <small className="text-[11px] text-slate-400 mt-1">
                  Includes OTP verification pass, host contact (Call & WhatsApp) & digital receipt.
                </small>
              </div>

              {bookingError && (
                <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">!</span>
                  <span>{bookingError}</span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-3 border-t border-slate-100">
              <button
                type="button"
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg cursor-pointer transition-all"
                onClick={() => setSelected(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={bookingLoading}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
              >
                {bookingLoading ? 'Reserving Slot & Generating Pass...' : 'Confirm & Generate Pass (Output Page) ➔'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lightbox Photo Gallery Modal */}
      <LightboxModal
        isOpen={Boolean(galleryModal)}
        onClose={closeGallery}
        title={galleryModal?.spot?.title || 'Parking Space'}
        photos={
          Array.isArray(galleryModal?.spot?.photos) && galleryModal.spot.photos.length > 0
            ? galleryModal.spot.photos
            : galleryModal?.spot?.photoUrl
              ? [galleryModal.spot.photoUrl]
              : []
        }
        activeIndex={galleryModal?.activeIndex || 0}
        setActiveIndex={(idx) => setGalleryModal((prev) => (prev ? { ...prev, activeIndex: idx } : null))}
      />


      {/* ========================================================
          MODAL: PROFILE COMPLETION REQUIRED POPUP
         ======================================================== */}
      {profilePromptSpot && (() => {
        const u = JSON.parse(localStorage.getItem('user') || 'null');
        const status = getDriverProfileStatus(u);
        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200">
              {/* Header */}
              <div className="p-5 sm:p-6 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-sm font-black shadow-inner border border-white/20 shrink-0">
                    ID
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-black/20 px-2.5 py-0.5 rounded-full inline-block">
                      Verification Required
                    </span>
                    <h3 className="text-lg sm:text-xl font-black mt-1">
                      Complete Profile to Book Parking
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setProfilePromptSpot(null)}
                  className="text-white/80 hover:text-white text-xl font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="p-5 sm:p-6 space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 leading-relaxed">
                  Host house owners require verified driver details before reservations are confirmed. Please complete your driver contact number, 12-digit Aadhaar, and Driving Licence to book <strong>{profilePromptSpot.title}</strong>.
                </div>

                <div className="space-y-2.5">
                  <span className="text-xs font-bold text-slate-700 block">Required Profile Verifications:</span>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                        01
                      </div>
                      <div>
                        <strong className="text-slate-900 block">Contact Mobile Number</strong>
                        <span className="text-[11px] text-slate-500">Shared with the parking host for gate entry</span>
                      </div>
                    </div>
                    {status.hasPhone ? (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">✓ Added</span>
                    ) : (
                      <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Missing</span>
                    )}
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                        02
                      </div>
                      <div>
                        <strong className="text-slate-900 block">12-Digit Aadhaar & Photo</strong>
                        <span className="text-[11px] text-slate-500">Government ID number and front card photo</span>
                      </div>
                    </div>
                    {status.hasAadhaar ? (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">✓ Verified</span>
                    ) : (
                      <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Missing</span>
                    )}
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                        03
                      </div>
                      <div>
                        <strong className="text-slate-900 block">Driving Licence & Photo</strong>
                        <span className="text-[11px] text-slate-500">Licence number and clear card photo</span>
                      </div>
                    </div>
                    {status.hasLicence ? (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">✓ Verified</span>
                    ) : (
                      <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Missing</span>
                    )}
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-center gap-2">
                  <span><strong>1-Minute Setup:</strong> Once you fill and save, you will automatically be returned to book this spot!</span>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setProfilePromptSpot(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <Link
                  to={`/profile?incomplete=true&spotId=${profilePromptSpot._id}`}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>Complete Profile & Book</span>
                  <span>→</span>
                </Link>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
