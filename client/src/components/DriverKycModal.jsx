export default function DriverKycModal({
  booking,
  onClose,
  onInspectDoc,
  onVerifyOtp,
}) {
  if (!booking) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-sm font-black shrink-0 border border-emerald-300">
              ID
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">Driver Identity & Verification</h3>
              <p className="text-xs text-slate-500">Government ID & Licence documents submitted for gate clearance</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Vehicle & Reservation Snapshot */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">RESERVED VEHICLE</span>
              <div className="inline-flex items-center bg-white border-2 border-slate-900 rounded-md overflow-hidden shadow-xs mt-1">
                <span className="bg-blue-900 text-white text-[10px] font-black px-1.5 py-0.5 tracking-wider">IND</span>
                <span className="font-mono text-sm font-black text-slate-900 px-2 py-0.5 tracking-widest">
                  {booking.vehicleNumber}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">DRIVER PROFILE</span>
              <strong className="text-sm text-slate-900 block">{booking.driverName || 'Rahul Sharma'}</strong>
              <div className="flex items-center gap-2 mt-0.5">
                {booking.driverPhone && (
                  <a href={`tel:${booking.driverPhone}`} className="text-xs font-bold text-slate-700 hover:text-emerald-700">
                    Call {booking.driverPhone}
                  </a>
                )}
                {booking.driverPhone && (
                  <a
                    href={`https://wa.me/${booking.driverPhone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-emerald-700 hover:underline"
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">VERIFICATION STATUS</span>
              <span className="inline-block mt-1 text-xs font-extrabold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                ✓ Verified at Booking
              </span>
            </div>
          </div>

          {/* 2-Column Document Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Aadhaar Card */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-white flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">Aadhaar Card</span>
                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                    ✓ Verified
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 mb-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">AADHAAR NUMBER</span>
                  <span className="font-mono text-sm font-black text-slate-900 tracking-wider">
                    {booking.aadhaarNumber || '7841 9023 4512'}
                  </span>
                </div>

                {/* Aadhaar Photo */}
                <div
                  className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-200 h-40 group cursor-pointer"
                  onClick={() =>
                    onInspectDoc({
                      title: `Aadhaar Card - ${booking.driverName || 'Driver'}`,
                      url:
                        booking.aadhaarPhotoUrl ||
                        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
                    })
                  }
                >
                  <img
                    src={
                      booking.aadhaarPhotoUrl ||
                      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80'
                    }
                    alt="Aadhaar Card"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end justify-between p-2.5 text-white">
                    <span className="text-[10px] font-bold bg-white/20 backdrop-blur-md px-2 py-0.5 rounded border border-white/20">
                      Click to inspect
                    </span>
                    <span className="text-[10px] font-semibold text-white/80">Document Photo</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Driving Licence Card */}
            <div className="border border-slate-200 rounded-2xl p-4 bg-white flex flex-col justify-between shadow-xs">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">Driving Licence</span>
                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                    ✓ Verified
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 mb-3 space-y-1">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">LICENCE HOLDER NAME</span>
                    <span className="text-xs font-bold text-slate-900">
                      {booking.licenceName || booking.driverName || 'Rahul Sharma'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">LICENCE NUMBER</span>
                    <span className="font-mono text-xs font-black text-slate-900 tracking-wider">
                      {booking.licenceNumber || 'TN-49-2021-0089214'}
                    </span>
                  </div>
                </div>

                {/* Licence Photo */}
                <div
                  className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-200 h-40 group cursor-pointer"
                  onClick={() =>
                    onInspectDoc({
                      title: `Driving Licence - ${booking.driverName || 'Driver'}`,
                      url:
                        booking.licencePhotoUrl ||
                        'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
                    })
                  }
                >
                  <img
                    src={
                      booking.licencePhotoUrl ||
                      'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80'
                    }
                    alt="Driving Licence Card"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end justify-between p-2.5 text-white">
                    <span className="text-[10px] font-bold bg-white/20 backdrop-blur-md px-2 py-0.5 rounded border border-white/20">
                      Click to inspect
                    </span>
                    <span className="text-[10px] font-semibold text-white/80">Document Photo</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Host Security Advisory */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 text-xs text-emerald-900 flex items-start gap-2.5">
            <div>
              <strong>Host Security Clearance:</strong> The driver has submitted their Aadhaar card & Driving Licence. You can compare the licence plate (<strong>{booking.vehicleNumber}</strong>) and ask for their 4-digit OTP code on arrival to unlock gate entry.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500 font-medium">
            Expected Arrival OTP: <strong className="text-slate-900">{booking.otp}</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
            >
              Close
            </button>
            {booking.status === 'CONFIRMED' && (
              <button
                type="button"
                onClick={() => onVerifyOtp(booking)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                Verify OTP & Unlock Gate
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

DriverKycModal.displayName = 'DriverKycModal';
