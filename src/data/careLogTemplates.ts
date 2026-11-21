import {
  CareInsightFlag,
  CareInsightTone,
  CareObservation,
  CareValueStatus,
} from '../types';

export type CareFieldKind = 'number' | 'select' | 'text';
export type CareFieldMode = 'single' | 'before-after';

export interface CareFieldOption {
  value: string;
  label: string;
  status?: CareValueStatus;
  tone?: CareInsightTone;
  unresolved?: boolean;
}

export interface CareFieldDefinition {
  id: string;
  label: string;
  kind: CareFieldKind;
  mode: CareFieldMode;
  unit?: string;
  required?: boolean;
  helper?: string;
  placeholder?: string;
  target?: { min?: number; max?: number; label: string };
  outOfRangeStatus?: 'attention' | 'critical';
  options?: CareFieldOption[];
  affectsMileage?: boolean;
}

export interface CareLogTemplate {
  id: string;
  title: string;
  guidance: string;
  fields: CareFieldDefinition[];
  billKeys: string[];
}

export type CareFormValues = Record<
  string,
  { value?: string; before?: string; after?: string }
>;

const yesNoAction = (yesLabel = 'Completed'): CareFieldOption[] => [
  { value: 'yes', label: yesLabel, status: 'normal', tone: 'positive' },
  { value: 'no', label: 'Not completed', status: 'attention', tone: 'negative', unresolved: true },
];

const normalAttention = (
  normalLabel: string,
  attention: Array<[string, string, ('attention' | 'critical')?]>
): CareFieldOption[] => [
  { value: 'normal', label: normalLabel, status: 'normal' },
  ...attention.map(([value, label, status]) => ({
    value,
    label,
    status: status || 'attention',
    tone: 'negative' as const,
    unresolved: true,
  })),
];

