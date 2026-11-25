import type { TimelineRide } from '../types';
import { rideStop, type PlaceNames } from './ridePlaces';

const DAY = 86_400_000;
const dayKey = (date: number) => new Date(date).toISOString().slice(0, 10);

export function ridingInsights(rides: TimelineRide[], dailyKm: Map<string, number>, names?: PlaceNames) {
  const distances = rides.map((ride) => ride.distanceKm).sort((a, b) => a - b);
  const i = Math.floor(distances.length / 2);
  const typicalKm = distances.length % 2 ? distances[i] : ((distances[i - 1] ?? 0) + (distances[i] ?? 0)) / 2;
  const busiest = [...dailyKm].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0];
  const arrivals = new Map<string, { label: string; count: number; days: Set<string>; exact: boolean }>();
  for (const ride of rides) {
    const end = rideStop(ride, 'end', names);
    if (!end.point) continue;
    const candidates = [
      end.area && { key: `area:${end.area}`, label: end.area, exact: false },
      end.id && end.name && { key: end.id, label: end.name, exact: true },
    ];
    for (const item of candidates) {
      if (!item) continue;
      const tally = arrivals.get(item.key) ?? { label: item.label, count: 0, days: new Set<string>(), exact: item.exact };
      tally.count++;
      tally.days.add(ride.date);
      arrivals.set(item.key, tally);
    }
  }
  const repeat = [...arrivals.values()].filter((item) => item.days.size > 1)
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.days.size - a.days.size || b.count - a.count)[0];
  return { typicalKm, busiest, repeat };
}

export function distanceTrend(dailyKm: Map<string, number>, start: string, end: string, period: number) {
  const first = Date.parse(start);
  const last = Date.parse(end);
  const days = Math.round((last - first) / DAY) + 1;
  const stride = period === 7 || days <= 8 ? 1 : Math.max(7, Math.ceil(days / 91) * 7);
  const count = Math.ceil(days / stride);
  if (!Number.isFinite(count) || count < 1) return [];
  return Array.from({ length: count }, (_, index) => {
    const to = last - (count - index - 1) * stride * DAY;
    const from = Math.max(first, to - (stride - 1) * DAY);
    let km = 0;
    for (let day = from; day <= to; day += DAY) km += dailyKm.get(dayKey(day)) ?? 0;
    return { from: dayKey(from), to: dayKey(to), km };
  });
}
