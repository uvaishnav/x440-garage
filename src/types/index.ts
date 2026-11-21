export type FuelGrade = 'Regular' | 'XP95' | 'Power';
export type RideMix = 'City' | 'Highway' | 'Mixed';
export type BikeZone =
  | 'engine'
  | 'chain'
  | 'rear_tyre'
  | 'front_tyre'
  | 'forks'
  | 'air_filter'
  | 'electrical'
  | 'controls';

export type HealthStatus = 'healthy' | 'soon' | 'overdue';
export type IssueSeverity = 'Minor' | 'Check Soon' | 'Urgent';

export interface BillEntry {
  key: string;
  value: string;
}

export interface FuelLog {
  id: string;
  date: string; // YYYY-MM-DD
  odometer: number;
  litres: number;
  pricePerLitre: number;
  totalCost: number;
  isFullTank: boolean;
  fuelGrade: FuelGrade;
  rideMix: RideMix;
  bunkName: string;
  bunkLocation?: string;
  bunkLat?: number;
  bunkLng?: number;
  tripId?: string | null;
  notes?: string;
  createdAt: number;
}

export interface ComputedFuelLog extends FuelLog {
  distanceKm?: number;
  mileageKmpl?: number;
  costPerKm?: number;
  accumulatedLitres?: number;
  intervalHadPartialFills?: boolean;
  sourceBunkName?: string;
  sourceBunkLocation?: string;
  sourceBunkDate?: string;
  sourceFuelGrade?: FuelGrade;
}

export interface BunkStat {
  bunkName: string;
  bunkLocation?: string;
  avgMileage: number;
  cityMileage?: number;
  highwayMileage?: number;
  fullFillCount: number;
  totalLitres: number;
  lastVisit: string;
}

export interface PreRideCheckItem {
  id: string;
  label: string;
  reason?: string;
  urgent?: boolean;
  checked: boolean;
}

export interface Trip {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  startTime?: string; // local datetime input value
  endTime?: string;
  startOdometer: number;
  endOdometer?: number;
  expectedKm: number;
  startTankPercent?: number;
  endTankPercent?: number;
  startTankFull?: boolean;
  endTankFull?: boolean;
  status: 'active' | 'completed';
  checklist: PreRideCheckItem[];
  notes?: string;
  linkedTimelineRideIds?: string[];
  createdAt: number;
}

export interface MaintenanceTask {
  id: string;
  title: string;
  category: 'Routine DIY' | 'Mid Service' | 'Major Service' | 'Fluid Flush';
  zone: BikeZone;
  intervalKm: number;
  intervalDays: number;
  description: string;
  enabled?: boolean;
  isCustom?: boolean;
  manualReference?: string;
  dueNowReason?: string;
  lastDoneOdometer: number | null;
  lastDoneDate: string | null; // YYYY-MM-DD
}

export interface MaintenanceLog {
  id: string;
  taskId: string;
  taskTitle: string;
  date: string; // YYYY-MM-DD
  odometer: number;
  totalCost: number;
  billEntries: BillEntry[];
  notes?: string;
  createdAt: number;
}

export interface BikeIssue {
  id: string;
  title: string;
  symptomCategory: string;
  severity: IssueSeverity;
  odometer: number;
  date: string;
  notes?: string;
  suggestedChecks: string[];
  status: 'open' | 'resolved';
  resolvedDate?: string;
  resolutionNote?: string;
  createdAt: number;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  time?: string;
  speedKmh?: number;
}

export interface TimelineRide {
  id: string;
  startTime: string; // ISO
  endTime: string; // ISO
  date: string; // YYYY-MM-DD
  distanceKm: number;
  durationMin: number;
  movingMin?: number;
  stoppedMin?: number;
  avgSpeedKmh: number;
  highwayPercent: number;
  cityPercent: number;
  activityType: string;
  points: RoutePoint[];
  startName?: string;
  endName?: string;
  source?: 'google-timeline' | 'gpx';
  classificationMethod?: 'osm' | 'speed-estimate';
  tripId?: string | null;
}

export type ExpenseCategory = 'Service' | 'Accessory' | 'Consumable' | 'Document' | 'Other';

export interface ExpenseLog {
  id: string;
  date: string;
  odometer?: number;
  category: ExpenseCategory;
  title: string;
  amount: number;
  notes?: string;
  billEntries?: BillEntry[];
  createdAt: number;
}

export interface AppSettings {
  bikeName: string;
  initialOdometer: number;
  fuelRates: Record<FuelGrade, number>;
  insuranceExpiry: string; // YYYY-MM-DD
  pucExpiry: string; // YYYY-MM-DD
  includeAmbiguousDriving: boolean;
  nextServiceOdometer?: number;
  documentReminderDays?: number;
  maintenanceTemplateVersion?: number;
}

export interface GarageBackup {
  settings?: AppSettings;
  fuelLogs?: FuelLog[];
  trips?: Trip[];
  tasks?: MaintenanceTask[];
  maintenanceLogs?: MaintenanceLog[];
  issues?: BikeIssue[];
  timelineRides?: TimelineRide[];
  expenses?: ExpenseLog[];
}