export const CARE_LOG_TEMPLATES: Record<string, CareLogTemplate> = {
  'tyre-pressure': {
    id: 'tyre-pressure',
    title: 'Tyre Pressure & Tread Record',
    guidance: 'Measure when cold. The X440 manual specifies 33 PSI front and rear.',
    fields: [
      { id: 'front-psi', label: 'Front pressure', kind: 'number', mode: 'before-after', unit: 'PSI', required: true, target: { min: 32, max: 34, label: 'Target 33 PSI cold (app band 32–34)' }, outOfRangeStatus: 'critical', affectsMileage: true },
      { id: 'rear-psi', label: 'Rear pressure', kind: 'number', mode: 'before-after', unit: 'PSI', required: true, target: { min: 32, max: 34, label: 'Target 33 PSI cold (app band 32–34)' }, outOfRangeStatus: 'critical', affectsMileage: true },
      { id: 'front-tread', label: 'Front tread depth', kind: 'number', mode: 'single', unit: 'mm', target: { min: 1, label: 'Replace at 1 mm or visible wear bars' }, outOfRangeStatus: 'critical' },
      { id: 'rear-tread', label: 'Rear tread depth', kind: 'number', mode: 'single', unit: 'mm', target: { min: 1, label: 'Replace at 1 mm or visible wear bars' }, outOfRangeStatus: 'critical' },
      { id: 'tyre-condition', label: 'Tyre condition after check', kind: 'select', mode: 'single', required: true, options: normalAttention('No visible damage', [['puncture', 'Puncture or embedded object'], ['crack', 'Cut, crack or cord visible', 'critical'], ['bulge', 'Bulge or sidewall damage', 'critical']]) },
    ],
    billKeys: ['Air / Nitrogen', 'Puncture Repair', 'Front Tyre', 'Rear Tyre', 'Valve', 'Wheel Alignment', 'Labour'],
  },
  'chain-care': {
    id: 'chain-care',
    title: 'Chain Condition & Care Record',
    guidance: 'Measure lower-run slack midway between sprockets. Manual target: 20–25 mm.',
    fields: [
      { id: 'chain-slack', label: 'Chain slack', kind: 'number', mode: 'before-after', unit: 'mm', required: true, target: { min: 20, max: 25, label: 'Manual range 20–25 mm' }, outOfRangeStatus: 'attention', affectsMileage: true },
      { id: 'chain-condition', label: 'Chain condition', kind: 'select', mode: 'before-after', required: true, affectsMileage: true, options: normalAttention('Clean, free and evenly tensioned', [['dry', 'Dry or rusty'], ['binding', 'Kinked or binding links'], ['damaged', 'Damaged roller, O-ring or sprocket', 'critical']]) },
      { id: 'chain-cleaned', label: 'Chain cleaning', kind: 'select', mode: 'single', required: true, affectsMileage: true, options: yesNoAction('Cleaned') },
      { id: 'chain-lubricated', label: 'O-ring-safe lubrication', kind: 'select', mode: 'single', required: true, affectsMileage: true, options: yesNoAction('Lubricated') },
    ],
    billKeys: ['Chain Cleaner', 'Chain Lube / SAE 90', 'Chain Kit', 'Rear Sprocket', 'Front Sprocket', 'Labour'],
  },
  'oil-level-cooler': {
    id: 'oil-level-cooler',
    title: 'Oil Level & Cooler Record',
    guidance: 'Check upright after the manual warm-up/wait procedure. Oil must remain between the sight-glass marks.',
    fields: [
      { id: 'oil-level', label: 'Oil sight-glass level', kind: 'select', mode: 'before-after', required: true, affectsMileage: true, options: [
        { value: 'between', label: 'Between lower and upper marks', status: 'normal' },
        { value: 'near-lower', label: 'Near lower mark', status: 'attention', tone: 'negative' },
        { value: 'below', label: 'Below lower mark', status: 'critical', tone: 'negative', unresolved: true },
        { value: 'above', label: 'Above upper mark', status: 'attention', tone: 'negative', unresolved: true },
      ] },
      { id: 'top-up', label: 'Oil topped up', kind: 'number', mode: 'single', unit: 'ml', placeholder: '0' },
      { id: 'cooler-condition', label: 'Oil cooler after check', kind: 'select', mode: 'single', required: true, affectsMileage: true, options: normalAttention('Fins clear; no leak or damage', [['blocked', 'Fins blocked with debris'], ['bent', 'Bent or damaged fins'], ['leak', 'Oil seep or leak', 'critical']]) },
    ],
    billKeys: ['15W-50 Engine Oil Top-up', 'Filler Cap O-ring', 'Leak Repair', 'Labour'],
  },
  'brakes-forks-clutch': {
    id: 'brakes-forks-clutch',
    title: 'Brake Condition Record',
    guidance: 'Wear grooves must remain visible; front and rear fluid must stay above MIN.',
    fields: [
      { id: 'front-pad', label: 'Front pad wear groove', kind: 'select', mode: 'before-after', required: true, options: normalAttention('Clearly visible', [['near', 'Near bottom of groove'], ['bottom', 'At bottom / replace pads', 'critical']]) },
      { id: 'rear-pad', label: 'Rear pad wear groove', kind: 'select', mode: 'before-after', required: true, options: normalAttention('Clearly visible', [['near', 'Near bottom of groove'], ['bottom', 'At bottom / replace pads', 'critical']]) },
      { id: 'brake-feel', label: 'Brake feel / drag', kind: 'select', mode: 'before-after', required: true, affectsMileage: true, options: normalAttention('Firm; wheels rotate freely', [['soft', 'Soft or spongy feel', 'critical'], ['drag', 'Brake drag present', 'critical'], ['noise', 'Noise or pulsing']]) },
      { id: 'brake-fluid', label: 'Front & rear fluid level', kind: 'select', mode: 'single', required: true, options: normalAttention('Both above MIN', [['low', 'One or both at/below MIN', 'critical'], ['leak', 'Sudden drop or leak seen', 'critical']]) },
    ],
    billKeys: ['Front Brake Pads', 'Rear Brake Pads', 'DOT 4 Brake Fluid', 'Disc Cleaning', 'Caliper Service', 'Labour'],
  },
  'mid-service-5k': {
    id: 'mid-service-5k',
    title: 'Air Filter Inspection Record',
    guidance: 'The wet paper element must not be washed or cleaned; replace it if very dirty or damaged.',
    fields: [
      { id: 'filter-condition', label: 'Air-filter condition', kind: 'select', mode: 'before-after', required: true, affectsMileage: true, options: normalAttention('Clean / light dust only', [['dirty', 'Very dirty or restricted'], ['damaged', 'Damaged surface or seal', 'critical']]) },
      { id: 'filter-action', label: 'Action taken', kind: 'select', mode: 'single', required: true, affectsMileage: true, options: [
        { value: 'inspect', label: 'Inspected and reinstalled', status: 'normal' },
        { value: 'replace', label: 'Replaced with new element', status: 'normal', tone: 'positive' },
        { value: 'none', label: 'Needs replacement; not done', status: 'attention', tone: 'negative', unresolved: true },
      ] },
      { id: 'drain-tube', label: 'Air-cleaner drain tube', kind: 'select', mode: 'single', options: yesNoAction('Checked and drained') },
    ],
    billKeys: ['Air Filter', 'Drain Tube Service', 'Housing Seal', 'Labour'],
  },
  'major-service-10k': {
    id: 'major-service-10k',
    title: 'Engine Oil Service Record',
    guidance: 'Manual grade: fully synthetic SAE 15W-50. Drain quantity is approximately 2.25 L.',
    fields: [
      { id: 'oil-grade', label: 'Oil grade used', kind: 'select', mode: 'single', required: true, affectsMileage: true, options: [
        { value: '15w50', label: 'Fully synthetic SAE 15W-50', status: 'normal', tone: 'positive' },
        { value: 'other', label: 'Different / unknown grade', status: 'attention', tone: 'negative', unresolved: true },
      ] },
      { id: 'oil-quantity', label: 'Oil filled', kind: 'number', mode: 'single', unit: 'L', required: true, target: { min: 2.15, max: 2.35, label: 'About 2.25 L after draining' }, outOfRangeStatus: 'attention' },
      { id: 'oil-filter', label: 'Oil filter', kind: 'select', mode: 'single', required: true, options: yesNoAction('Replaced') },
      { id: 'strainer', label: 'Strainer & magnetic plug', kind: 'select', mode: 'single', required: true, options: yesNoAction('Cleaned and inspected') },
      { id: 'oil-leak-after', label: 'Leak check after service', kind: 'select', mode: 'single', required: true, options: normalAttention('No seep or leak', [['seep', 'Minor seep remains'], ['leak', 'Active leak', 'critical']]) },
    ],
    billKeys: ['15W-50 Engine Oil', 'Oil Filter', 'Strainer / Drain Washer', 'Filler Cap O-ring', 'Labour', 'Consumables'],
  },
  'fork-seal-check': {
    id: 'fork-seal-check',
    title: 'Fork Seal & Stanchion Record',
    guidance: 'Record oil rings, leaks and stanchion damage before and after attention.',
    fields: [
      { id: 'left-fork', label: 'Left fork', kind: 'select', mode: 'before-after', required: true, options: normalAttention('Dry and smooth', [['ring', 'Oil ring / weep'], ['leak', 'Active leak', 'critical'], ['pitted', 'Pitted or damaged stanchion', 'critical']]) },
      { id: 'right-fork', label: 'Right fork', kind: 'select', mode: 'before-after', required: true, options: normalAttention('Dry and smooth', [['ring', 'Oil ring / weep'], ['leak', 'Active leak', 'critical'], ['pitted', 'Pitted or damaged stanchion', 'critical']]) },
      { id: 'fork-action', label: 'Action taken', kind: 'text', mode: 'single', placeholder: 'Wiped seals, replaced seal, dealer inspection…' },
    ],
    billKeys: ['Fork Seal', 'Dust Seal', 'Fork Oil', 'Stanchion Repair', 'Labour'],
  },
  'controls-free-play': {
    id: 'controls-free-play',
    title: 'Clutch & Throttle Free-play Record',
    guidance: 'Manual ranges: clutch 10–15 mm; throttle grip 0–1 mm.',
    fields: [
      { id: 'clutch-free-play', label: 'Clutch lever free play', kind: 'number', mode: 'before-after', unit: 'mm', required: true, target: { min: 10, max: 15, label: 'Manual range 10–15 mm' }, outOfRangeStatus: 'attention' },
      { id: 'throttle-free-play', label: 'Throttle grip free play', kind: 'number', mode: 'before-after', unit: 'mm', required: true, target: { min: 0, max: 1, label: 'Manual range 0–1 mm' }, outOfRangeStatus: 'attention', affectsMileage: true },
      { id: 'cable-condition', label: 'Cable routing & return after check', kind: 'select', mode: 'single', required: true, options: normalAttention('Smooth return; no kink or chafe', [['sticky', 'Sticky or slow return', 'critical'], ['wear', 'Kink, chafe or routing issue', 'critical']]) },
    ],
    billKeys: ['Clutch Cable', 'Throttle Cable', 'Cable Lubricant', 'Adjuster', 'Labour'],
  },
  'lights-switches-horn': {
    id: 'lights-switches-horn',
    title: 'Electrical Controls Record',
    guidance: 'Check every lamp, brake-light switch, horn, kill switch and side-stand cut-off.',
    fields: [
      { id: 'electrical-functions', label: 'Lights, switches & horn', kind: 'select', mode: 'before-after', required: true, options: normalAttention('All functions pass', [['fault', 'One or more faults', 'critical']]) },
      { id: 'side-stand-cutoff', label: 'Side-stand engine cut-off', kind: 'select', mode: 'before-after', required: true, options: normalAttention('Passes functional test', [['fault', 'Fails functional test', 'critical']]) },
      { id: 'electrical-details', label: 'Fault / repair details', kind: 'text', mode: 'single', placeholder: 'e.g. rear brake-light switch adjusted' },
    ],
    billKeys: ['Bulb / LED Unit', 'Horn', 'Switch', 'Fuse', 'Wiring Repair', 'Labour'],
  },
  'fasteners-mounts': {
    id: 'fasteners-mounts',
    title: 'Fastener & Mount Record',
    guidance: 'Record where looseness was found and whether correct torque was restored.',
    fields: [
      { id: 'fastener-condition', label: 'Fastener condition', kind: 'select', mode: 'before-after', required: true, options: normalAttention('No looseness found', [['minor', 'Loose non-critical fastener'], ['critical', 'Loose mount / safety-critical fastener', 'critical']]) },
      { id: 'fastener-area', label: 'Area / fastener', kind: 'text', mode: 'single', placeholder: 'Mirror, handlebar, engine mount, exhaust…' },
      { id: 'torque-verified', label: 'Final torque / security', kind: 'select', mode: 'single', required: true, options: yesNoAction('Verified secure') },
    ],
    billKeys: ['Fastener', 'Thread Locker', 'Mount / Bush', 'Heat Shield', 'Labour'],
  },
  'battery-health': {
    id: 'battery-health',
    title: 'Battery & Terminal Record',
    guidance: 'The connected system raises a low-battery alert below 12.4 V.',
    fields: [
      { id: 'battery-voltage', label: 'Resting battery voltage', kind: 'number', mode: 'before-after', unit: 'V', required: true, target: { min: 12.4, label: 'Low-battery alert threshold: 12.4 V' }, outOfRangeStatus: 'attention' },
      { id: 'terminal-condition', label: 'Terminals & corrosion', kind: 'select', mode: 'before-after', required: true, options: normalAttention('Clean and secure', [['loose', 'Loose terminal'], ['corrosion', 'Corrosion present']]) },
      { id: 'battery-action', label: 'Action taken', kind: 'text', mode: 'single', placeholder: 'Charged, terminals cleaned, battery replaced…' },
    ],
    billKeys: ['Battery', 'Terminal Cleaning', 'Charger', 'Terminal Hardware', 'Labour'],
  },
  'spark-plug-inspect': {
    id: 'spark-plug-inspect',
    title: 'Spark Plug Inspection Record',
    guidance: 'Manual plug gap: 0.8–0.9 mm. Replace if worn, cracked or chipped.',
    fields: [
      { id: 'spark-gap', label: 'Spark-plug gap', kind: 'number', mode: 'before-after', unit: 'mm', required: true, target: { min: 0.8, max: 0.9, label: 'Manual range 0.8–0.9 mm' }, outOfRangeStatus: 'attention', affectsMileage: true },
      { id: 'spark-condition', label: 'Electrode / insulator condition', kind: 'select', mode: 'before-after', required: true, affectsMileage: true, options: normalAttention('Normal colour; square electrodes', [['fouled', 'Fouled / heavy deposits'], ['worn', 'Worn electrode'], ['cracked', 'Cracked or chipped insulator', 'critical']]) },
    ],
    billKeys: ['Spark Plug REK6YC', 'Plug Cleaning', 'Feeler Gauge Check', 'Labour'],
  },
  'steering-bearings': {
    id: 'steering-bearings',
    title: 'Steering & Wheel Bearing Record',
    guidance: 'Record notchiness, play or roughness before and after inspection or adjustment.',
    fields: [
      { id: 'steering-head', label: 'Steering head', kind: 'select', mode: 'before-after', required: true, options: normalAttention('Smooth; no play or notch', [['play', 'Free play present', 'critical'], ['notchy', 'Notchy or rough movement', 'critical']]) },
      { id: 'front-bearing', label: 'Front wheel bearing', kind: 'select', mode: 'before-after', required: true, options: normalAttention('Smooth; no play', [['play', 'Play or roughness', 'critical']]) },
      { id: 'rear-bearing', label: 'Rear wheel bearing', kind: 'select', mode: 'before-after', required: true, options: normalAttention('Smooth; no play', [['play', 'Play or roughness', 'critical']]) },
    ],
    billKeys: ['Steering Bearing', 'Front Wheel Bearing', 'Rear Wheel Bearing', 'Grease', 'Labour'],
  },
  'air-filter-replace': {
    id: 'air-filter-replace',
    title: 'Air Filter Replacement Record',
    guidance: 'Replace the wet paper element; do not wash or clean it.',
    fields: [
      { id: 'old-filter', label: 'Removed filter condition', kind: 'select', mode: 'single', required: true, affectsMileage: true, options: normalAttention('Scheduled replacement / light dust', [['dirty', 'Very dirty or restricted'], ['damaged', 'Damaged surface or seal', 'critical']]) },
      { id: 'new-filter', label: 'New filter installed', kind: 'select', mode: 'single', required: true, affectsMileage: true, options: yesNoAction('Installed') },
      { id: 'filter-seal', label: 'Housing & seal after installation', kind: 'select', mode: 'single', required: true, options: normalAttention('Clean and fully seated', [['gap', 'Seal gap / seating concern', 'critical']]) },
    ],
    billKeys: ['Air Filter', 'Housing Seal', 'Drain Tube', 'Labour'],
  },
  'spark-plug-replace': {
    id: 'spark-plug-replace',
    title: 'Spark Plug Replacement Record',
    guidance: 'Specified plug: Federal Mogul REK6YC; final gap 0.8–0.9 mm.',
    fields: [
      { id: 'old-plug-condition', label: 'Removed plug condition', kind: 'select', mode: 'single', required: true, affectsMileage: true, options: normalAttention('Normal scheduled wear', [['fouled', 'Fouled / deposits'], ['worn', 'Electrode worn'], ['cracked', 'Cracked or chipped', 'critical']]) },
      { id: 'plug-model', label: 'New plug model', kind: 'text', mode: 'single', required: true, placeholder: 'Federal Mogul REK6YC' },
      { id: 'new-plug-gap', label: 'Final plug gap', kind: 'number', mode: 'single', unit: 'mm', required: true, target: { min: 0.8, max: 0.9, label: 'Manual range 0.8–0.9 mm' }, outOfRangeStatus: 'attention', affectsMileage: true },
      { id: 'start-idle-after', label: 'Start & idle after replacement', kind: 'select', mode: 'single', required: true, options: normalAttention('Starts and idles normally', [['poor', 'Starting / idle issue remains']]) },
    ],
    billKeys: ['Spark Plug REK6YC', 'Suppressor Cap', 'Labour'],
  },
  'fuel-filter-valves': {
    id: 'fuel-filter-valves',
    title: 'Fuel System & Valve-Clearance Record',
    guidance: 'Dealer-level record. Cold clearances: intake 0.10±0.02 mm; exhaust 0.22±0.02 mm.',
    fields: [
      { id: 'intake-clearance', label: 'Intake valve clearance', kind: 'number', mode: 'before-after', unit: 'mm', target: { min: 0.08, max: 0.12, label: 'Cold range 0.08–0.12 mm' }, outOfRangeStatus: 'attention', affectsMileage: true },
      { id: 'exhaust-clearance', label: 'Exhaust valve clearance', kind: 'number', mode: 'before-after', unit: 'mm', target: { min: 0.2, max: 0.24, label: 'Cold range 0.20–0.24 mm' }, outOfRangeStatus: 'attention', affectsMileage: true },
      { id: 'fuel-filter', label: 'Fuel filter', kind: 'select', mode: 'single', required: true, options: [
        { value: 'inspect', label: 'Inspected; serviceable', status: 'normal' },
        { value: 'replace', label: 'Replaced', status: 'normal', tone: 'positive' },
        { value: 'restricted', label: 'Restricted; unresolved', status: 'attention', tone: 'negative', unresolved: true },
      ] },
      { id: 'fuel-lines', label: 'Fuel lines & leak check after service', kind: 'select', mode: 'single', required: true, options: normalAttention('Secure; no leak', [['damage', 'Damage / deterioration'], ['leak', 'Fuel leak', 'critical']]) },
    ],
    billKeys: ['Fuel Filter', 'Fuel Line / Clamp', 'Valve Adjustment', 'Gasket', 'Labour'],
  },
  'fluid-flush-30k': {
    id: 'fluid-flush-30k',
    title: 'Brake Fluid & Fork Oil Record',
    guidance: 'Use DOT 4. Replace brake fluid every 2 years or sooner at ≥3% moisture; fork oil every 2 years/30,000 km.',
    fields: [
      { id: 'brake-moisture', label: 'Brake-fluid moisture before flush', kind: 'number', mode: 'single', unit: '%', target: { max: 2.99, label: 'Flush at 3% or greater' }, outOfRangeStatus: 'critical' },
      { id: 'brake-fluid-replaced', label: 'Front & rear DOT 4 fluid', kind: 'select', mode: 'single', required: true, options: yesNoAction('Flushed and replaced') },
      { id: 'fork-oil-replaced', label: '43 mm USD fork oil', kind: 'select', mode: 'single', required: true, options: yesNoAction('Replaced') },
      { id: 'fluid-result', label: 'Brake feel & leak check after service', kind: 'select', mode: 'single', required: true, options: normalAttention('Firm feel; no leaks', [['soft', 'Soft / spongy feel', 'critical'], ['leak', 'Fluid or fork-oil leak', 'critical']]) },
    ],
    billKeys: ['DOT 4 Brake Fluid', 'Fork Oil', 'Fork Seal', 'Bleeding / Flush', 'Labour'],
  },
  'generic-repair': {
    id: 'generic-repair',
    title: 'Repair Outcome Record',
    guidance: 'Capture whether the symptom was actually resolved, not only what was replaced.',
    fields: [
      { id: 'symptom-state', label: 'Symptom / fault', kind: 'select', mode: 'before-after', required: true, options: normalAttention('Not present', [['present', 'Present'], ['severe', 'Severe / safety concern', 'critical']]) },
      { id: 'road-test', label: 'Post-repair road test', kind: 'select', mode: 'single', required: true, options: normalAttention('Pass — symptom not reproduced', [['partial', 'Improved but still present'], ['fail', 'Failed / unresolved', 'critical']]) },
      { id: 'repair-detail', label: 'Repair / adjustment performed', kind: 'text', mode: 'single', required: true, placeholder: 'Part replaced, setting adjusted, diagnosis…' },
    ],
    billKeys: ['Replacement Part', 'Diagnostic Charge', 'Repair Labour', 'Consumables', 'Road Test'],
  },
  'generic-modification': {
    id: 'generic-modification',
    title: 'Modification Baseline Record',
    guidance: 'Record what changed so later mileage or handling differences have useful context.',
    fields: [
      { id: 'modification-detail', label: 'Part / change', kind: 'text', mode: 'single', required: true, placeholder: 'Exhaust, luggage rack, windscreen, tyres…' },
      { id: 'weight-change', label: 'Approximate weight change', kind: 'number', mode: 'single', unit: 'kg', placeholder: 'Use a negative value if lighter' },
      { id: 'expected-effect', label: 'Expected mileage effect', kind: 'select', mode: 'single', affectsMileage: true, options: [
        { value: 'better', label: 'May improve mileage', status: 'unrated', tone: 'positive' },
        { value: 'worse', label: 'May reduce mileage', status: 'unrated', tone: 'negative' },
        { value: 'none', label: 'No expected effect', status: 'unrated', tone: 'neutral' },
        { value: 'unknown', label: 'Unknown — observe', status: 'unrated', tone: 'neutral' },
      ] },
    ],
    billKeys: ['Accessory / Part', 'Mounting Kit', 'Electrical Work', 'Installation Labour'],
  },
};

