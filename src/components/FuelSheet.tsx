import React, { useEffect, useMemo, useState } from 'react';
import { AppSettings, FuelGrade, FuelLog, RideMix, Trip } from '../types';
import { fetchNearbyBunks, getCurrentPosition, NearbyBunk } from '../lib/overpass';
import { CloseIcon, LocationPinIcon } from './Icons';

interface FuelSheetProps {
  open: boolean;
  onClose: () => void;
  currentOdometer: number;
  settings: AppSettings;
  activeTrip: Trip | null;
  recentLogs: FuelLog[];
  onSave: (log: FuelLog) => Promise<void>;
}

const GRADES: FuelGrade[] = ['Regular', 'XP95', 'Power'];
const MIXES: RideMix[] = ['City', 'Highway', 'Mixed'];

export const FuelSheet: React.FC<FuelSheetProps> = ({
  open,
  onClose,
  currentOdometer,
  settings,
  activeTrip,
  recentLogs,
  onSave,
}) => {
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [odometer, setOdometer] = useState('');
  const [litres, setLitres] = useState('');
  const [fuelGrade, setFuelGrade] = useState<FuelGrade>('Regular');
  const [pricePerLitre, setPricePerLitre] = useState(String(settings.fuelRates.Regular));
  const [isFullTank, setIsFullTank] = useState(true);
  const [rideMix, setRideMix] = useState<RideMix>(activeTrip ? 'Highway' : 'City');
  const [bunkName, setBunkName] = useState('');
  const [bunkLocation, setBunkLocation] = useState('');
  const [bunkCoords, setBunkCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [linkActiveTrip, setLinkActiveTrip] = useState(Boolean(activeTrip));

  const [nearbyBunks, setNearbyBunks] = useState<NearbyBunk[]>([]);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState('');
  const [saving, setSaving] = useState(false);

  // Unique recent bunks for 1-tap backdated entry
  const recentBunkNames = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const l of recentLogs) {
      const n = l.bunkName?.trim();
      if (n && !seen.has(n.toLowerCase())) {
        seen.add(n.toLowerCase());
        list.push(n);
      }
      if (list.length >= 4) break;
    }
    return list;
  }, [recentLogs]);

  // Reset form each time sheet opens
  useEffect(() => {
    if (!open) return;
    setDate(new Date().toISOString().slice(0, 10));
    setOdometer(currentOdometer > 0 ? String(currentOdometer) : '');
    setLitres('');
    setFuelGrade('Regular');
    setPricePerLitre(String(settings.fuelRates.Regular));
    setIsFullTank(true);
    setRideMix(activeTrip ? 'Highway' : 'City');
    setLinkActiveTrip(Boolean(activeTrip));
    setBunkName('');
    setBunkLocation('');
    setBunkCoords(null);
    setLocError('');

    // Auto-detect nearby petrol bunks on open
    detectNearbyBunks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const detectNearbyBunks = async () => {
    setLocating(true);
    setLocError('');
    try {
      const pos = await getCurrentPosition();
      const bunks = await fetchNearbyBunks(pos.lat, pos.lng);
      setNearbyBunks(bunks);
      if (bunks.length > 0 && !bunkName) {
        setBunkName(bunks[0].name);
        setBunkLocation(bunks[0].address || '');
        setBunkCoords({ lat: bunks[0].lat, lng: bunks[0].lng });
      }
    } catch {
      setLocError('GPS unavailable — pick a recent bunk or type below.');
    } finally {
      setLocating(false);
    }
  };

  const handleGradeSelect = (grade: FuelGrade) => {
    setFuelGrade(grade);
    setPricePerLitre(String(settings.fuelRates[grade] || settings.fuelRates.Regular));
  };

  const numLitres = parseFloat(litres) || 0;
  const numRate = parseFloat(pricePerLitre) || 0;
  const computedTotal = Math.round(numLitres * numRate);
  const numOdo = parseFloat(odometer) || 0;

  const isBackdated = date < today;
  const odoWarning =
    !isBackdated && currentOdometer > 0 && numOdo > 0 && numOdo < currentOdometer;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numOdo <= 0 || numLitres <= 0) return;

    setSaving(true);
    try {
      const log: FuelLog = {
        id: `fuel-${Date.now()}`,
        date,
        odometer: numOdo,
        litres: Number(numLitres.toFixed(2)),
        pricePerLitre: Number(numRate.toFixed(2)),
        totalCost: computedTotal,
        isFullTank,
        fuelGrade,
        rideMix,
        bunkName: bunkName.trim() || 'Unspecified Bunk',
        bunkLocation: bunkLocation.trim() || undefined,
        bunkLat: bunkCoords?.lat,
        bunkLng: bunkCoords?.lng,
        tripId: linkActiveTrip && activeTrip ? activeTrip.id : null,
        createdAt: Date.now(),
      };
      await onSave(log);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#141518] border-t border-white/10 rounded-t-[28px] max-h-[92vh] overflow-y-auto animate-sheet-up safe-bottom">
        {/* Grabber & Header */}
        <div className="sticky top-0 z-10 bg-[#141518]/95 backdrop-blur-md px-5 pt-3 pb-3 border-b border-white/[0.06]">
          <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#F5F5F7]">Log Fuel</h2>
              <p className="text-[11px] text-[#8E8E93]">
                {activeTrip && linkActiveTrip
                  ? `Linked to trip: ${activeTrip.name}`
                  : 'Tank-to-tank precision tracker'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-[#1F2126] flex items-center justify-center text-[#8E8E93] active:scale-95"
              aria-label="Close"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Primary 2 Numeric Inputs: Odometer & Litres */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[#1F2126] border border-white/[0.08] p-3.5 focus-within:border-[#FF6600]">
              <label className="text-[11px] uppercase tracking-wider text-[#8E8E93] font-medium block">
                Odometer (km)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                required
                placeholder={String(currentOdometer || 1200)}
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                className="w-full bg-transparent text-2xl font-semibold text-[#F5F5F7] tabular-nums mt-1 focus:outline-none"
              />
            </div>

            <div className="rounded-2xl bg-[#1F2126] border border-white/[0.08] p-3.5 focus-within:border-[#FF6600]">
              <label className="text-[11px] uppercase tracking-wider text-[#8E8E93] font-medium block">
                Fuel (Litres)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                required
                placeholder="8.50"
                value={litres}
                onChange={(e) => setLitres(e.target.value)}
                className="w-full bg-transparent text-2xl font-semibold text-[#FF6600] tabular-nums mt-1 focus:outline-none"
              />
            </div>
          </div>

          {odoWarning && (
            <p className="text-xs text-[#FFD60A] bg-[#FFD60A]/10 border border-[#FFD60A]/25 rounded-xl px-3 py-2">
              Entered odometer is lower than your latest ({currentOdometer} km). Change the date below if this is a backdated fill.
            </p>
          )}

          {/* Tank Full Toggle + Live Total ₹ */}
          <div className="flex items-center justify-between rounded-2xl bg-[#1F2126] border border-white/[0.08] px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[#F5F5F7]">Tank Full</p>
              <p className="text-[11px] text-[#8E8E93]">
                {isFullTank
                  ? 'Used for exact tank-to-tank mileage'
                  : 'Partial top-up — carried to next full fill'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsFullTank((v) => !v)}
              className={`w-12 h-7 rounded-full p-0.5 transition-colors ${
                isFullTank ? 'bg-[#30D158]' : 'bg-[#3A3A3C]'
              }`}
            >
              <span
                className={`block w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  isFullTank ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Fuel Grade & Editable Rate */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#8E8E93] font-medium">Fuel Grade & Rate</span>
              <span className="text-xs font-semibold text-[#F5F5F7] tabular-nums">
                Est. Total: ₹{computedTotal.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 grid grid-cols-3 gap-1.5 bg-[#1F2126] p-1 rounded-xl border border-white/[0.06]">
                {GRADES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => handleGradeSelect(g)}
                    className={`h-9 rounded-lg text-xs font-medium transition-colors ${
                      fuelGrade === g
                        ? 'bg-[#FF6600] text-white'
                        : 'text-[#8E8E93]'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <div className="w-24 h-11 rounded-xl bg-[#1F2126] border border-white/[0.08] px-2.5 flex items-center gap-1">
                <span className="text-xs text-[#8E8E93]">₹</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={pricePerLitre}
                  onChange={(e) => setPricePerLitre(e.target.value)}
                  className="w-full bg-transparent text-sm font-medium text-[#F5F5F7] tabular-nums focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Nearby Petrol Bunk Picker (OpenStreetMap Overpass) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#8E8E93] font-medium">Petrol Bunk</span>
              <button
                type="button"
                onClick={detectNearbyBunks}
                disabled={locating}
                className="text-xs font-medium text-[#FF6600] flex items-center gap-1"
              >
                <LocationPinIcon className="w-3.5 h-3.5" />
                {locating ? 'Detecting...' : 'Detect Nearby'}
              </button>
            </div>

            {nearbyBunks.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {nearbyBunks.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setBunkName(b.name);
                      setBunkLocation(b.address || '');
                      setBunkCoords({ lat: b.lat, lng: b.lng });
                    }}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-xs border transition-colors ${
                      bunkName === b.name
                        ? 'bg-[#FF6600]/15 border-[#FF6600] text-[#F5F5F7]'
                        : 'bg-[#1F2126] border-white/[0.06] text-[#8E8E93]'
                    }`}
                  >
                    {b.name} · {b.distanceMeters}m
                  </button>
                ))}
              </div>
            )}

            {recentBunkNames.length > 0 && nearbyBunks.length === 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {recentBunkNames.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setBunkName(name)}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-xs border ${
                      bunkName === name
                        ? 'bg-[#FF6600]/15 border-[#FF6600] text-[#F5F5F7]'
                        : 'bg-[#1F2126] border-white/[0.06] text-[#8E8E93]'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}

            <input
              type="text"
              placeholder="Bunk name (e.g. IOCL Jubilee Hills)"
              value={bunkName}
              onChange={(e) => setBunkName(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-[#1F2126] border border-white/[0.08] text-sm text-[#F5F5F7] placeholder:text-[#636366] focus:outline-none focus:border-[#FF6600]"
            />
            {locError && <p className="text-[11px] text-[#636366]">{locError}</p>}
          </div>

          {/* Ride Mix + Date (for backdated fills) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[#8E8E93] font-medium block mb-1.5">
                Riding Mix
              </label>
              <div className="grid grid-cols-3 gap-1 bg-[#1F2126] p-1 rounded-xl border border-white/[0.06]">
                {MIXES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setRideMix(m)}
                    className={`h-9 rounded-lg text-[11px] font-medium ${
                      rideMix === m ? 'bg-[#2C2E35] text-[#F5F5F7]' : 'text-[#8E8E93]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-[#8E8E93] font-medium block mb-1.5">
                Date (Backdate OK)
              </label>
              <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-[#1F2126] border border-white/[0.08] text-sm text-[#F5F5F7] tabular-nums focus:outline-none focus:border-[#FF6600]"
              />
            </div>
          </div>

          {activeTrip && (
            <label className="flex items-center justify-between rounded-xl bg-[#FF6600]/10 border border-[#FF6600]/25 px-3.5 py-2.5 text-xs">
              <span className="text-[#F5F5F7]">
                Attach to active trip: <strong>{activeTrip.name}</strong>
              </span>
              <input
                type="checkbox"
                checked={linkActiveTrip}
                onChange={(e) => {
                  setLinkActiveTrip(e.target.checked);
                  if (e.target.checked) setRideMix('Highway');
                }}
                className="accent-[#FF6600] w-4 h-4"
              />
            </label>
          )}

          <button
            type="submit"
            disabled={saving || numOdo <= 0 || numLitres <= 0}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-[#FF6600] to-[#F58220] text-white font-semibold text-[15px] shadow-[0_8px_24px_rgba(255,102,0,0.3)] active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {saving ? 'Saving...' : `Save Fill · ₹${computedTotal.toLocaleString('en-IN')}`}
          </button>
        </form>
      </div>
    </div>
  );
};
