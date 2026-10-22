import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';

// Canvas-based image optimizer for ID documents (compresses to ~100KB for fast loading and low storage footprint)
function optimizeDocFile(file, maxWidth = 1000, maxHeight = 700, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Please select an image file (JPG, PNG, or WebP).'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Failed to load image.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

// Format 12-digit Aadhaar number with spaces (e.g., 1234 5678 9012)
function formatAadhaarInput(val) {
  const digits = val.replace(/\D/g, '').slice(0, 12);
  const parts = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(' ');
}

export default function Profile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNew = searchParams.get('new') === 'true';
  const isIncomplete = searchParams.get('incomplete') === 'true' || searchParams.get('onboarding') === 'true';
  const returnSpotId = searchParams.get('spotId');
  const isOnboarding = isNew || isIncomplete || Boolean(returnSpotId);

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  });

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    address: '',
    aadhaarNumber: '',
    aadhaarPhotoUrl: '',
    licenceName: '',
    licenceNumber: '',
    licencePhotoUrl: '',
    isVerified: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aadhaarUploading, setAadhaarUploading] = useState(false);
  const [licenceUploading, setLicenceUploading] = useState(false);
  const [showAadhaar, setShowAadhaar] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [previewModal, setPreviewModal] = useState(null); // { title, url }

  // Fetch initial profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        const data = await api('/auth/me').catch(() => stored);
        const merged = { ...stored, ...(data || {}) };

        // Populate with real user data without fake demo placeholders
        setForm({
          name: merged.name || '',
          email: merged.email || '',
          phone: merged.phone || '',
          city: merged.city || '',
          address: merged.address || '',
          aadhaarNumber: merged.aadhaarNumber || '',
          aadhaarPhotoUrl: merged.aadhaarPhotoUrl || '',
          licenceName: merged.licenceName || merged.name || '',
          licenceNumber: merged.licenceNumber || '',
          licencePhotoUrl: merged.licencePhotoUrl || '',
          isVerified: Boolean(
            merged.isVerified && merged.aadhaarNumber && merged.licenceNumber
          ),
        });
      } catch (err) {
        setErrorMsg('Failed to load profile details.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  // Handle Aadhaar Photo Upload
  const handleAadhaarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAadhaarUploading(true);
    setErrorMsg('');
    try {
      const optimized = await optimizeDocFile(file);
      setForm((prev) => ({ ...prev, aadhaarPhotoUrl: optimized }));
      setStatusMsg('✓ Aadhaar photo uploaded and optimized successfully.');
    } catch (err) {
      setErrorMsg(err.message || 'Error processing Aadhaar photo.');
    } finally {
      setAadhaarUploading(false);
      e.target.value = '';
    }
  };

  // Handle Licence Photo Upload
  const handleLicenceUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLicenceUploading(true);
    setErrorMsg('');
    try {
      const optimized = await optimizeDocFile(file);
      setForm((prev) => ({ ...prev, licencePhotoUrl: optimized }));
      setStatusMsg('✓ Driving Licence photo uploaded and optimized successfully.');
    } catch (err) {
      setErrorMsg(err.message || 'Error processing Driving Licence photo.');
    } finally {
      setLicenceUploading(false);
      e.target.value = '';
    }
  };

  // Save full profile
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatusMsg('');
    setErrorMsg('');

    try {
      const isHost = currentUser?.role === 'host';
      const cleanPhone = (form.phone || '').replace(/\D/g, '');
      const cleanAadhaar = (form.aadhaarNumber || '').replace(/\D/g, '');
      const hasLocation = Boolean(form.city?.trim() || form.address?.trim());

      // Validation for Host role
      if (isHost) {
        if (!form.name.trim()) {
          throw new Error('Please enter your Host Full Name.');
        }
        if (!cleanPhone || cleanPhone.length < 10) {
          throw new Error('Please enter a valid 10-digit primary mobile phone number.');
        }
        if (!hasLocation) {
          throw new Error('Please enter your property Location (City and Address).');
        }
        if (!cleanAadhaar || cleanAadhaar.length < 12) {
          throw new Error('Please enter your valid 12-digit Indian Aadhaar number.');
        }
        if (!form.aadhaarPhotoUrl) {
          throw new Error('Please upload your Aadhaar Card photo / document.');
        }
      }

      // Validation for Driver role
      if (!isHost) {
        if (!form.name.trim()) {
          throw new Error('Please enter your Driver Full Name.');
        }
        if (!cleanPhone || cleanPhone.length < 10) {
          throw new Error('Please enter a valid 10-digit primary mobile phone number.');
        }
        if (!cleanAadhaar || cleanAadhaar.length < 12) {
          throw new Error('Please enter your valid 12-digit Indian Aadhaar number.');
        }
        if (!form.aadhaarPhotoUrl) {
          throw new Error('Please upload your Aadhaar Card photo.');
        }
        if (!form.licenceNumber.trim() || form.licenceNumber.trim().length < 4) {
          throw new Error('Please enter your Driving Licence number.');
        }
        if (!form.licencePhotoUrl) {
          throw new Error('Please upload your Driving Licence card photo.');
        }
      }

      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        city: form.city.trim(),
        address: form.address.trim(),
        aadhaarNumber: form.aadhaarNumber.trim(),
        aadhaarPhotoUrl: form.aadhaarPhotoUrl,
        licenceName: form.licenceName.trim(),
        licenceNumber: form.licenceNumber.trim(),
        licencePhotoUrl: form.licencePhotoUrl,
      };

      const updated = await api('/auth/profile', {
        method: 'PATCH',
        body: payload,
      });

      // Update local storage user profile
      const isVerified = isHost
        ? Boolean(cleanAadhaar.length >= 12 && form.aadhaarPhotoUrl && cleanPhone.length >= 10 && hasLocation)
        : Boolean(payload.aadhaarNumber && payload.licenceNumber);

      const mergedUser = {
        ...(currentUser || {}),
        ...updated,
        ...payload,
        isVerified,
      };
      localStorage.setItem('user', JSON.stringify(mergedUser));
      setCurrentUser(mergedUser);

      setForm((prev) => ({
        ...prev,
        isVerified,
      }));

      setStatusMsg(
        returnSpotId
          ? '✓ Profile & ID Verification documents saved! Returning you to complete your parking reservation...'
          : isHost
          ? '✓ Host details, Aadhaar photo and location saved in database! Entering Host Dashboard...'
          : '✓ Profile & ID Verification documents saved successfully! Redirecting you to Find Parking Spots...'
      );

      // Redirect appropriately
      setTimeout(() => {
        if (returnSpotId) {
          navigate(`/?bookSpot=${returnSpotId}`);
        } else if (isHost) {
          navigate('/host');
        } else {
          navigate('/');
        }
      }, 1200);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Calculate KYC completeness
  const isHost = currentUser?.role === 'host';
  const cleanPhone = (form.phone || '').replace(/\D/g, '');
  const cleanAadhaar = (form.aadhaarNumber || '').replace(/\D/g, '');
  const hasPhone = cleanPhone.length >= 10;
  const hasAadhaar = cleanAadhaar.length >= 12;
  const hasAadhaarPhoto = Boolean(form.aadhaarPhotoUrl);
  const hasLocation = Boolean(form.city?.trim() || form.address?.trim());
  const hasLicence = Boolean(form.licenceNumber && form.licenceNumber.length >= 4);
  const hasLicencePhoto = Boolean(form.licencePhotoUrl);

  const completedCount = isHost
    ? [Boolean(form.name?.trim()), hasPhone, hasLocation, hasAadhaar, hasAadhaarPhoto].filter(Boolean).length
    : [hasAadhaar, hasAadhaarPhoto, hasLicence, hasLicencePhoto].filter(Boolean).length;
  const totalSteps = isHost ? 5 : 4;
  const isFullyVerified = isHost ? completedCount === 5 : completedCount === 4;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link to={isHost ? '/host' : '/'} className="hover:text-emerald-700">Home</Link>
            <span>/</span>
            <span className="font-bold text-slate-800">
              {isHost ? 'Host Profile & KYC Verification' : 'Driver Profile & ID Verification'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            {isHost ? 'Host Profile & Identity Verification' : 'Driver Profile & KYC Verification'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isHost
              ? 'Complete your contact phone and Aadhaar verification. Your verified host details are stored in the database and shown to drivers who reserve your spaces.'
              : 'Complete your contact details and upload your Aadhaar & Driving Licence. Hosts will view these verified details upon spot reservation for gate clearance.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isHost ? (
            <Link
              to="/host"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              Host Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/"
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors"
              >
                Find Parking
              </Link>
              <Link
                to="/my-bookings"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                My Bookings
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Prominent Onboarding / New User Welcome Banner */}
      {(isOnboarding || (!form.aadhaarNumber && !loading)) && (
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider bg-white/20 text-white px-2.5 py-0.5 rounded-full inline-block backdrop-blur-xs">
                {isHost
                  ? (isNew ? 'New Host Registration' : 'Host Profile Incomplete')
                  : (returnSpotId ? 'Booking Clearance Required' : isNew ? 'New Driver Registration' : 'Profile Incomplete')}
              </span>
              <span className="text-xs text-emerald-100 font-bold">
                {isHost ? 'Host Identity & Location Verification' : 'Driver ID & Contact Verification'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black">
              {isHost
                ? (isNew
                    ? `Welcome, ${form.name || 'Host'}! Complete details to access Host Dashboard`
                    : 'Complete your Host details and Aadhaar to access Dashboard')
                : (returnSpotId
                    ? 'Complete your profile to unlock and book this parking bay'
                    : isNew
                    ? `Welcome, ${form.name || 'Driver'}! Complete your profile to book parking`
                    : 'Please complete your Driver ID details to book spots')}
            </h2>
            <p className="text-xs text-emerald-50 max-w-xl leading-relaxed">
              {isHost
                ? 'Fill in your Full Name, 10-digit Phone Number, Property Location (City & Address), 12-digit Aadhaar Number, and upload your Aadhaar document photo. Once saved, you will immediately enter your Host Dashboard!'
                : (returnSpotId
                    ? 'Host house owners require verified driver details before reservations are confirmed. Complete your 10-digit mobile, 12-digit Aadhaar, and Driving Licence below. You will be returned to book immediately upon saving!'
                    : 'Please fill your mobile phone number, 12-digit Aadhaar number, and Driving Licence with photos. Once you click save below, you will immediately proceed to find and book parking spots!')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(isHost ? '/host' : '/')}
            className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white text-xs font-bold rounded-xl border border-white/25 transition-all shrink-0 cursor-pointer shadow-xs"
          >
            {isHost ? 'Host Dashboard →' : 'Skip to Find Spots →'}
          </button>
        </div>
      )}

      {/* Verification Status Card */}
      <div
        className={`rounded-2xl border p-5 sm:p-6 transition-all ${
          isFullyVerified
            ? 'bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border-emerald-300'
            : 'bg-amber-50/70 border-amber-300'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black shrink-0 shadow-xs ${
                isFullyVerified
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-500 text-white'
              }`}
            >
              {isFullyVerified ? '✓' : 'ID'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  {isHost
                    ? (isFullyVerified ? 'Verified Host Profile' : 'Host Verification & Location Details Pending')
                    : (isFullyVerified ? 'Verified Driver Profile' : 'Driver Identity Verification Pending')}
                </h3>
                <span
                  className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                    isFullyVerified
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                >
                  {isFullyVerified ? '● Fully Verified' : `${completedCount}/${totalSteps} Completed`}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-xl">
                {isHost
                  ? (isFullyVerified
                      ? 'Your phone number, location address, and Aadhaar document are verified. Drivers can view your verified host identity when reserving your bays.'
                      : 'Please provide your full name, phone number, property location address, Aadhaar number, and Aadhaar card photo to complete host verification.')
                  : (isFullyVerified
                      ? 'Your Aadhaar and Driving Licence are verified. Hosts can instantly confirm your gate arrival without physical document checks.'
                      : 'Please enter your Aadhaar number, Driving Licence number, and upload photos of both cards so hosts can verify you at check-in.')}
              </p>
            </div>
          </div>

          <div className="text-right sm:border-l sm:border-slate-200 sm:pl-6">
            <div className="text-2xl font-black text-slate-900">
              {Math.round((completedCount / totalSteps) * 100)}%
            </div>
            <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Profile Completeness
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <span>✓</span>
          <span>{statusMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-800 text-xs font-bold flex items-center gap-2">
          <span className="w-4 h-4 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center font-bold">!</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Form Container */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: CONTACT & LOCATION DETAILS */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
              01
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {isHost ? 'Host Contact & Property Location' : 'Contact & Personal Details'}
              </h3>
              <p className="text-xs text-slate-500">
                {isHost
                  ? 'Shared with drivers reserving your spot so they can reach you and locate your parking area.'
                  : 'Shared with the parking host so they can contact you on arrival.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isHost ? 'Host Full Name' : 'Driver Full Name'}
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={isHost ? 'e.g. Sundar Raman' : 'e.g. Rahul Sharma'}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={form.email}
                disabled
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Primary Mobile Phone (Calling & WhatsApp)
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g. +91 94431 88990"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isHost ? 'Property City / Region (Location) *' : 'City / Region'}
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="e.g. Thanjavur, Tamil Nadu"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                required={isHost}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isHost ? 'Property / Gate Location Address *' : 'Home / Street Address'}
              </label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder={isHost ? 'e.g. 14, Main Road, Vallam, Thanjavur' : 'e.g. 24, South Mada Street, Mylapore, Chennai'}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                required={isHost}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: AADHAAR CARD VERIFICATION */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🇮🇳</span>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {isHost ? 'Host Aadhaar Card Verification' : 'Aadhaar Card Verification'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isHost
                    ? '12-digit Indian Aadhaar number and card photo for verified property host status.'
                    : 'Government ID number and card photo for identity authentication.'}
                </p>
              </div>
            </div>
            {hasAadhaar && hasAadhaarPhoto && (
              <span className="text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full">
                ✓ Aadhaar Verified
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-slate-700">12-Digit Aadhaar Number</label>
                <button
                  type="button"
                  onClick={() => setShowAadhaar(!showAadhaar)}
                  className="text-xs text-emerald-700 hover:text-emerald-800 font-bold cursor-pointer"
                >
                  {showAadhaar ? 'Mask Aadhaar' : 'Show Full Aadhaar'}
                </button>
              </div>
              <input
                type={showAadhaar ? 'text' : 'password'}
                maxLength="14"
                value={formatAadhaarInput(form.aadhaarNumber)}
                onChange={(e) => setForm({ ...form, aadhaarNumber: e.target.value })}
                placeholder="e.g. 7841 9023 4512"
                className="w-full font-mono text-base tracking-wider px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
                {isHost
                  ? 'Enter your 12-digit Indian Aadhaar number. Authenticates your ownership profile in the database.'
                  : 'Enter your 12-digit Indian Aadhaar number. Visible to the host for identity verification during parking session.'}
              </p>
            </div>

            {/* Aadhaar Photo Upload & Preview */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Aadhaar Card Photo / Document (Front Side) {isHost && '*'}
              </label>

              {form.aadhaarPhotoUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 max-w-md group shadow-xs">
                  <img
                    src={form.aadhaarPhotoUrl}
                    alt="Aadhaar Card Preview"
                    className="w-full h-48 object-cover cursor-pointer group-hover:scale-105 transition-transform"
                    onClick={() => setPreviewModal({ title: 'Aadhaar Card Document', url: form.aadhaarPhotoUrl })}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                  {/* Top Badges */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded-md shadow-xs">
                      ✓ Aadhaar Photo Attached
                    </span>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, aadhaarPhotoUrl: '' })}
                      className="w-6 h-6 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center text-xs font-bold cursor-pointer transition-colors"
                      title="Remove Aadhaar Photo"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Bottom Action Bar */}
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white">
                    <button
                      type="button"
                      onClick={() => setPreviewModal({ title: 'Aadhaar Card Document', url: form.aadhaarPhotoUrl })}
                      className="text-xs font-bold bg-white/20 hover:bg-white/30 backdrop-blur-md px-3 py-1 rounded-lg border border-white/20 cursor-pointer transition-colors"
                    >
                      Inspect Full Photo
                    </button>

                    <label className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded-lg cursor-pointer transition-colors">
                      {aadhaarUploading ? 'Uploading...' : 'Replace Photo'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAadhaarUpload}
                        disabled={aadhaarUploading}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/30 rounded-2xl p-6 text-center cursor-pointer transition-all">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <span className="text-xs font-extrabold text-slate-800">
                    {aadhaarUploading ? 'Compressing & Processing...' : 'Upload Aadhaar Card Photo'}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1">
                    Take a photo from phone camera or select JPG, PNG, WebP image
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAadhaarUpload}
                    disabled={aadhaarUploading}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: DRIVING LICENCE VERIFICATION (DRIVERS ONLY) */}
        {!isHost && (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                  03
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Driving Licence Verification</h3>
                  <p className="text-xs text-slate-500">Government issued driver licence number and card photo.</p>
                </div>
              </div>
              {hasLicence && hasLicencePhoto && (
                <span className="text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full">
                  ✓ Licence Verified
                </span>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Name as Printed on Driving Licence
                  </label>
                  <input
                    type="text"
                    value={form.licenceName}
                    onChange={(e) => setForm({ ...form, licenceName: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                    required={!isHost}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Driving Licence Number
                  </label>
                  <input
                    type="text"
                    value={form.licenceNumber}
                    onChange={(e) => setForm({ ...form, licenceNumber: e.target.value.toUpperCase() })}
                    placeholder="e.g. TN-49-2021-0089214"
                    className="w-full font-mono text-sm uppercase px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                    required={!isHost}
                  />
                </div>
              </div>

              {/* Licence Photo Upload & Preview */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Driving Licence Card Photo (Front Side) *
                </label>

                {form.licencePhotoUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 max-w-md group shadow-xs">
                    <img
                      src={form.licencePhotoUrl}
                      alt="Driving Licence Card Preview"
                      className="w-full h-48 object-cover cursor-pointer group-hover:scale-105 transition-transform"
                      onClick={() => setPreviewModal({ title: 'Driving Licence Document', url: form.licencePhotoUrl })}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                    {/* Top Badges */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white px-2 py-0.5 rounded-md shadow-xs">
                        ✓ Licence Photo Attached
                      </span>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, licencePhotoUrl: '' })}
                        className="w-6 h-6 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center text-xs font-bold cursor-pointer transition-colors"
                        title="Remove Licence Photo"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white">
                      <button
                        type="button"
                        onClick={() => setPreviewModal({ title: 'Driving Licence Document', url: form.licencePhotoUrl })}
                        className="text-xs font-bold bg-white/20 hover:bg-white/30 backdrop-blur-md px-3 py-1 rounded-lg border border-white/20 cursor-pointer transition-colors"
                      >
                        Inspect Full Photo
                      </button>

                      <label className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded-lg cursor-pointer transition-colors">
                        {licenceUploading ? 'Uploading...' : 'Replace Photo'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLicenceUpload}
                          disabled={licenceUploading}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/30 rounded-2xl p-6 text-center cursor-pointer transition-all">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                      </svg>
                    </div>
                    <span className="text-xs font-extrabold text-slate-800">
                      {licenceUploading ? 'Compressing & Processing...' : 'Upload Driving Licence Photo'}
                    </span>
                    <span className="text-[11px] text-slate-500 mt-1">
                      Take a clear photo of your Driving Licence card (Front view)
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLicenceUpload}
                      disabled={licenceUploading}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        )}

        {/* BOTTOM ACTION BAR */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div>
            <span className="text-xs font-bold text-slate-900 block">
              {isHost ? 'Ready to Access Host Dashboard' : 'Ready to Save & Update'}
            </span>
            <p className="text-[11px] text-slate-500">
              {isHost
                ? 'Your verified host details and Aadhaar document will be saved to your profile.'
                : 'Your details will be synchronized immediately for all upcoming spot reservations.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(isHost ? '/host' : '/')}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              {isHost ? 'Go to Dashboard' : 'Skip / Cancel'}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {saving
                ? 'Saving Details...'
                : isHost
                ? 'Save Host Profile & Enter Dashboard ➔'
                : isOnboarding
                ? 'Save Profile & Find Spots ➔'
                : 'Save & Update Verified Profile'}
            </button>
          </div>
        </div>
      </form>

      {/* FULL-SCREEN DOCUMENT PREVIEW LIGHTBOX */}
      {previewModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6"
          onClick={() => setPreviewModal(null)}
        >
          <div className="flex items-center justify-between text-white z-10" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>{previewModal.title}</span>
            </h3>
            <button
              type="button"
              onClick={() => setPreviewModal(null)}
              className="w-9 h-9 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center text-lg font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div
            className="flex-1 flex items-center justify-center my-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewModal.url}
              alt={previewModal.title}
              className="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/10"
            />
          </div>

          <div className="text-center text-xs text-slate-400">
            Press Esc or click anywhere outside to close preview
          </div>
        </div>
      )}
    </div>
  );
}
