import {
  BunkStat,
  ComputedFuelLog,
  FuelLog,
  HealthStatus,
  MaintenanceTask,
  PreRideCheckItem,
} from '../types';

/**
 * Backdate-safe Tank-to-Tank mileage engine.
 * Always sorts by odometer ascending and combines partial fills into the next full tank.
 */
export function computeFuelMetrics(logs: FuelLog[]): ComputedFuelLog[] {
  if (!logs.length) return [];

  const sorted = [...logs].sort((a, b) => {
    if (a.odometer !== b.odometer) return a.odometer - b.odometer;
    return a.date.localeCompare(b.date);
  });

  let lastFullOdo: number | null = null;
  let pendingLitres = 0;
  let pendingCost = 0;

  const computed: ComputedFuelLog[] = sorted.map((log) => {
    if (!log.isFullTank) {
      pendingLitres += log.litres;
      pendingCost += log.totalCost;
      return { ...log };
    }

    if (lastFullOdo === null) {
      lastFullOdo = log.odometer;
      pendingLitres = 0;
      pendingCost = 0;
      return { ...log };
    }

    const distanceKm = log.odometer - lastFullOdo;
    const totalLitresUsed = log.litres + pendingLitres;
    const totalSpent = log.totalCost + pendingCost;

    lastFullOdo = log.odometer;
    pendingLitres = 0;
    pendingCost = 0;

    if (distanceKm > 0 && totalLitresUsed > 0) {
      return {
        ...log,
        distanceKm,
        accumulatedLitres: Number(totalLitresUsed.toFixed(2)),
        mileageKmpl: Number((distanceKm / totalLitresUsed).toFixed(2)),
        costPerKm: Number((totalSpent / distanceKm).toFixed(2)),
      };
    }

    return { ...log };
  });

  // Return newest first for UI display
  return computed.reverse();
}

export function computeSummaryStats(computedLogs: ComputedFuelLog[]) {
  const valid = computedLogs.filter((l) => l.mileageKmpl && l.distanceKm && l.accumulatedLitres);

  const calcWeightedAvg = (subset: ComputedFuelLog[]) => {
    const dist = subset.reduce((s, l) => s + (l.distanceKm || 0), 0);
    const lit = subset.reduce((s, l) => s + (l.accumulatedLitres || 0), 0);
    return lit > 0 ? Number((dist / lit).toFixed(1)) : null;
  };

  const overallMileage = calcWeightedAvg(valid);
  const cityMileage = calcWeightedAvg(valid.filter((l) => l.rideMix === 'City'));
  const highwayMileage = calcWeightedAvg(valid.filter((l) => l.rideMix === 'Highway'));

  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthlySpend = computedLogs
    .filter((l) => l.date.startsWith(ym))
    .reduce((sum, l) => sum + l.totalCost, 0);

  const totalSpend = computedLogs.reduce((sum, l) => sum + l.totalCost, 0);

  return {
    overallMileage,
    cityMileage,
    highwayMileage,
    monthlySpend: Math.round(monthlySpend),
    totalSpend: Math.round(totalSpend),
  };
}

/**
 * Petrol Bunk Leaderboard:
 * Aggregates weighted average km/L per bunk from valid full-tank intervals.
 */
export function computeBunkLeaderboard(computedLogs: ComputedFuelLog[]): BunkStat[] {
  const map = new Map<
    string,
    {
      bunkName: string;
      bunkLocation?: string;
      dist: number;
      lit: number;
      cityDist: number;
      cityLit: number;
      hwyDist: number;
      hwyLit: number;
      fullFillCount: number;
      totalLitres: number;
      lastVisit: string;
    }
  >();

  for (const log of computedLogs) {
    const key = log.bunkName.trim().toLowerCase();
    if (!key) continue;

    const existing = map.get(key) || {
      bunkName: log.bunkName.trim(),
      bunkLocation: log.bunkLocation,
      dist: 0,
      lit: 0,
      cityDist: 0,
      cityLit: 0,
      hwyDist: 0,
      hwyLit: 0,
      fullFillCount: 0,
      totalLitres: 0,
      lastVisit: log.date,
    };

    existing.totalLitres += log.litres;
    if (log.date > existing.lastVisit) existing.lastVisit = log.date;

    if (log.mileageKmpl && log.distanceKm && log.accumulatedLitres) {
      existing.fullFillCount += 1;
      existing.dist += log.distanceKm;
      existing.lit += log.accumulatedLitres;
      if (log.rideMix === 'City') {
        existing.cityDist += log.distanceKm;
        existing.cityLit += log.accumulatedLitres;
      } else if (log.rideMix === 'Highway') {
        existing.hwyDist += log.distanceKm;
        existing.hwyLit += log.accumulatedLitres;
      }
    }

    map.set(key, existing);
  }

  return Array.from(map.values())
    .filter((b) => b.lit > 0)
    .map((b) => ({
      bunkName: b.bunkName,
      bunkLocation: b.bunkLocation,
      avgMileage: Number((b.dist / b.lit).toFixed(1)),
      cityMileage: b.cityLit > 0 ? Number((b.cityDist / b.cityLit).toFixed(1)) : undefined,
      highwayMileage: b.hwyLit > 0 ? Number((b.hwyDist / b.hwyLit).toFixed(1)) : undefined,
      fullFillCount: b.fullFillCount,
      totalLitres: Number(b.totalLitres.toFixed(1)),
      lastVisit: b.lastVisit,
    }))
    .sort((a, b) => {
      // Prioritize bunks with >= 2 full fills first, then highest avgMileage
      const aQualified = a.fullFillCount >= 2 ? 1 : 0;
      const bQualified = b.fullFillCount >= 2 ? 1 : 0;
      if (aQualified !== bQualified) return bQualified - aQualified;
      return b.avgMileage - a.avgMileage;
    });
}

