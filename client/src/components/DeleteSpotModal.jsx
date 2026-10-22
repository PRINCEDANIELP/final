export default function DeleteSpotModal({
  spot,
  deleteLoading,
  onClose,
  onConfirm,
}) {
  if (!spot) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-red-50/50">
          <div>
            <h3 className="text-lg font-black text-red-600">Delete Parking Bay</h3>
            <p className="text-xs text-slate-500 mt-0.5">Permanent action</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-3">
          <p className="text-sm text-slate-700">
            Are you sure you want to permanently delete <strong>"{spot.title}"</strong> located at <em>{spot.address}</em>?
          </p>
          <p className="text-xs text-slate-400">
            This bay will be removed from all future search listings. Existing completed records will remain in booking archives.
          </p>
        </div>

        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleteLoading}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleteLoading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl cursor-pointer"
          >
            {deleteLoading ? 'Deleting...' : 'Yes, Delete Bay'}
          </button>
        </div>
      </div>
    </div>
  );
}

DeleteSpotModal.displayName = 'DeleteSpotModal';
