import type { RoutePoint, TimelinePlace, TimelineRide } from '../types';
import { localDateInputValue } from './date';
import { analyzeRouteSamples, routeDistanceKm, splitRouteTrace } from './routeTrace';

function numeric(value: unknown): number | undefined {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function coordinates(lat: unknown, lng: unknown): RoutePoint | undefined {
  const latitude = numeric(lat);
  const longitude = numeric(lng);
  if (latitude == null || longitude == null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return;
  return { lat: latitude, lng: longitude };
}

function parseLocation(raw: unknown): RoutePoint | undefined {
  if (typeof raw !== 'string') return;
  const parts = raw.trim().replace(/^geo:/i, '').replace(/°/g, '').split(',');
  if (parts.length === 2) return coordinates(parts[0], parts[1]);
}

function timestamp(raw: unknown): number {
  return typeof raw === 'string' ? Date.parse(raw) : NaN;
}

function activityType(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toUpperCase().replace(/[\s-]+/g, '_') : '';
}

interface TimedPoint {
  point: RoutePoint;
  ms: number;
}

function pathPoints(path: unknown, windowStart: number): TimedPoint[] {
  if (!Array.isArray(path)) return [];
  return path.flatMap((entry) => {
    const point = parseLocation(entry?.point);
    const time = timestamp(entry?.time);
    const offset = numeric(entry?.durationMinutesOffsetFromStartTime);
    const ms = Number.isFinite(time) ? time
      : offset != null && offset >= 0 ? windowStart + offset * 60_000
      : NaN;
    // Keep times within the range accepted by Date.toISOString.
    if (!point || !Number.isFinite(new Date(ms).getTime())) return [];
    return [{ point: { ...point, time: new Date(ms).toISOString() }, ms }];
  });
}

function lowerBound(points: TimedPoint[], time: number): number {
  let low = 0;
  let high = points.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (points[middle].ms < time) low = middle + 1;
    else high = middle;
  }
  return low;
}

function reduceTrace(points: RoutePoint[]): RoutePoint[] {
  const limit = 500;
  if (points.length <= limit) return points;
  return Array.from({ length: limit }, (_, index) =>
    points[Math.round(index * (points.length - 1) / (limit - 1))]
  );
}

function textValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

interface RideInput {
  type: string;
  startTime: string;
  endTime: string;
  distanceMeters?: number;
  points: RoutePoint[];
  startName?: string;
  endName?: string;
  startPlace?: TimelinePlace;
  endPlace?: TimelinePlace;
}

interface Visit {
  place: TimelinePlace;
  from: number;
  to: number;
}

function matchVisit(point: RoutePoint | undefined, at: number, visits: Visit[]): TimelinePlace | undefined {
  if (!point) return;
  let closest: TimelinePlace | undefined;
  let bestScore = Infinity;
  for (const { place, from, to } of visits) {
    const minutes = Math.max(from - at, at - to, 0) / 60_000;
    if (minutes > 15) continue;
    const km = routeDistanceKm(point, place);
    const score = km + minutes * 0.025;
    if (km <= 0.45 && score < bestScore) {
      closest = place;
      bestScore = score;
    }
  }
  return closest;
}

function buildRide(input: RideInput): TimelineRide | undefined {
  const { type, startTime, endTime, points, startName, endName } = input;
  const start = timestamp(startTime);
  const end = timestamp(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;

  const trace = analyzeRouteSamples(points);
  const traceKm = () => splitRouteTrace(points).reduce((km, part) =>
    km + part.slice(1).reduce((sum, point, i) => sum + routeDistanceKm(part[i], point), 0), 0);
  const distanceKm = input.distanceMeters != null && input.distanceMeters > 0
    ? input.distanceMeters / 1000
    : traceKm();
  const minimumKm = type === 'IN_PASSENGER_VEHICLE' || type === 'DRIVING' ? 0.8 : 0.05;
  if (distanceKm < minimumKm) return;

  const durationMin = (end - start) / 60_000;
  const avgSpeedKmh = Number((distanceKm * 60 / durationMin).toFixed(1));
  const highwayPercent = avgSpeedKmh >= 58 ? 85 : avgSpeedKmh >= 45 ? 65 : avgSpeedKmh >= 35 ? 35 : 10;
  const hasSamples = points.some((point) => point.time && !point.anchor);

  return {
    id: `tl-${start}`,
    startTime,
    endTime,
    date: /[+-]\d{2}:?\d{2}$/.test(startTime) ? startTime.slice(0, 10) : localDateInputValue(new Date(start)),
    distanceKm: Number(distanceKm.toFixed(3)),
    durationMin: Number(durationMin.toFixed(3)),
    movingMin: trace.sampledMin > 0 ? trace.movingMin : undefined,
    stoppedMin: trace.sampledMin > 0 ? trace.stoppedMin : undefined,
    sampledMin: hasSamples ? trace.sampledMin : undefined,
    longGapMin: hasSamples ? trace.longGapMin : undefined,
    avgSpeedKmh,
    highwayPercent,
    cityPercent: 100 - highwayPercent,
    activityType: type,
    points: reduceTrace(points),
    startName,
    endName,
    startPlace: input.startPlace,
    endPlace: input.endPlace,
    source: 'google-timeline',
    classificationMethod: 'speed-estimate',
  };
}

/** Supports on-device Timeline exports and older Takeout activity segments. */
export function parseGoogleTimelineJson(jsonText: string, includeAmbiguousDriving = false): TimelineRide[] {
  const data = JSON.parse(jsonText);
  const segments = Array.isArray(data) ? data : data?.semanticSegments;
  const legacy = data?.timelineObjects;
  if (!Array.isArray(segments) && !Array.isArray(legacy)) throw new Error('Unsupported Timeline format');

  const allowed = new Set(['MOTORCYCLING', 'MOTORCYCLE']);
  if (includeAmbiguousDriving) {
    allowed.add('IN_PASSENGER_VEHICLE');
    allowed.add('DRIVING');
  }
  const rides = new Map<number, TimelineRide>();
  const add = (input: RideInput) => {
    const ride = buildRide(input);
    if (ride) rides.set(timestamp(ride.startTime), ride);
  };

  if (Array.isArray(segments)) {
    const standalone = segments.flatMap((segment) => segment?.activity ? []
      : pathPoints(segment?.timelinePath, timestamp(segment?.startTime)))
      .sort((a, b) => a.ms - b.ms);
    const visits = segments.flatMap((segment): Visit[] => {
      const candidate = segment?.visit?.topCandidate;
      const id = textValue(candidate?.placeID ?? candidate?.placeId);
      const point = parseLocation(candidate?.placeLocation?.latLng ?? candidate?.placeLocation);
      const from = timestamp(segment?.startTime);
      const to = timestamp(segment?.endTime);
      if (!id || !/^[A-Za-z0-9_-]{15,200}$/.test(id) || !point || !Number.isFinite(from) || to < from || !Number.isFinite(to)) return [];
      return [{ place: { id, lat: point.lat, lng: point.lng }, from, to }];
    });
    for (const segment of segments) {
      const activity = segment?.activity;
      const type = activityType(activity?.topCandidate?.type || activity?.activityType);
      if (!activity || !allowed.has(type)) continue;
      const { startTime, endTime } = segment;
      const start = timestamp(startTime);
      const end = timestamp(endTime);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;

      const samples = [
        ...standalone.slice(lowerBound(standalone, start), lowerBound(standalone, end + 1)),
        ...pathPoints(segment.timelinePath, start).filter((point) => point.ms >= start && point.ms <= end),
      ].sort((a, b) => a.ms - b.ms);
      // Conflicting coordinates at the same minute cannot describe instantaneous movement.
      const points = samples.filter((sample, index) => index === 0 || samples[index - 1].ms !== sample.ms)
        .map((sample) => sample.point);
      const origin = parseLocation(activity.start?.latLng ?? activity.start);
      const destination = parseLocation(activity.end?.latLng ?? activity.end);
      if (origin && !points.some((point) => timestamp(point.time) === start)) {
        points.unshift({ ...origin, time: startTime, anchor: true });
      }
      if (destination && !points.some((point) => timestamp(point.time) === end)) {
        points.push({ ...destination, time: endTime, anchor: true });
      }
      add({
        type, startTime, endTime, points,
        distanceMeters: numeric(activity.distanceMeters),
        startName: textValue(activity.start?.name) ?? textValue(activity.start?.address),
        endName: textValue(activity.end?.name) ?? textValue(activity.end?.address),
        startPlace: matchVisit(origin ?? points[0], start, visits),
        endPlace: matchVisit(destination ?? points[points.length - 1], end, visits),
      });
    }
  }

  if (Array.isArray(legacy)) {
    for (const item of legacy) {
      const segment = item?.activitySegment;
      const type = activityType(segment?.activityType);
      if (!segment || !allowed.has(type)) continue;
      const legacyLocation = (point: { latitudeE7?: number; longitudeE7?: number } | undefined) =>
        coordinates((point?.latitudeE7 ?? NaN) / 1e7, (point?.longitudeE7 ?? NaN) / 1e7);
      const waypoints: Array<{ latE7?: number; lngE7?: number } | null> =
        Array.isArray(segment.waypointPath?.waypoints) ? segment.waypointPath.waypoints : [];
      add({
        type,
        startTime: segment.duration?.startTimestamp,
        endTime: segment.duration?.endTimestamp,
        distanceMeters: numeric(segment.distance),
        points: [
          legacyLocation(segment.startLocation),
          ...waypoints.map((point) => coordinates((point?.latE7 ?? NaN) / 1e7, (point?.lngE7 ?? NaN) / 1e7)),
          legacyLocation(segment.endLocation),
        ].filter((point): point is RoutePoint => Boolean(point)),
        startName: textValue(segment.startLocation?.name) ?? textValue(segment.startLocation?.address),
        endName: textValue(segment.endLocation?.name) ?? textValue(segment.endLocation?.address),
      });
    }
  }

  return [...rides.values()].sort((a, b) => timestamp(b.startTime) - timestamp(a.startTime));
}
