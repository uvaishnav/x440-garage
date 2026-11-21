import React, { useMemo } from 'react';
import { CockpitDial } from '../components/CockpitDial';
import { ChevronRightIcon, RouteIcon } from '../components/Icons';
import {
  computeFuelMetrics,
  computeSummaryStats,
  evaluateTaskHealth,
} from '../lib/calculations';
import { BikeIssue, FuelLog, MaintenanceTask, Trip } from '../types';

interface HomePageProps {
  currentOdometer: number;
  fuelLogs: FuelLog[];
  tasks: MaintenanceTask[];
  issues: BikeIssue[];
  activeTrip: Trip | null;
  onNavigate: (tab: 'fuel' | 'trips' | 'care') => void;
  onQuickMarkTask: (task: MaintenanceTask) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  currentOdometer,
  fuelLogs,
  tasks,
  issues,
  activeTrip,
  onNavigate,
  onQuickMarkTask,
}) => {
  const computedFuel = useMemo(() => computeFuelMetrics(fuelLogs), [fuelLogs]);
  const summary = useMemo(() => computeSummaryStats(computedFuel), [computedFuel]);

  const healthList = useMemo(() => {
    return tasks
      .map((t) => evaluateTaskHealth(t, currentOdometer))
      .sort((a, b) => b.progressPercent - a.progressPercent);
  }, [tasks, currentOdometer]);

  const overdueCount = healthList.filter((h) => h.status === 'overdue').length;
  const soonCount = healthList.filter((h) => h.status === 'soon').length;
  const openIssues = issues.filter((i) => i.status === 'open').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-[#FF6600] font-semibold">
            Matte Denim Black
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#F5F5F7]">
            X440 Cockpit
          </h1>
        </div>
        <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10">
          <img
            src="/assets/icon-192.png"
            alt="X440"
            className="w-full h-full object-cover"
          />
        </div>
      </header>

      {/* Active Trip Banner */}
      {activeTrip && (
        <button
          onClick={() => onNavigate('trips')}
          className="w-full rounded-2xl bg-gradient-to-r from-[#FF6600]/20 to-[#141518] border border-[#FF6600]/35 px-4 py-3 flex items-center justify-between text-left active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FF6600]/20 text-[#FF6600] flex items-center justify-center">
              <RouteIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-[#FF6600] font-semibold">
                Active Highway Trip
              </p>
              <p className="text-sm font-semibold text-[#F5F5F7]">{activeTrip.name}</p>
            </div>
          </div>
          <ChevronRightIcon className="w-4 h-4 text-[#FF6600]" />
        </button>
      )}

      {/* Hero TFT Cockpit Dial */}
      <CockpitDial
        odometer={currentOdometer}
        nextDue={healthList[0]}
        overdueCount={overdueCount}
        soonCount={soonCount}
        onTapCare={() => onNavigate('care')}
      />

      {/* Mileage & Spend Readouts */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          onClick={() => onNavigate('fuel')}
          className="rounded-2xl bg-[#141518] border border-white/[0.08] p-3.5 text-left active:scale-[0.98] transition-transform"
        >
          <p className="text-[10px] uppercase tracking-wider text-[#8E8E93] font-medium">
            City Avg
          </p>
          <p className="text-xl font-semibold text-[#F5F5F7] tabular-nums mt-1">
            {summary.cityMileage ?? summary.overallMileage ?? '—'}
          </p>
          <p className="text-[11px] text-[#636366]">km/L</p>
        </button>

        <button
          onClick={() => onNavigate('trips')}
          className="rounded-2xl bg-[#141518] border border-white/[0.08] p-3.5 text-left active:scale-[0.98] transition-transform"
        >
          <p className="text-[10px] uppercase tracking-wider text-[#8E8E93] font-medium">
            Highway
          </p>
          <p className="text-xl font-semibold text-[#FF6600] tabular-nums mt-1">
            {summary.highwayMileage ?? '—'}
          </p>
          <p className="text-[11px] text-[#636366]">km/L</p>
        </button>

        <button
          onClick={() => onNavigate('fuel')}
          className="rounded-2xl bg-[#141518] border border-white/[0.08] p-3.5 text-left active:scale-[0.98] transition-transform"
        >
          <p className="text-[10px] uppercase tracking-wider text-[#8E8E93] font-medium">
            This Month
          </p>
          <p className="text-xl font-semibold text-[#F5F5F7] tabular-nums mt-1">
            ₹{summary.monthlySpend.toLocaleString('en-IN')}
          </p>
          <p className="text-[11px] text-[#636366]">Fuel</p>
        </button>
      </div>

      {/* Upcoming Care Checklist (Top 3) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold text-[#F5F5F7]">Upcoming Care</h2>
          <button
            onClick={() => onNavigate('care')}
            className="text-xs font-medium text-[#FF6600]"
          >
            All {tasks.length} items
          </button>
        </div>

        <div className="space-y-2">
          {healthList.slice(0, 3).map((item) => {
            const dotColor =
              item.status === 'overdue'
                ? 'bg-[#FF453A]'
                : item.status === 'soon'
                ? 'bg-[#FFD60A]'
                : 'bg-[#30D158]';

            return (
              <div
                key={item.task.id}
                className="rounded-2xl bg-[#141518] border border-white/[0.08] px-4 py-3.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                    <p className="text-sm font-medium text-[#F5F5F7] truncate">
                      {item.task.title}
                    </p>
                  </div>
                  <p className="text-xs text-[#8E8E93] tabular-nums mt-1 pl-4">
                    {item.remainingKm !== null
                      ? item.remainingKm <= 0
                        ? `Overdue by ${Math.abs(item.remainingKm)} km`
                        : `${item.remainingKm} km left`
                      : `Every ${item.task.intervalKm.toLocaleString('en-IN')} km`}
                    {item.remainingDays !== null && ` · ${item.remainingDays}d`}
                  </p>
                </div>

                <button
                  onClick={() => onQuickMarkTask(item.task)}
                  className="shrink-0 px-3 py-1.5 rounded-xl bg-[#1F2126] border border-white/[0.08] text-xs font-medium text-[#F5F5F7] active:scale-95"
                >
                  Log Done
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Open Service Issues Callout */}
      {openIssues > 0 && (
        <button
          onClick={() => onNavigate('care')}
          className="w-full rounded-2xl bg-[#141518] border border-[#FF453A]/30 px-4 py-3 flex items-center justify-between"
        >
          <span className="text-xs text-[#F5F5F7]">
            <strong className="text-[#FF453A]">{openIssues} open issue{openIssues > 1 ? 's' : ''}</strong> queued for your next service visit
          </span>
          <ChevronRightIcon className="w-4 h-4 text-[#8E8E93]" />
        </button>
      )}
    </div>
  );
};
