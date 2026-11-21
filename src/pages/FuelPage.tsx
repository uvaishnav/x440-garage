import React, { useMemo } from 'react';
import {
  computeBunkLeaderboard,
  computeFuelMetrics,
  computeSummaryStats,
} from '../lib/calculations';
import { FuelLog } from '../types';
import { LocationPinIcon, TrashIcon } from '../components/Icons';

interface FuelPageProps {
  fuelLogs: FuelLog[];
  onDeleteLog: (id: string) => Promise<void>;
}

export const FuelPage: React.FC<FuelPageProps> = ({ fuelLogs, onDeleteLog }) => {
  const computed = useMemo(() => computeFuelMetrics(fuelLogs), [fuelLogs]);
  const summary = useMemo(() => computeSummaryStats(computed), [computed]);
  const bunks = useMemo(() => computeBunkLeaderboard(computed), [computed]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.24em] text-[#FF6600] font-semibold">
          Tank-to-Tank
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#F5F5F7]">
          Fuel & Bunks
        </h1>
      </header>

      {/* Overall Summary Card */}
      <div className="rounded-[24px] bg-[#141518] border border-white/[0.08] p-4 grid grid-cols-3 divide-x divide-white/[0.06]">
        <div className="pr-3">
          <p className="text-[10px] uppercase tracking-wider text-[#8E8E93]">Overall</p>
          <p className="text-2xl font-semibold text-[#F5F5F7] tabular-nums mt-1">
            {summary.overallMileage ?? '—'}
          </p>
          <p className="text-[11px] text-[#636366]">km/L</p>
        </div>
        <div className="px-3">
          <p className="text-[10px] uppercase tracking-wider text-[#8E8E93]">City</p>
          <p className="text-2xl font-semibold text-[#F5F5F7] tabular-nums mt-1">
            {summary.cityMileage ?? '—'}
          </p>
          <p className="text-[11px] text-[#636366]">km/L</p>
        </div>
        <div className="pl-3">
          <p className="text-[10px] uppercase tracking-wider text-[#8E8E93]">Highway</p>
          <p className="text-2xl font-semibold text-[#FF6600] tabular-nums mt-1">
            {summary.highwayMileage ?? '—'}
          </p>
          <p className="text-[11px] text-[#636366]">km/L</p>
        </div>
      </div>

      {/* Petrol Bunk Leaderboard */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-[#F5F5F7]">Bunk Leaderboard</h2>
          <span className="text-[11px] text-[#636366]">Ranked by avg km/L</span>
        </div>

        {bunks.length === 0 ? (
          <div className="rounded-2xl bg-[#141518] border border-white/[0.08] p-5 text-center text-xs text-[#8E8E93]">
            Log at least 2 full-tank fills to rank petrol bunks by real mileage.
          </div>
        ) : (
          <div className="space-y-2">
            {bunks.map((b, idx) => (
              <div
                key={b.bunkName}
                className="rounded-2xl bg-[#141518] border border-white/[0.08] px-4 py-3.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold tabular-nums w-5 ${
                        idx === 0 && b.fullFillCount >= 2
                          ? 'text-[#FF6600]'
                          : 'text-[#636366]'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <p className="text-sm font-medium text-[#F5F5F7] truncate">
                      {b.bunkName}
                    </p>
                  </div>
                  <p className="text-[11px] text-[#8E8E93] mt-1 pl-7 tabular-nums">
                    {b.fullFillCount} full fill{b.fullFillCount > 1 ? 's' : ''}
                    {b.cityMileage ? ` · City ${b.cityMileage}` : ''}
                    {b.highwayMileage ? ` · Hwy ${b.highwayMileage}` : ''}
                    {b.fullFillCount < 2 ? ' · Needs 2+ fills to confirm' : ''}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-lg font-semibold text-[#F5F5F7] tabular-nums">
                    {b.avgMileage}
                  </p>
                  <p className="text-[10px] text-[#636366]">km/L</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Fill History */}
      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-[#F5F5F7] px-1">Fill History</h2>

        {computed.length === 0 ? (
          <div className="rounded-2xl bg-[#141518] border border-white/[0.08] p-6 text-center text-xs text-[#8E8E93]">
            Tap the orange center Fuel button anytime you refuel.
          </div>
        ) : (
          <div className="space-y-2">
            {computed.map((log) => (
              <div
                key={log.id}
                className="rounded-2xl bg-[#141518] border border-white/[0.08] p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#F5F5F7] tabular-nums">
                      {log.odometer.toLocaleString('en-IN')} km
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#1F2126] text-[10px] font-medium text-[#8E8E93]">
                      {log.fuelGrade} · {log.rideMix}
                    </span>
                    {!log.isFullTank && (
                      <span className="px-2 py-0.5 rounded-md bg-[#FFD60A]/15 text-[10px] font-medium text-[#FFD60A]">
                        Partial
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#8E8E93] flex items-center gap-1 mt-1 truncate">
                    <LocationPinIcon className="w-3.5 h-3.5 shrink-0 text-[#636366]" />
                    <span className="truncate">{log.bunkName}</span>
                  </p>

                  <p className="text-[11px] text-[#636366] tabular-nums mt-1">
                    {log.date} · {log.litres} L · ₹{log.totalCost.toLocaleString('en-IN')}
                    {log.distanceKm ? ` · +${log.distanceKm} km` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-lg font-semibold text-[#FF6600] tabular-nums">
                      {log.mileageKmpl ? log.mileageKmpl : '—'}
                    </p>
                    <p className="text-[10px] text-[#636366]">
                      {log.mileageKmpl ? 'km/L' : log.isFullTank ? 'Baseline' : 'Pending'}
                    </p>
                  </div>
                  <button
                    onClick={() => onDeleteLog(log.id)}
                    className="p-2 text-[#636366] hover:text-[#FF453A]"
                    aria-label="Delete fuel log"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
