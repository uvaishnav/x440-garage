import React from 'react';
import { TaskHealth } from '../lib/calculations';

interface CockpitDialProps {
  odometer: number;
  nextDue?: TaskHealth;
  overdueCount: number;
  soonCount: number;
  onTapCare: () => void;
}

/**
 * Inspired directly by the Harley-Davidson X440's 3.5-inch circular TFT instrument pod.
 */
export const CockpitDial: React.FC<CockpitDialProps> = ({
  odometer,
  nextDue,
  overdueCount,
  soonCount,
  onTapCare,
}) => {
  const progress = nextDue ? nextDue.progressPercent : 0;
  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  // 270-degree tachometer-style sweep
  const arcLength = circumference * 0.75;
  const filledLength = arcLength * (Math.min(100, progress) / 100);

  const ringColor =
    overdueCount > 0 ? '#FF453A' : soonCount > 0 ? '#FF6600' : '#F58220';

  const statusText =
    overdueCount > 0
      ? `${overdueCount} Overdue`
      : soonCount > 0
      ? `${soonCount} Due Soon`
      : 'All Systems Nominal';

  const statusDot =
    overdueCount > 0
      ? 'bg-[#FF453A]'
      : soonCount > 0
      ? 'bg-[#FFD60A]'
      : 'bg-[#30D158]';

  return (
    <div className="relative rounded-[28px] bg-[#141518] border border-white/[0.08] p-5 flex flex-col items-center overflow-hidden">
      {/* Subtle radial glow behind TFT pod */}
      <div
        className="pointer-events-none absolute -top-16 w-56 h-56 rounded-full blur-3xl opacity-20"
        style={{ background: ringColor }}
      />

      <div className="relative w-52 h-48 flex items-center justify-center">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {/* Background metallic track */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="7"
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
            transform="rotate(135 100 100)"
          />
          {/* Active Harley Orange progress arc */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth="7"
            strokeDasharray={`${filledLength} ${circumference}`}
            strokeLinecap="round"
            transform="rotate(135 100 100)"
            className="transition-all duration-700 ease-ios-spring"
          />
          {/* Subtle inner bezel ring */}
          <circle
            cx="100"
            cy="100"
            r="72"
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
          />
        </svg>

        {/* Center Readout */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
          <span className="text-[10px] uppercase tracking-[0.26em] text-[#8E8E93] font-medium">
            ODOMETER
          </span>
          <span className="text-[34px] font-semibold tracking-tight text-[#F5F5F7] tabular-nums leading-none mt-1.5">
            {odometer.toLocaleString('en-IN')}
          </span>
          <span className="text-xs text-[#636366] font-medium mt-1">km</span>

          <button
            onClick={onTapCare}
            className="mt-3.5 px-3 py-1 rounded-full bg-[#1F2126] border border-white/[0.08] flex items-center gap-1.5 active:scale-95 transition-transform"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
            <span className="text-[11px] font-medium text-[#F5F5F7]">{statusText}</span>
          </button>
        </div>
      </div>

      {nextDue && (
        <div className="w-full mt-1 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
          <span className="text-[#8E8E93] truncate pr-2">
            Next: <span className="text-[#F5F5F7] font-medium">{nextDue.task.title}</span>
          </span>
          <span className="tabular-nums font-semibold text-[#FF6600] shrink-0">
            {nextDue.remainingKm !== null
              ? nextDue.remainingKm <= 0
                ? `${Math.abs(nextDue.remainingKm)} km over`
                : `in ${nextDue.remainingKm} km`
              : 'Set baseline'}
          </span>
        </div>
      )}
    </div>
  );
};
