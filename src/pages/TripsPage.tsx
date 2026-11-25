import React, { useMemo, useRef, useState } from 'react';
import { RideTripSummary, RidingStats, TimelineTripCard } from '../components/RideHistory';
import {
  CheckIcon,
  CloseIcon,
  EditIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from '../components/Icons';
import { buildPreRideChecklist } from '../lib/calculations';
import { localDateInputValue, localDateTimeValue } from '../lib/date';
import { parseGoogleTimelineJson } from '../lib/timelineParser';
import { parseGpx } from '../lib/gpxParser';
import { buildRideHistory, newTimelineRides, timelinePlaceUpdates } from '../lib/rideHistory';
import { AppSettings, FuelLog, MaintenanceTask, TimelineRide, Trip } from '../types';

interface TripsPageProps {
  currentOdometer: number;
  trips: Trip[];
  fuelLogs: FuelLog[];
  tasks: MaintenanceTask[];
  timelineRides: TimelineRide[];
  settings: AppSettings;
  onSaveTrip: (trip: Trip) => Promise<void>;
  onDeleteTrip: (id: string) => Promise<void>;
  onImportTimeline: (rides: TimelineRide[]) => Promise<void>;
  onSavePlaceName: (id: string, name: string) => Promise<void>;
  onDeleteTimelineRide: (id: string) => Promise<void>;
}

export const TripsPage: React.FC<TripsPageProps> = ({
  currentOdometer,
  trips,
  fuelLogs,
  tasks,
  timelineRides,
  settings,
  onSaveTrip,
  onDeleteTrip,
  onImportTimeline,
  onSavePlaceName,
  onDeleteTimelineRide,
}) => {
  const [showTripEditor, setShowTripEditor] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [tripName, setTripName] = useState('');
  const [startOdo, setStartOdo] = useState('');
  const [expectedKm, setExpectedKm] = useState('550');
  const [startTime, setStartTime] = useState(localDateTimeValue());
  const [endTime, setEndTime] = useState('');
  const [endOdo, setEndOdo] = useState('');
  const [tripNotes, setTripNotes] = useState('');
  const [startTankFull, setStartTankFull] = useState(true);
  const [startTankPercent, setStartTankPercent] = useState('100');
  const [endTankFull, setEndTankFull] = useState(false);
  const [endTankPercent, setEndTankPercent] = useState('50');

  const [endingTrip, setEndingTrip] = useState<Trip | null>(null);
  const [finishOdo, setFinishOdo] = useState('');
  const [finishTime, setFinishTime] = useState(localDateTimeValue());
  const [finishTankFull, setFinishTankFull] = useState(false);
  const [finishTankPercent, setFinishTankPercent] = useState('50');
  const [saveError, setSaveError] = useState('');

  const [importStatus, setImportStatus] = useState('');
  const [importing, setImporting] = useState(false);
  const [visibleTrips, setVisibleTrips] = useState(6);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInProgress = useRef(false);

  const activeTrip = trips.find((trip) => trip.status === 'active') || null;
  const pastTrips = trips.filter((trip) => trip.status === 'completed');
  const { byTrip, timelineTrips } = useMemo(() => buildRideHistory(timelineRides, trips), [timelineRides, trips]);

  const openNewTrip = () => {
    setEditingTrip(null);
    setTripName('');
    setStartOdo(String(currentOdometer || ''));
    setExpectedKm('550');
    setStartTime(localDateTimeValue());
    setEndTime('');
    setEndOdo('');
    setTripNotes('');
    setStartTankFull(true);
    setStartTankPercent('100');
    setEndTankFull(false);
    setEndTankPercent('50');
    setSaveError('');
    setShowTripEditor(true);
  };

  const openEditTrip = (trip: Trip) => {
    setEditingTrip(trip);
    setTripName(trip.name);
    setStartOdo(String(trip.startOdometer));
    setExpectedKm(String(trip.expectedKm));
    setStartTime(trip.startTime || `${trip.startDate}T08:00`);
    setEndTime(trip.endTime || (trip.endDate ? `${trip.endDate}T18:00` : ''));
    setEndOdo(trip.endOdometer == null ? '' : String(trip.endOdometer));
    setTripNotes(trip.notes || '');
    setStartTankFull(trip.startTankFull ?? trip.startTankPercent === 100);
    setStartTankPercent(String(trip.startTankPercent ?? 100));
    setEndTankFull(trip.endTankFull ?? trip.endTankPercent === 100);
    setEndTankPercent(String(trip.endTankPercent ?? 50));
    setSaveError('');
    setShowTripEditor(true);
  };

  const saveTrip = async (event: React.FormEvent) => {
    event.preventDefault();
    const start = parseFloat(startOdo) || currentOdometer;
    const expected = parseFloat(expectedKm) || 300;
    const finish = parseFloat(endOdo) || undefined;
    if (!tripName.trim() || start <= 0) return;

    const trip: Trip = {
      id: editingTrip?.id || `trip-${Date.now()}`,
      name: tripName.trim(),
      startDate: startTime.slice(0, 10) || localDateInputValue(),
      startTime,
      endDate:
        editingTrip?.status === 'completed' && endTime
          ? endTime.slice(0, 10)
          : editingTrip?.endDate,
      endTime: editingTrip?.status === 'completed' ? endTime || editingTrip.endTime : undefined,
      startOdometer: start,
      endOdometer: editingTrip?.status === 'completed' ? finish : undefined,
      expectedKm: expected,
      startTankFull,
      startTankPercent: startTankFull
        ? 100
        : Math.min(100, Math.max(0, parseFloat(startTankPercent) || 0)),
      endTankFull: editingTrip?.status === 'completed' ? endTankFull : undefined,
      endTankPercent:
        editingTrip?.status === 'completed'
          ? endTankFull
            ? 100
            : Math.min(100, Math.max(0, parseFloat(endTankPercent) || 0))
          : undefined,
      status: editingTrip?.status || 'active',
      checklist: editingTrip?.checklist || buildPreRideChecklist(tasks, start, expected),
      notes: tripNotes.trim() || undefined,
      linkedTimelineRideIds: editingTrip?.linkedTimelineRideIds || [],
      createdAt: editingTrip?.createdAt || Date.now(),
    };

    setSaveError('');
    try {
      await onSaveTrip(trip);
      setShowTripEditor(false);
      setEditingTrip(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save this trip.');
    }
  };

  const toggleCheckItem = async (trip: Trip, itemId: string) => {
    await onSaveTrip({
      ...trip,
      checklist: trip.checklist.map((item) =>
        item.id === itemId ? { ...item, checked: !item.checked } : item
      ),
    });
  };

  const openFinishTrip = (trip: Trip) => {
    setEndingTrip(trip);
    setFinishOdo(String(Math.max(currentOdometer, trip.startOdometer)));
    setFinishTime(localDateTimeValue());
    setFinishTankFull(false);
    setFinishTankPercent('50');
    setSaveError('');
  };

  const completeTrip = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!endingTrip) return;
    const finalOdo = parseFloat(finishOdo) || currentOdometer;
    if (finalOdo <= endingTrip.startOdometer) return;
    setSaveError('');
    try {
      await onSaveTrip({
        ...endingTrip,
        endOdometer: finalOdo,
        endDate: finishTime.slice(0, 10) || localDateInputValue(),
        endTime: finishTime,
        endTankFull: finishTankFull,
        endTankPercent: finishTankFull
          ? 100
          : Math.min(100, Math.max(0, parseFloat(finishTankPercent) || 0)),
        status: 'completed',
      });
      setEndingTrip(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not finish this trip.');
    }
  };

  const handleTimelineUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || uploadInProgress.current) return;
    const gpx = file.name.toLowerCase().endsWith('.gpx');
    uploadInProgress.current = true;
    setImporting(true);
    setImportStatus('Parsing ride file…');
    let saving = false;
    try {
      const text = await file.text();
      const parsed = gpx
        ? parseGpx(text)
        : parseGoogleTimelineJson(text, settings.includeAmbiguousDriving);
      if (!parsed.length) {
        setImportStatus(gpx ? 'No GPS tracks found in this file.' : 'No matching motorcycle activity found in this export.');
        return;
      }
      const incoming = newTimelineRides(parsed, timelineRides);
      const updates = gpx ? [] : timelinePlaceUpdates(parsed, timelineRides);
      if (!incoming.length && !updates.length) {
        setImportStatus('You’re up to date. This file has no new ride legs.');
        return;
      }
      saving = true;
      setImportStatus('Saving ride history…');
      await onImportTimeline([...incoming, ...updates]);
      setImportStatus([
        incoming.length > 0 && `Added ${incoming.length} ride ${incoming.length === 1 ? 'leg' : 'legs'}.`,
        updates.length > 0 && `Matched stops for ${updates.length} saved ${updates.length === 1 ? 'leg' : 'legs'}.`,
      ].filter(Boolean).join(' '));
    } catch {
      setImportStatus(saving ? 'Could not finish saving. Import the same file again to retry.'
        : gpx ? 'Could not read this GPX file.' : 'Could not read this file as a Google Maps Timeline export.');
    } finally {
      input.value = '';
      uploadInProgress.current = false;
      setImporting(false);
    }
  };

  const tripStats = (trip: Trip) => {
    const linkedFuel = fuelLogs.filter((log) => log.tripId === trip.id);
    const purchasedLitres = linkedFuel.reduce((sum, log) => sum + log.litres, 0);
    const cashSpent = linkedFuel.reduce((sum, log) => sum + log.totalCost, 0);
    const distance =
      trip.endOdometer && trip.endOdometer > trip.startOdometer
        ? trip.endOdometer - trip.startOdometer
        : null;
    const startPercent = trip.startTankFull ? 100 : trip.startTankPercent;
    const finishPercent = trip.endTankFull ? 100 : trip.endTankPercent;
    const tankAdjustment =
      startPercent != null && finishPercent != null
        ? ((startPercent - finishPercent) / 100) * 13.5
        : 0;
    const consumedLitres = Math.max(0, purchasedLitres + tankAdjustment);
    const exact = Boolean(trip.startTankFull && trip.endTankFull);
    const mileage =
      distance && consumedLitres > 0
        ? Number((distance / consumedLitres).toFixed(1))
        : null;
    const averageRate =
      purchasedLitres > 0 ? cashSpent / purchasedLitres : settings.fuelRates.Regular;
    const consumedCost = consumedLitres * averageRate;
    const costPerKm = distance && consumedCost > 0 ? consumedCost / distance : null;
    return { purchasedLitres, cashSpent, consumedLitres, distance, mileage, costPerKm, exact };
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#FF6600] font-semibold">Highway & Routes</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#F5F5F7]">Trips</h1>
        </div>
        {!activeTrip && (
          <button onClick={openNewTrip} className="h-10 px-3.5 rounded-xl bg-[#FF6600] text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95"><PlusIcon className="w-4 h-4" /> Start Trip</button>
        )}
      </header>

      {activeTrip && (
        <section className="rounded-2xl bg-[#141518] border border-[#FF6600]/40 p-4 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-widest text-[#FF6600] font-semibold">Active Trip</span>
              <h2 className="text-lg font-semibold text-[#F5F5F7] truncate">{activeTrip.name}</h2>
              <p className="text-xs text-[#8E8E93] tabular-nums">Start {activeTrip.startOdometer.toLocaleString('en-IN')} km · Est. {activeTrip.expectedKm} km</p>
            </div>
            <button onClick={() => openEditTrip(activeTrip)} className="w-9 h-9 rounded-xl bg-[#1F2126] text-[#8E8E93] flex items-center justify-center" aria-label="Edit active trip"><EditIcon /></button>
            <button onClick={() => openFinishTrip(activeTrip)} className="h-9 px-3 rounded-xl bg-[#FF6600] text-white text-xs font-semibold">Finish</button>
          </div>
          <div className="space-y-2 pt-2 border-t border-white/[0.06]">
            <p className="text-xs font-medium text-[#8E8E93]">Pre-Ride Checklist ({activeTrip.checklist.filter((item) => item.checked).length}/{activeTrip.checklist.length})</p>
            {activeTrip.checklist.map((item) => (
              <button key={item.id} onClick={() => toggleCheckItem(activeTrip, item.id)} className="w-full rounded-xl bg-[#1F2126] px-3.5 py-2.5 flex items-start gap-3 text-left">
                <span className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border shrink-0 ${item.checked ? 'bg-[#30D158] border-[#30D158] text-black' : item.urgent ? 'border-[#FF6600]' : 'border-white/20'}`}>{item.checked && <CheckIcon className="w-3.5 h-3.5" />}</span>
                <span className="min-w-0"><span className={`block text-xs font-medium ${item.checked ? 'line-through text-[#636366]' : 'text-[#F5F5F7]'}`}>{item.label}</span>{item.reason && <span className={`block text-[11px] mt-0.5 ${item.urgent ? 'text-[#FF6600]' : 'text-[#8E8E93]'}`}>{item.reason}</span>}</span>
              </button>
            ))}
          </div>
          <RideTripSummary rides={byTrip.get(activeTrip.id) ?? []} names={settings.timelinePlaceNames}
            onSavePlaceName={onSavePlaceName} manual />
        </section>
      )}

      <section className="rounded-2xl bg-[#141518] border border-white/[0.08] p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[#F5F5F7]">Import ride history</h2>
            <p className="mt-0.5 text-xs text-[#B3B3BB]">Google Maps Timeline or GPX. Only new ride legs are saved.</p>
          </div>
          <input ref={fileInputRef} type="file" accept=".json,.gpx,application/json,application/gpx+xml" onChange={handleTimelineUpload} className="hidden" />
          <button type="button" disabled={importing} onClick={() => fileInputRef.current?.click()} className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-[#1F2126] px-3.5 text-sm font-medium text-[#F5F5F7] hover:bg-[#282A30] disabled:opacity-50"><UploadIcon className="size-4 text-[#FF8037]" /> Import</button>
        </div>
        <div role="status" aria-live="polite">
          {importStatus && <p className="rounded-xl bg-[#FF6600]/10 px-3 py-2 text-xs text-[#FFBE90]">{importStatus}</p>}
        </div>
      </section>

      {timelineRides.length > 0 && <RidingStats rides={timelineRides}
        names={settings.timelinePlaceNames} onDelete={onDeleteTimelineRide} />}

      {pastTrips.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold text-[#F5F5F7] px-1">Completed Trips</h2>
          {pastTrips.map((trip) => {
            const stats = tripStats(trip);
            return (
              <div key={trip.id} className="rounded-2xl bg-[#141518] border border-white/[0.08] p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="text-base font-semibold text-[#F5F5F7] truncate">{trip.name}</p><p className="text-[11px] text-[#8E8E93] tabular-nums">{trip.startDate}{trip.endDate && trip.endDate !== trip.startDate ? ` → ${trip.endDate}` : ''}</p></div>
                  <div className="flex gap-1"><button onClick={() => openEditTrip(trip)} className="w-8 h-8 rounded-lg bg-[#1F2126] text-[#8E8E93] flex items-center justify-center" aria-label="Edit trip"><EditIcon /></button><button onClick={() => window.confirm(`Delete ${trip.name}?`) && onDeleteTrip(trip.id)} className="w-8 h-8 rounded-lg bg-[#1F2126] text-[#8E8E93] flex items-center justify-center" aria-label="Delete trip"><TrashIcon /></button></div>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-3 border-t border-white/[0.06]">
                  <TripMetric label="Distance" value={stats.distance ? `${stats.distance} km` : '—'} />
                  <TripMetric label="Mileage" value={stats.mileage ? `${stats.mileage}` : '—'} suffix={stats.mileage ? 'km/L' : undefined} note={stats.mileage ? (stats.exact ? 'Exact' : 'Estimate') : undefined} />
                  <TripMetric label="Fuel used" value={stats.consumedLitres > 0 ? stats.consumedLitres.toFixed(1) : '—'} suffix={stats.consumedLitres > 0 ? 'L' : undefined} />
                  <TripMetric label="Cost / km" value={stats.costPerKm ? `₹${stats.costPerKm.toFixed(2)}` : '—'} />
                </div>
                {trip.notes && <p className="text-xs text-[#8E8E93]">{trip.notes}</p>}
                <RideTripSummary rides={byTrip.get(trip.id) ?? []} names={settings.timelinePlaceNames}
                  onSavePlaceName={onSavePlaceName} manual />
              </div>
            );
          })}
        </section>
      )}

      {timelineRides.length > 0 && (
        <section className="space-y-3">
          <div className="px-1">
            <h2 className="text-base font-semibold text-[#F5F5F7]">Long rides</h2>
            <p className="mt-0.5 text-xs text-[#B3B3BB]">Trips with more than an hour of recorded ride time.</p>
          </div>
          {timelineTrips.slice(0, visibleTrips).map(({ rides, roundTrip }) => (
            <TimelineTripCard key={rides[0].id} rides={rides} roundTrip={roundTrip}
              names={settings.timelinePlaceNames} onSavePlaceName={onSavePlaceName} />
          ))}
          {timelineTrips.length === 0 && <p className="px-1 text-sm text-[#B3B3BB]">No long rides found outside your manual trips. Short rides appear in Riding activity.</p>}
          {visibleTrips < timelineTrips.length && (
            <button type="button" className="min-h-11 w-full rounded-xl bg-[#1F2126] text-sm font-medium text-[#FFBE90] hover:bg-[#282A30]" onClick={() => setVisibleTrips((count) => count + 6)}>Show more long rides</button>
          )}
        </section>
      )}
      {timelineRides.length > 0 && (
        <p className="px-1 text-xs text-[#B3B3BB]">
          Approximate area names from <a className="underline underline-offset-4" href="https://www.geonames.org/"
            target="_blank" rel="noreferrer">GeoNames</a> (<a className="underline underline-offset-4"
            href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>).
        </p>
      )}

      {showTripEditor && (
        <Sheet title={editingTrip ? 'Edit Trip' : 'Start Highway Trip'} onClose={() => setShowTripEditor(false)}>
          <form onSubmit={saveTrip} className="space-y-3.5">
            <input type="text" required value={tripName} onChange={(event) => setTripName(event.target.value)} placeholder="Trip name (e.g. Vijayawada – Hyderabad)" className="field h-12" />
            <div className="grid grid-cols-2 gap-3"><LabeledInput label="Start odometer" type="number" value={startOdo} onChange={setStartOdo} /><LabeledInput label="Expected distance" type="number" value={expectedKm} onChange={setExpectedKm} /></div>
            <LabeledInput label="Start date & time" type="datetime-local" value={startTime} onChange={setStartTime} />
            <TankLevelEditor label="Tank full at start" full={startTankFull} onFull={setStartTankFull} percent={startTankPercent} onPercent={setStartTankPercent} />
            {editingTrip?.status === 'completed' && <><div className="grid grid-cols-2 gap-3"><LabeledInput label="End odometer" type="number" value={endOdo} onChange={setEndOdo} /><LabeledInput label="End date & time" type="datetime-local" value={endTime} onChange={setEndTime} /></div><TankLevelEditor label="Tank full at finish" full={endTankFull} onFull={setEndTankFull} percent={endTankPercent} onPercent={setEndTankPercent} /></>}
            <textarea rows={2} value={tripNotes} onChange={(event) => setTripNotes(event.target.value)} placeholder="Trip notes (optional)" className="field p-3" />
            {saveError && <ErrorMessage text={saveError} />}
            <button type="submit" className="w-full py-3.5 rounded-xl bg-[#FF6600] text-white font-semibold text-sm">{editingTrip ? 'Save Trip Changes' : 'Generate Checklist & Start'}</button>
          </form>
        </Sheet>
      )}

      {endingTrip && (
        <Sheet title={`Finish ${endingTrip.name}`} onClose={() => setEndingTrip(null)}>
          <form onSubmit={completeTrip} className="space-y-4">
            <LabeledInput label={`Final odometer · started at ${endingTrip.startOdometer} km`} type="number" value={finishOdo} onChange={setFinishOdo} />
            <LabeledInput label="Finish date & time" type="datetime-local" value={finishTime} onChange={setFinishTime} />
            <TankLevelEditor label="Tank full at finish" full={finishTankFull} onFull={setFinishTankFull} percent={finishTankPercent} onPercent={setFinishTankPercent} />
            <p className="text-[11px] text-[#8E8E93]">Full-to-full results are exact. Other tank levels produce a clearly labelled estimate using the 13.5 L tank capacity.</p>
            {saveError && <ErrorMessage text={saveError} />}
            <button type="submit" className="w-full py-3.5 rounded-xl bg-[#FF6600] text-white font-semibold text-sm">Save Trip Summary</button>
          </form>
        </Sheet>
      )}
    </div>
  );
};

const TripMetric: React.FC<{ label: string; value: string; suffix?: string; note?: string }> = ({ label, value, suffix, note }) => <div><p className="text-[9px] text-[#8E8E93]">{label}</p><p className="text-sm font-semibold text-[#F5F5F7] tabular-nums mt-0.5">{value}{suffix && <span className="text-[9px] text-[#636366] ml-0.5">{suffix}</span>}</p>{note && <p className="text-[9px] text-[#FF6600]">{note}</p>}</div>;

const Sheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"><div className="w-full max-w-lg bg-[#141518] border-t border-white/10 rounded-t-2xl max-h-[90dvh] overflow-y-auto p-5 space-y-4 animate-sheet-up safe-bottom-sheet"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold text-[#F5F5F7]">{title}</h3><button onClick={onClose} className="w-9 h-9 rounded-full bg-[#1F2126] flex items-center justify-center text-[#8E8E93]" aria-label="Close"><CloseIcon /></button></div>{children}</div></div>;

const LabeledInput: React.FC<{ label: string; type: string; value: string; onChange: (value: string) => void }> = ({ label, type, value, onChange }) => <label className="block"><span className="text-[11px] text-[#8E8E93] block mb-1">{label}</span><input type={type} required value={value} onChange={(event) => onChange(event.target.value)} className="field h-12" /></label>;

const TankLevelEditor: React.FC<{ label: string; full: boolean; onFull: (value: boolean) => void; percent: string; onPercent: (value: string) => void }> = ({ label, full, onFull, percent, onPercent }) => <div className="rounded-xl bg-[#1F2126] border border-white/[0.08] p-3 space-y-2"><label className="flex items-center justify-between text-xs text-[#F5F5F7]">{label}<input type="checkbox" checked={full} onChange={(event) => onFull(event.target.checked)} className="accent-[#FF6600] w-4 h-4" /></label>{!full && <label className="text-[11px] text-[#8E8E93]">Approximate tank level: {percent}%<input type="range" min="0" max="100" step="5" value={percent} onChange={(event) => onPercent(event.target.value)} className="w-full accent-[#FF6600] mt-2" /></label>}</div>;

const ErrorMessage: React.FC<{ text: string }> = ({ text }) => <p role="alert" className="text-xs text-[#FF8A82] bg-[#FF453A]/10 border border-[#FF453A]/25 rounded-xl px-3 py-2">{text}</p>;
