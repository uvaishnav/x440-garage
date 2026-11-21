export interface NearbyBunk {
  id: string;
  name: string;
  brand?: string;
  address?: string;
  lat: number;
  lng: number;
  distanceMeters: number;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Fetches nearby petrol bunks using OpenStreetMap Overpass API (100% free, zero billing).
 */
export async function fetchNearbyBunks(
  lat: number,
  lng: number,
  radiusMeters = 1800
): Promise<NearbyBunk[]> {
  const query = `[out:json][timeout:10];(node["amenity"="fuel"](around:${radiusMeters},${lat},${lng});way["amenity"="fuel"](around:${radiusMeters},${lat},${lng}););out center 12;`;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  let response: Response;
  try {
    response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error('Could not reach OpenStreetMap Overpass API');
  }

  const data = await response.json();
  const elements = Array.isArray(data.elements) ? data.elements : [];

  const results: NearbyBunk[] = elements
    .map((el: any) => {
      const elLat = el.lat ?? el.center?.lat;
      const elLng = el.lon ?? el.center?.lon;
      if (typeof elLat !== 'number' || typeof elLng !== 'number') return null;

      const tags = el.tags || {};
      const rawName = tags.name || tags.brand || tags.operator || 'Petrol Bunk';
      const brand = tags.brand || tags.operator;
      const area = tags['addr:suburb'] || tags['addr:city'] || tags['addr:street'] || '';

      return {
        id: String(el.id),
        name: brand && !rawName.toLowerCase().includes(brand.toLowerCase())
          ? `${brand} — ${rawName}`
          : rawName,
        brand,
        address: area,
        lat: elLat,
        lng: elLng,
        distanceMeters: haversineMeters(lat, lng, elLat, elLng),
      };
    })
    .filter(Boolean) as NearbyBunk[];

  // Deduplicate by name and sort closest first
  const seen = new Set<string>();
  return results
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .filter((b) => {
      const k = b.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 5);
}

export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}
