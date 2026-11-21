import { BikeEventKind } from '../types';

export interface BikeEventTemplate {
  id: string;
  label: string;
  kind: BikeEventKind;
  description: string;
  taskIds: string[];
  selectDueTasks?: boolean;
}

export const BIKE_EVENT_TEMPLATES: BikeEventTemplate[] = [
  {
    id: 'periodic-service',
    label: 'Periodic Service',
    kind: 'Service',
    description: 'A scheduled workshop or dealer service. Due care items are preselected.',
    taskIds: [],
    selectDueTasks: true,
  },
  {
    id: 'engine-oil-service',
    label: 'Engine Oil & Filter Change',
    kind: 'Service',
    description: 'Oil, filter and strainer work.',
    taskIds: ['major-service-10k', 'oil-level-cooler'],
  },
  {
    id: 'chain-service',
    label: 'Chain Clean, Lube or Adjustment',
    kind: 'Chain Care',
    description: 'Chain cleaning, lubrication, slack adjustment or chain-kit work.',
    taskIds: ['chain-care'],
  },
  {
    id: 'tyre-work',
    label: 'Tyre or Wheel Work',
    kind: 'Tyre Work',
    description: 'Pressure correction, puncture repair, tyre replacement or wheel work.',
    taskIds: ['tyre-pressure', 'steering-bearings'],
  },
  {
    id: 'brake-work',
    label: 'Brake Service',
    kind: 'Brake Work',
    description: 'Brake inspection, cleaning, pad work or fluid service.',
    taskIds: ['brakes-forks-clutch', 'fluid-flush-30k'],
  },
  {
    id: 'air-filter-service',
    label: 'Air Filter Work',
    kind: 'Service',
    description: 'Air-filter inspection or replacement.',
    taskIds: ['mid-service-5k', 'air-filter-replace'],
  },
  {
    id: 'repair-adjustment',
    label: 'Repair or Adjustment',
    kind: 'Repair',
    description: 'A repair, diagnosis or adjustment that does not fit a scheduled service.',
    taskIds: [],
  },
  {
    id: 'modification',
    label: 'Accessory or Modification',
    kind: 'Modification',
    description: 'A change that may affect weight, airflow, ergonomics or mileage.',
    taskIds: [],
  },
  {
    id: 'one-time',
    label: 'One-time Custom Event',
    kind: 'Other',
    description: 'Name this event for this log only. It will not be added to the template list.',
    taskIds: [],
  },
];
