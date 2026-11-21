import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BikeAnatomyMap } from '../components/BikeAnatomyMap';
import { BillReceiptCard } from '../components/BillReceiptCard';
import { BillReceiptEditor } from '../components/BillReceiptEditor';
import { CareInspectionEditor } from '../components/CareInspectionEditor';
import { AlertPulseIcon, CareIcon, CheckIcon, CloseIcon, PlusIcon, TrashIcon } from '../components/Icons';
import { BIKE_EVENT_TEMPLATES } from '../data/bikeEventTemplates';
import {
  buildCareLogResult,
  careTemplateFor,
  CareFormValues,
} from '../data/careLogTemplates';
import {
  X440_QUICK_SPECS,
  X440_SYMPTOM_SUGGESTIONS,
} from '../data/x440Template';
import { evaluateTaskHealth, sumBillEntries } from '../lib/calculations';
import { localDateInputValue } from '../lib/date';
import {
  AppSettings,
  BikeEvent,
  BikeIssue,
  BikeZone,
  BillEntry,
  CareInsightFlag,
  ExpenseCategory,
  ExpenseLog,
  FuelLog,
  GarageBackup,
  IssueSeverity,
  MaintenanceLog,
  MaintenanceTask,
  Trip,
  TimelineRide,
} from '../types';

type CareSection = 'checklist' | 'issues' | 'service' | 'settings';

