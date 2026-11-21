import { RoutePoint, TimelineRide } from '../types';

function parseLatLngString(raw: string): RoutePoint | null {
  // Handles formats like "17.385044°, 78.486671°" or "geo:17.385,78.486"
  const cleaned = raw.replace(/°/g, '').replace(/^geo:/i, '').trim();
  const parts = cleaned.split(',').map((p) => parseFloat(p.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { lat: parts[0], lng: parts[1] };
  }
  return null;
}

function haversineKm(a: RoutePoint, b: RoutePoint): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function classifyRoadSplit(distanceKm: number, durationMin: number, avgSpeedKmh: number) {
  if (durationMin <= 0 || distanceKm <= 0) {
    return { highwayPercent: 0, cityPercent: 100 };
  }
  // Heuristic calibrated for Indian highways (e.g., NH65 Vja-Hyd avg 55-75 km/h vs city 18-32 km/h)
  if (avgSpeedKmh >= 58) return { highwayPercent: 85, cityPercent: 15 };
  if (avgSpeedKmh >= 45) return { highwayPercent: 65, cityPercent: 35 };
  if (avgSpeedKmh >= 35) return { highwayPercent: 35, cityPercent: 65 };
  return { highwayPercent: 10, cityPercent: 90 };
}

/**
 * Parses iPhone Google Maps exported `location-history.json` (on-device semanticSegments
 * or legacy timelineObjects). Automatically imports MOTORCYCLING segments only,
 * ignoring car/bus/train/walk unless `includeAmbiguousDriving` is enabled in Settings.
 */
export function parseGoogleTimelineJson(
  jsonText: string,
  includeAmbiguousDriving = false
): TimelineRide[] {
  const data = JSON.parse(jsonText);
  const rides: TimelineRide[] = [];

  const allowedTypes = new Set(['MOTORCYCLING', 'MOTORCYCLE']);
  if (includeAmbiguousDriving) {
    allowedTypes.add('IN_PASSENGER_VEHICLE');
  }

  // Format 1: Newer iPhone / Android On-Device Export (`semanticSegments` or root array)
  const segments = Array.isArray(data)
    ? data
    : Array.isArray(data.semanticSegments)
    ? data.semanticSegments
    : [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const activity = seg.activity;
    if (!activity) continue;

    const type = String(
      activity.topCandidate?.type || activity.activityType || ''
    ).toUpperCase();

    if (!allowedTypes.has(type)) continue;

    const startTime = seg.startTime;
    const endTime = seg.endTime;
    if (!startTime || !endTime) continue;

    const points: RoutePoint[] = [];
    if (activity.start?.latLng) {
      const p = parseLatLngString(activity.start.latLng);
      if (p) points.push(p);
    }

    if (Array.isArray(seg.timelinePath)) {
      for (const tp of seg.timelinePath) {
        if (tp.point) {
          const p = parseLatLngString(tp.point);
          if (p) points.push(p);
        }
      }
    }

    if (activity.end?.latLng) {
      const p = parseLatLngString(activity.end.latLng);
      if (p) points.push(p);
    }

    let distanceKm =
      typeof activity.distanceMeters === 'number'
        ? activity.distanceMeters / 1000
        : 0;

    if (distanceKm === 0 && points.length >= 2) {
      for (let j = 1; j < points.length; j++) {
        distanceKm += haversineKm(points[j - 1], points[j]);
      }
    }

    if (distanceKm < 0.8) continue; // Ignore tiny GPS jitter

    const durationMin = Math.max(
      1,
      Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000)
    );
    const avgSpeedKmh = Number(((distanceKm / durationMin) * 60).toFixed(1));
    const { highwayPercent, cityPercent } = classifyRoadSplit(
      distanceKm,
      durationMin,
      avgSpeedKmh
    );

    rides.push({
      id: `tl-${new Date(startTime).getTime()}-${i}`,
      startTime,
      endTime,
      date: startTime.slice(0, 10),
      distanceKm: Number(distanceKm.toFixed(1)),
      durationMin,
      avgSpeedKmh,
      highwayPercent,
      cityPercent,
      activityType: type,
      points: points.slice(0, 150), // Keep Firestore doc compact
    });
  }

  // Format 2: Legacy Semantic Location History (`timelineObjects`)
  if (Array.isArray(data.timelineObjects)) {
    for (let i = 0; i < data.timelineObjects.length; i++) {
      const seg = data.timelineObjects[i]?.activitySegment;
      if (!seg) continue;

      const type = String(seg.activityType || '').toUpperCase();
      if (!allowedTypes.has(type)) continue;

      const startTime = seg.duration?.startTimestamp;
      const endTime = seg.duration?.endTimestamp;
      if (!startTime || !endTime) continue;

      const points: RoutePoint[] = [];
      if (seg.startLocation?.latitudeE7) {
        points.push({
          lat: seg.startLocation.latitudeE7 / 1e7,
          lng: seg.startLocation.longitudeE7 / 1e7,
        });
      }
      if (Array.isArray(seg.waypointPath?.waypoints)) {
        for (const wp of seg.waypointPath.waypoints) {
          if (wp.latE7) {
            points.push({ lat: wp.latE7 / 1e7, lng: wp.lngE7 / 1e7 });
          }
        }
      }
      if (seg.endLocation?.latitudeE7) {
        points.push({
          lat: seg.endLocation.latitudeE7 / 1e7,
          lng: seg.endLocation.longitudeE7 / 1e7,
        });
      }

      const distanceKm = (seg.distance || 0) / 1000;
      if (distanceKm < 0.8) continue;

      const durationMin = Math.max(
        1,
        Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000)
      );
      const avgSpeedKmh = Number(((distanceKm / durationMin) * 60).toFixed(1));
      const { highwayPercent, cityPercent } = classifyRoadSplit(
        distanceKm,
        durationMin,
        avgSpeedKmh
      );

      rides.push({
        id: `tl-leg-${new Date(startTime).getTime()}-${i}`,
        startTime,
        endTime,
        date: startTime.slice(0, 10),
        distanceKm: Number(distanceKm.toFixed(1)),
        durationMin,
        avgSpeedKmh,
        highwayPercent,
        cityPercent,
        activityType: type,
        points: points.slice(0, 150),
      });
    }
  }

  return rides.sort((a, b) => b.startTime.localeCompare(a.startTime));
}