function statusForValue(field: CareFieldDefinition, raw: string): CareValueStatus {
  if (!raw.trim()) return 'unrated';
  if (field.kind === 'number' && field.target) {
    const value = Number(raw);
    if (!Number.isFinite(value)) return 'unrated';
    const below = field.target.min != null && value < field.target.min;
    const above = field.target.max != null && value > field.target.max;
    return below || above ? field.outOfRangeStatus || 'attention' : 'normal';
  }
  if (field.kind === 'select') {
    return field.options?.find((option) => option.value === raw)?.status || 'unrated';
  }
  return 'unrated';
}

function displayValue(field: CareFieldDefinition, raw: string): string {
  if (field.kind === 'select') {
    return field.options?.find((option) => option.value === raw)?.label || raw;
  }
  return `${raw}${field.unit ? ` ${field.unit}` : ''}`;
}

function isAbnormal(status?: CareValueStatus): boolean {
  return status === 'attention' || status === 'critical';
}

export function buildCareLogResult(
  templateId: string | undefined,
  values: CareFormValues,
  validateRequired = true
): {
  observations: CareObservation[];
  insightFlags: CareInsightFlag[];
  missingFields: string[];
} {
  const template = templateId ? CARE_LOG_TEMPLATES[templateId] : undefined;
  if (!template) return { observations: [], insightFlags: [], missingFields: [] };

  const observations: CareObservation[] = [];
  const insightFlags: CareInsightFlag[] = [];
  const missingFields: string[] = [];

  const addFlag = (flag: CareInsightFlag) => {
    if (!insightFlags.some((item) => item.id === flag.id)) insightFlags.push(flag);
  };

  template.fields.forEach((field) => {
    const entry = values[field.id] || {};
    if (field.mode === 'before-after') {
      const before = entry.before?.trim() || '';
      const after = entry.after?.trim() || '';
      if (validateRequired && field.required && (!before || !after)) {
        missingFields.push(field.label);
      }
      if (!before && !after) return;
      const beforeStatus = statusForValue(field, before);
      const afterStatus = statusForValue(field, after);
      const beforeLabel = before ? displayValue(field, before) : '';
      const afterLabel = after ? displayValue(field, after) : '';
      observations.push({
        fieldId: field.id,
        label: field.label,
        mode: field.mode,
        unit: field.unit,
        targetLabel: field.target?.label,
        beforeValue: before || undefined,
        beforeLabel: beforeLabel || undefined,
        beforeStatus,
        afterValue: after || undefined,
        afterLabel: afterLabel || undefined,
        afterStatus,
      });

      if (before && isAbnormal(beforeStatus)) {
        addFlag({
          id: `${field.id}-before`,
          label: `${field.label} was ${beforeLabel}`,
          tone: 'negative',
          affectsMileage: Boolean(field.affectsMileage),
          unresolved: !after,
        });
      }
      if (after && isAbnormal(afterStatus)) {
        addFlag({
          id: `${field.id}-after`,
          label: `${field.label} remains ${afterLabel}`,
          tone: 'negative',
          affectsMileage: Boolean(field.affectsMileage),
          unresolved: true,
        });
      } else if (after && afterStatus === 'normal' && before && isAbnormal(beforeStatus)) {
        addFlag({
          id: `${field.id}-corrected`,
          label: `${field.label} corrected to ${afterLabel}`,
          tone: 'positive',
          affectsMileage: Boolean(field.affectsMileage),
          unresolved: false,
        });
      }
      return;
    }

    const value = entry.value?.trim() || '';
    if (validateRequired && field.required && !value) missingFields.push(field.label);
    if (!value) return;
    const valueStatus = statusForValue(field, value);
    const valueLabel = displayValue(field, value);
    observations.push({
      fieldId: field.id,
      label: field.label,
      mode: field.mode,
      unit: field.unit,
      targetLabel: field.target?.label,
      value,
      valueLabel,
      valueStatus,
    });

    const option = field.options?.find((item) => item.value === value);
    const tone = option?.tone || (isAbnormal(valueStatus) ? 'negative' : undefined);
    if (tone) {
      addFlag({
        id: field.id,
        label: `${field.label}: ${valueLabel}`,
        tone,
        affectsMileage: Boolean(field.affectsMileage),
        unresolved: option?.unresolved ?? isAbnormal(valueStatus),
      });
    } else if (isAbnormal(valueStatus)) {
      addFlag({
        id: field.id,
        label: `${field.label}: ${valueLabel}`,
        tone: 'negative',
        affectsMileage: Boolean(field.affectsMileage),
        unresolved: true,
      });
    }
  });

  return { observations, insightFlags, missingFields };
}

export function careTemplateFor(templateId?: string): CareLogTemplate | undefined {
  return templateId ? CARE_LOG_TEMPLATES[templateId] : undefined;
}