interface CarePageProps {
  currentOdometer: number;
  tasks: MaintenanceTask[];
  maintenanceLogs: MaintenanceLog[];
  issues: BikeIssue[];
  settings: AppSettings;
  fuelLogs: FuelLog[];
  trips: Trip[];
  expenses: ExpenseLog[];
  bikeEvents: BikeEvent[];
  timelineRides: TimelineRide[];
  preselectedTask: MaintenanceTask | null;
  onClearPreselectedTask: () => void;
  onCompleteTask: (task: MaintenanceTask, log: MaintenanceLog) => Promise<void>;
  onSaveTask: (task: MaintenanceTask) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onFlagRain: () => Promise<void>;
  onSaveIssue: (issue: BikeIssue) => Promise<void>;
  onResolveIssue: (id: string, note: string) => Promise<void>;
  onDeleteIssue: (id: string) => Promise<void>;
  onSaveExpense: (expense: ExpenseLog) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
  onSaveBikeEvent: (event: BikeEvent) => Promise<void>;
  onDeleteBikeEvent: (event: BikeEvent) => Promise<void>;
  onImportBackup: (backup: GarageBackup) => Promise<void>;
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
  expenses,
  bikeEvents,
  timelineRides,
  preselectedTask,
  onClearPreselectedTask,
  onCompleteTask,
  onSaveTask,
  onDeleteTask,
  onFlagRain,
  onSaveIssue,
  onResolveIssue,
  onDeleteIssue,
  onSaveExpense,
  onDeleteExpense,
  onSaveBikeEvent,
  onDeleteBikeEvent,
  onImportBackup,
  onSaveSettings,
  onSignOut,
}) => {
  const [section, setSection] = useState<CareSection>('checklist');
  const [selectedZone, setSelectedZone] = useState<BikeZone | null>(null);

  // Maintenance completion sheet state
  const [activeTask, setActiveTask] = useState<MaintenanceTask | null>(null);
  const [logDate, setLogDate] = useState(localDateInputValue());
  const [logOdo, setLogOdo] = useState(String(currentOdometer || ''));
  const [billEntries, setBillEntries] = useState<BillEntry[]>([]);
  const [logNotes, setLogNotes] = useState('');
  const [logCareValues, setLogCareValues] = useState<CareFormValues>({});
  const [logCareError, setLogCareError] = useState('');
  const [showTaskEditor, setShowTaskEditor] = useState(false);
  const [editingTask, setEditingTask] = useState<MaintenanceTask | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskIntervalKm, setTaskIntervalKm] = useState('1000');
  const [taskIntervalDays, setTaskIntervalDays] = useState('30');
  const [taskZone, setTaskZone] = useState<BikeZone>('engine');
  const [taskCategory, setTaskCategory] = useState<MaintenanceTask['category']>('Routine DIY');
  const [taskEnabled, setTaskEnabled] = useState(true);

  // Issue logger sheet state
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueTitle, setIssueTitle] = useState('');
  const [issueCategory, setIssueCategory] = useState<string>(
    Object.keys(X440_SYMPTOM_SUGGESTIONS)[0]
  );
  const [issueSeverity, setIssueSeverity] = useState<IssueSeverity>('Check Soon');
  const [issueNotes, setIssueNotes] = useState('');
  const [issueOdometer, setIssueOdometer] = useState(String(currentOdometer || ''));
  const [issueDate, setIssueDate] = useState(localDateInputValue());
  const [editingIssue, setEditingIssue] = useState<BikeIssue | null>(null);
  const [resolvingIssue, setResolvingIssue] = useState<BikeIssue | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('Accessory');
  const [expenseDate, setExpenseDate] = useState(localDateInputValue());
  const [expenseNotes, setExpenseNotes] = useState('');

  // Bike event logger state
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventTemplateId, setEventTemplateId] = useState('periodic-service');
  const [eventCustomTitle, setEventCustomTitle] = useState('');
  const [eventDate, setEventDate] = useState(localDateInputValue());
  const [eventOdometer, setEventOdometer] = useState(String(currentOdometer || ''));
  const [eventWorkshop, setEventWorkshop] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [eventBillEntries, setEventBillEntries] = useState<BillEntry[]>([]);
  const [eventCareValues, setEventCareValues] = useState<CareFormValues>({});
  const [eventTaskIds, setEventTaskIds] = useState<string[]>([]);
  const [eventSaving, setEventSaving] = useState(false);
  const [eventError, setEventError] = useState('');

  // Local settings draft
  const [draftSettings, setDraftSettings] = useState<AppSettings>(settings);
  const [savedToast, setSavedToast] = useState(false);
  const [backupStatus, setBackupStatus] = useState('');
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraftSettings(settings);
  }, [settings]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [section]);

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
    setLogDate(localDateInputValue());
    setLogOdo(String(currentOdometer || ''));
    setBillEntries([]);
    setLogNotes('');
    setLogCareValues({});
    setLogCareError('');
  };

  const healthList = useMemo(
    () => tasks.filter((task) => task.enabled !== false).map((t) => evaluateTaskHealth(t, currentOdometer)),
    [tasks, currentOdometer]
  );

  const visibleHealth = selectedZone
    ? healthList.filter((h) => h.task.zone === selectedZone)
    : healthList;

  const selectEventTemplate = (templateId: string) => {
    const template = BIKE_EVENT_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    setEventTemplateId(templateId);
    setEventCustomTitle('');
    setEventCareValues({});
    setEventError('');
    setEventTaskIds(
      template.selectDueTasks
        ? healthList
            .filter((health) => {
              const latestLog = [...maintenanceLogs]
                .filter((log) => log.taskId === health.task.id)
                .sort(
                  (a, b) =>
                    b.odometer - a.odometer ||
                    b.date.localeCompare(a.date) ||
                    b.createdAt - a.createdAt
                )[0];
              const hasOpenFinding = (latestLog?.insightFlags || []).some(
                (flag) => flag.unresolved
              );
              return (
                hasOpenFinding ||
                health.status === 'overdue' ||
                (health.status === 'soon' &&
                  (health.remainingKm !== null || health.remainingDays !== null))
              );
            })
            .map((health) => health.task.id)
        : template.taskIds.filter((id) => tasks.some((task) => task.id === id))
    );
  };

  const openEventLogger = () => {
    selectEventTemplate('periodic-service');
    setEventDate(localDateInputValue());
    setEventOdometer(String(currentOdometer || ''));
    setEventWorkshop('');
    setEventNotes('');
    setEventBillEntries([]);
    setEventCareValues({});
    setEventError('');
    setShowEventForm(true);
  };

  const handleSaveBikeEvent = async (submitEvent: React.FormEvent) => {
    submitEvent.preventDefault();
    const template = BIKE_EVENT_TEMPLATES.find((item) => item.id === eventTemplateId);
    if (!template) return;
    const title = eventTemplateId === 'one-time' ? eventCustomTitle.trim() : template.label;
    const odometer = parseFloat(eventOdometer) || 0;
    if (!title || odometer <= 0) {
      setEventError('Add an event name and a valid odometer reading.');
      return;
    }

    const careResult = buildCareLogResult(
      template.careTemplateId,
      eventCareValues
    );
    if (careResult.missingFields.length > 0) {
      setEventError(`Complete: ${careResult.missingFields.join(', ')}.`);
      return;
    }
    const serviceFlags: CareInsightFlag[] = template.serviceAssumption
      ? [{
          id: 'periodic-service-complete',
          label: 'Periodic service completed; selected items assumed restored',
          tone: 'positive',
          affectsMileage: true,
          unresolved: false,
        }]
      : [];

    const cleanedEntries = eventBillEntries.filter(
      (entry) => entry.key.trim() !== '' || entry.value.trim() !== ''
    );
    const event: BikeEvent = {
      id: `event-${Date.now()}`,
      templateId: template.id,
      kind: template.kind,
      title,
      date: eventDate,
      odometer,
      workshop: eventWorkshop.trim() || undefined,
      notes: eventNotes.trim() || undefined,
      completedTaskIds: eventTaskIds,
      careTaskId: tasks.some((task) => task.id === template.careTemplateId)
        ? template.careTemplateId
        : undefined,
      careTemplateId: template.careTemplateId,
      observations: careResult.observations,
      insightFlags: [...serviceFlags, ...careResult.insightFlags],
      billEntries: cleanedEntries,
      totalCost: sumBillEntries(cleanedEntries),
      createdAt: Date.now(),
    };

    setEventSaving(true);
    setEventError('');
    try {
      await onSaveBikeEvent(event);
      setShowEventForm(false);
      setSection('service');
    } catch (error) {
      setEventError(error instanceof Error ? error.message : 'Could not save this bike event.');
    } finally {
      setEventSaving(false);
    }
  };

  const handleSaveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask) return;
    const odo = parseFloat(logOdo) || currentOdometer;
    const careResult = buildCareLogResult(activeTask.id, logCareValues);
    if (careResult.missingFields.length > 0) {
      setLogCareError(`Complete: ${careResult.missingFields.join(', ')}.`);
      return;
    }
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
      careTemplateId: careTemplateFor(activeTask.id)?.id,
      observations: careResult.observations,
      insightFlags: careResult.insightFlags,
      createdAt: Date.now(),
    };
    await onCompleteTask(activeTask, log);
    setActiveTask(null);
  };

  const openTaskEditor = (task?: MaintenanceTask) => {
    setEditingTask(task || null);
    setTaskTitle(task?.title || '');
    setTaskDescription(task?.description || '');
    setTaskIntervalKm(String(task?.intervalKm ?? 1000));
    setTaskIntervalDays(String(task?.intervalDays ?? 30));
    setTaskZone(task?.zone || 'engine');
    setTaskCategory(task?.category || 'Routine DIY');
    setTaskEnabled(task?.enabled !== false);
    setShowTaskEditor(true);
  };

  const handleSaveTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    const task: MaintenanceTask = {
      id: editingTask?.id || `custom-${Date.now()}`,
      title: taskTitle.trim(),
      category: taskCategory,
      zone: taskZone,
      intervalKm: Math.max(1, parseFloat(taskIntervalKm) || 1),
      intervalDays: Math.max(1, parseFloat(taskIntervalDays) || 1),
      description: taskDescription.trim(),
      enabled: taskEnabled,
      isCustom: editingTask?.isCustom ?? true,
      lastDoneOdometer: editingTask?.lastDoneOdometer ?? null,
      lastDoneDate: editingTask?.lastDoneDate ?? null,
      dueNowReason: editingTask?.dueNowReason,
    };
    await onSaveTask(task);
    setShowTaskEditor(false);
  };

  const handleAddIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueTitle.trim()) return;
    const newIssue: BikeIssue = {
      id: editingIssue?.id || `issue-${Date.now()}`,
      title: issueTitle.trim(),
      symptomCategory: issueCategory,
      severity: issueSeverity,
      odometer: parseFloat(issueOdometer) || currentOdometer,
      date: issueDate,
      notes: issueNotes.trim() || undefined,
      suggestedChecks: X440_SYMPTOM_SUGGESTIONS[issueCategory] || [],
      status: editingIssue?.status || 'open',
      resolvedDate: editingIssue?.resolvedDate,
      resolutionNote: editingIssue?.resolutionNote,
      createdAt: editingIssue?.createdAt || Date.now(),
    };
    await onSaveIssue(newIssue);
    setIssueTitle('');
    setIssueNotes('');
    setEditingIssue(null);
    setShowIssueForm(false);
  };

  const openIssueEditor = (issue?: BikeIssue) => {
    setEditingIssue(issue || null);
    setIssueTitle(issue?.title || '');
    setIssueCategory(issue?.symptomCategory || Object.keys(X440_SYMPTOM_SUGGESTIONS)[0]);
    setIssueSeverity(issue?.severity || 'Check Soon');
    setIssueNotes(issue?.notes || '');
    setIssueOdometer(String(issue?.odometer ?? currentOdometer ?? ''));
    setIssueDate(issue?.date || localDateInputValue());
    setShowIssueForm(true);
  };

  const handleResolveIssue = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resolvingIssue || !resolutionNote.trim()) return;
    await onResolveIssue(resolvingIssue.id, resolutionNote.trim());
    setResolvingIssue(null);
    setResolutionNote('');
  };

  const handleSaveExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = parseFloat(expenseAmount) || 0;
    if (!expenseTitle.trim() || amount <= 0) return;
    await onSaveExpense({
      id: `expense-${Date.now()}`,
      date: expenseDate,
      odometer: currentOdometer || undefined,
      category: expenseCategory,
      title: expenseTitle.trim(),
      amount,
      notes: expenseNotes.trim() || undefined,
      createdAt: Date.now(),
    });
    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseNotes('');
    setShowExpenseForm(false);
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
      timelineRides,
      expenses,
      bikeEvents,
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

  const downloadText = (name: string, text: string, type: string) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const careDetails = (record: Pick<MaintenanceLog, 'observations' | 'insightFlags' | 'notes'>) => [
    ...(record.observations || []).map((observation) =>
      observation.mode === 'before-after'
        ? `${observation.label}: ${observation.beforeLabel || '—'} -> ${observation.afterLabel || '—'}`
        : `${observation.label}: ${observation.valueLabel || observation.value || '—'}`
    ),
    ...(record.insightFlags || []).map((flag) =>
      `${flag.tone}${flag.unresolved ? '/open' : ''}: ${flag.label}`
    ),
    record.notes || '',
  ].filter(Boolean).join(' | ');

  const handleExportCsv = () => {
    const rows: unknown[][] = [['record_type', 'date', 'odometer', 'title', 'amount', 'details']];
    fuelLogs.forEach((log) => rows.push(['fuel', log.date, log.odometer, `${log.fuelGrade} · ${log.bunkName}`, log.totalCost, `${log.litres} L · ${log.rideMix} · ${log.isFullTank ? 'full' : 'partial'}`]));
    trips.forEach((trip) => rows.push(['trip', trip.startDate, trip.startOdometer, trip.name, '', `${trip.status} · expected ${trip.expectedKm} km · end ${trip.endOdometer || ''}`]));
    maintenanceLogs.forEach((log) => rows.push(['maintenance', log.date, log.odometer, log.taskTitle, log.totalCost, careDetails(log)]));
    bikeEvents.forEach((event) => rows.push(['bike_event', event.date, event.odometer, event.title, event.totalCost, `${event.kind} · ${event.workshop || ''} · ${careDetails(event)}`]));
    issues.forEach((issue) => rows.push(['issue', issue.date, issue.odometer, issue.title, '', `${issue.severity} · ${issue.status} · ${issue.notes || ''}`]));
    expenses.forEach((expense) => rows.push(['expense', expense.date, expense.odometer || '', expense.title, expense.amount, `${expense.category} · ${expense.notes || ''}`]));
    downloadText(
      `x440-garage-all-data-${localDateInputValue()}.csv`,
      rows.map((row) => row.map(csvCell).join(',')).join('\n'),
      'text/csv;charset=utf-8'
    );
  };

  const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBackupStatus('Restoring backup…');
    try {
      const parsed = JSON.parse(await file.text()) as GarageBackup;
      await onImportBackup(parsed);
      setBackupStatus('Backup restored. Existing records with matching IDs were updated.');
    } catch (error) {
      setBackupStatus(error instanceof Error ? error.message : 'Could not restore this backup.');
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = '';
    }
  };

  const openIssues = issues.filter((i) => i.status === 'open');
  const resolvedIssues = issues.filter((i) => i.status === 'resolved');
  const serviceOdometer = settings.nextServiceOdometer && settings.nextServiceOdometer > currentOdometer
    ? settings.nextServiceOdometer
    : currentOdometer + 1000;
  const dueForService = healthList.filter((health) =>
    health.status === 'overdue' ||
    (health.remainingKm != null && health.remainingKm <= serviceOdometer - currentOdometer) ||
    (health.remainingDays != null && health.remainingDays <= 30)
  );
  const latestTaskLogs = new Map<string, MaintenanceLog>();
  [...maintenanceLogs]
    .sort(
      (a, b) =>
        b.odometer - a.odometer ||
        b.date.localeCompare(a.date) ||
        b.createdAt - a.createdAt
    )
    .forEach((log) => {
      if (!latestTaskLogs.has(log.taskId)) latestTaskLogs.set(log.taskId, log);
    });
  const unresolvedFindings = tasks.flatMap((task) => {
    const log = latestTaskLogs.get(task.id);
    if (!log) return [];
    return (log.insightFlags || [])
      .filter((flag) => flag.unresolved)
      .map((flag) => ({ task, log, flag }));
  });
  const unresolvedStandaloneEvents = bikeEvents.flatMap((event) =>
    event.careTaskId
      ? []
      : (event.insightFlags || [])
          .filter((flag) => flag.unresolved)
          .map((flag) => ({ event, flag }))
  );
  const unresolvedConditionCount =
    unresolvedFindings.length + unresolvedStandaloneEvents.length;
  const serviceTotal =
    maintenanceLogs.reduce((sum, log) => sum + log.totalCost, 0) +
    bikeEvents.reduce((sum, event) => sum + event.totalCost, 0);
  const otherExpenseTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const selectedEventTemplate =
    BIKE_EVENT_TEMPLATES.find((template) => template.id === eventTemplateId) ||
    BIKE_EVENT_TEMPLATES[0];

  const shareServiceHandover = async () => {
    const lines = [
      `${settings.bikeName} service handover`,
      `Current odometer: ${currentOdometer} km`,
      `Next service target: ${serviceOdometer} km`,
      '',
      'Maintenance due:',
      ...(dueForService.length
        ? dueForService.map((item) => `• ${item.task.title}`)
        : ['• None currently due from recorded baselines']),
      '',
      'Measured findings still out of range:',
      ...(
        unresolvedFindings.length || unresolvedStandaloneEvents.length
          ? [
              ...unresolvedFindings.map(
                ({ task, log, flag }) =>
                  `• ${task.title}: ${flag.label} (${log.date} @ ${log.odometer} km)`
              ),
              ...unresolvedStandaloneEvents.map(
                ({ event, flag }) =>
                  `• ${event.title}: ${flag.label} (${event.date} @ ${event.odometer} km)`
              ),
            ]
          : ['• None']
      ),
      '',
      'Open issues:',
      ...(openIssues.length
        ? openIssues.map((issue) => `• [${issue.severity}] ${issue.title} — ${issue.notes || issue.symptomCategory}`)
        : ['• None']),
    ];
    const text = lines.join('\n');
    if (navigator.share) {
      await navigator.share({ title: 'X440 Service Handover', text });
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

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

      <button
        onClick={openEventLogger}
        className="w-full min-h-14 rounded-2xl bg-[#FF6600] px-4 py-3 flex items-center justify-between gap-4 text-left text-white active:scale-[0.99] transition-transform"
      >
        <span className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-black/15 flex items-center justify-center shrink-0">
            <CareIcon className="w-5 h-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Log Bike Event</span>
            <span className="block text-[11px] text-white/80 truncate">
              Service, repair, adjustment or a one-time event
            </span>
          </span>
        </span>
        <PlusIcon className="w-5 h-5 shrink-0" />
      </button>

      {/* iOS Segmented Control */}
      <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-[#141518] border border-white/[0.08]">
        {(
          [
            ['checklist', 'Checklist'],
            ['issues', `Issues${openIssues.length ? ` (${openIssues.length})` : ''}`],
            ['service', 'Service'],
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
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button onClick={() => openTaskEditor()} className="shrink-0 h-10 px-3.5 rounded-xl bg-[#FF6600] text-white text-xs font-semibold flex items-center gap-1"><PlusIcon className="w-4 h-4" /> Custom Task</button>
            <button onClick={onFlagRain} className="shrink-0 h-10 px-3.5 rounded-xl bg-[#141518] border border-white/[0.08] text-xs font-semibold text-[#F5F5F7]">Rode in Rain · Chain Due</button>
          </div>
          <BikeAnatomyMap
            taskHealthList={healthList}
            selectedZone={selectedZone}
            onSelectZone={setSelectedZone}
          />

          <div className="space-y-2.5">
            {visibleHealth.map((h) => {
              const latestLog = latestTaskLogs.get(h.task.id);
              const latestSignals = latestLog?.insightFlags || [];
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

                  {h.task.dueNowReason && (
                    <p className="text-xs text-[#FFD60A] bg-[#FFD60A]/10 rounded-lg px-3 py-2">
                      {h.task.dueNowReason}
                    </p>
                  )}

                  {latestSignals.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {latestSignals.slice(0, 3).map((flag) => (
                        <span key={flag.id} className={`rounded-lg px-2 py-1 text-[10px] ${flag.tone === 'positive' ? 'bg-[#30D158]/12 text-[#76E596]' : flag.tone === 'negative' ? 'bg-[#FF453A]/12 text-[#FF9B95]' : 'bg-white/[0.06] text-[#C7C7CC]'}`}>
                          {flag.label}{flag.unresolved ? ' · open' : ''}
                        </span>
                      ))}
                    </div>
                  )}

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
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => openTaskEditor(h.task)} className="px-2.5 py-1.5 rounded-lg bg-[#1F2126] text-[#8E8E93] text-xs">Edit</button>
                      <button onClick={() => openTaskModal(h.task)} className="px-3.5 py-1.5 rounded-xl bg-[#FF6600] text-white text-xs font-semibold active:scale-95">Mark Done</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Digital Service Bill Receipts */}
          {maintenanceLogs.some((log) => !log.eventId) && (
            <section className="space-y-2.5 pt-2">
              <h2 className="text-sm font-semibold text-[#F5F5F7] px-1">
                Service Receipts & History
              </h2>
              {maintenanceLogs.filter((log) => !log.eventId).map((log) => (
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
              onClick={() => openIssueEditor()}
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
                    <div className="flex items-center">
                      <button onClick={() => openIssueEditor(issue)} className="p-1.5 text-[#8E8E93]" aria-label="Edit issue">Edit</button>
                      <button onClick={() => onDeleteIssue(issue.id)} className="p-1.5 text-[#8E8E93] hover:text-[#FF453A]" aria-label="Delete issue"><TrashIcon className="w-4 h-4" /></button>
                    </div>
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
                    onClick={() => {
                      setResolvingIssue(issue);
                      setResolutionNote('');
                    }}
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
                  {issue.resolutionNote && <span className="text-[#636366] ml-2 truncate">{issue.resolutionNote}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {section === 'service' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#141518] border border-white/[0.08] p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-sm font-semibold text-[#F5F5F7]">Next Service Handover</p><p className="text-[11px] text-[#8E8E93] mt-0.5">Prepared for {serviceOdometer.toLocaleString('en-IN')} km</p></div>
              <button onClick={shareServiceHandover} className="h-9 px-3 rounded-xl bg-[#FF6600] text-white text-xs font-semibold">Share</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-[#1F2126] p-3"><p className="text-[10px] text-[#A7A7AD]">Due</p><p className="text-xl font-semibold text-[#F5F5F7]">{dueForService.length}</p></div>
              <div className="rounded-xl bg-[#1F2126] p-3"><p className="text-[10px] text-[#A7A7AD]">Out of range</p><p className={`text-xl font-semibold ${unresolvedConditionCount ? 'text-[#FF8A82]' : 'text-[#30D158]'}`}>{unresolvedConditionCount}</p></div>
              <div className="rounded-xl bg-[#1F2126] p-3"><p className="text-[10px] text-[#A7A7AD]">Issues</p><p className="text-xl font-semibold text-[#F5F5F7]">{openIssues.length}</p></div>
            </div>
          </div>

          <section className="space-y-2">
            <div className="px-1">
              <h2 className="text-sm font-semibold text-[#F5F5F7]">Measured findings to fix</h2>
              <p className="text-[11px] text-[#8E8E93] mt-0.5">Only the latest readings that remain outside their target.</p>
            </div>
            {unresolvedConditionCount === 0 ? (
              <div className="rounded-xl bg-[#30D158]/8 border border-[#30D158]/15 px-4 py-3 text-xs text-[#76E596]">
                No recorded measurements are currently out of range.
              </div>
            ) : (
              <>
                {unresolvedFindings.map(({ task, log, flag }) => (
                  <div key={`${task.id}-${flag.id}`} className="rounded-xl bg-[#FF453A]/8 border border-[#FF453A]/15 px-4 py-3">
                    <p className="text-sm font-medium text-[#F5F5F7]">{task.title}</p>
                    <p className="text-xs text-[#FF9B95] mt-1">{flag.label}</p>
                    <p className="text-[10px] text-[#8E8E93] mt-1 tabular-nums">Last checked {log.date} @ {log.odometer.toLocaleString('en-IN')} km</p>
                  </div>
                ))}
                {unresolvedStandaloneEvents.map(({ event, flag }) => (
                  <div key={`${event.id}-${flag.id}`} className="rounded-xl bg-[#FF453A]/8 border border-[#FF453A]/15 px-4 py-3">
                    <p className="text-sm font-medium text-[#F5F5F7]">{event.title}</p>
                    <p className="text-xs text-[#FF9B95] mt-1">{flag.label}</p>
                    <p className="text-[10px] text-[#8E8E93] mt-1 tabular-nums">Logged {event.date} @ {event.odometer.toLocaleString('en-IN')} km</p>
                  </div>
                ))}
              </>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-[#F5F5F7] px-1">Maintenance due by schedule</h2>
            {dueForService.length === 0 ? (
              <p className="rounded-xl bg-[#141518] border border-white/[0.08] px-4 py-3 text-xs text-[#A7A7AD]">No initialized care item is due before this service target.</p>
            ) : dueForService.map((health) => (
              <div key={health.task.id} className="rounded-xl bg-[#141518] border border-white/[0.08] px-4 py-3">
                <p className="text-sm text-[#F5F5F7]">{health.task.title}</p>
                <p className="text-[11px] text-[#8E8E93] mt-0.5">{health.task.description}</p>
              </div>
            ))}
          </section>

          {openIssues.length > 0 && <section className="space-y-2"><h2 className="text-sm font-semibold text-[#F5F5F7] px-1">Open issues</h2>{openIssues.map((issue) => <div key={issue.id} className="rounded-xl bg-[#141518] border border-white/[0.08] px-4 py-3"><div className="flex justify-between gap-3"><p className="text-sm text-[#F5F5F7]">{issue.title}</p><span className="text-[10px] text-[#FFD60A]">{issue.severity}</span></div><p className="text-[11px] text-[#8E8E93] mt-0.5">{issue.notes || issue.symptomCategory}</p></div>)}</section>}

          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-3 px-1">
              <div>
                <h2 className="text-sm font-semibold text-[#F5F5F7]">Bike Event History</h2>
                <p className="text-[11px] text-[#8E8E93]">Events appear beside relevant mileage intervals.</p>
              </div>
              <button onClick={openEventLogger} className="h-9 px-3 rounded-xl bg-[#FF6600] text-white text-xs font-semibold shrink-0">Log Event</button>
            </div>
            {bikeEvents.length === 0 ? (
              <div className="rounded-xl bg-[#141518] border border-white/[0.08] px-4 py-5 text-center">
                <p className="text-xs text-[#A7A7AD]">No service or bike events logged yet.</p>
              </div>
            ) : (
              bikeEvents.map((event) => {
                const completedNames = tasks
                  .filter((task) => event.completedTaskIds.includes(task.id))
                  .map((task) => task.title);
                return (
                  <article key={event.id} className="rounded-2xl bg-[#141518] border border-white/[0.08] p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#F5F5F7] break-words">{event.title}</p>
                        <p className="text-[11px] text-[#A7A7AD] tabular-nums mt-0.5">
                          {event.kind} · {event.date} @ {event.odometer.toLocaleString('en-IN')} km
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {event.totalCost > 0 && <span className="text-sm font-semibold text-[#F5F5F7] tabular-nums">₹{event.totalCost.toLocaleString('en-IN')}</span>}
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete “${event.title}”? Linked checklist completions will also be removed.`)) {
                              void onDeleteBikeEvent(event);
                            }
                          }}
                          className="w-9 h-9 flex items-center justify-center text-[#A7A7AD] active:text-[#FF453A]"
                          aria-label={`Delete ${event.title}`}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                    {event.workshop && <p className="text-xs text-[#D1D1D6]">Workshop: {event.workshop}</p>}
                    {event.notes && <p className="text-xs text-[#A7A7AD] leading-relaxed break-words">{event.notes}</p>}
                    {completedNames.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {completedNames.map((name) => (
                          <span key={name} className="px-2 py-1 rounded-lg bg-[#1F2126] text-[10px] text-[#C7C7CC]">{name}</span>
                        ))}
                      </div>
                    )}
                    {(event.observations || []).length > 0 && (
                      <div className="divide-y divide-white/[0.05] rounded-xl bg-[#0F1013] border border-white/[0.06] px-3.5 py-1">
                        {(event.observations || []).map((observation) => (
                          <div key={observation.fieldId} className="py-2 flex items-start justify-between gap-3 text-xs">
                            <div>
                              <p className="text-[#A7A7AD]">{observation.label}</p>
                              {observation.targetLabel && <p className="text-[10px] text-[#73737A] mt-0.5">{observation.targetLabel}</p>}
                            </div>
                            <p className="max-w-[58%] text-right text-[#F5F5F7] font-medium tabular-nums break-words">
                              {observation.mode === 'before-after'
                                ? `${observation.beforeLabel || '—'} → ${observation.afterLabel || '—'}`
                                : observation.valueLabel || observation.value || '—'}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {(event.insightFlags || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(event.insightFlags || []).map((flag) => (
                          <span key={flag.id} className={`rounded-lg px-2 py-1 text-[10px] ${flag.tone === 'positive' ? 'bg-[#30D158]/12 text-[#76E596]' : flag.tone === 'negative' ? 'bg-[#FF453A]/12 text-[#FF9B95]' : 'bg-white/[0.06] text-[#C7C7CC]'}`}>
                            {flag.label}{flag.unresolved ? ' · open' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                    {(event.billEntries || []).length > 0 && (
                      <div className="rounded-xl bg-[#0F1013] border border-white/[0.06] px-3.5 py-2 divide-y divide-white/[0.05]">
                        {(event.billEntries || []).map((entry, index) => {
                          const numericValue = entry.value.trim().replace(/[₹,\s]/g, '');
                          const looksLikeCost =
                            /^\d+(\.\d+)?$/.test(numericValue) &&
                            !entry.key.toLowerCase().includes('invoice');
                          return (
                            <div key={`${entry.key}-${index}`} className="py-1.5 flex items-center justify-between gap-3 text-xs">
                              <span className="text-[#8E8E93] break-words">{entry.key}</span>
                              <span className="text-[#F5F5F7] font-medium tabular-nums text-right break-words">
                                {looksLikeCost
                                  ? `₹${Number(numericValue).toLocaleString('en-IN')}`
                                  : entry.value}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </section>

          <section className="space-y-2.5">
            <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-[#F5F5F7]">Ownership Expenses</h2><p className="text-[11px] text-[#8E8E93]">Service ₹{serviceTotal.toLocaleString('en-IN')} · Other ₹{otherExpenseTotal.toLocaleString('en-IN')}</p></div><button onClick={() => setShowExpenseForm(true)} className="h-9 px-3 rounded-xl bg-[#1F2126] text-[#FF6600] text-xs font-semibold">Add Expense</button></div>
            {expenses.map((expense) => <div key={expense.id} className="rounded-xl bg-[#141518] border border-white/[0.08] px-4 py-3 flex items-center justify-between gap-3"><div><p className="text-sm text-[#F5F5F7]">{expense.title}</p><p className="text-[11px] text-[#8E8E93]">{expense.date} · {expense.category}</p></div><div className="flex items-center gap-2"><span className="text-sm font-semibold text-[#F5F5F7]">₹{expense.amount.toLocaleString('en-IN')}</span><button onClick={() => onDeleteExpense(expense.id)} className="p-1.5 text-[#8E8E93]"><TrashIcon /></button></div></div>)}
          </section>
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

            <div className="grid grid-cols-2 gap-3">
              <label className="text-[11px] text-[#8E8E93]">Bike name<input value={draftSettings.bikeName} onChange={(event) => setDraftSettings({ ...draftSettings, bikeName: event.target.value })} className="field h-11 mt-1" /></label>
              <label className="text-[11px] text-[#8E8E93]">Starting odometer<input type="number" value={draftSettings.initialOdometer} onChange={(event) => setDraftSettings({ ...draftSettings, initialOdometer: parseFloat(event.target.value) || 0 })} className="field h-11 mt-1" /></label>
              <label className="text-[11px] text-[#8E8E93] col-span-2">Next service odometer<input type="number" value={draftSettings.nextServiceOdometer || ''} onChange={(event) => setDraftSettings({ ...draftSettings, nextServiceOdometer: parseFloat(event.target.value) || 0 })} className="field h-11 mt-1" /></label>
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

            <label className="block text-[11px] text-[#8E8E93]">Document reminder window · days<input type="number" min="1" value={draftSettings.documentReminderDays ?? 30} onChange={(event) => setDraftSettings({ ...draftSettings, documentReminderDays: parseFloat(event.target.value) || 30 })} className="field h-11 mt-1" /></label>

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
            <button onClick={handleExportCsv} className="h-11 rounded-xl bg-[#141518] border border-white/[0.08] text-xs font-semibold text-[#F5F5F7]">Export CSV</button>
            <input ref={backupInputRef} type="file" accept=".json,application/json" onChange={handleImportBackup} className="hidden" />
            <button onClick={() => backupInputRef.current?.click()} className="h-11 rounded-xl bg-[#141518] border border-white/[0.08] text-xs font-semibold text-[#F5F5F7]">Restore JSON</button>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="h-11 rounded-xl bg-[#141518] border border-[#FF453A]/30 text-xs font-semibold text-[#FF453A]"
              >
                Sign Out
              </button>
            )}
          </div>
          {backupStatus && <p className="text-xs text-[#FFB27A] bg-[#FF6600]/10 rounded-xl px-3 py-2">{backupStatus}</p>}
        </div>
      )}

      {showEventForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-[28px] border-t border-white/10 bg-[#141518] p-5 space-y-4 animate-sheet-up safe-bottom-sheet">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold text-[#FF8A32]">Bike history</p>
                <h3 className="text-lg font-semibold text-[#F5F5F7]">Log Bike Event</h3>
                <p className="text-xs text-[#A7A7AD] mt-1">Selected care items are marked complete when this event is saved.</p>
              </div>
              <button onClick={() => setShowEventForm(false)} className="w-9 h-9 rounded-full bg-[#1F2126] flex items-center justify-center text-[#A7A7AD] shrink-0" aria-label="Close event logger">
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBikeEvent} className="space-y-4">
              <label className="block text-xs text-[#C7C7CC]">
                Event template
                <select
                  value={eventTemplateId}
                  onChange={(event) => selectEventTemplate(event.target.value)}
                  className="field h-12 mt-1.5"
                >
                  {BIKE_EVENT_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>{template.label}</option>
                  ))}
                </select>
              </label>

              <p className="rounded-xl bg-[#1F2126] px-3.5 py-3 text-xs leading-relaxed text-[#A7A7AD]">
                {selectedEventTemplate.description}
              </p>

              {eventTemplateId === 'one-time' && (
                <label className="block text-xs text-[#C7C7CC]">
                  Event name
                  <input
                    required
                    maxLength={100}
                    value={eventCustomTitle}
                    onChange={(event) => setEventCustomTitle(event.target.value)}
                    placeholder="What happened?"
                    className="field h-12 mt-1.5"
                  />
                  <span className="block text-[10px] text-[#73737A] mt-1">Saved only to this event—not added to the dropdown.</span>
                </label>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-[#C7C7CC]">
                  Odometer
                  <input type="number" inputMode="decimal" min="0.1" step="0.1" required value={eventOdometer} onChange={(event) => setEventOdometer(event.target.value)} className="field h-11 mt-1.5" />
                </label>
                <label className="text-xs text-[#C7C7CC]">
                  Date
                  <input type="date" required max={localDateInputValue()} value={eventDate} onChange={(event) => setEventDate(event.target.value)} className="field h-11 mt-1.5" />
                </label>
              </div>

              <label className="block text-xs text-[#C7C7CC]">
                Workshop or dealer <span className="text-[#73737A]">(optional)</span>
                <input maxLength={100} value={eventWorkshop} onChange={(event) => setEventWorkshop(event.target.value)} placeholder="e.g. Premia Vijayawada" className="field h-11 mt-1.5" />
              </label>

              {selectedEventTemplate.careTemplateId && (
                <CareInspectionEditor
                  templateId={selectedEventTemplate.careTemplateId}
                  values={eventCareValues}
                  onChange={setEventCareValues}
                />
              )}

              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold text-[#F5F5F7]">Maintenance completed</legend>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-[#8E8E93]">Select only the care items actually completed.</p>
                  <span className="text-[11px] text-[#FF9A52] shrink-0">{eventTaskIds.length} selected</span>
                </div>
                <div className="max-h-52 overflow-y-auto divide-y divide-white/[0.06] rounded-xl bg-[#1F2126] px-3">
                  {tasks.filter((task) => task.enabled !== false).map((task) => (
                    <label key={task.id} className="min-h-11 py-2.5 flex items-center justify-between gap-3 text-xs text-[#D1D1D6]">
                      <span className="leading-snug">{task.title}</span>
                      <input
                        type="checkbox"
                        checked={eventTaskIds.includes(task.id)}
                        onChange={(changeEvent) =>
                          setEventTaskIds((previous) =>
                            changeEvent.target.checked
                              ? [...previous, task.id]
                              : previous.filter((id) => id !== task.id)
                          )
                        }
                        className="w-5 h-5 accent-[#FF6600] shrink-0"
                      />
                    </label>
                  ))}
                </div>
              </fieldset>

              <BillReceiptEditor
                entries={eventBillEntries}
                onChange={setEventBillEntries}
                presetKeys={selectedEventTemplate.billKeys}
              />

              <textarea
                rows={3}
                maxLength={1000}
                value={eventNotes}
                onChange={(event) => setEventNotes(event.target.value)}
                placeholder="What changed? Parts, observations, settings or anything that may affect mileage…"
                className="field p-3"
              />

              {eventError && <p role="alert" className="rounded-xl bg-[#FF453A]/10 px-3 py-2 text-xs text-[#FFAAA5]">{eventError}</p>}

              <button type="submit" disabled={eventSaving} className="w-full h-14 rounded-2xl bg-[#FF6600] text-white text-sm font-semibold disabled:opacity-50 active:scale-[0.99]">
                {eventSaving ? 'Saving Event…' : `Save Event${eventTaskIds.length ? ` & Complete ${eventTaskIds.length} Item${eventTaskIds.length === 1 ? '' : 's'}` : ''}`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MARK MAINTENANCE DONE + KEY-VALUE BILL EDITOR SHEET */}
      {activeTask && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#141518] border-t border-white/10 rounded-t-[28px] max-h-[90dvh] overflow-y-auto p-5 space-y-4 animate-sheet-up safe-bottom-sheet">
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

              {careTemplateFor(activeTask.id) && (
                <CareInspectionEditor
                  templateId={activeTask.id}
                  values={logCareValues}
                  onChange={setLogCareValues}
                />
              )}

              <BillReceiptEditor
                entries={billEntries}
                onChange={setBillEntries}
                presetKeys={careTemplateFor(activeTask.id)?.billKeys}
              />

              <textarea
                rows={2}
                placeholder="Notes (optional — e.g., Motul 15W-50 used, chain slack adjusted)"
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                className="w-full p-3 rounded-xl bg-[#1F2126] border border-white/[0.08] text-sm text-[#F5F5F7] placeholder:text-[#636366] focus:outline-none focus:border-[#FF6600]"
              />

              {logCareError && (
                <p role="alert" className="rounded-xl bg-[#FF453A]/10 px-3 py-2 text-xs text-[#FFAAA5]">
                  {logCareError}
                </p>
              )}

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
          <div className="w-full max-w-lg bg-[#141518] border-t border-white/10 rounded-t-[28px] p-5 space-y-4 animate-sheet-up safe-bottom-sheet">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#F5F5F7]">
                {editingIssue ? 'Edit Bike Symptom' : 'Log Bike Symptom'}
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

              <div className="grid grid-cols-2 gap-3">
                <label className="text-[11px] text-[#8E8E93]">Odometer<input type="number" value={issueOdometer} onChange={(event) => setIssueOdometer(event.target.value)} className="field h-11 mt-1" /></label>
                <label className="text-[11px] text-[#8E8E93]">Date<input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} className="field h-11 mt-1" /></label>
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
                {editingIssue ? 'Save Issue Changes' : 'Save to Service Handover List'}
              </button>
            </form>
          </div>
        </div>
      )}

      {resolvingIssue && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"><div className="w-full max-w-lg bg-[#141518] border-t border-white/10 rounded-t-2xl p-5 space-y-4 safe-bottom-sheet"><div className="flex justify-between"><h3 className="text-lg font-semibold text-[#F5F5F7]">Resolve {resolvingIssue.title}</h3><button onClick={() => setResolvingIssue(null)} className="text-[#8E8E93]"><CloseIcon /></button></div><form onSubmit={handleResolveIssue} className="space-y-3"><textarea required rows={3} value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} placeholder="What fixed it? Parts replaced, adjustment made, dealer notes…" className="field p-3" /><button type="submit" className="w-full h-12 rounded-xl bg-[#30D158] text-black text-sm font-semibold">Mark Resolved</button></form></div></div>
      )}

      {showExpenseForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"><div className="w-full max-w-lg bg-[#141518] border-t border-white/10 rounded-t-2xl p-5 space-y-4 safe-bottom-sheet"><div className="flex justify-between"><h3 className="text-lg font-semibold text-[#F5F5F7]">Add Ownership Expense</h3><button onClick={() => setShowExpenseForm(false)} className="text-[#8E8E93]"><CloseIcon /></button></div><form onSubmit={handleSaveExpense} className="space-y-3"><input required value={expenseTitle} onChange={(event) => setExpenseTitle(event.target.value)} placeholder="Accessory or expense" className="field h-12" /><div className="grid grid-cols-2 gap-3"><input required type="number" step="0.01" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} placeholder="Amount ₹" className="field h-11" /><select value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value as ExpenseCategory)} className="field h-11">{(['Accessory','Consumable','Document','Other'] as ExpenseCategory[]).map((category) => <option key={category}>{category}</option>)}</select></div><input type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} className="field h-11" /><textarea rows={2} value={expenseNotes} onChange={(event) => setExpenseNotes(event.target.value)} placeholder="Notes (optional)" className="field p-3" /><button type="submit" className="w-full h-12 rounded-xl bg-[#FF6600] text-white text-sm font-semibold">Save Expense</button></form></div></div>
      )}

      {showTaskEditor && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[#141518] border-t border-white/10 rounded-t-2xl max-h-[90dvh] overflow-y-auto p-5 space-y-4 animate-sheet-up safe-bottom-sheet">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#F5F5F7]">{editingTask ? 'Edit Maintenance Task' : 'Add Custom Task'}</h3>
              <button onClick={() => setShowTaskEditor(false)} className="w-9 h-9 rounded-full bg-[#1F2126] flex items-center justify-center text-[#8E8E93]"><CloseIcon /></button>
            </div>
            <form onSubmit={handleSaveTask} className="space-y-3.5">
              <input required value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Task name" className="field h-12" />
              <textarea rows={2} value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} placeholder="What to inspect or replace" className="field p-3" />
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[11px] text-[#8E8E93]">Every kilometres<input type="number" required value={taskIntervalKm} onChange={(event) => setTaskIntervalKm(event.target.value)} className="field h-11 mt-1" /></label>
                <label className="text-[11px] text-[#8E8E93]">Every days<input type="number" required value={taskIntervalDays} onChange={(event) => setTaskIntervalDays(event.target.value)} className="field h-11 mt-1" /></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[11px] text-[#8E8E93]">Bike zone<select value={taskZone} onChange={(event) => setTaskZone(event.target.value as BikeZone)} className="field h-11 mt-1">{(['engine','chain','rear_tyre','front_tyre','forks','air_filter','electrical','controls'] as BikeZone[]).map((zone) => <option key={zone} value={zone}>{zone.replace('_', ' ')}</option>)}</select></label>
                <label className="text-[11px] text-[#8E8E93]">Category<select value={taskCategory} onChange={(event) => setTaskCategory(event.target.value as MaintenanceTask['category'])} className="field h-11 mt-1">{(['Routine DIY','Mid Service','Major Service','Fluid Flush'] as const).map((category) => <option key={category}>{category}</option>)}</select></label>
              </div>
              <label className="flex items-center justify-between rounded-xl bg-[#1F2126] px-3.5 py-3 text-xs text-[#F5F5F7]">Enabled<input type="checkbox" checked={taskEnabled} onChange={(event) => setTaskEnabled(event.target.checked)} className="accent-[#FF6600] w-4 h-4" /></label>
              <div className="flex gap-2">
                {editingTask?.isCustom && <button type="button" onClick={async () => { await onDeleteTask(editingTask.id); setShowTaskEditor(false); }} className="h-12 px-4 rounded-xl bg-[#FF453A]/10 text-[#FF8A82] text-xs font-semibold">Delete</button>}
                <button type="submit" className="flex-1 h-12 rounded-xl bg-[#FF6600] text-white text-sm font-semibold">Save Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
