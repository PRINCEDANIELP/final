import { LOCATION_PRESETS } from '../utils/location.js';

export default function LocationChips({
  activeCoords,
  onSelectPreset,
  onAutoDetectGps,
  gpsLoading,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-2">
      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">
        Quick Cities:
      </span>

      {/* Auto-detect button chip */}
      <button
        type="button"
        onClick={onAutoDetectGps}
        disabled={gpsLoading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-transform active:scale-95 cursor-pointer disabled:opacity-60"
        title="Detect your current physical GPS / Network location"
      >
        <span className="inline-block w-2 h-2 rounded-full bg-white animate-ping" />
        {gpsLoading ? 'Detecting GPS...' : '📍 Auto-Detect My GPS'}
      </button>

      {/* Preset city chips */}
      {LOCATION_PRESETS.map((p) => {
        const isSelected =
          Math.abs(activeCoords.lat - p.lat) < 0.01 &&
          Math.abs(activeCoords.lng - p.lng) < 0.01;

        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectPreset(p)}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              isSelected
                ? 'bg-slate-900 text-white border-slate-900 font-bold shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            <span>{p.name}</span>
            {p.tag && (
              <span
                className={`text-[10px] ml-1 px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {p.tag}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

LocationChips.displayName = 'LocationChips';
