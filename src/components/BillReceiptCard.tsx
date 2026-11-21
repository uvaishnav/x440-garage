import React from 'react';
import { MaintenanceLog } from '../types';
import { ReceiptIcon } from './Icons';

interface BillReceiptCardProps {
  log: MaintenanceLog;
}

/**
 * Renders stored JSON key-value bill info as a clean Apple Pay-style digital receipt.
 */
export const BillReceiptCard: React.FC<BillReceiptCardProps> = ({ log }) => {
  const validRows = (log.billEntries || []).filter(
    (e) => e.key.trim() || e.value.trim()
  );
  const observations = log.observations || [];
  const insightFlags = log.insightFlags || [];

  return (
    <div className="rounded-2xl bg-[#141518] border border-white/[0.08] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#1F2126] border border-white/[0.06] flex items-center justify-center text-[#FF6600] shrink-0">
            <ReceiptIcon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#F5F5F7] leading-tight">
              {log.taskTitle}
            </p>
            <p className="text-[11px] text-[#8E8E93] tabular-nums mt-0.5">
              {log.date} · {log.odometer.toLocaleString('en-IN')} km
            </p>
          </div>
        </div>
        {log.totalCost > 0 && (
          <span className="text-sm font-semibold text-[#F5F5F7] tabular-nums">
            ₹{log.totalCost.toLocaleString('en-IN')}
          </span>
        )}
      </div>

      {observations.length > 0 && (
        <div className="divide-y divide-white/[0.05] rounded-xl bg-[#0F1013] border border-white/[0.06] px-3.5 py-1">
          {observations.map((observation) => (
            <div key={observation.fieldId} className="py-2 flex items-start justify-between gap-3 text-xs">
              <div className="min-w-0">
                <p className="text-[#A7A7AD]">{observation.label}</p>
                {observation.targetLabel && (
                  <p className="mt-0.5 text-[10px] text-[#73737A]">{observation.targetLabel}</p>
                )}
              </div>
              <p className="max-w-[58%] text-right font-medium text-[#F5F5F7] tabular-nums break-words">
                {observation.mode === 'before-after'
                  ? `${observation.beforeLabel || '—'} → ${observation.afterLabel || '—'}`
                  : observation.valueLabel || observation.value || '—'}
              </p>
            </div>
          ))}
        </div>
      )}

      {insightFlags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {insightFlags.map((flag) => (
            <span
              key={flag.id}
              className={`rounded-lg px-2 py-1 text-[10px] ${
                flag.tone === 'positive'
                  ? 'bg-[#30D158]/12 text-[#76E596]'
                  : flag.tone === 'negative'
                  ? 'bg-[#FF453A]/12 text-[#FF9B95]'
                  : 'bg-white/[0.06] text-[#C7C7CC]'
              }`}
            >
              {flag.label}{flag.unresolved ? ' · open' : ''}
            </span>
          ))}
        </div>
      )}

      {validRows.length > 0 && (
        <div className="rounded-xl bg-[#0F1013] border border-white/[0.06] px-3.5 py-2.5 divide-y divide-white/[0.05]">
          {validRows.map((entry, idx) => (
            <div
              key={idx}
              className="py-1.5 flex items-center justify-between gap-3 text-xs"
            >
              <span className="text-[#8E8E93]">{entry.key}</span>
              <span className="text-[#F5F5F7] font-medium tabular-nums text-right">
                {/^\d+(\.\d+)?$/.test(entry.value.trim()) &&
                !entry.key.toLowerCase().includes('invoice')
                  ? `₹${Number(entry.value).toLocaleString('en-IN')}`
                  : entry.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {log.notes && (
        <p className="text-xs text-[#8E8E93] leading-relaxed">{log.notes}</p>
      )}
    </div>
  );
};
