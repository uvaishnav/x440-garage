import { useEffect, useMemo, useRef } from 'react';
import type { TimelineRide } from '../types';
import { splitRouteTrace } from '../lib/routeTrace';

/** Small, offline preview of the actual trace. The detailed map opens on demand. */
export function RouteSketch({ rides }: { rides: TimelineRide[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const tracks = useMemo(() => rides.flatMap((ride) => splitRouteTrace(ride.points)), [rides]);
  const total = tracks.reduce((sum, track) => sum + track.length, 0);

  useEffect(() => {
    const target = canvas.current;
    const ctx = target?.getContext('2d');
    if (!target || !ctx || total < 2) return;
    const width = 120;
    const height = 82;
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    target.width = width * ratio;
    target.height = height * ratio;
    ctx.scale(ratio, ratio);

    const points = tracks.flat();
    const lat = points.map((point) => point.lat);
    const lng = points.map((point) => point.lng);
    const minLat = Math.min(...lat);
    const maxLat = Math.max(...lat);
    const minLng = Math.min(...lng);
    const maxLng = Math.max(...lng);
    const longitudeScale = Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
    const scale = Math.min(
      (width - 20) / Math.max(0.00015, (maxLng - minLng) * longitudeScale),
      (height - 20) / Math.max(0.00015, maxLat - minLat),
    );
    const project = (point: (typeof points)[number]) => ({
      x: width / 2 + (point.lng - (minLng + maxLng) / 2) * longitudeScale * scale,
      y: height / 2 - (point.lat - (minLat + maxLat) / 2) * scale,
    });
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#FF914F';
    ctx.lineWidth = 2.1;
    for (const track of tracks) {
      ctx.beginPath();
      track.forEach((point, index) => {
        const { x, y } = project(point);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    for (const [point, color] of [[points[0], '#B5C6B8'], [points[points.length - 1], '#FF914F']] as const) {
      const { x, y } = project(point);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [total, tracks]);

  if (total < 2) return null;
  return <canvas ref={canvas} width={120} height={82} role="img" aria-label="Preview of the recorded ride trace"
    className="h-[82px] w-[94px] shrink-0 rounded-xl bg-[#211C1B] min-[390px]:w-[120px]" />;
}
