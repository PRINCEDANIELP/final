export default function EditSpotModal({
  spot,
  editForm,
  setEditForm,
  editModalError,
  editModalSuccess,
  savingEdit,
  editPhotoUploading,
  vehicleOptions = ['BIKE', 'HATCHBACK', 'SEDAN', 'SUV'],
  amenityOptions = [],
  onClose,
  onSubmit,
  onUploadPhotos,
  onSetCoverPhoto,
  onRemovePhoto,
  onOpenGallery,
}) {
  if (!spot) return null;

  const toggleVehicle = (vt) => {
    const list = editForm.vehicleTypes || [];
    const exists = list.includes(vt);
    const updated = exists ? list.filter((v) => v !== vt) : [...list, vt];
    setEditForm({ ...editForm, vehicleTypes: updated.length ? updated : ['SEDAN'] });
  };

  const toggleAmenity = (am) => {
    const list = editForm.amenities || [];
    const exists = list.includes(am);
    const updated = exists ? list.filter((a) => a !== am) : [...list, am];
    setEditForm({ ...editForm, amenities: updated });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-lg font-black text-slate-900">Edit Parking Bay</h3>
            <p className="text-xs text-slate-500 mt-0.5">Update spot title, address, rates, and amenities</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {editModalError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl">
              {editModalError}
            </div>
          )}
          {editModalSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl">
              {editModalSuccess}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Spot Title *</label>
            <input
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Street Address *</label>
            <input
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              placeholder="e.g. 14, Main Road, Near Bus Station"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
              required
            />
          </div>

          {/* Area, City, Pincode Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Area / Landmark</label>
              <input
                value={editForm.area || ''}
                onChange={(e) => setEditForm({ ...editForm, area: e.target.value })}
                placeholder="e.g. Vallam"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
              <input
                value={editForm.city || ''}
                onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                placeholder="e.g. Thanjavur"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pincode</label>
              <input
                value={editForm.pincode || ''}
                onChange={(e) => setEditForm({ ...editForm, pincode: e.target.value })}
                placeholder="e.g. 613403"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Hourly Rate (₹) *</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm pointer-events-none">
                  ₹
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editForm.hourlyRate}
                  onChange={(e) =>
                    setEditForm({ ...editForm, hourlyRate: e.target.value.replace(/\D/g, '') })
                  }
                  className="w-full pl-8 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Availability Status</label>
              <button
                type="button"
                onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  editForm.isActive
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                {editForm.isActive ? '● Available' : '○ Offline'}
              </button>
            </div>
          </div>

          {/* Vehicle Categories */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Allowed Vehicle Categories
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {vehicleOptions.map((vt) => {
                const isSelected = editForm.vehicleTypes?.includes(vt);
                return (
                  <button
                    key={vt}
                    type="button"
                    onClick={() => toggleVehicle(vt)}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {vt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amenities */}
          {amenityOptions.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Bay Amenities & Features
              </label>
              <div className="flex flex-wrap gap-2">
                {amenityOptions.map((am) => {
                  const isSelected = editForm.amenities?.includes(am);
                  return (
                    <button
                      key={am}
                      type="button"
                      onClick={() => toggleAmenity(am)}
                      className={`py-1.5 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected ? '✓ ' : ''}
                      {am}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Host Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Contact Person Name
              </label>
              <input
                type="text"
                value={editForm.contactName || ''}
                onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })}
                placeholder="e.g. Sundar Rajan (Host)"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Contact Phone Number
              </label>
              <input
                type="tel"
                value={editForm.contactPhone || ''}
                onChange={(e) => setEditForm({ ...editForm, contactPhone: e.target.value })}
                placeholder="e.g. +91 98424 12345"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Gate Entrance & Arrival Instructions
            </label>
            <textarea
              rows="2"
              value={editForm.instructions || ''}
              onChange={(e) => setEditForm({ ...editForm, instructions: e.target.value })}
              placeholder="e.g. Gated driveway. Ring calling bell at Gate #1."
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Photos */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div>
                <label className="block text-xs font-bold text-slate-700">Parking Bay Photos</label>
                <p className="text-[11px] text-slate-500">First photo is used as cover image.</p>
              </div>
              {(editForm.photos?.length || 0) > 0 && (
                <span className="text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  {editForm.photos.length} Photo{editForm.photos.length === 1 ? '' : 's'}
                </span>
              )}
            </div>

            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/30 rounded-xl p-3.5 text-center cursor-pointer transition-all mb-3">
              <span className="text-xs font-bold text-slate-800">
                {editPhotoUploading ? 'Optimizing...' : 'Upload Photos from Device'}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">JPG, PNG, or WebP</span>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={onUploadPhotos}
                disabled={editPhotoUploading}
                className="hidden"
              />
            </label>

            {editForm.photos && editForm.photos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {editForm.photos.map((photo, idx) => {
                  const isPrimary = idx === 0;
                  return (
                    <div
                      key={idx}
                      className={`group relative rounded-xl overflow-hidden border-2 bg-slate-900 aspect-square flex flex-col justify-between shadow-xs transition-all ${
                        isPrimary
                          ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <img
                        src={photo}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => onOpenGallery(idx)}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src =
                            'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&auto=format&fit=crop&q=80';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

                      <div className="absolute top-1 left-1 right-1 flex justify-between items-center z-10">
                        {isPrimary ? (
                          <span className="bg-emerald-600 text-white text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow-xs">
                            Cover
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSetCoverPhoto(idx)}
                            className="bg-black/70 hover:bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer"
                          >
                            Set Cover
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onRemovePhoto(idx)}
                          className="w-5 h-5 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-[10px] font-black cursor-pointer ml-auto"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center text-xs text-slate-500">
                No photos currently attached.
              </div>
            )}
          </div>

          <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 rounded-b-3xl">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer"
            >
              {savingEdit ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
