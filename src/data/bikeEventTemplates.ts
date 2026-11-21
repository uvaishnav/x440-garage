import { BikeEventKind } from '../types';

export interface BikeEventTemplate {
  id: string;
  label: string;
  kind: BikeEventKind;
  description: string;
  taskIds: string[];
  selectDueTasks?: boolean;
  careTemplateId?: string;
  billKeys: string[];
  serviceAssumption?: boolean;
}

export const BIKE_EVENT_TEMPLATES: BikeEventTemplate[] = [
  {
    id: 'periodic-service',
    label: 'Periodic Service',
    kind: 'Service',
    description: 'A scheduled workshop or dealer service. Due care items are preselected.',
    taskIds: [],
    selectDueTasks: true,
    billKeys: ['Invoice No', 'Engine Oil', 'Oil Filter', 'Service Labour', 'Consumables', 'Tax / Discount'],
    serviceAssumption: true,
  },
  {
    id: 'engine-oil-service',
    label: 'Engine Oil & Filter Change',
    kind: 'Service',
    description: 'Oil, filter and strainer work.',
    taskIds: ['major-service-10k'],
    careTemplateId: 'major-service-10k',
    billKeys: ['15W-50 Engine Oil', 'Oil Filter', 'Strainer / Drain Washer', 'Filler Cap O-ring', 'Labour', 'Consumables'],
  },
  {
    id: 'chain-service',
    label: 'Chain Clean, Lube or Adjustment',
    kind: 'Chain Care',
    description: 'Chain cleaning, lubrication, slack adjustment or chain-kit work.',
    taskIds: ['chain-care'],
    careTemplateId: 'chain-care',
    billKeys: ['Chain Cleaner', 'Chain Lube / SAE 90', 'Chain Kit', 'Rear Sprocket', 'Front Sprocket', 'Labour'],
  },
  {
    id: 'tyre-work',
    label: 'Tyre or Wheel Work',
    kind: 'Tyre Work',
    description: 'Pressure correction, puncture repair, tyre replacement or wheel work.',
    taskIds: ['tyre-pressure'],
    careTemplateId: 'tyre-pressure',
    billKeys: ['Air / Nitrogen', 'Puncture Repair', 'Front Tyre', 'Rear Tyre', 'Valve', 'Wheel Alignment', 'Labour'],
  },
  {
    id: 'brake-work',
    label: 'Brake Service',
    kind: 'Brake Work',
    description: 'Brake inspection, cleaning, pad work or fluid service.',
    taskIds: ['brakes-forks-clutch'],
    careTemplateId: 'brakes-forks-clutch',
    billKeys: ['Front Brake Pads', 'Rear Brake Pads', 'DOT 4 Brake Fluid', 'Disc Cleaning', 'Caliper Service', 'Labour'],
  },
  {
    id: 'air-filter-service',
    label: 'Air Filter Work',
    kind: 'Service',
    description: 'Air-filter inspection or replacement.',
    taskIds: ['mid-service-5k'],
    careTemplateId: 'mid-service-5k',
    billKeys: ['Air Filter', 'Drain Tube Service', 'Housing Seal', 'Labour'],
  },
  {
    id: 'repair-adjustment',
    label: 'Repair or Adjustment',
    kind: 'Repair',
    description: 'A repair, diagnosis or adjustment that does not fit a scheduled service.',
    taskIds: [],
    careTemplateId: 'generic-repair',
    billKeys: ['Replacement Part', 'Diagnostic Charge', 'Repair Labour', 'Consumables', 'Road Test'],
  },
  {
    id: 'modification',
    label: 'Accessory or Modification',
    kind: 'Modification',
    description: 'A change that may affect weight, airflow, ergonomics or mileage.',
    taskIds: [],
    careTemplateId: 'generic-modification',
    billKeys: ['Accessory / Part', 'Mounting Kit', 'Electrical Work', 'Installation Labour'],
  },
  {
    id: 'one-time',
    label: 'One-time Custom Event',
    kind: 'Other',
    description: 'Name this event for this log only. It will not be added to the template list.',
    taskIds: [],
    billKeys: ['Part', 'Labour', 'Consumables', 'Invoice No'],
  },
];
