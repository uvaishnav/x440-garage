import React, { useRef, useState } from 'react';
import { RouteMap } from '../components/RouteMap';
import { CheckIcon, CloseIcon, PlusIcon, UploadIcon } from '../components/Icons';
import { buildPreRideChecklist } from '../lib/calculations';
import { parseGoogleTimelineJson } from '../lib/timelineParser';
import {
  AppSettings,
  FuelLog,
  MaintenanceTask,
  TimelineRide,
  Trip,
} from '../types';

interface TripsPageProps {
  currentOdometer: number;
  trips: Trip[];
  fuelLogs: FuelLog[];
  tasks: MaintenanceTask[];
  timelineRides: TimelineRide[];
  settings: AppSettings;
  onSaveTrip: (trip: Trip) => Promise<void>;
  onImportTimeline: (rides: TimelineRide[]) => Promise<void>;
}

export const TripsPage: React.FC<TripsPageProps> = ({
  currentOdometer,
  trips,
  fuelLogs,
  tasks,
  timelineRides,
  settings,
  onSaveTrip,
  onImportTimeline,
}) => {
  const [showNewTrip, setShowNewTrip] = useState(false);
  const [tripName, setTripName] = useState('');
  const [startOdo, setStartOdo] = useState(String(currentOdometer || ''));
  const [expectedKm, setExpectedKm] = useState('550');

  const [endingTrip, setEndingTrip] = useState<Trip | null>(null);
  const [endOdo, setEndOdo] = useState('');

  const [importStatus, setImportStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeTrip = trips.find((t) => t.status === 'active') || null;
  const pastTrips = trips.filter((t) => t.status === 'completed');

  const handleStartTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    const odo = parseFloat(startOdo) || currentOdometer;
    const exp = parseFloat(expectedKm) || 300;
    if (!tripName.trim() || odo <= 0) return;

    const checklist = buildPreRideChecklist(tasks, odo, exp);
    const newTrip: Trip = {
      id: `trip-${Date.now()}`,
      name: tripName.trim(),
      startDate: new Date().toISOString().slice(0, 10),
      startOdometer: odo,
      expectedKm: exp,
      status: 'active',
      checklist,
      createdAt: Date.now(),
    };
    await onSaveTrip(newTrip);
    setTripName('');
    setShowNewTrip(false);
  };

  const toggleCheckItem = async (trip: Trip, itemId: string) => {
    const nextChecklist = trip.checklist.map((item) =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    );
    await onSaveTrip({ ...trip, checklist: nextChecklist });
  };

  const handleCompleteTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!endingTrip) return;
    const finalOdo = parseFloat(endOdo) || currentOdometer;
    if (finalOdo <= endingTrip.startOdometer) return;

    await onSaveTrip({
      ...endingTrip,
      endOdometer: finalOdo,
      endDate: new Date().toISOString().slice(0, 10),
      status: 'completed',
    });
    setEndingTrip(null);
    setEndOdo('');
  };

  const handleTimelineUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('Parsing motorcycle rides...');
    try {
      const text = await file.text();
      const parsed = parseGoogleTimelineJson(text, settings.includeAmbiguousDriving);
      if (parsed.length === 0) {
        setImportStatus(
          'No MOTORCYCLING rides found in this file. Check Settings if Google labeled rides as Driving.'
        );
      } else {
        await onImportTimeline(parsed);
        setImportStatus(`Imported ${parsed.length} X440 motorcycle ride${parsed.length > 1 ? 's' : ''}.`);
      }
    } catch {
      setImportStatus('Invalid JSON file. Export location-history.json from Google Maps on iPhone.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const tripStats = (trip: Trip) => {
    const linkedFuel = fuelLogs.filter((l) => l.tripId === trip.id);
    const totalLitres = linkedFuel.reduce((s, l) => s + l.litres, 0);
    const totalCost = linkedFuel.reduce((s, l) => s + l.totalCost, 0);
    const dist =
      trip.endOdometer && trip.endOdometer > trip.startOdometer
        ? trip.endOdometer - trip.startOdometer
        : null;
    const mileage =
      dist && totalLitres > 0 ? Number((dist / totalLitres).toFixed(1)) : null;

    return { linkedFuel, totalLitres, totalCost, dist, mileage };
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#FF6600] font-semibold">
            Highway & Routes
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#F5F5F7]">
            Trips
          </h1>
        </div>
        {!activeTrip && (
          <button
            onClick={() => {
              setStartOdo(String(currentOdometer || ''));
              setShowNewTrip(true);
            }}
            className="h-10 px-3.5 rounded-xl bg-[#FF6600] text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95"
          >
            <PlusIcon className="w-4 h-4" /> Start Trip
          </button>
        )}
      </header>

      {/* Active Highway Trip Card + Smart Pre-Ride Checklist */}
      {activeTrip && (
        <section className="rounded-[24px] bg-[#141518] border border-[#FF6600]/40 p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase tracking-widest text-[#FF6600] font-semibold">
                Active Trip
              </span>
              <h2 className="text-lg font-semibold text-[#F5F5F7] mt-0.5">
                {activeTrip.name}
              </h2>
              <p className="text-xs text-[#8E8E93] tabular-nums mt-0.5">
                Start {activeTrip.startOdometer.toLocaleString('en-IN')} km · Est. {activeTrip.expectedKm} km
              </p>
            </div>
            <button
              onClick={() => {
                setEndingTrip(activeTrip);
                setEndOdo(String(Math.max(currentOdometer, activeTrip.startOdometer)));
              }}
              className="px-3 py-1.5 rounded-xl bg-[#FF6600] text-white text-xs font-semibold active:scale-95"
            >
              Finish Trip
            </button>
          </div>

          {/* Pre-Ride Checklist */}
          <div className="space-y-2 pt-2 border-t border-white/[0.06]">
            <p className="text-xs font-medium text-[#8E8E93]">
              Smart Pre-Ride Checklist ({activeTrip.checklist.filter((c) => c.checked).length}/
              {activeTrip.checklist.length})
            </p>
            {activeTrip.checklist.map((item) => (
              <button
                key={item.id}
                onClick={() => toggleCheckItem(activeTrip, item.id)}
                className="w-full rounded-xl bg-[#1F2126] px-3.5 py-2.5 flex items-start gap-3 text-left"
              >
                <span
                  className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${
                    item.checked
                      ? 'bg-[#30D158] border-[#30D158] text-black'
                      : item.urgent
                      ? 'border-[#FF6600]'
                      : 'border-white/20'
                  }`}
                >
                  {item.checked && <CheckIcon className="w-3.5 h-3.5" />}
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-xs font-medium ${
                      item.checked ? 'line-through text-[#636366]' : 'text-[#F5F5F7]'
                    }`}
                  >
                    {item.label}
                  </p>
                  {item.reason && (
                    <p
                      className={`text-[11px] mt-0.5 ${
                        item.urgent ? 'text-[#FF6600]' : 'text-[#8E8E93]'
                      }`}
                    >
                      {item.reason}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Google Maps Timeline Importer (Auto-Filters MOTORCYCLING only) */}
      <section className="rounded-2xl bg-[#141518] border border-white/[0.08] p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#F5F5F7]">
              Google Maps Timeline Import
            </p>
            <p className="text-[11px] text-[#8E8E93] mt-0.5">
              Auto-imports motorcycle rides only (skips car, bus & walk).
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleTimelineUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 h-10 px-3.5 rounded-xl bg-[#1F2126] border border-white/10 text-xs font-medium text-[#F5F5F7] flex items-center gap-1.5 active:scale-95"
          >
            <UploadIcon className="w-4 h-4 text-[#FF6600]" /> Import JSON
          </button>
        </div>
        {importStatus && (
          <p className="text-xs text-[#FF6600] bg-[#FF6600]/10 rounded-xl px-3 py-2">
            {importStatus}
          </p>
        )}
      </section>

      {/* Completed Trip Route Passes */}
      {pastTrips.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold text-[#F5F5F7] px-1">
            Completed Trips
          </h2>
          <div className="space-y-3">
            {pastTrips.map((trip) => {
              const st = tripStats(trip);
              return (
                <div
                  key={trip.id}
                  className="rounded-[22px] bg-[#141518] border border-white/[0.08] p-4 space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-base font-semibold text-[#F5F5F7]">
                        {trip.name}
                      </p>
                      <p className="text-[11px] text-[#8E8E93] tabular-nums mt-0.5">
                        {trip.startDate}
                        {trip.endDate && trip.endDate !== trip.startDate
                          ? ` → ${trip.endDate}`
                          : ''}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-[#FF6600]/15 text-[#FF6600] text-xs font-semibold tabular-nums">
                      {st.dist ? `${st.dist} km` : 'Completed'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/[0.06] text-xs">
                    <div>
                      <p className="text-[10px] text-[#8E8E93]">Trip Mileage</p>
                      <p className="font-semibold text-[#F5F5F7] tabular-nums mt-0.5">
                        {st.mileage ? `${st.mileage} km/L` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#8E8E93]">Fuel Used</p>
                      <p className="font-semibold text-[#F5F5F7] tabular-nums mt-0.5">
                        {st.totalLitres > 0 ? `${st.totalLitres.toFixed(1)} L` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#8E8E93]">Fuel Cost</p>
                      <p className="font-semibold text-[#F5F5F7] tabular-nums mt-0.5">
                        {st.totalCost > 0
                          ? `₹${Math.round(st.totalCost).toLocaleString('en-IN')}`
                          : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Imported Timeline Motorcycle Rides with Leaflet Route Maps */}
      {timelineRides.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-[#F5F5F7]">
              Timeline Motorcycle Rides
            </h2>
            <span className="text-[11px] text-[#636366] tabular-nums">
              {timelineRides.length} rides
            </span>
          </div>

          {timelineRides.slice(0, 10).map((ride) => (
            <div
              key={ride.id}
              className="rounded-[22px] bg-[#141518] border border-white/[0.08] p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[#F5F5F7] tabular-nums">
                    {ride.distanceKm} km Ride
                  </p>
                  <p className="text-[11px] text-[#8E8E93] tabular-nums">
                    {ride.date} · {ride.durationMin} min · Avg {ride.avgSpeedKmh} km/h
                  </p>
                </div>
                <span className="text-[11px] font-medium text-[#FF6600] tabular-nums">
                  {ride.highwayPercent}% Hwy
                </span>
              </div>

              <RouteMap points={ride.points} heightClass="h-40" />

              {/* Highway vs City Bar */}
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded-full bg-[#1F2126] overflow-hidden flex">
                  <div
                    className="h-full bg-[#FF6600]"
                    style={{ width: `${ride.highwayPercent}%` }}
                  />
                  <div
                    className="h-full bg-[#636366]"
                    style={{ width: `${ride.cityPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-[#8E8E93] tabular-nums">
                  <span>Highway {ride.highwayPercent}%</span>
                  <span>City {ride.cityPercent}%</span>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Start New Trip Modal */}
      {showNewTrip && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#141518] border-t border-white/10 rounded-t-[28px] p-5 space-y-4 animate-sheet-up safe-bottom-sheet">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#F5F5F7]">Start Highway Trip</h3>
              <button
                onClick={() => setShowNewTrip(false)}
                className="w-8 h-8 rounded-full bg-[#1F2126] flex items-center justify-center text-[#8E8E93]"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleStartTrip} className="space-y-3.5">
              <input
                type="text"
                required
                placeholder="Trip name (e.g. Vijayawada - Hyderabad)"
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                className="w-full h-12 px-3.5 rounded-xl bg-[#1F2126] border border-white/[0.08] text-sm text-[#F5F5F7] placeholder:text-[#636366] focus:outline-none focus:border-[#FF6600]"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#8E8E93] block mb-1">
                    Start Odometer (km)
                  </label>
                  <input
                    type="number"
                    required
                    value={startOdo}
                    onChange={(e) => setStartOdo(e.target.value)}
                    className="w-full h-12 px-3.5 rounded-xl bg-[#1F2126] border border-white/[0.08] text-sm text-[#F5F5F7] tabular-nums focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#8E8E93] block mb-1">
                    Expected Distance (km)
                  </label>
                  <input
                    type="number"
                    required
                    value={expectedKm}
                    onChange={(e) => setExpectedKm(e.target.value)}
                    className="w-full h-12 px-3.5 rounded-xl bg-[#1F2126] border border-white/[0.08] text-sm text-[#F5F5F7] tabular-nums focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full h-13 py-3.5 rounded-2xl bg-[#FF6600] text-white font-semibold text-sm"
              >
                Generate Pre-Ride Checklist & Start
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Finish Trip Modal */}
      {endingTrip && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#141518] border-t border-white/10 rounded-t-[28px] p-5 space-y-4 animate-sheet-up safe-bottom-sheet">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#F5F5F7]">
                Finish {endingTrip.name}
              </h3>
              <button
                onClick={() => setEndingTrip(null)}
                className="w-8 h-8 rounded-full bg-[#1F2126] flex items-center justify-center text-[#8E8E93]"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCompleteTrip} className="space-y-4">
              <div>
                <label className="text-xs text-[#8E8E93] block mb-1.5">
                  Final Odometer (Start was {endingTrip.startOdometer} km)
                </label>
                <input
                  type="number"
                  required
                  min={endingTrip.startOdometer + 1}
                  value={endOdo}
                  onChange={(e) => setEndOdo(e.target.value)}
                  className="w-full h-12 px-3.5 rounded-xl bg-[#1F2126] border border-white/[0.08] text-lg font-semibold text-[#F5F5F7] tabular-nums focus:outline-none focus:border-[#FF6600]"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-[#FF6600] text-white font-semibold text-sm"
              >
                Save Trip Summary
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
