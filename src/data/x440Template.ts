import { AppSettings, BikeZone, MaintenanceTask } from '../types';

export const DEFAULT_SETTINGS: AppSettings = {
  bikeName: 'Harley-Davidson X440 Matte Denim',
  initialOdometer: 0,
  fuelRates: {
    Regular: 107.4,
    XP95: 114.2,
    Power: 114.8,
  },
  insuranceExpiry: '',
  pucExpiry: '',
  includeAmbiguousDriving: false,
};

export const X440_QUICK_SPECS = [
  { label: 'Engine Oil Grade', value: '15W-50 JASO MA2' },
  { label: 'Oil Drain Capacity', value: '2.25 L (2.3 L pack)' },
  { label: 'Front Tyre (Cold)', value: '33 PSI (100/90-18)' },
  { label: 'Rear Tyre (Cold)', value: '33 PSI (140/70-17)' },
  { label: 'Fuel Tank Capacity', value: '13.5 Litres' },
  { label: 'Major Service', value: '10,000 km / 12 mo' },
];

export const PRESET_BILL_KEYS = [
  'Engine Oil',
  'Oil Filter',
  'Air Filter',
  'Brake Pads',
  'Chain Kit / Lube',
  'Labour',
  'Consumables',
  'Invoice No',
  'Dealer / Garage',
];

export const BIKE_HOTSPOTS: Record<
  BikeZone,
  { label: string; xPercent: number; yPercent: number }
> = {
  engine: { label: 'Engine & Oil', xPercent: 53, yPercent: 64 },
  chain: { label: 'Drive Chain', xPercent: 33, yPercent: 76 },
  rear_tyre: { label: 'Rear Tyre & Brake', xPercent: 20, yPercent: 73 },
  front_tyre: { label: 'Front Tyre & Brake', xPercent: 81, yPercent: 73 },
  forks: { label: 'USD Forks & Fluid', xPercent: 73, yPercent: 46 },
  air_filter: { label: 'Air Filter & Intake', xPercent: 43, yPercent: 52 },
};

export const X440_MAINTENANCE_TEMPLATE: MaintenanceTask[] = [
  {
    id: 'tyre-pressure',
    title: 'Tyre Pressure & Tread Check',
    category: 'Routine DIY',
    zone: 'front_tyre',
    intervalKm: 500,
    intervalDays: 14,
    description: 'Check cold pressure: 33 PSI Front & 33 PSI Rear. Inspect tread wear indicators (TWI).',
    lastDoneOdometer: null,
    lastDoneDate: null,
  },
  {
    id: 'chain-care',
    title: 'Chain Clean, Lube & Slack Check',
    category: 'Routine DIY',
    zone: 'chain',
    intervalKm: 500,
    intervalDays: 21,
    description: 'Clean with chain cleaner, apply lube, verify slack & chain slider wear. Do sooner after rain.',
    lastDoneOdometer: null,
    lastDoneDate: null,
  },
  {
    id: 'oil-level-cooler',
    title: 'Engine Oil Level & Oil Cooler Check',
    category: 'Routine DIY',
    zone: 'engine',
    intervalKm: 1000,
    intervalDays: 30,
    description: 'Inspect oil level on level ground and clear mud/bugs from the oil cooler fins.',
    lastDoneOdometer: null,
    lastDoneDate: null,
  },
  {
    id: 'brakes-forks-clutch',
    title: 'Brake Pads, USD Fork Seals & Clutch Play',
    category: 'Routine DIY',
    zone: 'rear_tyre',
    intervalKm: 2500,
    intervalDays: 90,
    description: 'Check front/rear ByBre pad thickness, wipe USD fork stanchions for oil weeping, verify clutch free play.',
    lastDoneOdometer: null,
    lastDoneDate: null,
  },
  {
    id: 'mid-service-5k',
    title: 'Mid-Interval Checkup (5,000 km)',
    category: 'Mid Service',
    zone: 'air_filter',
    intervalKm: 5000,
    intervalDays: 180,
    description: 'Inspect/clean air filter & spark plug, top up oil, tighten fasteners, lube side-stand switch & check battery.',
    lastDoneOdometer: null,
    lastDoneDate: null,
  },
  {
    id: 'major-service-10k',
    title: 'Major Service — Oil, Filters & Valves',
    category: 'Major Service',
    zone: 'engine',
    intervalKm: 10000,
    intervalDays: 365,
    description: 'Replace 15W-50 MA2 oil (2.25 L), oil filter, air filter, spark plug, external fuel filter; clean strainer & magnetic plug; check valve clearance.',
    lastDoneOdometer: null,
    lastDoneDate: null,
  },
  {
    id: 'fluid-flush-30k',
    title: 'Brake Fluid & USD Fork Oil Flush',
    category: 'Fluid Flush',
    zone: 'forks',
    intervalKm: 30000,
    intervalDays: 730,
    description: 'Replace DOT 4 front/rear brake fluid and front 43 mm KYB USD fork oil.',
    lastDoneOdometer: null,
    lastDoneDate: null,
  },
];

export const X440_SYMPTOM_SUGGESTIONS: Record<string, string[]> = {
  'Vibrations / Buzzing': [
    'Check mirror stalks, crash guard & exhaust heat-shield bolts for looseness',
    'Inspect drive chain slack and rear axle alignment',
    'Verify front & rear tyre pressure is 33 PSI cold',
  ],
  'Mileage Drop': [
    'Check cold tyre pressure (low PSI drops mileage sharply on the X440)',
    'Inspect air filter element for dust clogging',
    'Check for brake drag or overly tight drive chain',
  ],
  'Brake Squeak / Soft Feel': [
    'Clean brake disc & caliper pads (dust/mud buildup)',
    'Check remaining front/rear pad thickness',
    'Inspect brake fluid level and color through sight window',
  ],
  'Cold Start / Idle Issue': [
    'Check battery resting voltage (should be 12.6V+)',
    'Inspect spark plug gap and carbon fouling',
    'Ask dealer to verify ECU idle firmware update & throttle body cleanliness',
  ],
  'Chain Noise / Jerky Shifting': [
    'Clean & lubricate chain; check for tight/stiff links',
    'Adjust chain slack to manual spec and inspect chain slider',
    'Check clutch cable free play at the lever',
  ],
  'Heating / Oil Seepage': [
    'Check engine oil level immediately',
    'Inspect drain bolt washer, oil filter cover O-ring & cooler lines for weeping',
    'Clear mud or debris blocking the oil cooler fins',
  ],
  'Other / General': [
    'Note exact speed, gear, and engine temperature when it happens',
    'Mention odometer reading to the Harley-Davidson service advisor',
  ],
};
