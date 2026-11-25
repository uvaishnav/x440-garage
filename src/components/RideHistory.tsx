import { useId, useMemo, useState } from 'react';
import type { TimelineRide } from '../types';
import { localDateInputValue } from '../lib/date';
import { analyzeRouteSamples, splitRouteTrace } from '../lib/routeTrace';
import { summarizeRides } from '../lib/rideHistory';
import { RouteMap } from './RouteMap';
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

export function RidingStats({ rides, onDelete }: {
  rides: TimelineRide[];
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
  const daily = [...stats.dailyKm].sort(([a], [b]) => b.localeCompare(a));
  const scale = Math.max(1, ...daily.map(([, km]) => km));
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
      <h2 id="riding-stats-heading" className="text-base font-semibold">Riding stats</h2>
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
          <dl className="grid grid-cols-3 gap-2">
            <Metric label="Distance" value={`${number.format(stats.km)} km`} />
            <Metric label="Ride legs" value={number.format(selected.length)} />
            <Metric label="Riding days" value={number.format(daily.length)} />
          </dl>
          <div className="border-t border-white/[0.08] pt-3">
            <h3 className="text-xs font-semibold text-[#D8D8DC]">Recent riding days</h3>
            <ul className="mt-2 space-y-2">
              {daily.slice(0, 5).map(([day, km]) => (
                <li key={day} className="grid grid-cols-[3.8rem_1fr_4.6rem] items-center gap-2 text-xs tabular-nums">
                  <span className="text-[#B3B3BB]">{dateLabel(day)}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#2A2B30]" aria-hidden="true">
                    <div className="h-full rounded-full bg-[#FF8037]" style={{ width: `${km / scale * 100}%` }} />
                  </div>
                  <span className="text-right text-[#E1E1E5]">{number.format(km)} km</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-[#B3B3BB]">
            Longest leg {number.format(stats.longestKm)} km
            {driving > 0 && ` · Includes ${driving} unverified driving ${driving === 1 ? 'leg' : 'legs'}`}
          </p>
          <details className="border-t border-white/[0.08]">
            <summary className="min-h-11 content-center cursor-pointer text-sm font-medium text-[#D8D8DC]">Ride log</summary>
            <ul className="divide-y divide-white/[0.06]">
              {selected.slice(0, visibleRows).map((ride) => (
                <li key={ride.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-[#B3B3BB]">{dateLabel(ride.date)} · {rideTime(ride)}</span>
                  <span className="ml-auto text-right tabular-nums">{number.format(ride.distanceKm)} km</span>
                  <button type="button" onClick={() => void deleteRide(ride)} disabled={deleting != null}
                    className="flex size-11 shrink-0 items-center justify-center rounded-lg text-[#B3B3BB] hover:bg-white/[0.06] disabled:opacity-50"
                    aria-label={`Remove ${dateLabel(ride.date)} ride at ${rideTime(ride)}`}>
                    <TrashIcon className="size-4" />
                  </button>
                </li>
              ))}
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

export function TimelineTripCard({ rides, roundTrip }: { rides: TimelineRide[]; roundTrip: boolean }) {
  const first = rides[0];
  const last = rides[rides.length - 1];
  const title = roundTrip ? 'Round trip'
    : first.startName && last.endName && first.startName !== last.endName
      ? `${first.startName} → ${last.endName}` : first.startName || 'Long ride';
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-[#141518] p-4">
      <header className="mb-3">
        <h3 className="break-words text-base font-semibold">{title}</h3>
        <p className="mt-0.5 text-xs tabular-nums text-[#B3B3BB]">{dateLabel(first.date, true)} · {rideTime(first)}</p>
      </header>
      <RideTripSummary rides={rides} />
    </article>
  );
}

export function RideTripSummary({ rides, manual = false }: { rides: TimelineRide[]; manual?: boolean }) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const stats = useMemo(() => summarizeRides(rides), [rides]);
  const routes = useMemo(() => expanded ? rides.flatMap((ride) => splitRouteTrace(ride.points)) : [], [expanded, rides]);
  const coverage = stats.legMinutes ? Math.min(1, stats.sampledMinutes / stats.legMinutes) : 0;
  const bands = useMemo(() => {
    if (!expanded || coverage < 0.65) return [];
    return rides.reduce((total, ride) => {
      const { speedBandMinutes } = analyzeRouteSamples(ride.points);
      return total.map((minutes, index) => minutes + speedBandMinutes[index]);
    }, [0, 0, 0]);
  }, [coverage, expanded, rides]);
  const bandTotal = bands.reduce((sum, minutes) => sum + minutes, 0);
  const roundedBands = bands.map((minutes) => Math.floor(minutes / bandTotal * 100));
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
        <Metric label="Ride legs" value={number.format(rides.length)} />
      </dl>
      {unverified && <p className="text-xs text-[#FFBE90]">Includes unverified driving.</p>}
      <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)}
        className="min-h-11 w-full rounded-xl bg-[#1F2126] px-3 text-left text-sm font-medium text-[#E1E1E5] hover:bg-[#282A30]">
        {expanded ? 'Hide route details' : 'View route details'}
      </button>
      <div id={id} hidden={!expanded} className="space-y-3">
        {expanded && (
          <>
            <RouteMap routes={routes} heightClass="h-44" />
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
            {rides.length > 1 && (
              <ol className="divide-y divide-white/[0.06] border-t border-white/[0.08]">
                {rides.map((ride) => (
                  <li key={ride.id} className="flex flex-wrap justify-between gap-x-2 gap-y-1 py-2 text-xs tabular-nums">
                    <span className="text-[#B3B3BB]">{dateLabel(ride.date)} · {rideTime(ride)}</span>
                    <span>{number.format(ride.distanceKm)} km · {duration(ride.durationMin)}</span>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-[#B3B3BB]">{label}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold tabular-nums text-[#F5F5F7]">{value}</dd>
    </div>
  );
}
