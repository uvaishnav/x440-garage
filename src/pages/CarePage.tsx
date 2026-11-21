import React, { useEffect, useMemo, useState } from 'react';
import { BikeAnatomyMap } from '../components/BikeAnatomyMap';
import { BillReceiptCard } from '../components/BillReceiptCard';
import { BillReceiptEditor } from '../components/BillReceiptEditor';
import { AlertPulseIcon, CheckIcon, CloseIcon, PlusIcon, TrashIcon } from '../components/Icons';
import {
  X440_QUICK_SPECS,
  X440_SYMPTOM_SUGGESTIONS,
} from '../data/x440Template';
import { evaluateTaskHealth, sumBillEntries } from '../lib/calculations';
import {
  AppSettings,
  BikeIssue,
  BikeZone,
  BillEntry,
  FuelLog,
  IssueSeverity,
  MaintenanceLog,
  MaintenanceTask,
  Trip,
} from '../types';

type CareSection = 'checklist' | 'issues' | 'settings';

interface CarePageProps {
  currentOdometer: number;
  tasks: MaintenanceTask[];
  maintenanceLogs: MaintenanceLog[];
  issues: BikeIssue[];
  settings: AppSettings;
  fuelLogs: FuelLog[];
  trips: Trip[];
  preselectedTask: MaintenanceTask | null;
  onClearPreselectedTask: () => void;
  onCompleteTask: (task: MaintenanceTask, log: MaintenanceLog) => Promise<void>;
  onSaveIssue: (issue: BikeIssue) => Promise<void>;
  onResolveIssue: (id: string, note: string) => Promise<void>;
  onDeleteIssue: (id: string) => Promise<void>;
  onSaveSettings: (next: AppSettings) => Promise<void>;
  onSignOut?: () => void;
}

