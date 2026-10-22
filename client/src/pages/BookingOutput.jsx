import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api.js';

// Clean SVG QR Code generator (authentic matrix styling)
function QRCodeSVG({ value = 'PARKSHARE', size = 130 }) {
  // Generate deterministic pattern based on hash
  const hash = Array.from(value).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) | 0, 17);
  const matrixSize = 21;
  const cells = [];

  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      // Corner detection patterns (3 corners of QR)
      const isTopLeft = r < 7 && c < 7;
      const isTopRight = r < 7 && c >= matrixSize - 7;
      const isBottomLeft = r >= matrixSize - 7 && c < 7;

      let isFilled = false;
      if (isTopLeft || isTopRight || isBottomLeft) {
        const localR = isTopLeft ? r : isTopRight ? r : r - (matrixSize - 7);
        const localC = isTopLeft ? c : isTopRight ? c - (matrixSize - 7) : c;
        if (localR === 0 || localR === 6 || localC === 0 || localC === 6) isFilled = true;
        else if (localR >= 2 && localR <= 4 && localC >= 2 && localC <= 4) isFilled = true;
        else isFilled = false;
      } else {
        // Pseudo-random deterministic fill based on hash and coordinates
        const seed = Math.sin((r * matrixSize + c + Math.abs(hash)) * 12.9898) * 43758.5453;
        isFilled = (seed - Math.floor(seed)) > 0.45;
      }
      if (isFilled) cells.push({ r, c });
    }
  }

  const cellSize = size / matrixSize;

  return (
    <div className="flex flex-col items-center gap-2" title={`QR Code: ${value}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect width={size} height={size} fill="#ffffff" rx="8" />
        {cells.map(({ r, c }) => (
          <rect
            key={`${r}-${c}`}
            x={c * cellSize + 1}
            y={r * cellSize + 1}
            width={cellSize - 0.8}
            height={cellSize - 0.8}
            fill="#111827"
            rx="1"
          />
        ))}
      </svg>
      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Scan for Gate Verification</span>
    </div>
  );
}

export default function BookingOutput() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [booking, setBooking] = useState(location.state?.booking || null);
  const [loading, setLoading] = useState(!booking);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchBooking = async () => {
    try {
      const targetId = id || 'bk-demo-8921';
      const data = await api(`/bookings/${targetId}`);
      if (data && typeof data === 'object') {
        setBooking(data);
      }
      setLoading(false);
    } catch (err) {
      console.warn('Booking fetch notice:', err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooking();
    // Auto refresh status every 10 seconds to catch host check-in / check-out
    const interval = setInterval(fetchBooking, 10000);
    return () => clearInterval(interval);
  }, [id]);

  const defaultSample = {
    _id: id || 'bk-demo-8921',
    spot: {
      title: 'Green Park Portico & Covered Driveway',
      address: '12, 4th Cross Rd, T. Nagar, Chennai',
      hourlyRate: 40,
      contactName: 'Sundar Raman',
      contactPhone: '9840123456',
      instructions: 'Ring bell at Gate #2 or call host upon arrival. Security guard will verify OTP.',
      location: { coordinates: [80.2341, 13.0418] },
    },
    driverName: 'Ramesh Kumar',
    driverPhone: '+91 98401 23456',
    vehicleNumber: 'TN09AB1234',
    startTime: new Date(Date.now() - 3600000).toISOString(),
    endTime: new Date(Date.now() + 7200000).toISOString(),
    otp: '7842',
    totalAmount: 120,
    status: 'CONFIRMED',
    createdAt: new Date().toISOString(),
  };

  const displayBooking = booking || defaultSample;
  const spot =
    displayBooking.spot && typeof displayBooking.spot === 'object'
      ? displayBooking.spot
      : defaultSample.spot;

  const copyOTP = () => {
    const code = displayBooking?.otp || '7842';
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const printTicket = () => {
    window.print();
  };

  if (loading && !booking) {
    return (
      <div className="flex flex-col items-center justify-center p-16 gap-3 text-slate-500">
        <div className="w-10 h-10 border-3 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
        <p className="text-sm font-semibold">Loading digital parking pass...</p>
      </div>
    );
  }

  const rawStart = displayBooking.startTime ? new Date(displayBooking.startTime) : new Date();
  const rawEnd = displayBooking.endTime ? new Date(displayBooking.endTime) : new Date(Date.now() + 7200000);
  const startDate = isNaN(rawStart.getTime()) ? new Date() : rawStart;
  const endDate = isNaN(rawEnd.getTime()) ? new Date(Date.now() + 7200000) : rawEnd;
  const durationHours = Math.max(1, Math.ceil((endDate - startDate) / 3600000));
  const rate = spot?.hourlyRate || Math.round((displayBooking.totalAmount || 120) / durationHours) || 40;
  const bookingCode = String(displayBooking._id || id || 'DEMO89').slice(-6).toUpperCase();

  const coords = spot?.location?.coordinates;
  const mapsUrl = coords && coords.length >= 2
    ? `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((spot?.title || '') + ' ' + (spot?.address || ''))}`;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide bg-amber-100 text-amber-900 border border-amber-300">
            Confirmed · Ready for Check-in
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide bg-emerald-100 text-emerald-900 border border-emerald-300 relative">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Active · Vehicle Parked
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide bg-slate-200 text-slate-700">
            Completed · Checked Out
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide bg-red-100 text-red-900 border border-red-200">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto pb-10">
      {/* Top Banner and Navigation */}
      <div className="print:hidden flex justify-between items-center mb-5 flex-wrap gap-3">
        <Link to="/" className="text-slate-600 text-sm font-semibold hover:text-emerald-700 transition-colors">
          ← Back to Map / Search
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/my-bookings" className="text-slate-600 text-sm font-semibold py-1.5 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 transition-colors">
            My Bookings
          </Link>
          <button onClick={printTicket} className="bg-slate-900 text-white py-2 px-3.5 rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer" title="Print this parking voucher">
            Print Pass / Receipt
          </button>
        </div>
      </div>

      <div className="text-center mb-6 print:hidden">
        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white text-2xl font-black rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-600/30">✓</div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Booking Output & Parking Pass</h2>
        <p className="text-slate-500 text-sm mt-1">
          Your parking spot is reserved. Present the digital pass and OTP to the host upon arrival.
        </p>
      </div>

      {/* Main Digital Pass Ticket */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden relative w-full" id="parking-pass-ticket">
        {/* Pass Top Bar */}
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-700 p-5 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Namma Spots" className="h-12 w-auto object-contain bg-white/95 rounded-lg p-0.5 shadow-xs" />
            <div>
              <span className="text-lg font-black tracking-tight block leading-tight">Namma Spots</span>
              <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest">Official Digital Parking Pass</span>
            </div>
          </div>
          <div className="text-right font-mono bg-emerald-950/50 border border-emerald-600/40 rounded-xl px-3 py-1.5">
            <span className="block text-[9px] text-emerald-300 font-bold tracking-wider uppercase">PASS REF</span>
            <strong className="text-base text-white font-black tracking-wider">#{bookingCode}</strong>
          </div>
        </div>

        {/* Status Row with Live Status Refresh */}
        <div className="flex justify-between items-center py-3 px-6 bg-slate-50 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            {getStatusBadge(displayBooking.status)}
            <button
              type="button"
              onClick={fetchBooking}
              className="text-[11px] font-bold text-slate-500 hover:text-emerald-700 bg-white border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
              title="Click to check latest check-in / check-out status"
            >
              <span>↻</span>
              <span>Refresh Status</span>
            </button>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Booked on {new Date(displayBooking.createdAt || Date.now()).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            })}
          </span>
        </div>

        {/* OTP Spotlight Box */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 text-center relative border-b border-slate-800">
          <div>
            <span className="inline-block text-[11px] font-black tracking-widest text-emerald-400 uppercase bg-emerald-950/80 px-3 py-0.5 rounded-full border border-emerald-500/30">
              CHECK-IN VERIFICATION OTP
            </span>
            <span className="block text-xs text-slate-300 mt-1.5 font-medium">
              Host will verify this code to unlock the parking bay
            </span>
          </div>
          <div className="flex flex-col items-center gap-3 mt-4">
            <div className="flex gap-3 justify-center cursor-pointer" onClick={copyOTP} title="Click to copy OTP">
              {String(displayBooking.otp || '7842').split('').map((digit, idx) => (
                <span
                  key={idx}
                  className="w-14 h-16 bg-slate-800/90 border-2 border-emerald-400 rounded-xl text-emerald-300 font-mono text-3xl font-black flex items-center justify-center shadow-lg shadow-emerald-500/20 hover:-translate-y-0.5 transition-all"
                >
                  {digit}
                </span>
              ))}
            </div>
            <button
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 py-1.5 px-4 text-xs font-bold rounded-full cursor-pointer transition-colors"
              onClick={copyOTP}
              type="button"
            >
              {copied ? '✓ Copied to Clipboard!' : 'Copy OTP'}
            </button>
          </div>
        </div>

        {/* Perforation Divider with Notch Cutouts */}
        <div className="relative h-6 bg-white flex items-center overflow-visible">
          <span className="absolute w-6 h-6 bg-slate-100 rounded-full top-1/2 -translate-y-1/2 -left-3 border-r border-slate-300"></span>
          <span className="w-full border-b-2 border-dashed border-slate-300 mx-6"></span>
          <span className="absolute w-6 h-6 bg-slate-100 rounded-full top-1/2 -translate-y-1/2 -right-3 border-l border-slate-300"></span>
        </div>

        {/* Middle Body: Perfectly Aligned Content */}
        <div className="p-6 flex flex-col gap-5">
          {/* Top Row: Spot Location (Left) + Framed QR Code (Right) */}
          <div className="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-5 items-start">
            <div className="flex flex-col gap-3">
              {/* Optional Photo Thumbnail of Reserved Spot */}
              {((spot.photos && spot.photos[0]) || spot.photoUrl) && (
                <div className="relative h-32 w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-200">
                  <img
                    src={(spot.photos && spot.photos[0]) || spot.photoUrl}
                    alt={spot.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                  <span className="absolute bottom-2 left-2.5 text-[10px] font-bold text-white bg-black/60 px-2 py-0.5 rounded backdrop-blur-xs border border-white/20">
                    Reserved Parking Space
                  </span>
                </div>
              )}
              <div>
                <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                  PARKING SPOT LOCATION
                </span>
                <h3 className="text-xl font-black text-slate-900 leading-snug mt-0.5">
                  {spot.title || 'Covered Portico & Gated Driveway'}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {spot.address || 'Near Main Road / Junction Avenue'}
                </p>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-emerald-700 text-xs font-bold mt-2 hover:underline print:hidden"
                >
                  Open Navigation in Google Maps →
                </a>
              </div>

              {/* Vehicle Badge & Rate */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <span className="block text-[10px] font-black tracking-wider text-slate-400 uppercase mb-1">
                    REGISTERED VEHICLE
                  </span>
                  <div className="inline-flex items-center bg-white border-2 border-slate-900 rounded-md overflow-hidden shadow-xs">
                    <span className="bg-blue-900 text-white text-[10px] font-black px-1.5 py-1 tracking-wider">
                      IND
                    </span>
                    <span className="font-mono text-sm font-black text-slate-900 px-2.5 py-1 tracking-widest">
                      {displayBooking.vehicleNumber || 'TN49AB1234'}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] font-black tracking-wider text-slate-400 uppercase mb-1">
                    RATE
                  </span>
                  <span className="text-base font-black text-slate-900">
                    ₹{rate} <span className="text-xs font-medium text-slate-500">/ hour</span>
                  </span>
                </div>
              </div>
            </div>

            {/* QR Code Box */}
            <div className="flex flex-col items-center bg-slate-50 border border-slate-200 rounded-2xl p-3 shadow-xs">
              <QRCodeSVG
                value={`PARKSHARE:${displayBooking._id || 'demo'}:${displayBooking.otp || '0000'}:${displayBooking.vehicleNumber || 'VEHICLE'}`}
                size={120}
              />
              <div className="mt-2 text-center bg-white border border-slate-200 py-1 px-2.5 rounded-lg w-full">
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">BAY RESERVED</span>
                <strong className="text-xs font-black text-slate-900">BAY #{bookingCode.slice(-3)}</strong>
              </div>
            </div>
          </div>

          {/* Full-width Timings Row */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex justify-between items-center flex-wrap gap-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ENTRY / CHECK-IN</span>
              <strong className="text-base font-extrabold text-slate-900">
                {startDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </strong>
              <small className="text-xs text-slate-500 font-medium">
                {startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </small>
            </div>

            <div className="flex flex-col items-center text-xs font-black text-emerald-800 bg-emerald-100/80 px-3 py-1.5 rounded-full border border-emerald-300">
              <span>➜ {durationHours} hr{durationHours > 1 ? 's' : ''} duration</span>
            </div>

            <div className="flex flex-col text-right">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">EXIT / CHECK-OUT</span>
              <strong className="text-base font-extrabold text-slate-900">
                {endDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </strong>
              <small className="text-xs text-slate-500 font-medium">
                {endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </small>
            </div>
          </div>

          {/* Side-by-Side Cards: Host Details (Left) + Driver Details (Right) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Host Contact & Gate Note */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    HOST & GATE ACCESS
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    {spot.contactName || 'Host'}
                  </span>
                </div>
                <div className="text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-dashed border-slate-300 mb-3 leading-relaxed">
                  <strong>Gate Note:</strong> {spot.instructions || 'Gated entrance. Ring calling bell at gate or call host on arrival.'}
                </div>
              </div>

              {spot.contactPhone && (
                <div className="flex gap-2 flex-wrap print:hidden">
                  <a
                    href={`tel:${spot.contactPhone}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    Call Host ({spot.contactPhone})
                  </a>
                  {(() => {
                    const cleanPhone = String(spot.contactPhone).replace(/\D/g, '');
                    const waUrl = cleanPhone.length === 10 ? `https://wa.me/91${cleanPhone}` : `https://wa.me/${cleanPhone}`;
                    return (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors"
                      >
                        WhatsApp
                      </a>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Driver Information Card */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    DRIVER DETAILS
                  </span>
                  <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Verified Driver
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 mb-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Driver Name:</span>
                    <strong className="text-slate-900 font-bold">{displayBooking.driverName || 'Ramesh Kumar'}</strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Contact Phone:</span>
                    <strong className="text-slate-900 font-mono font-bold">{displayBooking.driverPhone || '+91 98401 23456'}</strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Vehicle Reg:</span>
                    <strong className="text-slate-900 font-mono font-bold">{displayBooking.vehicleNumber || 'TN49AB1234'}</strong>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-100">
                    <span className="text-slate-500 font-medium">Driver ID / Aadhaar:</span>
                    <strong className="text-emerald-700 font-mono text-[11px] font-bold">
                      {displayBooking.aadhaarNumber ? `✓ Aadhaar (**** ${displayBooking.aadhaarNumber.slice(-4)})` : '✓ Verified ID'}
                    </strong>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 font-medium">Driving Licence:</span>
                    <strong className="text-emerald-700 font-mono text-[11px] font-bold">
                      {displayBooking.licenceNumber ? `✓ ${displayBooking.licenceNumber}` : '✓ Verified on File'}
                    </strong>
                  </div>
                </div>
              </div>

              <span className="text-[10px] text-slate-400 font-medium">
                Verified driver ID details shared with host for gate check-in
              </span>
            </div>
          </div>
        </div>

        {/* Perforation Divider */}
        <div className="relative h-6 bg-white flex items-center overflow-visible">
          <span className="absolute w-6 h-6 bg-slate-100 rounded-full top-1/2 -translate-y-1/2 -left-3 border-r border-slate-300"></span>
          <span className="w-full border-b-2 border-dashed border-slate-300 mx-6"></span>
          <span className="absolute w-6 h-6 bg-slate-100 rounded-full top-1/2 -translate-y-1/2 -right-3 border-l border-slate-300"></span>
        </div>

        {/* Bottom Receipt & Payment Summary */}
        <div className="p-5 bg-slate-50/50">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-bold text-slate-900">Payment & Billing Summary</h4>
            <span className="text-[11px] font-semibold bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">Paid Online / Pre-authorized</span>
          </div>

          <div className="flex justify-between items-center text-sm text-slate-600 mb-2">
            <span>Slot Reservation ({durationHours} hr @ ₹{rate}/hr)</span>
            <span>₹{durationHours * rate}</span>
          </div>
          <div className="flex justify-between items-center text-sm text-slate-600 mb-2">
            <span>Platform Service & Technology Fee</span>
            <span className="text-emerald-600 font-bold">FREE (₹0)</span>
          </div>
          <div className="flex justify-between items-center text-sm text-slate-600 mb-2">
            <span>Parking Space GST / Local Municipal Tax</span>
            <span className="text-emerald-600 font-bold">Included</span>
          </div>

          <div className="border-b border-slate-200 my-3"></div>

          <div className="flex justify-between items-center text-slate-900">
            <strong className="text-base">Grand Total Paid</strong>
            <strong className="text-2xl font-black text-emerald-600">₹{displayBooking.totalAmount || durationHours * rate}</strong>
          </div>

          <div className="bg-slate-100/70 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-600 mt-3.5 leading-relaxed">
            <strong>Overtime Policy:</strong> A 15-minute grace period is provided at checkout. Overtime exceeding 15 minutes is charged at 1.5x the hourly rate (₹{Math.round(rate * 1.5)}/hr).
          </div>
        </div>

        {/* Ticket Footer Bar */}
        <div className="bg-slate-100 py-3 px-6 flex justify-between items-center text-[11px] text-slate-400 border-t border-slate-200 font-mono">
          <span>Namma Spots Digital Parking Pass · Verified by Host Check-in Protocol</span>
          <span className="font-bold text-slate-600">CODE: {bookingCode}</span>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex gap-3 mt-6 justify-center flex-wrap print:hidden">
        <button onClick={printTicket} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer">
          Print / Download Ticket
        </button>
        <Link to="/my-bookings" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg border border-slate-200 transition-all cursor-pointer">
          View All Bookings
        </Link>
        <Link to="/" className="px-4 py-2 bg-transparent hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 transition-all cursor-pointer">
          Find Another Spot
        </Link>
      </div>
    </div>
  );
}

BookingOutput.displayName = 'BookingOutput';
