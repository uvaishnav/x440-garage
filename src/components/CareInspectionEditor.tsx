import React, { useMemo } from 'react';
import {
  buildCareLogResult,
  careTemplateFor,
  CareFieldDefinition,
  CareFormValues,
} from '../data/careLogTemplates';

interface CareInspectionEditorProps {
  templateId?: string;
  values: CareFormValues;
  onChange: (next: CareFormValues) => void;
}

export const CareInspectionEditor: React.FC<CareInspectionEditorProps> = ({
  templateId,
  values,
  onChange,
}) => {
  const template = careTemplateFor(templateId);
  const preview = useMemo(
    () => buildCareLogResult(templateId, values, false),
    [templateId, values]
  );

  if (!template) return null;

  const update = (
    fieldId: string,
    key: 'value' | 'before' | 'after',
    value: string
  ) => {
    onChange({
      ...values,
      [fieldId]: { ...values[fieldId], [key]: value },
    });
  };

  const input = (
    field: CareFieldDefinition,
    key: 'value' | 'before' | 'after',
    ariaLabel: string
  ) => {
    const value = values[field.id]?.[key] || '';
    if (field.kind === 'select') {
      return (
        <select
          aria-label={ariaLabel}
          value={value}
          onChange={(event) => update(field.id, key, event.target.value)}
          className="field h-11"
        >
          <option value="">Select…</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      );
    }
    return (
      <div className="relative">
        <input
          aria-label={ariaLabel}
          type={field.kind === 'number' ? 'number' : 'text'}
          inputMode={field.kind === 'number' ? 'decimal' : undefined}
          step={field.kind === 'number' ? 'any' : undefined}
          value={value}
          onChange={(event) => update(field.id, key, event.target.value)}
          placeholder={field.placeholder}
          className={`field h-11 ${field.unit ? 'pr-12' : ''}`}
        />
        {field.unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#A7A7AD] pointer-events-none">
            {field.unit}
          </span>
        )}
      </div>
    );
  };

  return (
    <section className="space-y-3" aria-label={template.title}>
      <div>
        <h4 className="text-sm font-semibold text-[#F5F5F7]">{template.title}</h4>
        <p className="mt-1 text-[11px] leading-relaxed text-[#A7A7AD]">{template.guidance}</p>
      </div>

      <div className="divide-y divide-white/[0.07] rounded-xl bg-[#1F2126] px-3.5">
        {template.fields.map((field) => (
          <div key={field.id} className="py-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <label className="text-xs font-medium text-[#E5E5E8]">
                {field.label}{field.required ? <span className="text-[#FF8A32]"> *</span> : null}
              </label>
              {(field.target?.label || field.helper) && (
                <span className="max-w-[55%] text-right text-[10px] leading-snug text-[#8E8E93]">
                  {field.target?.label || field.helper}
                </span>
              )}
            </div>

            {field.mode === 'before-after' ? (
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <span className="text-[10px] text-[#8E8E93]">Before</span>
                  {input(field, 'before', `${field.label} before`)}
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-[#8E8E93]">After</span>
                  {input(field, 'after', `${field.label} after`)}
                </div>
              </div>
            ) : (
              input(field, 'value', field.label)
            )}
          </div>
        ))}
      </div>

      {preview.insightFlags.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Recorded condition signals">
          {preview.insightFlags.map((flag) => (
            <span
              key={flag.id}
              className={`rounded-lg px-2 py-1 text-[10px] leading-snug ${
                flag.tone === 'positive'
                  ? 'bg-[#30D158]/12 text-[#76E596]'
                  : flag.tone === 'negative'
                  ? 'bg-[#FF453A]/12 text-[#FF9B95]'
                  : 'bg-white/[0.06] text-[#C7C7CC]'
              }`}
            >
              {flag.label}{flag.unresolved ? ' · needs attention' : ''}
            </span>
          ))}
        </div>
      )}
    </section>
  );
};
