import type { RoutePoint, TimelineRide } from '../types';
import indiaPlaces from '../data/indiaPlaces.json';
import { routeDistanceKm } from './routeTrace';

export type PlaceNames = Record<string, string | null>;

interface Area extends Pick<RoutePoint, 'lat' | 'lng'> {
  name: string;
  kind: number;
}

// GeoNames public populated-place extract, CC BY 4.0. Includes major Indian
// settlements and additional locality coverage in Telangana and Andhra Pradesh.
const areas = new Map<string, Area[]>();
const cell = (coordinate: number) => Math.floor(coordinate * 4);
for (const [name, lat, lng, kind] of indiaPlaces as Array<[string, number, number, number]>) {
  const key = `${cell(lat)},${cell(lng)}`;
  const area = { name, lat, lng, kind };
  const list = areas.get(key);
  if (list) list.push(area);
  else areas.set(key, [area]);
}

export function nearbyRideArea(point: Pick<RoutePoint, 'lat' | 'lng'>): string | undefined {
  let nearest: Area | undefined;
  let bestScore = Infinity;
  const latitude = cell(point.lat);
  const longitude = cell(point.lng);
  for (let y = latitude - 1; y <= latitude + 1; y++) {
    for (let x = longitude - 1; x <= longitude + 1; x++) {
      for (const area of areas.get(`${y},${x}`) ?? []) {
        const km = routeDistanceKm(point, area);
        if (km > (area.kind === 2 ? 14 : 4)) continue;
        // A named neighborhood close to the stop is more useful than a city centroid.
        const score = km + (area.kind === 2 ? 3 : area.kind === 1 ? -0.5 : 0);
        if (score < bestScore) {
          nearest = area;
          bestScore = score;
        }
      }
    }
  }
  return nearest?.name;
}

export function rideStop(ride: TimelineRide, side: 'start' | 'end', names: PlaceNames = {}) {
  const visit = side === 'start' ? ride.startPlace : ride.endPlace;
  const endpoint = side === 'start' ? ride.points[0] : ride.points[ride.points.length - 1];
  const point = visit ?? endpoint;
  const imported = ride.source === 'gpx' ? undefined : side === 'start' ? ride.startName : ride.endName;
  const saved = visit && Object.prototype.hasOwnProperty.call(names, visit.id) ? names[visit.id] : undefined;
  const name = saved || imported || undefined;
  const area = point ? nearbyRideArea(point) : undefined;
  return { id: visit?.id, point, name, area, label: name ?? area };
}

export function googleMapsStopUrl(stop: ReturnType<typeof rideStop>) {
  if (!stop.point) return;
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', `${stop.point.lat},${stop.point.lng}`);
  if (stop.id) url.searchParams.set('query_place_id', stop.id);
  return url.href;
}

export function tripDestination(rides: TimelineRide[], roundTrip: boolean) {
  if (!roundTrip) return rides[rides.length - 1];
  const start = rides[0].startPlace ?? rides[0].points[0];
  if (!start) return rides[rides.length - 1];
  let distance = 0;
  let destination = rides[rides.length - 1];
  for (const ride of rides) {
    const stop = ride.endPlace ?? ride.points[ride.points.length - 1];
    if (!stop) continue;
    const km = routeDistanceKm(start, stop);
    if (km > distance) {
      distance = km;
      destination = ride;
    }
  }
  return destination;
}
