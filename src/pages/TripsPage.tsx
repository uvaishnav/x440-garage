import React, { useRef, useState } from 'react';
import { RouteMap } from '../components/RouteMap';
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
import { enrichRidePlaces } from '../lib/osmEnrichment';
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeTrip = trips.find((trip) => trip.status === 'active') || null;
  const pastTrips = trips.filter((trip) => trip.status === 'completed');

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
    const file = event.target.files?.[0];
    if (!file) return;
    setImportStatus('Parsing ride file…');
    try {
      const text = await file.text();
      let parsed = file.name.toLowerCase().endsWith('.gpx')
        ? parseGpx(text)
        : parseGoogleTimelineJson(text, settings.includeAmbiguousDriving);
      if (!parsed.length) {
        setImportStatus(
          'No motorcycle rides found. Enable the Driving fallback in Settings if Google mislabeled the ride.'
        );
      } else {
        setImportStatus(`Found ${parsed.length} rides · matching trips and naming places…`);
        const matchedTrips = new Map<string, Trip>();
        parsed = parsed.map((ride) => {
          const rideTime = new Date(ride.startTime).getTime();
          const match = trips.find((trip) => {
            const start = new Date(trip.startTime || `${trip.startDate}T00:00`).getTime();
            const finish = new Date(
              trip.endTime || `${trip.endDate || trip.startDate}T23:59`
            ).getTime();
            return rideTime >= start - 3_600_000 && rideTime <= finish + 3_600_000;
          });
          if (!match) return ride;
          matchedTrips.set(match.id, {
            ...match,
            linkedTimelineRideIds: Array.from(
              new Set([...(match.linkedTimelineRideIds || []), ride.id])
            ),
          });
          return { ...ride, tripId: match.id };
        });
        for (const trip of matchedTrips.values()) await onSaveTrip(trip);
        const enriched: TimelineRide[] = [];
        for (let index = 0; index < parsed.length; index += 1) {
          setImportStatus(`Naming places ${index + 1}/${parsed.length}…`);
          enriched.push(await enrichRidePlaces(parsed[index]));
        }
        await onImportTimeline(enriched);
        setImportStatus(`Imported ${enriched.length} motorcycle ride${enriched.length === 1 ? '' : 's'}.`);
      }
    } catch {
      setImportStatus('This file could not be read as a supported Timeline JSON export.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const linkTimelineRide = async (ride: TimelineRide, tripId: string) => {
    const previousTrip = trips.find((trip) => trip.id === ride.tripId);
    const nextTrip = trips.find((trip) => trip.id === tripId);
    if (previousTrip && previousTrip.id !== tripId) {
      await onSaveTrip({
        ...previousTrip,
        linkedTimelineRideIds: (previousTrip.linkedTimelineRideIds || []).filter(
          (id) => id !== ride.id
        ),
      });
    }
    if (nextTrip) {
      await onSaveTrip({
        ...nextTrip,
        linkedTimelineRideIds: Array.from(
          new Set([...(nextTrip.linkedTimelineRideIds || []), ride.id])
        ),
      });
    }
    await onImportTimeline([{ ...ride, tripId: tripId || null }]);
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
        </section>
      )}

      <section className="rounded-2xl bg-[#141518] border border-white/[0.08] p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-sm font-semibold text-[#F5F5F7]">Google Maps Timeline Import</p><p className="text-[11px] text-[#8E8E93] mt-0.5">Motorcycle rides only; car, bus and walking are skipped.</p></div>
          <input ref={fileInputRef} type="file" accept=".json,.gpx,application/json,application/gpx+xml" onChange={handleTimelineUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="shrink-0 h-10 px-3.5 rounded-xl bg-[#1F2126] border border-white/10 text-xs font-medium text-[#F5F5F7] flex items-center gap-1.5"><UploadIcon className="w-4 h-4 text-[#FF6600]" /> Import</button>
        </div>
        {importStatus && <p className="text-xs text-[#FFB27A] bg-[#FF6600]/10 rounded-xl px-3 py-2">{importStatus}</p>}
      </section>

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
              </div>
            );
          })}
        </section>
      )}

      {timelineRides.length > 0 && (
        <section className="space-y-3">
          <div className="flex justify-between px-1"><h2 className="text-sm font-semibold text-[#F5F5F7]">Timeline Motorcycle Rides</h2><span className="text-[11px] text-[#636366]">{timelineRides.length} rides</span></div>
          {timelineRides.slice(0, 20).map((ride) => (
            <div key={ride.id} className="rounded-2xl bg-[#141518] border border-white/[0.08] p-4 space-y-3">
              <div className="flex justify-between gap-3"><div><p className="text-sm font-semibold text-[#F5F5F7]">{ride.startName && ride.endName ? `${ride.startName} → ${ride.endName}` : `${ride.distanceKm} km Ride`}</p><p className="text-[11px] text-[#8E8E93]">{ride.date} · {ride.durationMin} min{ride.movingMin ? ` (${ride.movingMin} moving)` : ''} · Avg {ride.avgSpeedKmh} km/h</p></div><span className="text-[11px] text-[#FF6600]">{ride.highwayPercent}% Hwy</span></div>
              <RouteMap points={ride.points} heightClass="h-40" />
              <div className="h-1.5 rounded-full bg-[#636366] overflow-hidden"><div className="h-full bg-[#FF6600]" style={{ width: `${ride.highwayPercent}%` }} /></div>
              <RideSpeedBands ride={ride} />
              <div className="flex items-center gap-2">
                <select value={ride.tripId || ''} onChange={(event) => linkTimelineRide(ride, event.target.value)} className="field h-10 text-xs flex-1">
                  <option value="">Not linked to a manual trip</option>
                  {trips.map((trip) => <option key={trip.id} value={trip.id}>{trip.name}</option>)}
                </select>
                <span className="text-[10px] text-[#636366] uppercase">{ride.source === 'gpx' ? 'GPX' : 'Timeline'}</span>
                <button onClick={() => onDeleteTimelineRide(ride.id)} className="w-10 h-10 rounded-xl bg-[#1F2126] text-[#8E8E93] flex items-center justify-center" aria-label="Delete imported ride"><TrashIcon /></button>
              </div>
            </div>
          ))}
        </section>
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

const RideSpeedBands: React.FC<{ ride: TimelineRide }> = ({ ride }) => {
  const speeds = ride.points.map((point) => point.speedKmh).filter((speed): speed is number => speed != null && Number.isFinite(speed));
  if (!speeds.length) return <p className="text-[10px] text-[#636366]">Road split: {ride.classificationMethod === 'osm' ? 'OSM road metadata + speed' : 'average-speed estimate'}</p>;
  const city = Math.round((speeds.filter((speed) => speed < 35).length / speeds.length) * 100);
  const cruise = Math.round((speeds.filter((speed) => speed >= 35 && speed < 70).length / speeds.length) * 100);
  const fast = Math.max(0, 100 - city - cruise);
  return <div className="grid grid-cols-3 gap-2 text-[10px] text-[#8E8E93]"><span>Under 35 · {city}%</span><span>35–70 · {cruise}%</span><span>70+ · {fast}%</span></div>;
};
