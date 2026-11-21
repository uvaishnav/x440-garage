import React from 'react';
import { PRESET_BILL_KEYS } from '../data/x440Template';
import { sumBillEntries } from '../lib/calculations';
import { BillEntry } from '../types';
import { PlusIcon, TrashIcon } from './Icons';

interface BillReceiptEditorProps {
  entries: BillEntry[];
  onChange: (next: BillEntry[]) => void;
  presetKeys?: string[];
}

export const BillReceiptEditor: React.FC<BillReceiptEditorProps> = ({
  entries,
  onChange,
  presetKeys = PRESET_BILL_KEYS,
}) => {
  const addRow = (presetKey = '') => {
    onChange([...entries, { key: presetKey, value: '' }]);
  };

  const updateRow = (index: number, field: 'key' | 'value', val: string) => {
    const next = entries.map((row, idx) =>
      idx === index ? { ...row, [field]: val } : row
    );
    onChange(next);
  };

  const removeRow = (index: number) => {
    onChange(entries.filter((_, idx) => idx !== index));
  };

  const autoTotal = sumBillEntries(entries);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#8E8E93]">
          Bill Breakdown (Stored as Key-Value JSON)
        </span>
        {autoTotal > 0 && (
          <span className="text-xs font-semibold text-[#FF6600] tabular-nums">
            Auto-Sum: ₹{autoTotal.toLocaleString('en-IN')}
          </span>
        )}
      </div>

      {/* 1-Tap Preset Keys */}
      <div className="flex flex-wrap gap-1.5">
        {presetKeys.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => addRow(preset)}
            className="px-2.5 py-1 rounded-lg bg-[#1F2126] border border-white/[0.06] text-[11px] text-[#F5F5F7] active:scale-95 transition-transform"
          >
            + {preset}
          </button>
        ))}
      </div>

      {/* Key-Value Rows */}
      <div className="space-y-2">
        {entries.map((row, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Item (e.g. Engine Oil)"
              value={row.key}
              onChange={(e) => updateRow(idx, 'key', e.target.value)}
              className="flex-1 h-11 px-3 rounded-xl bg-[#1F2126] border border-white/[0.08] text-sm text-[#F5F5F7] placeholder:text-[#636366] focus:outline-none focus:border-[#FF6600]"
            />
            <input
              type="text"
              placeholder="Amount / Value"
              value={row.value}
              onChange={(e) => updateRow(idx, 'value', e.target.value)}
              className="w-32 h-11 px-3 rounded-xl bg-[#1F2126] border border-white/[0.08] text-sm text-[#F5F5F7] tabular-nums placeholder:text-[#636366] focus:outline-none focus:border-[#FF6600]"
            />
            <button
              type="button"
              onClick={() => removeRow(idx)}
              className="w-10 h-11 rounded-xl bg-[#1F2126] text-[#8E8E93] hover:text-[#FF453A] flex items-center justify-center shrink-0"
              aria-label="Remove row"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => addRow('')}
        className="w-full h-10 rounded-xl border border-dashed border-white/15 text-xs font-medium text-[#8E8E93] flex items-center justify-center gap-1.5 active:scale-[0.99]"
      >
        <PlusIcon className="w-3.5 h-3.5" /> Add Custom Field
      </button>
    </div>
  );
};
