export default function CheckoutModal({
  booking,
  checkoutLoading,
  onClose,
  onConfirm,
}) {
  if (!booking) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-lg font-black text-slate-900">Vehicle Checkout & Gate Release</h3>
            <p className="text-xs text-slate-500 mt-0.5">Review parking session and confirm exit.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={checkoutLoading}
            className="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <div className="text-center">
            <div className="inline-flex items-center bg-white border-2 border-slate-900 rounded-md overflow-hidden shadow-xs mb-2">
              <span className="bg-blue-900 text-white text-[10px] font-black px-1.5 py-1 tracking-wider">IND</span>
              <span className="font-mono text-base font-black text-slate-900 px-3 py-1 tracking-widest">
                {booking.vehicleNumber}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Driver: <strong>{booking.driverName || 'Guest Driver'}</strong>
            </p>
          </div>

          {booking.isOvertime ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-900">
              <strong className="block text-sm mb-1 text-red-800">Overtime Parking Recorded</strong>
              Vehicle parked <strong>+{booking.overtimeMins} minutes</strong> past booked exit time. An overtime surcharge of{' '}
              <strong>₹{booking.overtimeFee}</strong> has been added to final billing.
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800">
              ✓ Vehicle exiting on time within booked reservation slot.
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs space-y-2">
            <div className="flex justify-between text-slate-600">
              <span>Booked Slot Base Amount:</span>
              <strong>₹{booking.totalAmount}</strong>
            </div>

            {booking.isOvertime && (
              <div className="flex justify-between text-red-600 font-bold">
                <span>Overtime Surcharge:</span>
                <strong>+₹{booking.overtimeFee}</strong>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-sm font-extrabold text-slate-900">
              <span>Total Settled Amount:</span>
              <span className="text-emerald-700 text-lg font-black">₹{booking.finalAmount}</span>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={checkoutLoading}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={checkoutLoading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
          >
            {checkoutLoading ? 'Processing Exit...' : 'Confirm Gate Exit & Settle'}
          </button>
        </div>
      </div>
    </div>
  );
}

CheckoutModal.displayName = 'CheckoutModal';
