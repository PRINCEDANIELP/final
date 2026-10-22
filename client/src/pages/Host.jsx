import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { resolveUserLocation } from '../utils/location.js';
import EditSpotModal from '../components/EditSpotModal.jsx';
import DeleteSpotModal from '../components/DeleteSpotModal.jsx';
import CheckInModal from '../components/CheckInModal.jsx';
import CheckoutModal from '../components/CheckoutModal.jsx';
import DriverKycModal from '../components/DriverKycModal.jsx';
import LightboxModal from '../components/LightboxModal.jsx';

const VEHICLE_OPTIONS = ['BIKE', 'HATCHBACK', 'SEDAN', 'SUV'];
const AMENITY_OPTIONS = [
  'CCTV Monitored',
  'Covered Roof',
  'Gated Security',
  'EV Charging',
  '24/7 Gate Access',
  'Well Lit at Night',
];

// Canvas-based image optimizer to compress device photos into compact high-quality data URLs
function optimizeImageFile(file, maxWidth = 800, maxHeight = 600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Please select a valid image file.'));
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
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export default function Host() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' | 'spots' | 'create'
  const [spots, setSpots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Gate Check-in & Reservations Filtering & Search
  const [bookingFilter, setBookingFilter] = useState('ALL'); // 'ALL' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED'
  const [bookingSearch, setBookingSearch] = useState('');

  // OTP Verification Modal State
  const [activeCheckInBooking, setActiveCheckInBooking] = useState(null);
  const [inputOtp, setInputOtp] = useState('');
  const [otpError, setOtpError] = useState('');

  // Checkout & Overtime Settlement Modal State
  const [activeCheckoutBooking, setActiveCheckoutBooking] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // CRUD: Edit Spot Modal State
  const [editingSpot, setEditingSpot] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    address: '',
    area: '',
    city: '',
    pincode: '',
    hourlyRate: '40',
    vehicleTypes: ['SEDAN'],
    amenities: [],
    contactName: '',
    contactPhone: '',
    instructions: '',
    photos: [],
    isActive: true,
  });
  const [editPhotoUploading, setEditPhotoUploading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editModalError, setEditModalError] = useState('');
  const [editModalSuccess, setEditModalSuccess] = useState('');
  const [hostGalleryModal, setHostGalleryModal] = useState(null); // { spot, activeIndex }
  const [viewKycBooking, setViewKycBooking] = useState(null); // booking to inspect driver Aadhaar & Licence
  const [kycDocModal, setKycDocModal] = useState(null); // { title, url } for high-res doc viewer

  const openHostGallery = (spot, index = 0) => {
    setHostGalleryModal({ spot, activeIndex: index });
  };

  const closeHostGallery = () => {
    setHostGalleryModal(null);
  };

  useEffect(() => {
    if (!hostGalleryModal) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') closeHostGallery();
      const photos = (Array.isArray(hostGalleryModal.spot.photos) && hostGalleryModal.spot.photos.length > 0)
        ? hostGalleryModal.spot.photos
        : (hostGalleryModal.spot.photoUrl ? [hostGalleryModal.spot.photoUrl] : []);
      if (photos.length > 1) {
        if (e.key === 'ArrowRight') {
          setHostGalleryModal((prev) => ({
            ...prev,
            activeIndex: (prev.activeIndex + 1) % photos.length,
          }));
        }
        if (e.key === 'ArrowLeft') {
          setHostGalleryModal((prev) => ({
            ...prev,
            activeIndex: (prev.activeIndex - 1 + photos.length) % photos.length,
          }));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hostGalleryModal]);

  // CRUD: Delete Spot Modal State
  const [deletingSpot, setDeletingSpot] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Current Logged-in Host Profile details
  const [currentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  });

  const cleanPhone = (currentUser?.phone || '').replace(/\D/g, '');
  const cleanAadhaar = (currentUser?.aadhaarNumber || '').replace(/\D/g, '');
  const hasAadhaarPhoto = Boolean(currentUser?.aadhaarPhotoUrl);
  const hasLocation = Boolean(currentUser?.city?.trim() || currentUser?.address?.trim());
  const isHostProfileComplete = Boolean(
    currentUser?.name?.trim() &&
    cleanPhone.length >= 10 &&
    cleanAadhaar.length >= 12 &&
    hasAadhaarPhoto &&
    hasLocation
  );

  // Form for listing a new spot
  const [form, setForm] = useState(() => {
    const u = (() => {
      try {
        return JSON.parse(localStorage.getItem('user') || 'null');
      } catch {
        return null;
      }
    })();
    return {
      title: 'Covered Portico & Gated Driveway',
      address: u?.address || 'Near Main Road / Junction Avenue',
      area: 'Vallam',
      city: u?.city || 'Thanjavur',
      pincode: '613403',
      hourlyRate: '40',
      vehicleTypes: ['SEDAN', 'SUV'],
      amenities: ['CCTV Monitored', 'Covered Roof', 'Gated Security'],
      contactName: u?.name || '',
      contactPhone: u?.phone || '',
      hostAadhaarNumber: u?.aadhaarNumber || '',
      instructions: 'Gated entrance. Ring calling bell at Gate #1 or call host on arrival for gate entry.',
      photos: [],
      lat: '10.7181',
      lng: '79.0849',
      gpsVerified: true,
    };
  });

  const load = async () => {
    try {
      setLoading(true);
      const [spotsData, bookingsData] = await Promise.all([
        api('/spots/mine'),
        api('/bookings/host'),
      ]);
      setSpots(spotsData || []);
      setBookings(bookingsData || []);
    } catch (err) {
      setMsg(err.message || 'Failed to load host dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const run = async (fn, okMsg) => {
    try {
      await fn();
      setMsg(okMsg);
      await load();
    } catch (err) {
      setMsg(err.message || 'Operation failed');
    }
  };

  // High-Precision Hardware GPS Auto-fill for Parking Spot
  const detectLocation = async () => {
    setGpsLoading(true);
    setMsg('Requesting high-precision GPS coordinates from device hardware...');

    try {
      const loc = await resolveUserLocation();
      const streetAddress = loc.fullAddress ? loc.fullAddress.split(',').slice(0, 3).join(', ') : '';
      const area = loc.area || form.area || 'Vallam';
      const city = loc.city || form.city || 'Thanjavur';
      const pincode = loc.pincode || form.pincode || '613403';
      const fullAddress = streetAddress || `Near Main Road, ${area}, ${city}${pincode ? ' - ' + pincode : ''}`;

      setForm((prev) => ({
        ...prev,
        lat: loc.lat.toFixed(6),
        lng: loc.lng.toFixed(6),
        address: prev.address || fullAddress,
        area: area,
        city: city,
        pincode: pincode,
        gpsVerified: true,
      }));

      const precisionNotice = loc.accuracy ? ` (±${loc.accuracy}m precision)` : '';
      setMsg(`✓ GPS Located: ${loc.label}${precisionNotice} via ${loc.tier}. Address auto-filled below.`);
    } catch (err) {
      console.warn('GPS detection notice:', err);
      setMsg('Location resolution notice: Please verify your street address details below and click "Locate Pin from Address".');
    } finally {
      setGpsLoading(false);
    }
  };


  // Geocode address from text input to exact GPS coordinates
  const geocodeAddress = async () => {
    const fullQuery = [form.address, form.area, form.city, 'Tamil Nadu, India'].filter(Boolean).join(', ');
    setGpsLoading(true);
    setMsg(`Searching map coordinates for "${fullQuery}"...`);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&countrycodes=in&limit=1&addressdetails=1`,
        { headers: { 'User-Agent': 'NammaSpots-App/2.0' } }
      ).then((r) => r.json());

      if (res && res.length > 0) {
        const top = res[0];
        const newLat = parseFloat(top.lat).toFixed(6);
        const newLng = parseFloat(top.lon).toFixed(6);
        setForm((prev) => ({
          ...prev,
          lat: newLat,
          lng: newLng,
          gpsVerified: true,
        }));
        setMsg(`✓ Pinpoint Coordinates Verified: ${top.display_name.split(',').slice(0, 3).join(', ')} (${newLat}° N, ${newLng}° E)`);
      } else {
        const fallbackQuery = [form.area, form.city, 'Tamil Nadu'].filter(Boolean).join(', ');
        const res2 = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fallbackQuery)}&countrycodes=in&limit=1`,
          { headers: { 'User-Agent': 'NammaSpots-App/2.0' } }
        ).then((r) => r.json());

        if (res2 && res2.length > 0) {
          const newLat = parseFloat(res2[0].lat).toFixed(6);
          const newLng = parseFloat(res2[0].lon).toFixed(6);
          setForm((prev) => ({
            ...prev,
            lat: newLat,
            lng: newLng,
            gpsVerified: true,
          }));
          setMsg(`✓ Located via town area: ${form.area}, ${form.city} (${newLat}° N, ${newLng}° E)`);
        } else {
          setMsg('Could not auto-find pin for this address. You can adjust Latitude & Longitude directly in the form below.');
        }
      }
    } catch (err) {
      setMsg(`Location lookup notice: ${err.message}`);
    } finally {
      setGpsLoading(false);
    }
  };

  // MULTIPLE PHOTOS HANDLERS
  const handleMultiplePhotoUploadForNewSpot = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setPhotoUploading(true);
    setMsg(`Optimizing and processing ${files.length} device photo(s)...`);
    try {
      const optimizedUrls = await Promise.all(files.map((file) => optimizeImageFile(file)));
      setForm((prev) => ({
        ...prev,
        photos: [...prev.photos, ...optimizedUrls],
      }));
      setMsg(`✓ ${files.length} photo(s) added successfully from your device!`);
    } catch (err) {
      setMsg(err.message || 'Error uploading photo(s).');
    } finally {
      setPhotoUploading(false);
      e.target.value = '';
    }
  };

  const removePhotoFromNewSpot = (indexToRemove) => {
    setForm((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, idx) => idx !== indexToRemove),
    }));
  };

  const setNewSpotPrimaryPhoto = (indexToPrimary) => {
    setForm((prev) => {
      const target = prev.photos[indexToPrimary];
      const rest = prev.photos.filter((_, idx) => idx !== indexToPrimary);
      return {
        ...prev,
        photos: [target, ...rest],
      };
    });
  };

  // CRUD CREATE SPOT
  const createSpot = async (e) => {
    e.preventDefault();
    if (!isHostProfileComplete) {
      setMsg('⚠️ Profile Verification Incomplete: Please complete your Host Mobile, Aadhaar Number, Aadhaar document photo, and Location Address before listing bays.');
      navigate('/profile?incomplete=true');
      return;
    }
    try {
      setMsg('Listing parking space...');
      const primaryPhoto = form.photos[0] || null;
      await api('/spots', {
        method: 'POST',
        body: {
          title: form.title,
          address: form.address,
          area: form.area,
          city: form.city,
          pincode: form.pincode,
          photoUrl: primaryPhoto,
          photos: form.photos,
          amenities: form.amenities,
          contactName: form.contactName,
          contactPhone: form.contactPhone,
          instructions: form.instructions,
          lat: Number(form.lat),
          lng: Number(form.lng),
          hourlyRate: Number(form.hourlyRate),
          vehicleTypes: form.vehicleTypes,
        },
      });
      setMsg('✓ Parking space listed successfully and active for reservations!');
      setForm((prev) => ({
        ...prev,
        photos: [],
        title: 'Covered Portico & Gated Driveway',
      }));
      await load();
      setActiveTab('spots');
    } catch (err) {
      setMsg(err.message || 'Failed to list parking spot');
    }
  };

  // MULTIPLE PHOTOS HANDLERS FOR EDIT SPOT
  const handleMultiplePhotoUploadForEditSpot = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setEditPhotoUploading(true);
    try {
      const optimizedUrls = await Promise.all(files.map((file) => optimizeImageFile(file)));
      setEditForm((prev) => ({
        ...prev,
        photos: [...(prev.photos || []), ...optimizedUrls],
      }));
    } catch (err) {
      setEditModalError(err.message || 'Error processing photo(s).');
    } finally {
      setEditPhotoUploading(false);
      e.target.value = '';
    }
  };

  const removePhotoFromEditSpot = (indexToRemove) => {
    setEditForm((prev) => ({
      ...prev,
      photos: (prev.photos || []).filter((_, idx) => idx !== indexToRemove),
    }));
  };

  const setEditSpotPrimaryPhoto = (indexToPrimary) => {
    setEditForm((prev) => {
      const list = prev.photos || [];
      const target = list[indexToPrimary];
      const rest = list.filter((_, idx) => idx !== indexToPrimary);
      return {
        ...prev,
        photos: [target, ...rest],
      };
    });
  };

  // CRUD EDIT SPOT
  const openEditModal = (spot) => {
    setEditingSpot(spot);
    setEditModalError('');
    setEditModalSuccess('');
    setSavingEdit(false);
    const spotPhotos = Array.isArray(spot.photos) && spot.photos.length > 0
      ? [...spot.photos]
      : (spot.photoUrl ? [spot.photoUrl] : []);
    setEditForm({
      title: spot.title || '',
      address: spot.address || '',
      area: spot.area || '',
      city: spot.city || '',
      pincode: spot.pincode || '',
      hourlyRate: String(spot.hourlyRate || 40),
      vehicleTypes: Array.isArray(spot.vehicleTypes) && spot.vehicleTypes.length ? spot.vehicleTypes : ['SEDAN'],
      amenities: Array.isArray(spot.amenities) ? spot.amenities : ['CCTV Monitored', 'Covered Roof'],
      contactName: spot.contactName || '',
      contactPhone: spot.contactPhone || '',
      instructions: spot.instructions || '',
      photos: spotPhotos,
      isActive: spot.isActive !== false,
    });
  };

  const saveEditSpot = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!editingSpot) return;

    if (!editForm.title || !editForm.title.trim()) {
      setEditModalError('Please enter a parking spot title.');
      return;
    }
    if (!editForm.address || !editForm.address.trim()) {
      setEditModalError('Please enter a street address / landmark.');
      return;
    }

    setSavingEdit(true);
    setEditModalError('');
    setEditModalSuccess('');

    try {
      const primaryPhoto = editForm.photos && editForm.photos.length > 0
        ? editForm.photos[0]
        : (editingSpot.photoUrl || null);

      const updatedPayload = {
        title: editForm.title.trim(),
        address: editForm.address.trim(),
        area: editForm.area?.trim() || '',
        city: editForm.city?.trim() || '',
        pincode: editForm.pincode?.trim() || '',
        hourlyRate: Number(editForm.hourlyRate) || 40,
        vehicleTypes: editForm.vehicleTypes && editForm.vehicleTypes.length > 0 ? editForm.vehicleTypes : ['SEDAN'],
        amenities: editForm.amenities || [],
        contactName: editForm.contactName?.trim() || '',
        contactPhone: editForm.contactPhone?.trim() || '',
        instructions: editForm.instructions?.trim() || '',
        photos: editForm.photos || [],
        photoUrl: primaryPhoto,
        isActive: editForm.isActive,
      };

      setSpots((prevSpots) =>
        prevSpots.map((s) =>
          String(s._id) === String(editingSpot._id) || s._id === editingSpot._id
            ? { ...s, ...updatedPayload }
            : s
        )
      );

      await api(`/spots/${editingSpot._id}`, {
        method: 'PATCH',
        body: updatedPayload,
      });

      setEditModalSuccess('✓ Changes saved successfully!');
      setMsg(`✓ Parking bay "${updatedPayload.title}" updated successfully!`);

      setTimeout(() => {
        setEditingSpot(null);
        setSavingEdit(false);
        setEditModalSuccess('');
      }, 500);
    } catch (err) {
      console.error('Failed to save spot:', err);
      setEditModalError(err.message || 'Failed to update parking bay. Please try again.');
      setSavingEdit(false);
    }
  };

  // CRUD DELETE SPOT
  const confirmDeleteSpot = async () => {
    if (!deletingSpot) return;
    setDeleteLoading(true);
    try {
      await api(`/spots/${deletingSpot._id}`, { method: 'DELETE' });
      setMsg(`✓ Parking space "${deletingSpot.title}" has been permanently deleted.`);
      setDeletingSpot(null);
      await load();
    } catch (err) {
      setMsg(err.message || 'Failed to delete parking spot.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleSpotOnline = (id) =>
    run(() => api(`/spots/${id}/toggle`, { method: 'PATCH' }), '✓ Spot availability updated');

  // GATE CHECK-IN
  const openCheckInModal = (b) => {
    setActiveCheckInBooking(b);
    setInputOtp(b.otp || '');
    setOtpError('');
  };

  const handleCheckInSubmit = async (e) => {
    e.preventDefault();
    if (!inputOtp.trim()) {
      setOtpError('Please enter the 4-digit OTP.');
      return;
    }

    try {
      await api(`/bookings/${activeCheckInBooking._id}/checkin`, {
        method: 'POST',
        body: { otp: inputOtp.trim() },
      });
      setMsg(`✓ Driver verified! Vehicle ${activeCheckInBooking.vehicleNumber} checked in successfully.`);
      setActiveCheckInBooking(null);
      await load();
    } catch (err) {
      setOtpError(err.message || 'Wrong OTP entered.');
    }
  };

  // GATE CHECKOUT
  const openCheckoutModal = (b) => {
    const now = Date.now();
    const end = new Date(b.endTime).getTime();
    const isOvertime = now > end;
    const overtimeMins = isOvertime ? Math.round((now - end) / 60000) : 0;
    const hourlyRate = b.spot?.hourlyRate || 40;
    const overtimeHours = Math.ceil(overtimeMins / 60);
    const overtimeFee = isOvertime ? overtimeHours * hourlyRate : 0;

    setActiveCheckoutBooking({
      ...b,
      isOvertime,
      overtimeMins,
      overtimeFee,
      finalAmount: (b.totalAmount || 0) + overtimeFee,
    });
  };

  const confirmCheckoutSubmit = async () => {
    if (!activeCheckoutBooking) return;
    setCheckoutLoading(true);
    try {
      await api(`/bookings/${activeCheckoutBooking._id}/checkout`, {
        method: 'POST',
        body: {
          overtimeFee: activeCheckoutBooking.overtimeFee,
          totalAmount: activeCheckoutBooking.finalAmount,
        },
      });
      setMsg(`✓ Vehicle ${activeCheckoutBooking.vehicleNumber} checked out successfully.`);
      setActiveCheckoutBooking(null);
      await load();
    } catch (err) {
      setMsg(err.message || 'Failed to complete checkout.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const toggleVehicleType = (type) => {
    setForm((prev) => {
      const exists = prev.vehicleTypes.includes(type);
      const updated = exists
        ? prev.vehicleTypes.filter((t) => t !== type)
        : [...prev.vehicleTypes, type];
      return { ...prev, vehicleTypes: updated.length ? updated : [type] };
    });
  };

  const toggleAmenity = (amenity) => {
    setForm((prev) => {
      const exists = prev.amenities.includes(amenity);
      const updated = exists
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity];
      return { ...prev, amenities: updated };
    });
  };

  const toggleEditVehicleType = (type) => {
    setEditForm((prev) => {
      const exists = prev.vehicleTypes.includes(type);
      const updated = exists
        ? prev.vehicleTypes.filter((t) => t !== type)
        : [...prev.vehicleTypes, type];
      return { ...prev, vehicleTypes: updated.length ? updated : [type] };
    });
  };

  const toggleEditAmenity = (amenity) => {
    setEditForm((prev) => {
      const exists = prev.amenities.includes(amenity);
      const updated = exists
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity];
      return { ...prev, amenities: updated };
    });
  };

  // Host isolation: Ensure only bookings for this host's parking bays are displayed
  const currentHostId = String(currentUser?.id || currentUser?._id || '');
  const mySpotIds = new Set(spots.map((s) => String(s._id || s.id)));

  // Strict host-isolation: only include bookings whose parking bay belongs to this host
  const myHostBookings = bookings.filter((b) => {
    const bSpotId = String(b.spot?._id || b.spot?.id || b.spot || '');
    const bSpotHost = String(b.spot?.host?._id || b.spot?.host?.id || b.spot?.host || b.host || '');
    return mySpotIds.has(bSpotId) || (currentHostId && (bSpotHost === currentHostId || String(b.host) === currentHostId));
  });

  // KPI Calculations strictly for this host's parking bays
  const confirmedBookings = myHostBookings.filter((b) => b.status === 'CONFIRMED');
  const activeBookings = myHostBookings.filter((b) => b.status === 'ACTIVE');
  const completedBookings = myHostBookings.filter((b) => b.status === 'COMPLETED');
  const totalHostRevenue = myHostBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  const nowMs = Date.now();
  const overtimeCount = activeBookings.filter((b) => nowMs > new Date(b.endTime).getTime()).length;

  const hasSearch = Boolean(bookingSearch && bookingSearch.trim());
  const q = (bookingSearch || '').trim().toLowerCase();
  const cleanQ = q.replace(/[\s\-_#]/g, '');

  const matchesQuery = (b) => {
    if (!hasSearch) return true;
    const plateRaw = String(b.vehicleNumber || '').toLowerCase();
    const plateClean = plateRaw.replace(/[\s\-_]/g, '');
    const refRaw = String(b._id || '').toLowerCase();
    const refCode = refRaw.slice(-6);
    const driverName = String(b.driverName || '').toLowerCase();
    const driverPhone = String(b.driverPhone || '').replace(/\D/g, '');
    const driverPhoneRaw = String(b.driverPhone || '').toLowerCase();
    const vehicleModel = String(b.vehicleModel || '').toLowerCase();
    const otp = String(b.otp || '');
    const spotTitle = String(b.spot?.title || '').toLowerCase();
    const spotAddress = String(b.spot?.address || '').toLowerCase();

    return (
      plateRaw.includes(q) ||
      plateClean.includes(cleanQ) ||
      refRaw.includes(cleanQ) ||
      refCode.includes(cleanQ) ||
      ('#' + refCode).includes(q) ||
      driverName.includes(q) ||
      driverPhone.includes(cleanQ) ||
      driverPhoneRaw.includes(q) ||
      vehicleModel.includes(q) ||
      otp.includes(cleanQ) ||
      spotTitle.includes(q) ||
      spotAddress.includes(q)
    );
  };

  const allSearchMatches = myHostBookings.filter(matchesQuery);
  const tabMatches = allSearchMatches.filter((b) => {
    if (bookingFilter === 'CONFIRMED') return b.status === 'CONFIRMED';
    if (bookingFilter === 'ACTIVE') return b.status === 'ACTIVE';
    if (bookingFilter === 'COMPLETED') return b.status === 'COMPLETED';
    return true;
  });

  const isCrossTabFallback = hasSearch && bookingFilter !== 'ALL' && tabMatches.length === 0 && allSearchMatches.length > 0;
  const filteredBookings = isCrossTabFallback ? allSearchMatches : tabMatches;

  return (
    <div className="w-full pb-12">
      {/* Scoped styles to completely remove spin buttons and scrollbar arrows without modifying index.css */}
      <style>{`
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          appearance: none !important;
          margin: 0 !important;
          display: none !important;
        }
        input,
        input[type="number"] {
          -moz-appearance: textfield !important;
        }
        /* Completely eliminate scrollbars and scroll arrows */
        ::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        * {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
      `}</style>

      {/* Host KYC Incomplete Warning Banner */}
      {!isHostProfileComplete && (
        <div className="w-full bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white rounded-3xl p-5 sm:p-6 mb-6 shadow-md border border-amber-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                ⚠️ Host Verification Required
              </span>
              <span className="text-xs text-amber-100 font-bold">Profile Incomplete</span>
            </div>
            <h3 className="text-lg font-black text-white">
              Complete your Host Details, Location & Aadhaar Photo
            </h3>
            <p className="text-xs text-amber-100 max-w-xl leading-relaxed">
              Before you can list parking bays or receive bookings from drivers, you must fill your Name, Contact Phone, Property Location (City/Address), 12-digit Aadhaar Number, and upload your Aadhaar document photo.
            </p>
          </div>
          <Link
            to="/profile?incomplete=true"
            className="px-5 py-2.5 bg-white text-slate-900 hover:bg-slate-100 text-xs font-black rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
          >
            Complete Host Profile & ID →
          </Link>
        </div>
      )}

      {/* Host Dashboard Hero Banner */}
      <div className="w-full bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 text-white rounded-3xl p-6 sm:p-8 mb-6 shadow-xs border border-emerald-800/40">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <img src="/logo.png" alt="Namma Spots" className="h-12 w-auto object-contain bg-white rounded-lg p-0.5 shadow-xs" />
              <span className="text-[11px] font-black tracking-wider uppercase bg-white/20 px-2.5 py-0.5 rounded-full border border-white/10">
                Host Control Center
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-1">
              Namma Spots Host Dashboard
            </h2>
            <p className="text-emerald-100/90 text-sm">
              Manage your driveways, verify driver check-in OTPs, and control your parking bays.
            </p>
          </div>

          <div className="flex gap-3 items-center flex-wrap">
            <div className="bg-white/15 px-4 py-2.5 rounded-2xl text-center min-w-[100px] border border-white/10 backdrop-blur-xs">
              <span className="block text-2xl font-black text-white">{spots.length}</span>
              <span className="text-[10px] uppercase tracking-wider text-emerald-200 font-bold">
                Listed Bays
              </span>
            </div>

            <div className="bg-white/15 px-4 py-2.5 rounded-2xl text-center min-w-[100px] border border-white/10 backdrop-blur-xs">
              <span className="block text-2xl font-black text-white">{activeBookings.length}</span>
              <span className="text-[10px] uppercase tracking-wider text-emerald-200 font-bold">
                Vehicles Parked
              </span>
            </div>
          </div>
        </div>

        {/* Host Verified Contact & Aadhaar Identity Summary */}
        <div className="mt-5 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-100">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isHostProfileComplete ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
              Host Contact: <strong className="text-white">{currentUser?.name || form.contactName || 'Host'}</strong>
            </span>
            <span>
              Phone: <strong className="text-white">{currentUser?.phone || form.contactPhone || 'Not set'}</strong>
            </span>
            <span>
              Host Aadhaar: <strong className="text-white">{currentUser?.aadhaarNumber ? `Verified (**** ${currentUser.aadhaarNumber.slice(-4)})` : 'Pending Verification'}</strong>
            </span>
          </div>
          <Link
            to="/profile"
            className="bg-white/15 hover:bg-white/25 text-white font-bold px-3 py-1 rounded-xl text-xs border border-white/20 transition-all flex items-center gap-1"
          >
            <span>{isHostProfileComplete ? 'Edit Host Profile & Aadhaar' : 'Complete Verification'}</span>
            <span>↗</span>
          </Link>
        </div>
      </div>

      {msg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-sm font-semibold mb-6 flex items-center justify-between shadow-xs">
          <span>{msg}</span>
          <button onClick={() => setMsg('')} className="text-emerald-700 hover:text-emerald-900 font-bold text-xs cursor-pointer ml-3">✕</button>
        </div>
      )}

      {/* Modern 3-Tab Navigation Bar */}
      <div className="flex border-b-2 border-slate-200 mb-6 gap-2 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setActiveTab('bookings')}
          className={`py-2.5 px-4 font-bold text-sm transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap rounded-t-xl border-b-2 ${activeTab === 'bookings'
              ? 'border-emerald-600 text-emerald-800 bg-emerald-50/60'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
        >
          <span>Gate Check-in & Reservations ({bookings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('spots')}
          className={`py-2.5 px-4 font-bold text-sm transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap rounded-t-xl border-b-2 ${activeTab === 'spots'
              ? 'border-emerald-600 text-emerald-800 bg-emerald-50/60'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
        >
          <span>My Listed Bays ({spots.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('create')}
          className={`py-2.5 px-4 font-bold text-sm transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap rounded-t-xl border-b-2 ${activeTab === 'create'
              ? 'border-emerald-600 text-emerald-800 bg-emerald-50/60'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
        >
          <span>List a New Space</span>
        </button>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center p-16 gap-3 text-slate-500">
          <div className="w-10 h-10 border-3 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
          <p className="text-sm font-semibold">Syncing parking bays and reservations...</p>
        </div>
      )}

      {/* ========================================================
          TAB 1: GATE CHECK-IN & RESERVATIONS SUITE
         ======================================================== */}
      {!loading && activeTab === 'bookings' && (
        <div>
          {/* Gate KPI Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white border-l-4 border-l-emerald-500 border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Currently Parked</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">{activeBookings.length}</span>
              <span className="text-[11px] text-slate-500 mt-1">Vehicles inside bays</span>
            </div>

            <div className="bg-white border-l-4 border-l-amber-500 border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Awaiting Arrival</span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">{confirmedBookings.length}</span>
              <span className="text-[11px] text-slate-500 mt-1">Ready for OTP check-in</span>
            </div>

            <div className="bg-white border-l-4 border-l-indigo-500 border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Revenue</span>
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">INR</span>
              </div>
              <span className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">₹{totalHostRevenue}</span>
              <span className="text-[11px] text-slate-500 mt-1">Earnings from bookings</span>
            </div>

            <div className={`bg-white border-l-4 ${overtimeCount > 0 ? 'border-l-red-500' : 'border-l-slate-300'} border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Overtime Alert</span>
                {overtimeCount > 0 ? (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded-md">Alert</span>
                ) : (
                  <span className="text-xs font-bold text-emerald-600">Normal</span>
                )}
              </div>
              <span className={`text-2xl sm:text-3xl font-black leading-tight ${overtimeCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                {overtimeCount}
              </span>
              <span className="text-[11px] text-slate-500 mt-1">Past booked checkout time</span>
            </div>
          </div>

          {/* Filter Bar & Search Input */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-xl overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${bookingFilter === 'ALL'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
                onClick={() => setBookingFilter('ALL')}
              >
                All ({myHostBookings.length})
              </button>
              <button
                type="button"
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${bookingFilter === 'CONFIRMED'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
                onClick={() => setBookingFilter('CONFIRMED')}
              >
                Awaiting Check-in ({confirmedBookings.length})
              </button>
              <button
                type="button"
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${bookingFilter === 'ACTIVE'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
                onClick={() => setBookingFilter('ACTIVE')}
              >
                Parked Now ({activeBookings.length})
              </button>
              <button
                type="button"
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${bookingFilter === 'COMPLETED'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                  }`}
                onClick={() => setBookingFilter('COMPLETED')}
              >
                Completed ({completedBookings.length})
              </button>
            </div>

            <div className="flex-1 min-w-[280px] max-w-md bg-white border border-slate-300 rounded-xl px-3.5 py-2 flex items-center gap-2 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-500/20">
              <span className="text-slate-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Search plate (TN49), driver name, ref..."
                value={bookingSearch}
                onChange={(e) => setBookingSearch(e.target.value)}
                className="w-full border-none outline-none bg-transparent text-xs text-slate-900 placeholder:text-slate-400"
              />
              {bookingSearch && (
                <button
                  type="button"
                  onClick={() => setBookingSearch('')}
                  className="bg-slate-100 text-slate-400 hover:text-slate-700 rounded-full w-5 h-5 flex items-center justify-center text-xs cursor-pointer"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Active Search Notification Banner */}
          {hasSearch && (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 mb-5 text-xs text-blue-900">
              <div>
                <span>Found <strong>{filteredBookings.length}</strong> reservation{filteredBookings.length === 1 ? '' : 's'} matching <strong>"{bookingSearch}"</strong></span>
                {isCrossTabFallback && <span className="ml-2 text-blue-600 font-semibold">(showing across all statuses)</span>}
              </div>
              <button
                type="button"
                onClick={() => setBookingSearch('')}
                className="text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer"
              >
                Clear Search
              </button>
            </div>
          )}

          {/* Reservations Empty State */}
          {filteredBookings.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-xs">
              <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 mx-auto mb-3 border border-slate-200">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {bookingFilter === 'CONFIRMED'
                  ? 'No Drivers Awaiting Arrival'
                  : bookingFilter === 'ACTIVE'
                    ? 'No Vehicles Currently Parked'
                    : bookingFilter === 'COMPLETED'
                      ? 'No Completed Bookings Yet'
                      : 'No Bookings on Your Parking Bays'}
              </h3>
              <p className="text-slate-500 text-xs mt-1.5 max-w-md mx-auto leading-relaxed">
                {bookingSearch
                  ? `No reservations match "${bookingSearch}". Try checking your spelling or clearing the search.`
                  : bookingFilter === 'CONFIRMED'
                    ? 'When a driver reserves one of your parking bays, their arrival card and check-in OTP will appear here in Awaiting Arrival.'
                    : 'Only bookings made specifically for your own listed parking bays appear in this host dashboard.'}
              </p>
              {bookingSearch && (
                <button
                  type="button"
                  onClick={() => setBookingSearch('')}
                  className="mt-3 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
                >
                  Clear Search Filter
                </button>
              )}
            </div>
          )}

          {/* Reservations Cards List */}
          <div className="flex flex-col gap-4">
            {filteredBookings.map((b) => {
              const spot = b.spot || {};
              const start = new Date(b.startTime);
              const end = new Date(b.endTime);
              const isOvertime = b.status === 'ACTIVE' && nowMs > end.getTime();
              const overtimeMins = isOvertime ? Math.round((nowMs - end.getTime()) / 60000) : 0;
              const rate = spot.hourlyRate || 40;
              const overtimeExtra = isOvertime ? Math.ceil(overtimeMins / 60) * rate : 0;

              return (
                <div
                  key={b._id}
                  className={`bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all ${b.status === 'ACTIVE'
                      ? (isOvertime ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-emerald-500')
                      : b.status === 'CONFIRMED'
                        ? 'border-l-4 border-l-amber-500'
                        : 'border-l-4 border-l-slate-300'
                    }`}
                >
                  {/* Top Bar: License Plate, Status Badge, Overtime Alert */}
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Indian License Plate Badge */}
                      <div className="inline-flex items-center bg-white border-2 border-slate-900 rounded-md overflow-hidden shadow-xs">
                        <span className="bg-blue-900 text-white text-[10px] font-black px-1.5 py-1 tracking-wider">IND</span>
                        <span className="font-mono text-sm font-black text-slate-900 px-2.5 py-1 tracking-widest">{b.vehicleNumber}</span>
                      </div>

                      {b.vehicleModel && (
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                          {b.vehicleModel}
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide ${b.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : b.status === 'CONFIRMED'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                      >
                        {b.status === 'ACTIVE' ? '● Parked in Bay' : b.status === 'CONFIRMED' ? 'Awaiting Check-in' : '✓ Completed'}
                      </span>
                    </div>

                    {isOvertime && (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold px-3 py-1 rounded-full bg-red-100 text-red-700 border border-red-200 animate-pulse">
                        <span>OVERTIME:</span>
                        <span>+{overtimeMins} mins past exit (+₹{overtimeExtra})</span>
                      </span>
                    )}

                    <span className="text-xs font-mono font-bold text-slate-400">
                      #{b._id.slice(-6).toUpperCase()}
                    </span>
                  </div>

                  {/* Middle Grid: Bay Details & Driver Contact */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <span className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-1">ASSIGNED PARKING BAY</span>
                      <h4 className="text-base font-bold text-slate-900">{spot.title || 'Reserved Parking Bay'}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{spot.address || 'Host Property'}</p>
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-1">DRIVER CONTACT & IDENTITY (KYC)</span>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <strong className="text-sm text-slate-900">{b.driverName || 'Guest Driver'}</strong>
                        {b.driverPhone && (
                          <a
                            href={`tel:${b.driverPhone}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors"
                          >
                            Call {b.driverPhone}
                          </a>
                        )}
                        {b.driverPhone && (
                          <a
                            href={`https://wa.me/${b.driverPhone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors"
                          >
                            WhatsApp
                          </a>
                        )}
                      </div>

                      {/* Driver Aadhaar & Licence Verification Button */}
                      <button
                        type="button"
                        onClick={() => setViewKycBooking(b)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-xl border transition-all cursor-pointer shadow-xs ${b.isKycVerified || (b.aadhaarNumber && b.licenceNumber)
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                          }`}
                        title="View driver Aadhaar Card & Driving Licence documents"
                      >
                        <span>
                          {b.isKycVerified || (b.aadhaarNumber && b.licenceNumber)
                            ? '✓ Verified ID: View Aadhaar & Licence'
                            : 'View Driver ID & Documents'}
                        </span>
                        <span className="text-[10px] bg-white/80 px-1.5 py-0.5 rounded-full border border-current">
                          Inspect ➔
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Action Toolbar & Summary */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-4">
                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">RESERVED TIME</span>
                        <strong className="text-xs font-bold text-slate-900">
                          {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} →{' '}
                          {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                          <span className="text-slate-400 font-normal">({start.toLocaleDateString()})</span>
                        </strong>
                      </div>

                      <div>
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">TOTAL AMOUNT</span>
                        <strong className="text-base font-black text-emerald-600">₹{b.totalAmount}</strong>
                      </div>

                      {b.status === 'CONFIRMED' && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1 rounded-lg text-xs font-bold">
                          Expected OTP: <strong className="text-amber-800">{b.otp}</strong>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/booking/${b._id}`, { state: { booking: b } })}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer"
                        title="View Digital Pass & Receipt"
                      >
                        View Pass
                      </button>

                      {b.status === 'CONFIRMED' && (
                        <button
                          type="button"
                          onClick={() => openCheckInModal(b)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          Verify OTP & Unlock Gate
                        </button>
                      )}

                      {b.status === 'ACTIVE' && (
                        <button
                          type="button"
                          onClick={() => openCheckoutModal(b)}
                          className={`px-4 py-2 text-white text-xs font-extrabold rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 ${isOvertime ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'
                            }`}
                        >
                          Check Out & Settle
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 2: MY LISTED PARKING BAYS (FULL CRUD OPERATIONS)
         ======================================================== */}
      {!loading && activeTab === 'spots' && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900">
                My Listed Parking Bays ({spots.length})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Full CRUD control: Edit details, contact info & photos, toggle online availability, or delete bays anytime.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              + List a New Space
            </button>
          </div>

          {spots.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
              <div className="text-4xl mb-3">🅿️</div>
              <h3 className="text-lg font-bold text-slate-900">No Parking Bays Listed Yet</h3>
              <p className="text-slate-500 text-xs max-w-md mx-auto my-2">
                Turn your driveway, portico, or garage into passive income. List your parking space in under 1 minute!
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className="mt-3 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                + List Your First Parking Space
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {spots.map((s) => {
              const spotBookings = bookings.filter((b) => b.spot?._id === s._id || b.spot === s._id);
              const spotPhotos = (Array.isArray(s.photos) && s.photos.length > 0)
                ? s.photos
                : (s.photoUrl ? [s.photoUrl] : []);
              const hasPhotos = spotPhotos.length > 0;
              const coverPhoto = spotPhotos[0];

              return (
                <div
                  key={s._id}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  {/* Card Media Header */}
                  {hasPhotos ? (
                    <div className="relative h-44 w-full bg-slate-900 overflow-hidden cursor-pointer" onClick={() => openHostGallery(s, 0)}>
                      <img
                        src={coverPhoto}
                        alt={s.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&auto=format&fit=crop&q=80';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-black/40" />

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-slate-900/80 backdrop-blur-md text-white px-2.5 py-1 rounded-full border border-white/20">
                          Parking Bay
                        </span>
                        <span
                          className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border shadow-xs pointer-events-auto ${s.isActive
                              ? 'bg-emerald-500/90 text-white border-emerald-400'
                              : 'bg-slate-800/90 text-slate-300 border-slate-600'
                            }`}
                        >
                          {s.isActive ? '● Available' : '○ Offline'}
                        </span>
                      </div>

                      {/* Bottom Info Bar on Image */}
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                        <span className="text-xs font-bold bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10 flex items-center gap-1.5">
                          {spotPhotos.length} {spotPhotos.length === 1 ? 'Photo' : 'Photos'}
                        </span>
                        <span className="text-[11px] font-bold bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20 hover:bg-white/30 transition-colors">
                          View All
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5 pb-4 flex justify-between items-start border-b border-slate-100 bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center p-1 shrink-0 border border-emerald-300">
                          <img src="/logo.png" alt="Namma Spots" className="h-20 w-auto object-contain" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                            PARKING BAY
                          </span>
                          <h4 className="font-extrabold text-slate-900 text-base leading-snug">{s.title}</h4>
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border shrink-0 ${s.isActive
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                      >
                        {s.isActive ? '● Available' : '○ Offline'}
                      </span>
                    </div>
                  )}

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start gap-2 mb-1.5">
                        <h4 className="font-extrabold text-slate-900 text-base leading-snug">{s.title}</h4>
                        <span className="text-base font-black text-emerald-600 whitespace-nowrap">₹{s.hourlyRate}/hr</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">{s.address}</p>

                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-600 mb-3">
                        <strong>Host:</strong> {s.contactPhone || '+91 98424 12345'} {s.contactName ? `(${s.contactName})` : ''}
                      </div>

                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {(s.vehicleTypes || ['SEDAN']).map((vt) => (
                          <span key={vt} className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                            {vt}
                          </span>
                        ))}
                        {(s.amenities || []).slice(0, 2).map((am) => (
                          <span key={am} className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md">
                            {am}
                          </span>
                        ))}
                      </div>

                      <div className="text-xs text-slate-400 mb-4">
                        Reservations: <strong className="text-slate-700">{spotBookings.length}</strong> total
                      </div>
                    </div>

                    {/* Actions Toolbar */}
                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(s)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 transition-colors cursor-pointer"
                          title="Edit title, rates, contact info and photos"
                        >
                          Edit
                        </button>
                        {hasPhotos && (
                          <button
                            type="button"
                            onClick={() => openHostGallery(s, 0)}
                            className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-bold rounded-lg border border-sky-200 transition-colors cursor-pointer"
                            title="View all photos in gallery"
                          >
                            {spotPhotos.length} Photos
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleSpotOnline(s._id)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${s.isActive
                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                        >
                          {s.isActive ? 'Set Offline' : 'Set Available'}
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingSpot(s)}
                          className="px-2.5 py-1.5 bg-white hover:bg-red-50 text-red-600 hover:text-red-700 border border-red-200 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                          title="Permanently delete this bay"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================
          TAB 3: LIST A NEW PARKING SPACE
         ======================================================== */}
      {!loading && activeTab === 'create' && (
        <div className="mt-2">
          <form className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs" onSubmit={createSpot}>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900">List a New Parking Space</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Upload device photos, auto-fill address with GPS, and set host contact instructions.
                </p>
              </div>

              <button
                type="button"
                onClick={detectLocation}
                disabled={gpsLoading}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {gpsLoading ? 'Detecting GPS...' : 'Use Current GPS to Auto-Fill'}
              </button>
            </div>

            {form.gpsVerified && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-3 rounded-xl flex items-center gap-2 mb-6">
                <span>✓</span>
                <span><strong>Location Verified:</strong> Coordinates captured automatically in the background. Address fields auto-filled below.</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Spot Title</label>
                <input
                  placeholder="e.g. Covered Portico & Gated Driveway"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700">Street Address / Landmark</label>
                  <button
                    type="button"
                    onClick={geocodeAddress}
                    disabled={gpsLoading}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-0.5 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                    title="Lookup map pin and coordinates for this address"
                  >
                    {gpsLoading ? 'Looking up Pin...' : 'Locate Pin from Address'}
                  </button>
                </div>
                <input
                  placeholder="e.g. Near Main Road / Junction Avenue"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Area / Locality</label>
                  <input
                    value={form.area}
                    onChange={(e) => setForm({ ...form, area: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                  <input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pincode</label>
                  <input
                    value={form.pincode}
                    onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Precise Coordinates & Live Pin Verification */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Map Coordinates & GPS Pin (Verified)
                  </span>
                  {form.lat && form.lng && (
                    <a
                      href={`https://www.google.com/maps?q=${form.lat},${form.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-bold text-sky-700 hover:text-sky-900 underline flex items-center gap-1"
                    >
                      <span>Preview Pin on Google Maps</span>
                      <span>↗</span>
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Latitude (GPS)</label>
                    <input
                      type="text"
                      value={form.lat}
                      onChange={(e) => setForm({ ...form, lat: e.target.value })}
                      placeholder="10.7181"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">Longitude (GPS)</label>
                    <input
                      type="text"
                      value={form.lng}
                      onChange={(e) => setForm({ ...form, lng: e.target.value })}
                      placeholder="79.0849"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Hourly Parking Rate (₹/hr)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm pointer-events-none">₹</span>
                  <input
                    key="create-hourly-rate-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    value={form.hourlyRate}
                    onChange={(e) => setForm({ ...form, hourlyRate: e.target.value.replace(/\D/g, '') })}
                    placeholder="40"
                    style={{ MozAppearance: 'textfield' }}
                    className="w-full pl-8 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:hidden"
                    required
                  />
                </div>
              </div>

              {/* Host Contact Details */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-extrabold text-slate-800">
                    Host Contact Details (Shared with Arriving Drivers)
                  </label>
                  <Link
                    to="/profile"
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline"
                  >
                    Update Profile & Aadhaar ↗
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Contact Person Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ananya Verma (Host)"
                      value={form.contactName}
                      onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Contact Phone Number
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. +91 98424 12345"
                      value={form.contactPhone}
                      onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Host Aadhaar Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 4512 8901 2345"
                      value={form.hostAadhaarNumber}
                      onChange={(e) => setForm({ ...form, hostAadhaarNumber: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Supported Vehicle Types</label>
                <div className="flex flex-wrap gap-2">
                  {VEHICLE_OPTIONS.map((vt) => {
                    const active = form.vehicleTypes.includes(vt);
                    return (
                      <button
                        type="button"
                        key={vt}
                        onClick={() => toggleVehicleType(vt)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${active
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                      >
                        {active ? '✓ ' : ''}{vt}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Key Amenities</label>
                <div className="flex flex-wrap gap-2">
                  {AMENITY_OPTIONS.map((am) => {
                    const active = form.amenities.includes(am);
                    return (
                      <button
                        type="button"
                        key={am}
                        onClick={() => toggleAmenity(am)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${active
                            ? 'bg-emerald-50 border border-emerald-400 text-emerald-800 shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-transparent'
                          }`}
                      >
                        {active ? '✓ ' : ''}{am}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* MULTIPLE PHOTOS UPLOAD SECTION */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700">
                      Parking Bay Photos (Upload Multiple Photos)
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Add photos of your entrance gate, covered portico, bay markings, and CCTV to build driver trust. First photo is used as the cover photo.
                    </p>
                  </div>
                  {form.photos.length > 0 && (
                    <span className="text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-full">
                      {form.photos.length} Photo{form.photos.length === 1 ? '' : 's'} Selected
                    </span>
                  )}
                </div>

                {/* Upload Action Area */}
                <div className="mb-3">
                  {/* Device File Upload */}
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/60 hover:bg-emerald-50/30 rounded-2xl p-5 text-center cursor-pointer transition-all">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-1.5">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-slate-800">
                      {photoUploading ? 'Compressing Photos...' : 'Upload Photos from Device'}
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5">
                      Select multiple JPG, PNG, or WebP files • Auto-compressed for fast loading
                    </span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleMultiplePhotoUploadForNewSpot}
                      disabled={photoUploading}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Thumbnail Preview Strip */}
                {form.photos.length > 0 ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                      {form.photos.map((photo, idx) => {
                        const isPrimary = idx === 0;
                        return (
                          <div
                            key={idx}
                            className={`group relative rounded-xl overflow-hidden border-2 bg-slate-900 aspect-video sm:aspect-square flex flex-col justify-between shadow-xs transition-all ${isPrimary ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-slate-400'
                              }`}
                          >
                            <img
                              src={photo}
                              alt={`Spot photo ${idx + 1}`}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&auto=format&fit=crop&q=80';
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 opacity-90 group-hover:opacity-100 transition-opacity" />

                            {/* Top Badges */}
                            <div className="absolute top-1.5 left-1.5 right-1.5 flex justify-between items-center">
                              {isPrimary ? (
                                <span className="bg-emerald-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                                  <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                  Cover Photo
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setNewSpotPrimaryPhoto(idx)}
                                  className="bg-black/70 hover:bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md transition-colors cursor-pointer"
                                  title="Make this photo the primary cover photo"
                                >
                                  Make Cover
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => removePhotoFromNewSpot(idx)}
                                className="w-5 h-5 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-[10px] font-black transition-colors cursor-pointer ml-auto"
                                title="Remove photo"
                              >
                                ✕
                              </button>
                            </div>

                            {/* Bottom Label */}
                            <div className="absolute bottom-1.5 left-1.5 right-1.5 text-center">
                              <span className="text-[10px] text-white/90 font-medium">
                                #{idx + 1}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center text-xs text-slate-500">
                    No photos attached yet. You can list now and upload photos later via <strong>Edit Bay</strong> anytime.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Gate Arrival Instructions for Drivers</label>
                <textarea
                  rows="2"
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  placeholder="e.g. Gated entrance. Ring calling bell at Gate #1 or call on arrival."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold rounded-xl shadow-xs transition-colors cursor-pointer mt-4"
              >
                ✓ List Parking Bay Now
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Parking Bay Modal */}
      <EditSpotModal
        spot={editingSpot}
        editForm={editForm}
        setEditForm={setEditForm}
        editModalError={editModalError}
        editModalSuccess={editModalSuccess}
        savingEdit={savingEdit}
        editPhotoUploading={editPhotoUploading}
        vehicleOptions={VEHICLE_OPTIONS}
        amenityOptions={AMENITY_OPTIONS}
        onClose={() => setEditingSpot(null)}
        onSubmit={saveEditSpot}
        onUploadPhotos={handleMultiplePhotoUploadForEditSpot}
        onSetCoverPhoto={setEditSpotPrimaryPhoto}
        onRemovePhoto={removePhotoFromEditSpot}
        onOpenGallery={(idx) => openHostGallery({ ...editingSpot, photos: editForm.photos }, idx)}
      />

      {/* Delete Spot Confirmation Modal */}
      <DeleteSpotModal
        spot={deletingSpot}
        deleteLoading={deleteLoading}
        onClose={() => setDeletingSpot(null)}
        onConfirm={confirmDeleteSpot}
      />

      {/* Gate Check-in OTP Verification Modal */}
      <CheckInModal
        booking={activeCheckInBooking}
        inputOtp={inputOtp}
        setInputOtp={setInputOtp}
        otpError={otpError}
        onClose={() => setActiveCheckInBooking(null)}
        onSubmit={handleCheckInSubmit}
      />

      {/* Gate Checkout & Settlement Modal */}
      <CheckoutModal
        booking={activeCheckoutBooking}
        checkoutLoading={checkoutLoading}
        onClose={() => setActiveCheckoutBooking(null)}
        onConfirm={confirmCheckoutSubmit}
      />

      {/* Driver KYC Verification Details Modal */}
      <DriverKycModal
        booking={viewKycBooking}
        onClose={() => setViewKycBooking(null)}
        onInspectDoc={(doc) => setKycDocModal(doc)}
        onVerifyOtp={(b) => {
          setViewKycBooking(null);
          openCheckInModal(b);
        }}
      />

      {/* Spot Photo Gallery Lightbox */}
      <LightboxModal
        isOpen={Boolean(hostGalleryModal)}
        onClose={closeHostGallery}
        title={hostGalleryModal?.spot?.title || 'Parking Space'}
        photos={
          Array.isArray(hostGalleryModal?.spot?.photos) && hostGalleryModal.spot.photos.length > 0
            ? hostGalleryModal.spot.photos
            : hostGalleryModal?.spot?.photoUrl
              ? [hostGalleryModal.spot.photoUrl]
              : []
        }
        activeIndex={hostGalleryModal?.activeIndex || 0}
        setActiveIndex={(idx) =>
          setHostGalleryModal((prev) => (prev ? { ...prev, activeIndex: idx } : null))
        }
      />

      {/* KYC High-Res Document Lightbox */}
      <LightboxModal
        isOpen={Boolean(kycDocModal)}
        onClose={() => setKycDocModal(null)}
        title={kycDocModal?.title}
        photos={kycDocModal?.url ? [kycDocModal.url] : []}
        activeIndex={0}
      />

    </div>
  );
}