export interface TaskHealth {
  task: MaintenanceTask;
  status: HealthStatus;
  remainingKm: number | null;
  remainingDays: number | null;
  progressPercent: number; // 0 (fresh) to 100+ (overdue)
}

export function evaluateTaskHealth(
  task: MaintenanceTask,
  currentOdometer: number
): TaskHealth {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let remainingKm: number | null = null;
  let kmProgress = 0;

  if (task.lastDoneOdometer !== null) {
    const kmSince = Math.max(0, currentOdometer - task.lastDoneOdometer);
    remainingKm = task.intervalKm - kmSince;
    kmProgress = (kmSince / task.intervalKm) * 100;
  }

  let remainingDays: number | null = null;
  let dayProgress = 0;

  if (task.lastDoneDate) {
    const lastDate = new Date(task.lastDoneDate + 'T00:00:00');
    const daysSince = Math.max(
      0,
      Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
    );
    remainingDays = task.intervalDays - daysSince;
    dayProgress = (daysSince / task.intervalDays) * 100;
  }

  // If never logged yet, prompt gently as 'soon' so user initializes baseline
  if (task.lastDoneOdometer === null && !task.lastDoneDate) {
    return {
      task,
      status: 'soon',
      remainingKm: null,
      remainingDays: null,
      progressPercent: 75,
    };
  }

  const maxProgress = Math.max(kmProgress, dayProgress);
  let status: HealthStatus = 'healthy';
  if (
    (remainingKm !== null && remainingKm <= 0) ||
    (remainingDays !== null && remainingDays <= 0)
  ) {
    status = 'overdue';
  } else if (maxProgress >= 80) {
    status = 'soon';
  }

  return {
    task,
    status,
    remainingKm,
    remainingDays,
    progressPercent: Math.min(100, Math.max(0, Math.round(maxProgress))),
  };
}

/**
 * Generates a smart pre-ride checklist based on expected highway trip distance
 * and current X440 maintenance timers.
 */
export function buildPreRideChecklist(
  tasks: MaintenanceTask[],
  currentOdometer: number,
  expectedKm: number
): PreRideCheckItem[] {
  const items: PreRideCheckItem[] = [];

  for (const task of tasks) {
    const health = evaluateTaskHealth(task, currentOdometer);
    if (
      health.status === 'overdue' ||
      (health.remainingKm !== null && health.remainingKm <= expectedKm)
    ) {
      items.push({
        id: `due-${task.id}`,
        label: task.title,
        reason:
          health.remainingKm !== null && health.remainingKm <= 0
            ? `Overdue by ${Math.abs(health.remainingKm)} km`
            : `Due in ${health.remainingKm} km (trip is ${expectedKm} km)`,
        urgent: true,
        checked: false,
      });
    }
  }

  const standardChecks: Omit<PreRideCheckItem, 'checked'>[] = [
    {
      id: 'std-tyres',
      label: 'Set cold tyre pressure to 33 PSI (Front & Rear)',
      reason: 'X440 highway spec',
    },
    {
      id: 'std-oil',
      label: 'Check engine oil level & wipe oil cooler fins',
      reason: 'Air/oil-cooled 440cc highway prep',
    },
    {
      id: 'std-brakes',
      label: 'Test front/rear brakes, lights & horn',
    },
    {
      id: 'std-kit',
      label: 'Pack chain lube, puncture kit, RC, Insurance & PUC',
    },
  ];

  for (const check of standardChecks) {
    items.push({ ...check, checked: false });
  }

  return items;
}

export function sumBillEntries(entries: { key: string; value: string }[]): number {
  let sum = 0;
  for (const item of entries) {
    // Only sum values that look like currency/numbers (ignore invoice numbers with letters/hyphens)
    const cleaned = item.value.replace(/[₹,\s]/g, '');
    if (/^\d+(\.\d+)?$/.test(cleaned)) {
      const keyLower = item.key.toLowerCase();
      if (
        !keyLower.includes('invoice') &&
        !keyLower.includes('bill no') &&
        !keyLower.includes('phone') &&
        !keyLower.includes('odo')
      ) {
        sum += parseFloat(cleaned);
      }
    }
  }
  return Math.round(sum);
}
