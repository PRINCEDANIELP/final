export default function CheckInModal({
  booking,
  inputOtp,
  setInputOtp,
  otpError,
  onClose,
  onSubmit,
}) {
  if (!booking) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200">
        <form onSubmit={onSubmit}>
          <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="text-lg font-black text-slate-900">Driver Gate Verification</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Vehicle: <strong>{booking.vehicleNumber}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            <p className="text-xs text-slate-600">
              Ask the arriving driver for their 4-digit OTP shown on their <strong>Namma Spot Digital Pass</strong>.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 text-center">
                Enter 4-Digit OTP Code
              </label>
              <input
                type="text"
                maxLength="4"
                placeholder="4892"
                value={inputOtp}
                onChange={(e) => setInputOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full font-mono text-3xl font-black text-center tracking-[12px] py-3 bg-slate-50 border-2 border-emerald-400 rounded-2xl text-emerald-800 outline-none focus:ring-4 focus:ring-emerald-500/20"
                autoFocus
                required
              />
            </div>

            {otpError && <p className="text-xs font-bold text-red-600 text-center">{otpError}</p>}

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Reserved Bay:</span>
                <strong className="text-slate-900">{booking.spot?.title || 'Parking Bay'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Expected OTP (Demo):</span>
                <strong className="text-emerald-700 font-bold">{booking.otp}</strong>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              ✓ Confirm & Unlock Bay
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
