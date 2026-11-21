import { RoutePoint, TimelineRide } from '../types';

function distanceKm(a: RoutePoint, b: RoutePoint): number {
  const radius = 6371;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function parseGpx(xmlText: string): TimelineRide[] {
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('Invalid GPX file');
  const tracks = Array.from(xml.querySelectorAll('trk'));

  return tracks.flatMap((track, trackIndex) => {
    const rawPoints = Array.from(track.querySelectorAll('trkpt'));
    const points = rawPoints.reduce<RoutePoint[]>((result, point) => {
        const lat = Number(point.getAttribute('lat'));
        const lng = Number(point.getAttribute('lon'));
        const time = point.querySelector('time')?.textContent || undefined;
        if (Number.isFinite(lat) && Number.isFinite(lng)) result.push({ lat, lng, time });
        return result;
      }, []);
    if (points.length < 2) return [];

    let totalDistance = 0;
    let movingSeconds = 0;
    for (let index = 1; index < points.length; index += 1) {
      const segmentDistance = distanceKm(points[index - 1], points[index]);
      totalDistance += segmentDistance;
      const from = points[index - 1].time ? new Date(points[index - 1].time!).getTime() : 0;
      const to = points[index].time ? new Date(points[index].time!).getTime() : 0;
      const seconds = from && to ? Math.max(0, (to - from) / 1000) : 0;
      const speed = seconds > 0 ? (segmentDistance / seconds) * 3600 : undefined;
      points[index].speedKmh = speed == null ? undefined : Number(speed.toFixed(1));
      if (speed != null && speed > 3) movingSeconds += seconds;
    }

    const startTime = points[0].time || new Date().toISOString();
    const endTime = points[points.length - 1].time || startTime;
    const durationMin = Math.max(
      1,
      Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000)
    );
    const movingMin = movingSeconds > 0 ? Math.max(1, Math.round(movingSeconds / 60)) : durationMin;
    const avgSpeedKmh = Number((totalDistance / (movingMin / 60)).toFixed(1));
    const highwayPercent = avgSpeedKmh >= 58 ? 85 : avgSpeedKmh >= 45 ? 65 : avgSpeedKmh >= 35 ? 35 : 10;
    const name = track.querySelector('name')?.textContent?.trim();

    return [{
      id: `gpx-${new Date(startTime).getTime()}-${trackIndex}`,
      startTime,
      endTime,
      date: startTime.slice(0, 10),
      distanceKm: Number(totalDistance.toFixed(1)),
      durationMin,
      movingMin,
      stoppedMin: Math.max(0, durationMin - movingMin),
      avgSpeedKmh,
      highwayPercent,
      cityPercent: 100 - highwayPercent,
      activityType: 'MOTORCYCLING',
      points: downsample(points, 500),
      startName: name,
      source: 'gpx',
      classificationMethod: 'speed-estimate',
    }];
  });
}

function downsample(points: RoutePoint[], maximum: number): RoutePoint[] {
  if (points.length <= maximum) return points;
  const output: RoutePoint[] = [];
  for (let index = 0; index < maximum; index += 1) {
    output.push(points[Math.round((index * (points.length - 1)) / (maximum - 1))]);
  }
  return output;
}
