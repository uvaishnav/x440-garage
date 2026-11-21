import React, { useMemo, useState } from 'react';
import {
  computeBunkLeaderboard,
  computeFuelMetrics,
  computeFuelGradeStats,
  computeSummaryStats,
} from '../lib/calculations';
import { BikeEvent, FuelLog, MaintenanceLog } from '../types';
import { EditIcon, LocationPinIcon, TrashIcon } from '../components/Icons';

interface FuelPageProps {
  fuelLogs: FuelLog[];
  bikeEvents: BikeEvent[];
  maintenanceLogs: MaintenanceLog[];
  onDeleteLog: (id: string) => Promise<void>;
  onEditLog: (log: FuelLog) => void;
}

export const FuelPage: React.FC<FuelPageProps> = ({ fuelLogs, bikeEvents, maintenanceLogs, onDeleteLog, onEditLog }) => {
  const computed = useMemo(() => computeFuelMetrics(fuelLogs), [fuelLogs]);
  const summary = useMemo(() => computeSummaryStats(computed), [computed]);
  const bunks = useMemo(() => computeBunkLeaderboard(computed), [computed]);
  const gradeStats = useMemo(() => computeFuelGradeStats(computed), [computed]);
  const careContext = useMemo(
    () => [
      ...bikeEvents.map((event) => ({
        id: `event-${event.id}`,
        title: event.title,
        date: event.date,
        odometer: event.odometer,
        flags: event.insightFlags || [],
      })),
      ...maintenanceLogs
        .filter((log) => !log.eventId)
        .map((log) => ({
          id: `maintenance-${log.id}`,
          title: log.taskTitle,
          date: log.date,
          odometer: log.odometer,
          flags: log.insightFlags || [],
        })),
    ],
    [bikeEvents, maintenanceLogs]
  );
  const [selectedBunk, setSelectedBunk] = useState<string | null>(null);

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

      <div className="rounded-2xl bg-[#141518] border border-white/[0.08] px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[#8E8E93]">Measured fuel cost</p>
          <p className="text-lg font-semibold text-[#F5F5F7] tabular-nums mt-0.5">
            {summary.fuelCostPerKm == null ? '—' : `₹${summary.fuelCostPerKm}/km`}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-[#8E8E93]">All-time fuel spend</p>
          <p className="text-lg font-semibold text-[#F5F5F7] tabular-nums mt-0.5">
            ₹{summary.totalSpend.toLocaleString('en-IN')}
          </p>
        </div>
      </div>

      {gradeStats.length > 0 && (
        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold text-[#F5F5F7] px-1">Fuel Grade Comparison</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {gradeStats.map((grade) => (
              <div key={grade.grade} className="min-w-[132px] rounded-xl bg-[#141518] border border-white/[0.08] px-3.5 py-3">
                <p className="text-xs text-[#8E8E93]">{grade.grade}</p>
                <p className="text-xl font-semibold text-[#F5F5F7] tabular-nums mt-1">
                  {grade.avgMileage} <span className="text-[10px] text-[#636366]">km/L</span>
                </p>
                <p className="text-[10px] text-[#636366] mt-1">{grade.samples} clean interval{grade.samples === 1 ? '' : 's'}</p>
              </div>
            ))}
          </div>
        </section>
      )}

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
              <button
                key={b.bunkName}
                onClick={() => setSelectedBunk(selectedBunk === b.bunkName ? null : b.bunkName)}
                className="w-full rounded-2xl bg-[#141518] border border-white/[0.08] px-4 py-3.5 text-left"
              >
                <div className="flex items-center justify-between gap-3">
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
                  </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-semibold text-[#F5F5F7] tabular-nums">
                      {b.avgMileage}
                    </p>
                    <p className="text-[10px] text-[#636366]">km/L</p>
                  </div>
                </div>
                {selectedBunk === b.bunkName && (
                  <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-1.5">
                    {computed
                      .filter((log) => log.sourceBunkName?.trim().toLowerCase() === b.bunkName.toLowerCase() && !log.intervalHadPartialFills && log.mileageKmpl)
                      .map((log) => (
                        <div key={log.id} className="flex items-center justify-between text-[11px] tabular-nums">
                          <span className="text-[#8E8E93]">{log.sourceBunkDate} · {log.distanceKm} km · {log.sourceFuelGrade}</span>
                          <span className="text-[#F5F5F7] font-medium">{log.mileageKmpl} km/L</span>
                        </div>
                      ))}
                  </div>
                )}
              </button>
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
            {computed.map((log, logIndex) => {
              const intervalStart = log.distanceKm ? log.odometer - log.distanceKm : null;
              const intervalEvents = intervalStart == null
                ? []
                : careContext
                    .filter(
                      (event) =>
                        event.odometer >= intervalStart - 250 &&
                        event.odometer <= log.odometer &&
                        event.date <= log.date
                    )
                    .sort((a, b) => a.odometer - b.odometer);
              const previousMeasured = computed
                .slice(logIndex + 1)
                .find((item) => item.mileageKmpl != null);
              const mileageChange =
                log.mileageKmpl != null && previousMeasured?.mileageKmpl != null
                  ? Number((log.mileageKmpl - previousMeasured.mileageKmpl).toFixed(1))
                  : null;

              return (
                <div
                  key={log.id}
                  className="rounded-2xl bg-[#141518] border border-white/[0.08] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-[#F5F5F7] tabular-nums">
                          {log.odometer.toLocaleString('en-IN')} km
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#1F2126] text-[10px] font-medium text-[#A7A7AD]">
                          {log.fuelGrade} · {log.rideMix}
                        </span>
                        {!log.isFullTank && (
                          <span className="px-2 py-0.5 rounded-md bg-[#FFD60A]/15 text-[10px] font-medium text-[#FFD60A]">
                            Partial
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[#A7A7AD] flex items-center gap-1 mt-1 truncate">
                        <LocationPinIcon className="w-3.5 h-3.5 shrink-0 text-[#73737A]" />
                        <span className="truncate">{log.bunkName}</span>
                      </p>

                      <p className="text-[11px] text-[#8E8E93] tabular-nums mt-1">
                        {log.date} · {log.litres} L · ₹{log.totalCost.toLocaleString('en-IN')}
                        {log.distanceKm ? ` · +${log.distanceKm} km` : ''}
                      </p>
                      {log.mileageKmpl && log.sourceBunkName && (
                        <p className="text-[10px] text-[#73737A] mt-1 truncate">
                          Interval fuel: {log.sourceBunkName}
                          {log.intervalHadPartialFills ? ' + partial top-ups (excluded from bunk ranking)' : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-lg font-semibold text-[#FF6600] tabular-nums">
                          {log.mileageKmpl ? log.mileageKmpl : '—'}
                        </p>
                        <p className="text-[10px] text-[#73737A]">
                          {log.mileageKmpl ? 'km/L' : log.isFullTank ? 'Baseline' : 'Pending'}
                        </p>
                      </div>
                      <div className="flex items-center">
                        <button onClick={() => onEditLog(log)} className="p-2 text-[#A7A7AD] active:text-[#FF6600]" aria-label="Edit fuel log">
                          <EditIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => onDeleteLog(log.id)} className="p-2 text-[#A7A7AD] active:text-[#FF453A]" aria-label="Delete fuel log">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {log.mileageKmpl && intervalEvents.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/[0.07] space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-semibold text-[#F5F5F7]">Care context for this interval</p>
                        {mileageChange != null && (
                          <span className={`text-[11px] font-semibold tabular-nums ${mileageChange >= 0 ? 'text-[#30D158]' : 'text-[#FF8A82]'}`}>
                            {mileageChange >= 0 ? '+' : ''}{mileageChange} km/L
                          </span>
                        )}
                      </div>
                      {intervalEvents.map((event) => {
                        const mileageFlags = event.flags.filter((flag) => flag.affectsMileage);
                        return (
                          <div key={event.id} className="space-y-1.5 rounded-lg bg-[#0F1013] px-3 py-2.5">
                            <div className="flex items-start justify-between gap-3 text-[11px]">
                              <div className="min-w-0">
                                <p className="text-[#E5E5E8] truncate">{event.title}</p>
                                <p className="text-[#73737A] tabular-nums">
                                  {event.date} · {event.odometer.toLocaleString('en-IN')} km
                                </p>
                              </div>
                              <span className="shrink-0 text-[10px] text-[#FFB27A]">
                                {event.odometer < (intervalStart ?? event.odometer) ? 'Before interval' : 'During interval'}
                              </span>
                            </div>
                            {mileageFlags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {mileageFlags.map((flag) => (
                                  <span key={flag.id} className={`rounded-md px-2 py-1 text-[10px] leading-snug ${flag.tone === 'positive' ? 'bg-[#30D158]/12 text-[#76E596]' : flag.tone === 'negative' ? 'bg-[#FF453A]/12 text-[#FF9B95]' : 'bg-white/[0.06] text-[#C7C7CC]'}`}>
                                    {flag.label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <p className="text-[10px] text-[#73737A]">Green and red signals are recorded context, not proof of cause.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
