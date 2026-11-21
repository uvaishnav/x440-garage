import { TimelineRide } from '../types';

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function classifyRoads(ride: TimelineRide): Promise<Pick<TimelineRide, 'highwayPercent' | 'cityPercent' | 'classificationMethod'>> {
  if (ride.points.length < 2) {
    return {
      highwayPercent: ride.highwayPercent,
      cityPercent: ride.cityPercent,
      classificationMethod: 'speed-estimate',
    };
  }
  const sampleCount = Math.min(12, ride.points.length);
  const samples = Array.from({ length: sampleCount }, (_, index) =>
    ride.points[Math.round((index * (ride.points.length - 1)) / Math.max(1, sampleCount - 1))]
  );
  const query = `[out:json][timeout:20];(${samples
    .map((point) => `way(around:45,${point.lat},${point.lng})["highway"];`)
    .join('')});out tags;`;
  try {
    const response = await fetchWithTimeout('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!response.ok) throw new Error('Road lookup failed');
    const data = await response.json();
    const roads = Array.isArray(data.elements) ? data.elements : [];
    if (!roads.length) throw new Error('No roads found');
    const highwayKinds = new Set(['motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link']);
    const major = roads.filter((road: any) => highwayKinds.has(road.tags?.highway)).length;
    const metadataPercent = (major / roads.length) * 100;
    const blended = Math.round(metadataPercent * 0.7 + ride.highwayPercent * 0.3);
    const highwayPercent = Math.min(95, Math.max(5, blended));
    return { highwayPercent, cityPercent: 100 - highwayPercent, classificationMethod: 'osm' };
  } catch {
    return {
      highwayPercent: ride.highwayPercent,
      cityPercent: ride.cityPercent,
      classificationMethod: 'speed-estimate',
    };
  }
}

async function reverseName(lat: number, lng: number): Promise<string | undefined> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('zoom', '12');
  const response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } }, 10000);
  if (!response.ok) return undefined;
  const data = await response.json();
  const address = data.address || {};
  return (
    address.city ||
    address.town ||
    address.village ||
    address.suburb ||
    data.display_name?.split(',').slice(0, 2).join(',')
  );
}

export async function enrichRidePlaces(ride: TimelineRide): Promise<TimelineRide> {
  if (ride.points.length < 2) return ride;
  try {
    const start = ride.points[0];
    const finish = ride.points[ride.points.length - 1];
    const roadSplit = await classifyRoads(ride);
    const startName = ride.startName || (await reverseName(start.lat, start.lng));
    // Public OSM reverse geocoding is intentionally used sparingly: two calls per import item.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const endName = ride.endName || (await reverseName(finish.lat, finish.lng));
    return { ...ride, ...roadSplit, startName, endName };
  } catch {
    return ride;
  }
}
