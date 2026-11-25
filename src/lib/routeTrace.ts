import type { RoutePoint } from '../types';

const MAX_GAP_MIN = 10;
const MAX_SAMPLE_SPEED_KMH = 200;

export function routeDistanceKm(a: RoutePoint, b: RoutePoint): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, x)));
}

function intervalMinutes(a: RoutePoint, b: RoutePoint): number {
  return a.time && b.time ? (Date.parse(b.time) - Date.parse(a.time)) / 60_000 : NaN;
}

function connects(a: RoutePoint, b: RoutePoint): boolean {
  const minutes = intervalMinutes(a, b);
  if (!Number.isFinite(minutes)) return true;
  if (minutes < 0 || minutes > MAX_GAP_MIN) return false;
  const km = routeDistanceKm(a, b);
  return minutes === 0 ? km < 0.05 : (km * 60) / minutes <= MAX_SAMPLE_SPEED_KMH;
}

export function splitRouteTrace(points: RoutePoint[]): RoutePoint[][] {
  const parts: RoutePoint[][] = [];
  for (const [index, point] of points.entries()) {
    if (index === 0 || !connects(points[index - 1], point)) parts.push([]);
    parts[parts.length - 1].push(point);
  }
  return parts;
}

export function analyzeRouteSamples(points: RoutePoint[]) {
  let sampledMin = 0;
  let movingMin = 0;
  let stoppedMin = 0;
  let longGapMin = 0;
  const speedBandMinutes = [0, 0, 0];

  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1];
    const b = points[index];
    const minutes = intervalMinutes(a, b);
    if (!Number.isFinite(minutes) || minutes <= 0) continue;
    if (minutes > MAX_GAP_MIN) {
      longGapMin += minutes;
      continue;
    }
    // Activity boundaries describe the leg but aren't position samples.
    if (a.anchor || b.anchor) continue;
    const km = routeDistanceKm(a, b);
    const speed = km * 60 / minutes;
    if (speed > MAX_SAMPLE_SPEED_KMH) continue;

    sampledMin += minutes;
    if (speed <= 3) {
      stoppedMin += minutes;
    } else {
      movingMin += minutes;
      speedBandMinutes[speed < 35 ? 0 : speed < 70 ? 1 : 2] += minutes;
    }
  }
  return { sampledMin, movingMin, stoppedMin, longGapMin, speedBandMinutes };
}
