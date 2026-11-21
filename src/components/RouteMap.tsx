import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { RoutePoint } from '../types';

interface RouteMapProps {
  points: RoutePoint[];
  heightClass?: string;
}

export const RouteMap: React.FC<RouteMapProps> = ({
  points,
  heightClass = 'h-44',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || points.length < 2) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(containerRef.current, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM &copy; CARTO',
      maxZoom: 18,
    }).addTo(map);

    const latLngs: L.LatLngExpression[] = points.map((p) => [p.lat, p.lng]);
    const polyline = L.polyline(latLngs, {
      color: '#FF6600',
      weight: 3.5,
      opacity: 0.92,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    // Start (Green) & End (Harley Orange) pins
    L.circleMarker(latLngs[0], {
      radius: 5,
      fillColor: '#30D158',
      color: '#0A0A0B',
      weight: 2,
      fillOpacity: 1,
    }).addTo(map);

    L.circleMarker(latLngs[latLngs.length - 1], {
      radius: 5,
      fillColor: '#FF6600',
      color: '#F5F5F7',
      weight: 2,
      fillOpacity: 1,
    }).addTo(map);

    map.fitBounds(polyline.getBounds(), { padding: [18, 18] });
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [points]);

  if (points.length < 2) {
    return (
      <div
        className={`${heightClass} w-full rounded-xl bg-[#0F1013] border border-white/[0.06] flex items-center justify-center text-xs text-[#636366]`}
      >
        No GPS route coordinates available
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`${heightClass} w-full rounded-xl overflow-hidden border border-white/[0.08]`}
    />
  );
};
