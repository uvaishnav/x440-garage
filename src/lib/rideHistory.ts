import type { TimelineRide, Trip } from '../types';
import { localDateInputValue } from './date';
import { routeDistanceKm } from './routeTrace';

function isGoogleRide(ride: TimelineRide) {
  return ride.source === 'google-timeline' || ride.id.startsWith('tl-');
}

function importKey(ride: TimelineRide) {
  return isGoogleRide(ride) ? `google:${Date.parse(ride.startTime)}` : ride.id;
}

export function newTimelineRides(incoming: TimelineRide[], saved: TimelineRide[]): TimelineRide[] {
  const seen = new Set(saved.map(importKey));
  const lastGoogleDay = saved.reduce((latest, ride) =>
    isGoogleRide(ride) && ride.date > latest ? ride.date : latest, '');

  return incoming.filter((ride) => {
    // The most recent day may have been imported before the last ride of that day.
    if (isGoogleRide(ride) && ride.date < lastGoogleDay) return false;
    const key = importKey(ride);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** An overlapping export can add visit metadata to saved legs without adding those legs again. */
export function timelinePlaceUpdates(incoming: TimelineRide[], saved: TimelineRide[]): TimelineRide[] {
  const byKey = new Map(incoming.filter(isGoogleRide).map((ride) => [importKey(ride), ride]));
  return saved.flatMap((ride) => {
    const parsed = byKey.get(importKey(ride));
    if (!parsed || Date.parse(parsed.endTime) !== Date.parse(ride.endTime)) return [];
    const startPlace = ride.startPlace ?? parsed.startPlace;
    const endPlace = ride.endPlace ?? parsed.endPlace;
    return startPlace !== ride.startPlace || endPlace !== ride.endPlace
      ? [{ ...ride, startPlace, endPlace }]
      : [];
  });
}

/** GPS outages are unknown time. Breaks between legs are outside this total. */
export function recordedLegMinutes(ride: TimelineRide): number {
  return Math.max(0, ride.durationMin - (ride.longGapMin ?? 0));
}

export function summarizeRides(rides: TimelineRide[]) {
  let km = 0;
  let legMinutes = 0;
  let sampledMinutes = 0;
  let movingMinutes = 0;
  let stoppedMinutes = 0;
  let longestKm = 0;
  const dailyKm = new Map<string, number>();

  for (const ride of rides) {
    km += ride.distanceKm;
    legMinutes += ride.durationMin;
    sampledMinutes += ride.sampledMin ?? 0;
    movingMinutes += ride.sampledMin != null ? ride.movingMin ?? 0 : 0;
    stoppedMinutes += ride.sampledMin != null ? ride.stoppedMin ?? 0 : 0;
    longestKm = Math.max(longestKm, ride.distanceKm);
    dailyKm.set(ride.date, (dailyKm.get(ride.date) ?? 0) + ride.distanceKm);
  }
  return { km, legMinutes, sampledMinutes, movingMinutes, stoppedMinutes, longestKm, dailyKm };
}

interface TimelineTrip {
  rides: TimelineRide[];
  roundTrip: boolean;
}

function endsOnStartDay(ride: TimelineRide) {
  const offset = ride.startTime.match(/([+-])(\d{2}):?(\d{2})$/);
  const end = Date.parse(ride.endTime);
  if (!offset) return localDateInputValue(new Date(end)) === ride.date;
  const minutes = (Number(offset[2]) * 60 + Number(offset[3])) * (offset[1] === '-' ? -1 : 1);
  return new Date(end + minutes * 60_000).toISOString().slice(0, 10) === ride.date;
}

function closeEnough(a: TimelineRide['points'][number] | undefined, b: TimelineRide['points'][number] | undefined, km: number) {
  return a != null && b != null && routeDistanceKm(a, b) <= km;
}

function groupUnassigned(rides: TimelineRide[]): TimelineTrip[] {
  const grouped: TimelineTrip[] = [];
  for (let first = 0; first < rides.length;) {
    const origin = rides[first];
    let last = first;
    let roundTrip = false;
    if (origin.points.length >= 2) {
      let leftOrigin = false;
      for (let i = first; i < rides.length; i++) {
        const leg = rides[i];
        if (leg.date !== origin.date || !endsOnStartDay(leg) || leg.points.length < 2) break;
        if (i > first) {
          const previous = rides[i - 1];
          if (Date.parse(leg.startTime) < Date.parse(previous.endTime)
            || !closeEnough(previous.points[previous.points.length - 1], leg.points[0], 0.75)) break;
        }
        leftOrigin ||= leg.points.some((point) => !closeEnough(origin.points[0], point, 0.5));
        if (leftOrigin && closeEnough(origin.points[0], leg.points[leg.points.length - 1], 0.5)) {
          last = i;
          roundTrip = true;
          break;
        }
      }
    }
    grouped.push({ rides: rides.slice(first, last + 1), roundTrip });
    first = last + 1;
  }
  return grouped.filter((trip) =>
    trip.rides.reduce((sum, ride) => sum + recordedLegMinutes(ride), 0) > 60
  ).reverse();
}

export function buildRideHistory(rides: TimelineRide[], manualTrips: Trip[]) {
  const windows = manualTrips.flatMap((trip) => {
    const start = Date.parse(trip.startTime || `${trip.startDate}T00:00`);
    const end = trip.endTime ? Date.parse(trip.endTime) + (/T\d{2}:\d{2}$/.test(trip.endTime) ? 59_999 : 0)
      : trip.endDate ? Date.parse(`${trip.endDate}T23:59:59.999`)
      : trip.status === 'active' ? Infinity
      : Date.parse(`${trip.startDate}T23:59:59.999`);
    return Number.isFinite(start) && end >= start ? [{ trip, start, end }] : [];
  }).sort((a, b) => (a.end - a.start) - (b.end - b.start) || b.start - a.start || a.trip.id.localeCompare(b.trip.id));

  const byTrip = new Map<string, TimelineRide[]>();
  const unassigned: TimelineRide[] = [];
  const ordered = [...rides].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  for (const ride of ordered) {
    const start = Date.parse(ride.startTime);
    const end = Date.parse(ride.endTime);
    const match = windows.find((window) => start >= window.start && end <= window.end);
    if (match) {
      const linked = byTrip.get(match.trip.id) ?? [];
      linked.push(ride);
      byTrip.set(match.trip.id, linked);
    } else {
      unassigned.push(ride);
    }
  }

  return { byTrip, timelineTrips: groupUnassigned(unassigned) };
}
