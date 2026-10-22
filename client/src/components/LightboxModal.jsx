export default function LightboxModal({
  isOpen,
  onClose,
  title,
  photos = [],
  activeIndex = 0,
  setActiveIndex,
}) {
  if (!isOpen) return null;

  const validPhotos = Array.isArray(photos) ? photos.filter(Boolean) : [];
  const currentPhoto = validPhotos[activeIndex] || validPhotos[0];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 select-none"
      onClick={onClose}
    >
      {/* Top Bar */}
      <div
        className="flex items-center justify-between text-white z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          {title && (
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
              {title}
            </span>
          )}
          {validPhotos.length > 1 && (
            <h3 className="text-sm sm:text-base font-bold text-slate-100">
              Photo {activeIndex + 1} of {validPhotos.length}
            </h3>
          )}
        </div>

        <div className="flex items-center gap-2">
          {validPhotos.length > 1 && (
            <span className="hidden sm:inline-block text-[11px] text-slate-400 font-medium mr-2">
              Use ◀ / ▶ arrows or click thumbnails to navigate
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center text-lg font-bold transition-all cursor-pointer"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Image with Navigation Arrows */}
      <div
        className="relative flex-1 flex items-center justify-center my-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {validPhotos.length > 1 && (
          <button
            type="button"
            onClick={() =>
              setActiveIndex?.((activeIndex - 1 + validPhotos.length) % validPhotos.length)
            }
            className="absolute left-2 sm:left-4 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center text-2xl font-bold border border-white/20 shadow-lg transition-transform hover:scale-110 cursor-pointer"
            title="Previous Photo"
          >
            ‹
          </button>
        )}

        <img
          src={currentPhoto}
          alt={`Gallery ${activeIndex + 1}`}
          className="max-h-[72vh] max-w-full rounded-2xl object-contain shadow-2xl transition-all border border-white/10"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src =
              'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=1200&auto=format&fit=crop&q=80';
          }}
        />

        {validPhotos.length > 1 && (
          <button
            type="button"
            onClick={() =>
              setActiveIndex?.((activeIndex + 1) % validPhotos.length)
            }
            className="absolute right-2 sm:right-4 z-20 w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center text-2xl font-bold border border-white/20 shadow-lg transition-transform hover:scale-110 cursor-pointer"
            title="Next Photo"
          >
            ›
          </button>
        )}
      </div>

      {/* Thumbnails */}
      {validPhotos.length > 1 && (
        <div
          className="flex items-center justify-center gap-2 overflow-x-auto py-2 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {validPhotos.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveIndex?.(idx)}
              className={`h-14 w-20 rounded-xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                activeIndex === idx
                  ? 'border-emerald-500 ring-2 ring-emerald-500/50 scale-105'
                  : 'border-white/20 opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={p}
                alt={`Thumb ${idx + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src =
                    'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=200&auto=format&fit=crop&q=80';
                }}
              />
            </button>
          ))}
        </div>
      )}

      {validPhotos.length <= 1 && (
        <div className="text-center text-xs text-slate-400">
          Click anywhere or press Esc to close
        </div>
      )}
    </div>
  );
}

LightboxModal.displayName = 'LightboxModal';