export const CarePage: React.FC<CarePageProps> = ({
  currentOdometer,
  tasks,
  maintenanceLogs,
  issues,
  settings,
  fuelLogs,
  trips,
  preselectedTask,
  onClearPreselectedTask,
  onCompleteTask,
  onSaveIssue,
  onResolveIssue,
  onDeleteIssue,
  onSaveSettings,
  onSignOut,
}) => {
  const [section, setSection] = useState<CareSection>('checklist');
  const [selectedZone, setSelectedZone] = useState<BikeZone | null>(null);

  // Maintenance completion sheet state
  const [activeTask, setActiveTask] = useState<MaintenanceTask | null>(null);
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logOdo, setLogOdo] = useState(String(currentOdometer || ''));
  const [billEntries, setBillEntries] = useState<BillEntry[]>([]);
  const [logNotes, setLogNotes] = useState('');

  // Issue logger sheet state
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueTitle, setIssueTitle] = useState('');
  const [issueCategory, setIssueCategory] = useState<string>(
    Object.keys(X440_SYMPTOM_SUGGESTIONS)[0]
  );
  const [issueSeverity, setIssueSeverity] = useState<IssueSeverity>('Check Soon');
  const [issueNotes, setIssueNotes] = useState('');

  // Local settings draft
  const [draftSettings, setDraftSettings] = useState<AppSettings>(settings);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    setDraftSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (preselectedTask) {
      setSection('checklist');
      openTaskModal(preselectedTask);
      onClearPreselectedTask();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedTask]);

  const openTaskModal = (task: MaintenanceTask) => {
    setActiveTask(task);
    setLogDate(new Date().toISOString().slice(0, 10));
    setLogOdo(String(currentOdometer || ''));
    setBillEntries([]);
    setLogNotes('');
  };

  const healthList = useMemo(
    () => tasks.map((t) => evaluateTaskHealth(t, currentOdometer)),
    [tasks, currentOdometer]
  );

  const visibleHealth = selectedZone
    ? healthList.filter((h) => h.task.zone === selectedZone)
    : healthList;

  const handleSaveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask) return;
    const odo = parseFloat(logOdo) || currentOdometer;
    const cleanedEntries = billEntries.filter(
      (b) => b.key.trim() !== '' || b.value.trim() !== ''
    );
    const totalCost = sumBillEntries(cleanedEntries);

    const log: MaintenanceLog = {
      id: `maint-${Date.now()}`,
      taskId: activeTask.id,
      taskTitle: activeTask.title,
      date: logDate,
      odometer: odo,
      totalCost,
      billEntries: cleanedEntries,
      notes: logNotes.trim() || undefined,
      createdAt: Date.now(),
    };
    await onCompleteTask(activeTask, log);
    setActiveTask(null);
  };

  const handleAddIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueTitle.trim()) return;
    const newIssue: BikeIssue = {
      id: `issue-${Date.now()}`,
      title: issueTitle.trim(),
      symptomCategory: issueCategory,
      severity: issueSeverity,
      odometer: currentOdometer,
      date: new Date().toISOString().slice(0, 10),
      notes: issueNotes.trim() || undefined,
      suggestedChecks: X440_SYMPTOM_SUGGESTIONS[issueCategory] || [],
      status: 'open',
      createdAt: Date.now(),
    };
    await onSaveIssue(newIssue);
    setIssueTitle('');
    setIssueNotes('');
    setShowIssueForm(false);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings(draftSettings);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  };

  const handleExportBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      settings,
      fuelLogs,
      trips,
      tasks,
      maintenanceLogs,
      issues,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `x440-garage-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openIssues = issues.filter((i) => i.status === 'open');
  const resolvedIssues = issues.filter((i) => i.status === 'resolved');

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] uppercase tracking-[0.24em] text-[#FF6600] font-semibold">
          X440 Ownership
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#F5F5F7]">
          Care & Service
        </h1>
      </header>

      {/* iOS Segmented Control */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#141518] border border-white/[0.08]">
        {(
          [
            ['checklist', 'Checklist'],
            ['issues', `Issues${openIssues.length ? ` (${openIssues.length})` : ''}`],
            ['settings', 'Specs & Rates'],
          ] as [CareSection, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`h-9 rounded-xl text-xs font-semibold transition-colors ${
              section === key
                ? 'bg-[#262830] text-[#F5F5F7]'
                : 'text-[#8E8E93]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* SECTION 1: INTERACTIVE BIKE MAP + MAINTENANCE CHECKLIST + DIGITAL RECEIPTS */}
      {section === 'checklist' && (
        <div className="space-y-5">
          <BikeAnatomyMap
            taskHealthList={healthList}
            selectedZone={selectedZone}
            onSelectZone={setSelectedZone}
          />

          <div className="space-y-2.5">
            {visibleHealth.map((h) => {
              const badgeColor =
                h.status === 'overdue'
                  ? 'text-[#FF453A] bg-[#FF453A]/15'
                  : h.status === 'soon'
                  ? 'text-[#FFD60A] bg-[#FFD60A]/15'
                  : 'text-[#30D158] bg-[#30D158]/15';

              return (
                <div
                  key={h.task.id}
                  className="rounded-2xl bg-[#141518] border border-white/[0.08] p-4 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-[#8E8E93] font-medium">
                        {h.task.category} · Every {h.task.intervalKm.toLocaleString('en-IN')} km / {h.task.intervalDays}d
                      </span>
                      <h3 className="text-sm font-semibold text-[#F5F5F7] mt-0.5">
                        {h.task.title}
                      </h3>
                    </div>
                    <span
                      className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold tabular-nums ${badgeColor}`}
                    >
                      {h.remainingKm !== null
                        ? h.remainingKm <= 0
                          ? `${Math.abs(h.remainingKm)} km over`
                          : `${h.remainingKm} km`
                        : 'Init'}
                    </span>
                  </div>

                  <p className="text-xs text-[#8E8E93] leading-relaxed">
                    {h.task.description}
                  </p>

                  {/* Progress Bar */}
                  <div className="h-1.5 w-full rounded-full bg-[#1F2126] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        h.status === 'overdue'
                          ? 'bg-[#FF453A]'
                          : h.status === 'soon'
                          ? 'bg-[#FF6600]'
                          : 'bg-[#30D158]'
                      }`}
                      style={{ width: `${h.progressPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-[#636366] tabular-nums">
                      {h.task.lastDoneDate
                        ? `Last: ${h.task.lastDoneDate} @ ${h.task.lastDoneOdometer?.toLocaleString('en-IN')} km`
                        : 'Not logged yet'}
                    </span>
                    <button
                      onClick={() => openTaskModal(h.task)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#FF6600] text-white text-xs font-semibold active:scale-95"
                    >
                      Mark Done
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Digital Service Bill Receipts */}
          {maintenanceLogs.length > 0 && (
            <section className="space-y-2.5 pt-2">
              <h2 className="text-sm font-semibold text-[#F5F5F7] px-1">
                Service Receipts & History
              </h2>
              {maintenanceLogs.map((log) => (
                <BillReceiptCard key={log.id} log={log} />
              ))}
            </section>
          )}
        </div>
      )}

      {/* SECTION 2: ISSUES & SYMPTOMS LOG (SERVICE HANDOVER) */}
      {section === 'issues' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#8E8E93]">
              Log issues as soon as you feel them to hand over at your next service.
            </p>
            <button
              onClick={() => setShowIssueForm(true)}
              className="shrink-0 h-9 px-3.5 rounded-xl bg-[#FF6600] text-white text-xs font-semibold flex items-center gap-1 active:scale-95"
            >
              <PlusIcon className="w-3.5 h-3.5" /> Log Issue
            </button>
          </div>

          {openIssues.length === 0 ? (
            <div className="rounded-2xl bg-[#141518] border border-white/[0.08] p-6 text-center text-xs text-[#8E8E93]">
              No open issues logged. Your X440 is running clean.
            </div>
          ) : (
            <div className="space-y-3">
              {openIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="rounded-2xl bg-[#141518] border border-white/[0.08] p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <AlertPulseIcon
                        className={`w-5 h-5 mt-0.5 shrink-0 ${
                          issue.severity === 'Urgent'
                            ? 'text-[#FF453A]'
                            : issue.severity === 'Check Soon'
                            ? 'text-[#FFD60A]'
                            : 'text-[#8E8E93]'
                        }`}
                      />
                      <div>
                        <p className="text-sm font-semibold text-[#F5F5F7]">
                          {issue.title}
                        </p>
                        <p className="text-[11px] text-[#8E8E93] tabular-nums mt-0.5">
                          {issue.symptomCategory} · {issue.date} @ {issue.odometer.toLocaleString('en-IN')} km
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => onDeleteIssue(issue.id)}
                      className="p-1.5 text-[#636366] hover:text-[#FF453A]"
                      aria-label="Delete issue"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>

                  {issue.notes && (
                    <p className="text-xs text-[#F5F5F7]/85">{issue.notes}</p>
                  )}

                  {issue.suggestedChecks.length > 0 && (
                    <div className="rounded-xl bg-[#0F1013] border border-white/[0.06] p-3 space-y-1">
                      <p className="text-[10px] uppercase tracking-wider text-[#FF6600] font-semibold">
                        X440 Quick Checks
                      </p>
                      {issue.suggestedChecks.map((s, idx) => (
                        <p key={idx} className="text-xs text-[#8E8E93]">
                          • {s}
                        </p>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => onResolveIssue(issue.id, 'Fixed at service')}
                    className="w-full h-10 rounded-xl bg-[#1F2126] border border-white/[0.08] text-xs font-semibold text-[#30D158] flex items-center justify-center gap-1.5 active:scale-[0.99]"
                  >
                    <CheckIcon className="w-4 h-4" /> Mark Resolved
                  </button>
                </div>
              ))}
            </div>
          )}

          {resolvedIssues.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-semibold text-[#636366] px-1">
                Resolved History ({resolvedIssues.length})
              </p>
              {resolvedIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="rounded-xl bg-[#141518]/60 border border-white/[0.05] px-4 py-3 flex items-center justify-between text-xs"
                >
                  <span className="text-[#8E8E93] line-through">{issue.title}</span>
                  <span className="text-[#30D158] tabular-nums">{issue.resolvedDate}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: PETROL RATES, X440 QUICK SPECS & SETTINGS */}
      {section === 'settings' && (
        <div className="space-y-5">
          {/* Default Petrol Rates */}
          <form
            onSubmit={handleSaveSettings}
            className="rounded-[24px] bg-[#141518] border border-white/[0.08] p-4 space-y-4"
          >
            <div>
              <h2 className="text-sm font-semibold text-[#F5F5F7]">
                Default Petrol Rates (₹ / Litre)
              </h2>
              <p className="text-[11px] text-[#8E8E93] mt-0.5">
                Auto-filled on every fuel log; still editable on highway trips.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {(['Regular', 'XP95', 'Power'] as const).map((grade) => (
                <div
                  key={grade}
                  className="rounded-xl bg-[#1F2126] border border-white/[0.08] p-2.5"
                >
                  <label className="text-[10px] uppercase tracking-wider text-[#8E8E93] block">
                    {grade}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={draftSettings.fuelRates[grade]}
                    onChange={(e) =>
                      setDraftSettings({
                        ...draftSettings,
                        fuelRates: {
                          ...draftSettings.fuelRates,
                          [grade]: parseFloat(e.target.value) || 0,
                        },
                      })
                    }
                    className="w-full bg-transparent text-base font-semibold text-[#F5F5F7] tabular-nums mt-1 focus:outline-none"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-[#8E8E93] block mb-1">
                  Insurance Expiry
                </label>
                <input
                  type="date"
                  value={draftSettings.insuranceExpiry}
                  onChange={(e) =>
                    setDraftSettings({ ...draftSettings, insuranceExpiry: e.target.value })
                  }
                  className="w-full h-11 px-3 rounded-xl bg-[#1F2126] border border-white/[0.08] text-xs text-[#F5F5F7] tabular-nums"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#8E8E93] block mb-1">
                  PUC Expiry
                </label>
                <input
                  type="date"
                  value={draftSettings.pucExpiry}
                  onChange={(e) =>
                    setDraftSettings({ ...draftSettings, pucExpiry: e.target.value })
                  }
                  className="w-full h-11 px-3 rounded-xl bg-[#1F2126] border border-white/[0.08] text-xs text-[#F5F5F7] tabular-nums"
                />
              </div>
            </div>

            <label className="flex items-center justify-between rounded-xl bg-[#1F2126] px-3.5 py-3 text-xs">
              <div>
                <p className="text-[#F5F5F7] font-medium">Timeline Fallback Filter</p>
                <p className="text-[11px] text-[#8E8E93]">
                  Include rides Google mislabeled as Driving
                </p>
              </div>
              <input
                type="checkbox"
                checked={draftSettings.includeAmbiguousDriving}
                onChange={(e) =>
                  setDraftSettings({
                    ...draftSettings,
                    includeAmbiguousDriving: e.target.checked,
                  })
                }
                className="accent-[#FF6600] w-4 h-4"
              />
            </label>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#FF6600] text-white text-sm font-semibold active:scale-[0.99]"
            >
              {savedToast ? 'Settings Saved' : 'Save Settings'}
            </button>
          </form>

          {/* X440 Manual Quick Specs */}
          <div className="rounded-[24px] bg-[#141518] border border-white/[0.08] p-4 space-y-2.5">
            <h2 className="text-sm font-semibold text-[#F5F5F7]">
              X440 Manual Quick Reference
            </h2>
            <div className="divide-y divide-white/[0.06]">
              {X440_QUICK_SPECS.map((spec) => (
                <div
                  key={spec.label}
                  className="py-2.5 flex items-center justify-between text-xs"
                >
                  <span className="text-[#8E8E93]">{spec.label}</span>
                  <span className="text-[#F5F5F7] font-medium tabular-nums">
                    {spec.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Export & Account */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleExportBackup}
              className="h-11 rounded-xl bg-[#141518] border border-white/[0.08] text-xs font-semibold text-[#F5F5F7]"
            >
              Export JSON Backup
            </button>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="h-11 rounded-xl bg-[#141518] border border-[#FF453A]/30 text-xs font-semibold text-[#FF453A]"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      )}

      {/* MARK MAINTENANCE DONE + KEY-VALUE BILL EDITOR SHEET */}
      {activeTask && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#141518] border-t border-white/10 rounded-t-[28px] max-h-[90vh] overflow-y-auto p-5 space-y-4 animate-sheet-up safe-bottom">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#FF6600] font-semibold">
                  Log Completed Care
                </p>
                <h3 className="text-base font-semibold text-[#F5F5F7]">
                  {activeTask.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveTask(null)}
                className="w-8 h-8 rounded-full bg-[#1F2126] flex items-center justify-center text-[#8E8E93]"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMaintenance} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#8E8E93] block mb-1">
                    Odometer (km)
                  </label>
                  <input
                    type="number"
                    required
                    value={logOdo}
                    onChange={(e) => setLogOdo(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-[#1F2126] border border-white/[0.08] text-sm text-[#F5F5F7] tabular-nums focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#8E8E93] block mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-[#1F2126] border border-white/[0.08] text-sm text-[#F5F5F7] tabular-nums focus:outline-none focus:border-[#FF6600]"
                  />
                </div>
              </div>

              <BillReceiptEditor entries={billEntries} onChange={setBillEntries} />

              <textarea
                rows={2}
                placeholder="Notes (optional — e.g., Motul 15W-50 used, chain slack adjusted)"
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#1F2126] border border-white/[0.08] text-sm text-[#F5F5F7] placeholder:text-[#636366] focus:outline-none focus:border-[#FF6600]"
              />

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-[#FF6600] text-white font-semibold text-sm"
              >
                Save Maintenance Log
              </button>
            </form>
          </div>
        </div>
      )}

      {/* LOG ISSUE SHEET */}
      {showIssueForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#141518] border-t border-white/10 rounded-t-[28px] p-5 space-y-4 animate-sheet-up safe-bottom">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#F5F5F7]">
                Log Bike Symptom
              </h3>
              <button
                onClick={() => setShowIssueForm(false)}
                className="w-8 h-8 rounded-full bg-[#1F2126] flex items-center justify-center text-[#8E8E93]"
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddIssue} className="space-y-3.5">
              <input
                type="text"
                required
                placeholder="What did you notice? (e.g. Rear brake squeak at low speed)"
                value={issueTitle}
                onChange={(e) => setIssueTitle(e.target.value)}
                className="w-full h-12 px-3.5 rounded-xl bg-[#1F2126] border border-white/[0.08] text-sm text-[#F5F5F7] placeholder:text-[#636366] focus:outline-none focus:border-[#FF6600]"
              />

              <div>
                <label className="text-[11px] text-[#8E8E93] block mb-1">
                  Symptom Type (auto-attaches X440 checks)
                </label>
                <select
                  value={issueCategory}
                  onChange={(e) => setIssueCategory(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-[#1F2126] border border-white/[0.08] text-sm text-[#F5F5F7]"
                >
                  {Object.keys(X440_SYMPTOM_SUGGESTIONS).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(['Minor', 'Check Soon', 'Urgent'] as IssueSeverity[]).map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setIssueSeverity(sev)}
                    className={`h-10 rounded-xl text-xs font-semibold border ${
                      issueSeverity === sev
                        ? 'bg-[#FF6600]/20 border-[#FF6600] text-[#F5F5F7]'
                        : 'bg-[#1F2126] border-white/[0.06] text-[#8E8E93]'
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>

              <textarea
                rows={2}
                placeholder="Extra details (speed, gear, sound)..."
                value={issueNotes}
                onChange={(e) => setIssueNotes(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#1F2126] border border-white/[0.08] text-sm text-[#F5F5F7] placeholder:text-[#636366]"
              />

              <button
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-[#FF6600] text-white font-semibold text-sm"
              >
                Save to Service Handover List
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
