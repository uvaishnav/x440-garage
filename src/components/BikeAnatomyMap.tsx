import React from 'react';
import { BIKE_HOTSPOTS } from '../data/x440Template';
import { TaskHealth } from '../lib/calculations';
import { BikeZone, HealthStatus } from '../types';

interface BikeAnatomyMapProps {
  taskHealthList: TaskHealth[];
  selectedZone: BikeZone | null;
  onSelectZone: (zone: BikeZone | null) => void;
}

const statusColors: Record<HealthStatus, { dot: string; ring: string }> = {
  healthy: { dot: 'bg-[#30D158]', ring: 'ring-[#30D158]/35' },
  soon: { dot: 'bg-[#FFD60A]', ring: 'ring-[#FFD60A]/40' },
  overdue: { dot: 'bg-[#FF453A]', ring: 'ring-[#FF453A]/45' },
};

export const BikeAnatomyMap: React.FC<BikeAnatomyMapProps> = ({
  taskHealthList,
  selectedZone,
  onSelectZone,
}) => {
  // Determine worst status for each bike zone
  const zoneStatus = (zone: BikeZone): HealthStatus => {
    const matching = taskHealthList.filter((t) => t.task.zone === zone);
    if (matching.some((m) => m.status === 'overdue')) return 'overdue';
    if (matching.some((m) => m.status === 'soon')) return 'soon';
    return 'healthy';
  };

  return (
    <div className="rounded-[24px] bg-[#141518] border border-white/[0.08] p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[#8E8E93] font-medium">
            X440 Diagnostic Map
          </p>
          <p className="text-xs text-[#636366] mt-0.5">
            {selectedZone
              ? `Filtered: ${BIKE_HOTSPOTS[selectedZone].label}`
              : 'Tap any zone to inspect'}
          </p>
        </div>
        {selectedZone && (
          <button
            onClick={() => onSelectZone(null)}
            className="text-xs font-medium text-[#FF6600] px-2.5 py-1 rounded-full bg-[#FF6600]/10"
          >
            Show All
          </button>
        )}
      </div>

      {/* Interactive side-profile canvas using user's custom x440-profile.png */}
      <div className="relative w-full aspect-[12/7] select-none">
        <img
          src="/assets/x440-profile.png"
          alt="Harley-Davidson X440 Blueprint"
          className="w-full h-full object-contain opacity-90 pointer-events-none"
        />

        {(Object.keys(BIKE_HOTSPOTS) as BikeZone[]).map((zone) => {
          const spot = BIKE_HOTSPOTS[zone];
          const status = zoneStatus(zone);
          const isSelected = selectedZone === zone;
          const colors = statusColors[status];

          return (
            <button
              key={zone}
              onClick={() => onSelectZone(isSelected ? null : zone)}
              style={{ left: `${spot.xPercent}%`, top: `${spot.yPercent}%` }}
              aria-label={spot.label}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center group"
            >
              <span
                className={`w-3.5 h-3.5 rounded-full ${colors.dot} ring-4 ${colors.ring} transition-transform ${
                  isSelected ? 'scale-125 ring-white/50' : 'group-active:scale-90'
                }`}
              />
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-5 pt-2 border-t border-white/[0.06] text-[11px] text-[#8E8E93]">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#30D158]" /> Healthy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#FFD60A]" /> Due Soon
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#FF453A]" /> Overdue
        </span>
      </div>
    </div>
  );
};
