import { useId, useMemo, useState } from 'react';
import type { TimelineRide } from '../types';
import { localDateInputValue } from '../lib/date';
import { analyzeRouteSamples, splitRouteTrace } from '../lib/routeTrace';
import { summarizeRides } from '../lib/rideHistory';
import { distanceTrend, ridingInsights } from '../lib/ridingInsights';
import { googleMapsStopUrl, rideStop, tripDestination, type PlaceNames } from '../lib/ridePlaces';
import { RouteMap } from './RouteMap';
import { RouteSketch } from './RouteSketch';
import { TrashIcon } from './Icons';

const number = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const fullDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const periods = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 0, label: 'All time' },
];

function dateLabel(day: string, withYear = false) {
  return (withYear ? fullDate : shortDate).format(new Date(`${day}T12:00`));
}

function duration(minutes: number) {
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  return [hours ? `${hours} h` : '', rounded % 60 || !hours ? `${rounded % 60} min` : ''].filter(Boolean).join(' ');
}

function rideTime(ride: TimelineRide) {
  return ride.startTime.slice(11, 16);
}

export function RidingStats({ rides, names, onDelete }: {
  rides: TimelineRide[];
  names?: PlaceNames;
  onDelete: (id: string) => Promise<void>;
}) {
  const [period, setPeriod] = useState(30);
  const [visibleRows, setVisibleRows] = useState(10);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const sorted = useMemo(() => [...rides].sort((a, b) =>
    Date.parse(b.startTime) - Date.parse(a.startTime)
  ), [rides]);
  const selected = useMemo(() => {
    if (period === 0) return sorted;
    const first = new Date();
    first.setDate(first.getDate() - period + 1);
    const start = localDateInputValue(first);
    const end = localDateInputValue();
    return sorted.filter((ride) => ride.date >= start && ride.date <= end);
  }, [period, sorted]);
  const stats = useMemo(() => summarizeRides(selected), [selected]);
  const insights = useMemo(() => ridingInsights(selected, stats.dailyKm, names), [selected, stats, names]);
  const trend = useMemo(() => {
    if (!selected.length) return [];
    if (period === 0) {
      const dates = [...stats.dailyKm.keys()].sort();
      return distanceTrend(stats.dailyKm, dates[0], dates[dates.length - 1], period);
    }
    const start = new Date();
    start.setDate(start.getDate() - period + 1);
    return distanceTrend(stats.dailyKm, localDateInputValue(start), localDateInputValue(), period);
  }, [period, selected, stats]);
  const driving = selected.filter((ride) => ['DRIVING', 'IN_PASSENGER_VEHICLE'].includes(ride.activityType)).length;

  const deleteRide = async (ride: TimelineRide) => {
    if (deleting || !window.confirm(`Remove the ${number.format(ride.distanceKm)} km ride on ${dateLabel(ride.date)}?`)) return;
    setDeleting(ride.id);
    setDeleteError('');
    try {
      await onDelete(ride.id);
    } catch {
      setDeleteError('Could not remove this ride. Try again.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#141518] p-4 space-y-4" aria-labelledby="riding-stats-heading">
      <h2 id="riding-stats-heading" className="text-base font-semibold">Riding activity</h2>
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-[#1F2126] p-1" role="group" aria-label="Riding stats period">
        {periods.map(({ days, label }) => (
          <button key={days} type="button" aria-pressed={period === days}
            className={`min-h-11 rounded-lg text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFB27A] ${period === days ? 'bg-[#38302C] text-[#FFBE90]' : 'text-[#C2C2C7] hover:bg-white/[0.06]'}`}
            onClick={() => { setPeriod(days); setVisibleRows(10); }}>
            {label}
          </button>
        ))}
      </div>
      {selected.length ? (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-[1.75rem] leading-tight font-semibold tabular-nums">{number.format(stats.km)} <span className="text-sm text-[#B3B3BB]">km ridden</span></p>
            <p className="text-xs text-[#C2C2C7]">{selected.length} legs · {stats.dailyKm.size} riding days</p>
          </div>
          <DistanceTrend buckets={trend} />
          <dl className="divide-y divide-white/[0.07] border-y border-white/[0.07] text-xs">
            {insights.busiest && (
              <Insight label="Biggest day" value={`${dateLabel(insights.busiest[0])} · ${number.format(insights.busiest[1])} km`} />
            )}
            {selected.length >= 3 && <Insight label="Typical leg" value={`${number.format(insights.typicalKm)} km`} />}
            {insights.repeat && <Insight label="You rode back to" value={`${insights.repeat.label} · ${insights.repeat.days.size} days`} />}
          </dl>
          {driving > 0 && <p className="text-xs text-[#FFBE90]">Includes {driving} unverified driving {driving === 1 ? 'leg' : 'legs'}.</p>}
          <details className="border-t border-white/[0.08]">
            <summary className="min-h-11 content-center cursor-pointer text-sm font-medium text-[#D8D8DC]">Ride log</summary>
            <ul className="divide-y divide-white/[0.06]">
              {selected.slice(0, visibleRows).map((ride) => {
                const stop = rideStop(ride, 'end', names);
                return (
                  <li key={ride.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0 py-2">
                      <p className="text-[#E1E1E5]">{stop.name ?? (stop.area ? `Near ${stop.area}` : 'Ride leg')}</p>
                      <p className="mt-0.5 text-[#B3B3BB]">{dateLabel(ride.date)} · {rideTime(ride)}</p>
                    </div>
                    <span className="ml-auto shrink-0 text-right tabular-nums">{number.format(ride.distanceKm)} km</span>
                    <button type="button" onClick={() => void deleteRide(ride)} disabled={deleting != null}
                      className="flex size-11 shrink-0 items-center justify-center rounded-lg text-[#B3B3BB] hover:bg-white/[0.06] disabled:opacity-50"
                      aria-label={`Remove ${dateLabel(ride.date)} ride at ${rideTime(ride)}`}>
                      <TrashIcon className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
            {visibleRows < selected.length && (
              <button type="button" className="min-h-11 text-sm font-medium text-[#FFBE90]"
                onClick={() => setVisibleRows((count) => count + 10)}>Show more rides</button>
            )}
            {deleteError && <p role="alert" className="text-xs text-[#FF9D91]">{deleteError}</p>}
          </details>
        </>
      ) : <p className="text-sm text-[#B3B3BB]">No recorded rides in this period. Choose a longer range to see older rides.</p>}
    </section>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[#B3B3BB]">{label}</dt>
      <dd className="text-right font-medium tabular-nums text-[#E1E1E5]">{value}</dd>
    </div>
  );
}

function DistanceTrend({ buckets }: { buckets: ReturnType<typeof distanceTrend> }) {
  const [picked, setPicked] = useState<string | null>(null);
  const max = Math.max(1, ...buckets.map((bucket) => bucket.km));
  const selected = buckets.find((bucket) => bucket.from === picked)
    ?? [...buckets].reverse().find((bucket) => bucket.km > 0);
  if (!selected) return null;
  const label = (bucket: typeof selected) => bucket.from === bucket.to
    ? dateLabel(bucket.from) : `${dateLabel(bucket.from)}–${dateLabel(bucket.to)}`;
  return (
    <div className="rounded-xl bg-[#1A1B1F] px-3 pb-2.5 pt-3">
      <div className="flex items-baseline justify-between gap-2 text-xs" aria-live="polite">
        <span className="text-[#C2C2C7]">{label(selected)}</span>
        <span className="font-medium tabular-nums text-[#FFBE90]">{number.format(selected.km)} km</span>
      </div>
      <div className="mt-1.5 flex gap-0.5 border-b border-white/15" role="group" aria-label="Distance over time">
        {buckets.map((bucket) => (
          <button key={bucket.from} type="button" aria-pressed={bucket === selected}
            aria-label={`${label(bucket)}, ${number.format(bucket.km)} kilometres`}
            onClick={() => setPicked(bucket.from)}
            className="flex h-16 flex-1 items-end justify-center rounded-sm px-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFB27A] hover:bg-white/[0.05]">
            <span aria-hidden="true"
              className={`w-full max-w-12 rounded-t-sm ${bucket === selected ? 'bg-[#FF934F]' : 'bg-[#74513F]'}`}
              style={{ height: `${Math.max(3, bucket.km / max * 100)}%` }} />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-[#B3B3BB]" aria-hidden="true">
        <span>{dateLabel(buckets[0].from)}</span><span>{dateLabel(buckets[buckets.length - 1].to)}</span>
      </div>
    </div>
  );
}

interface RidePlaceProps {
  names?: PlaceNames;
  onSavePlaceName: (id: string, name: string) => Promise<void>;
}

export function TimelineTripCard({ rides, roundTrip, names, onSavePlaceName }: {
  rides: TimelineRide[];
  roundTrip: boolean;
} & RidePlaceProps) {
  const first = rides[0];
  const origin = useMemo(() => rideStop(first, 'start', names), [first, names]);
  const destination = useMemo(() => rideStop(tripDestination(rides, roundTrip), 'end', names), [rides, roundTrip, names]);
  const hour = Number(rideTime(first).slice(0, 2));
  const timeOfDay = hour < 11 ? 'Morning' : hour < 16 ? 'Afternoon' : 'Evening';
  const title = destination.name ? `${roundTrip ? 'Loop via' : 'Ride to'} ${destination.name}`
    : destination.area ? `${roundTrip ? 'Loop near' : origin.area === destination.area ? 'Ride around' : 'Ride near'} ${destination.area}`
    : first.source === 'gpx' && first.startName ? first.startName
    : `${timeOfDay} ${roundTrip ? 'loop' : 'ride'}`;
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#141518] p-4">
      <header className="mb-3 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs tabular-nums text-[#B3B3BB]">{dateLabel(first.date, true)} · {rideTime(first)}</p>
          <h3 className="mt-1 text-pretty break-words text-lg font-semibold leading-tight">{title}</h3>
          {origin.label && origin.label !== destination.label && (
            <p className="mt-1.5 text-xs text-[#B3B3BB]">From {origin.name ?? `near ${origin.area}`}</p>
          )}
        </div>
        <RouteSketch rides={rides} />
      </header>
      <RideTripSummary rides={rides} names={names} onSavePlaceName={onSavePlaceName} featuredStop={destination} />
    </article>
  );
}

export function RideTripSummary({ rides, manual = false, names, onSavePlaceName, featuredStop }: {
  rides: TimelineRide[];
  manual?: boolean;
  featuredStop?: ReturnType<typeof rideStop>;
} & RidePlaceProps) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const stats = useMemo(() => summarizeRides(rides), [rides]);
  const routes = useMemo(() => expanded ? rides.flatMap((ride) => splitRouteTrace(ride.points)) : [], [expanded, rides]);
  const stops = useMemo(() => expanded ? rides.map((ride) => rideStop(ride, 'end', names)) : [], [expanded, names, rides]);
  const coverage = stats.legMinutes ? Math.min(1, stats.sampledMinutes / stats.legMinutes) : 0;
  const bands = useMemo(() => {
    if (!expanded || coverage < 0.65) return [];
    return rides.reduce((total, ride) => {
      const { speedBandMinutes } = analyzeRouteSamples(ride.points);
      return total.map((minutes, index) => minutes + speedBandMinutes[index]);
    }, [0, 0, 0]);
  }, [coverage, expanded, rides]);
  const bandTotal = bands.reduce((sum, minutes) => sum + minutes, 0);
  const roundedBands = bandTotal ? bands.map((minutes) => Math.floor(minutes / bandTotal * 100)) : [];
  if (bandTotal) {
    const largest = bands.indexOf(Math.max(...bands));
    roundedBands[largest] += 100 - roundedBands.reduce((sum, value) => sum + value, 0);
  }
  const longGap = rides.some((ride) => (ride.longGapMin ?? 0) > 0);
  const unverified = rides.some((ride) => ['DRIVING', 'IN_PASSENGER_VEHICLE'].includes(ride.activityType));

  if (!rides.length) return null;
  return (
    <div className={`space-y-3 border-t border-white/[0.08] pt-3 ${manual ? 'mt-3' : ''}`}>
      {manual && <h3 className="text-sm font-medium">Recorded rides</h3>}
      <dl className="grid grid-cols-3 gap-2">
        <Metric label="GPS distance" value={`${number.format(stats.km)} km`} />
        <Metric label="Leg elapsed time" value={duration(stats.legMinutes)} />
        {coverage >= 0.65 && stats.sampledMinutes >= 5
          ? <Metric label="Moving estimate" value={duration(stats.movingMinutes)} />
          : <Metric label="Ride legs" value={number.format(rides.length)} />}
      </dl>
      {unverified && <p className="text-xs text-[#FFBE90]">Includes unverified driving.</p>}
      <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)}
        className="min-h-11 w-full rounded-xl bg-[#1F2126] px-3 text-left text-sm font-medium text-[#E1E1E5] hover:bg-[#282A30]">
        {expanded ? 'Hide ride details' : 'Explore this ride'}
      </button>
      <div id={id} hidden={!expanded} className="space-y-3">
        {expanded && (
          <>
            <RouteMap routes={routes} heightClass="h-44" />
            {featuredStop?.point && <StopDetails stop={featuredStop} onSavePlaceName={onSavePlaceName} />}
            {stats.sampledMinutes >= 3 && (
              <p className="text-xs tabular-nums text-[#D8D8DC]">
                Estimated from GPS samples · {duration(stats.movingMinutes)} moving · {duration(stats.stoppedMinutes)} stopped ({Math.round(coverage * 100)}% of leg time covered)
              </p>
            )}
            {(longGap || coverage < 0.65) && (
              <p className="text-xs text-[#B3B3BB]">GPS coverage is incomplete. The map shows the recorded sections.</p>
            )}
            {bandTotal >= 3 && (
              <div className="space-y-1 text-xs text-[#B3B3BB]">
                <p>Share of sampled moving time</p>
                <p className="tabular-nums">Under 35 km/h {roundedBands[0]}% · 35–69 {roundedBands[1]}% · 70+ {roundedBands[2]}%</p>
              </div>
            )}
            {(rides.length > 1 || !featuredStop) && (
              <ol className="divide-y divide-white/[0.06] border-t border-white/[0.08]">
                {rides.map((ride, index) => (
                  <li key={ride.id} className="space-y-1 py-2 text-xs tabular-nums">
                    <div className="flex flex-wrap justify-between gap-x-2 gap-y-1">
                      <span className="text-[#B3B3BB]">{dateLabel(ride.date)} · {rideTime(ride)}</span>
                      <span>{number.format(ride.distanceKm)} km · {duration(ride.durationMin)}</span>
                    </div>
                    {stops[index]?.point && !(featuredStop?.id && stops[index].id === featuredStop.id) && (
                      <StopDetails stop={stops[index]} onSavePlaceName={onSavePlaceName} />
                    )}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StopDetails({ stop, onSavePlaceName }: {
  stop: ReturnType<typeof rideStop>;
  onSavePlaceName: RidePlaceProps['onSavePlaceName'];
}) {
  const fieldId = useId();
  const [editName, setEditName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const url = googleMapsStopUrl(stop);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stop.id || editName == null || saving) return;
    setSaving(true);
    setError(false);
    try {
      await onSavePlaceName(stop.id, editName);
      setEditName(null);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1 text-xs">
      <p className="font-medium text-[#E1E1E5]">{stop.name ?? (stop.area ? `Near ${stop.area}` : 'Recorded stop')}</p>
      <div className="flex flex-wrap items-center gap-x-4">
        {url && (
          <a href={url} target="_blank" rel="noreferrer"
            className="inline-flex min-h-11 items-center text-[#FFBE90] underline decoration-[#9B6241] underline-offset-4">
            {stop.id ? 'Open matched stop in Google Maps' : 'Open pin in Google Maps'}
          </a>
        )}
        {stop.id && editName == null && (
          <button type="button" className="min-h-11 text-[#D8D8DC] underline underline-offset-4"
            onClick={() => setEditName(stop.name ?? '')}>
            {stop.name ? 'Edit stop name' : 'Name this stop'}
          </button>
        )}
      </div>
      {editName != null && (
        <form onSubmit={save} className="space-y-2">
          <label htmlFor={fieldId} className="block text-[#C2C2C7]">Name used on your ride cards</label>
          <input id={fieldId} value={editName} maxLength={80} disabled={saving} onChange={(event) => setEditName(event.target.value)}
            placeholder="Leave blank to use the area name" className="field h-11 text-base" />
          <div className="flex items-center gap-2">
            <button type="submit" disabled={saving} className="min-h-11 rounded-lg bg-[#38302C] px-3 text-sm font-medium text-[#FFBE90] disabled:opacity-50">
              {saving ? 'Saving…' : 'Save name'}
            </button>
            <button type="button" disabled={saving} onClick={() => { setEditName(null); setError(false); }}
              className="min-h-11 px-3 text-sm text-[#D8D8DC]">Cancel</button>
          </div>
          {error && <p role="alert" className="text-[#FF9D91]">Could not save this name. Try again.</p>}
        </form>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-[#B3B3BB]">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold tabular-nums text-[#F5F5F7]">{value}</dd>
    </div>
  );
}
