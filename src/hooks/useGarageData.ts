import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
  FirestoreError,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, isFirebaseConfigured } from '../lib/firebase';
import {
  AppSettings,
  BikeIssue,
  ExpenseLog,
  FuelLog,
  GarageBackup,
  MaintenanceLog,
  MaintenanceTask,
  TimelineRide,
  Trip,
} from '../types';
import {
  DEFAULT_SETTINGS,
  X440_MAINTENANCE_TEMPLATE,
  X440_MAINTENANCE_TEMPLATE_VERSION,
} from '../data/x440Template';
import { withoutUndefined } from '../lib/firestoreData';
import { localDateInputValue } from '../lib/date';

const LOCAL_KEY = 'x440_garage_local_v1';

interface GarageState {
  fuelLogs: FuelLog[];
  trips: Trip[];
  tasks: MaintenanceTask[];
  maintenanceLogs: MaintenanceLog[];
  issues: BikeIssue[];
  timelineRides: TimelineRide[];
  expenses: ExpenseLog[];
  settings: AppSettings;
}

function mergeMaintenanceTemplate(saved: MaintenanceTask[]): MaintenanceTask[] {
  const savedMap = new Map(saved.map((task) => [task.id, task]));
  const defaults = X440_MAINTENANCE_TEMPLATE.map((template) => {
    const existing = savedMap.get(template.id);
    if (!existing) return { ...template, enabled: true };

    const needsReferenceMigration =
      (existing.templateVersion ?? 0) < X440_MAINTENANCE_TEMPLATE_VERSION;
    if (needsReferenceMigration) {
      return {
          ...template,
          enabled: existing.enabled ?? true,
          lastDoneOdometer: existing.lastDoneOdometer,
          lastDoneDate: existing.lastDoneDate,
          dueNowReason: existing.dueNowReason,
        };
    }

    // Once migrated, the rider's edits to a standard task are intentional.
    return { ...template, ...existing };
  });
  const custom = saved.filter(
    (task) => task.isCustom || !X440_MAINTENANCE_TEMPLATE.some((item) => item.id === task.id)
  );
  return [...defaults, ...custom].sort((a, b) => a.intervalKm - b.intervalKm);
}

function loadLocalState(): GarageState {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        fuelLogs: parsed.fuelLogs || [],
        trips: parsed.trips || [],
        tasks: parsed.tasks?.length
          ? mergeMaintenanceTemplate(parsed.tasks)
          : X440_MAINTENANCE_TEMPLATE,
        maintenanceLogs: parsed.maintenanceLogs || [],
        issues: parsed.issues || [],
        timelineRides: parsed.timelineRides || [],
        expenses: parsed.expenses || [],
        settings: {
          ...DEFAULT_SETTINGS,
          ...(parsed.settings || {}),
          maintenanceTemplateVersion: X440_MAINTENANCE_TEMPLATE_VERSION,
        },
      };
    }
  } catch {
    // ignore corrupted local storage
  }
  return {
    fuelLogs: [],
    trips: [],
    tasks: X440_MAINTENANCE_TEMPLATE,
    maintenanceLogs: [],
    issues: [],
    timelineRides: [],
    expenses: [],
    settings: DEFAULT_SETTINGS,
  };
}

export function useGarageData(user: User | null) {
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tasks, setTasks] = useState<MaintenanceTask[]>(X440_MAINTENANCE_TEMPLATE);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [issues, setIssues] = useState<BikeIssue[]>([]);
  const [timelineRides, setTimelineRides] = useState<TimelineRide[]>([]);
  const [expenses, setExpenses] = useState<ExpenseLog[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const isCloud = Boolean(isFirebaseConfigured && db && user);

  // Persist locally whenever running in local preview mode
  useEffect(() => {
    if (!isCloud && !loading) {
      localStorage.setItem(
        LOCAL_KEY,
        JSON.stringify({
          fuelLogs,
          trips,
          tasks,
          maintenanceLogs,
          issues,
          timelineRides,
          expenses,
          settings,
        })
      );
    }
  }, [
    isCloud,
    loading,
    fuelLogs,
    trips,
    tasks,
    maintenanceLogs,
    issues,
    timelineRides,
    expenses,
    settings,
  ]);

  useEffect(() => {
    if (!isCloud || !db || !user) {
      const local = loadLocalState();
      setFuelLogs(local.fuelLogs);
      setTrips(local.trips);
      setTasks(local.tasks);
      setMaintenanceLogs(local.maintenanceLogs);
      setIssues(local.issues);
      setTimelineRides(local.timelineRides);
      setExpenses(local.expenses);
      setSettings(local.settings);
      setDataError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setDataError(null);
    const uid = user.uid;
    const firestore = db;
    const unsubs: (() => void)[] = [];
    const handleSnapshotError = (error: FirestoreError | Error) => {
      const code = 'code' in error ? String(error.code) : '';
      setDataError(
        code.includes('permission-denied')
          ? 'Cloud access was denied. Publish the included Firestore rules and sign in again.'
          : 'Cloud data could not be loaded. Cached data remains available; Firebase will retry automatically.'
      );
      setLoading(false);
    };

    unsubs.push(
      onSnapshot(
        collection(firestore, 'users', uid, 'fuelLogs'),
        (snap) => {
          setFuelLogs(
            snap.docs
              .map((d) => ({ id: d.id, ...(d.data() as Omit<FuelLog, 'id'>) }))
              .sort((a, b) => b.createdAt - a.createdAt)
          );
        },
        handleSnapshotError
      )
    );

    unsubs.push(
      onSnapshot(
        collection(firestore, 'users', uid, 'trips'),
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<Trip, 'id'>) }))
            .sort((a, b) => b.createdAt - a.createdAt);
          setTrips(list);
        },
        handleSnapshotError
      )
    );

    unsubs.push(
      onSnapshot(
        collection(firestore, 'users', uid, 'maintenanceTasks'),
        async (snap) => {
          try {
            if (snap.empty) {
              // Auto-seed Harley-Davidson X440 manual template on first login
              const batch = writeBatch(firestore);
              for (const t of X440_MAINTENANCE_TEMPLATE) {
                batch.set(doc(firestore, 'users', uid, 'maintenanceTasks', t.id), t);
              }
              await batch.commit();
              return;
            }
            const saved = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as Omit<MaintenanceTask, 'id'>),
            }));
            const list = mergeMaintenanceTemplate(saved);
            setTasks(list);

            const needsTemplateSync = X440_MAINTENANCE_TEMPLATE.some((template) => {
              const existing = saved.find((task) => task.id === template.id);
              return (
                !existing ||
                (existing.templateVersion ?? 0) < X440_MAINTENANCE_TEMPLATE_VERSION
              );
            });
            if (!needsTemplateSync) return;
            const batch = writeBatch(firestore);
            for (const task of list) {
              batch.set(
                doc(firestore, 'users', uid, 'maintenanceTasks', task.id),
                withoutUndefined(task)
              );
            }
            await batch.commit();
          } catch (error) {
            handleSnapshotError(error as Error);
          }
        },
        handleSnapshotError
      )
    );

    unsubs.push(
      onSnapshot(
        collection(firestore, 'users', uid, 'maintenanceLogs'),
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<MaintenanceLog, 'id'>) }))
            .sort((a, b) => b.createdAt - a.createdAt);
          setMaintenanceLogs(list);
        },
        handleSnapshotError
      )
    );

    unsubs.push(
      onSnapshot(
        collection(firestore, 'users', uid, 'issues'),
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<BikeIssue, 'id'>) }))
            .sort((a, b) => b.createdAt - a.createdAt);
          setIssues(list);
        },
        handleSnapshotError
      )
    );

    unsubs.push(
      onSnapshot(
        collection(firestore, 'users', uid, 'timelineRides'),
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<TimelineRide, 'id'>) }))
            .sort((a, b) => b.startTime.localeCompare(a.startTime));
          setTimelineRides(list);
        },
        handleSnapshotError
      )
    );

    unsubs.push(
      onSnapshot(
        collection(firestore, 'users', uid, 'expenses'),
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...(d.data() as Omit<ExpenseLog, 'id'>) }))
            .sort((a, b) => b.createdAt - a.createdAt);
          setExpenses(list);
        },
        handleSnapshotError
      )
    );

    unsubs.push(
      onSnapshot(
        doc(firestore, 'users', uid, 'meta', 'settings'),
        (snap) => {
          if (snap.exists()) {
            setSettings({
              ...DEFAULT_SETTINGS,
              ...(snap.data() as Partial<AppSettings>),
              maintenanceTemplateVersion: X440_MAINTENANCE_TEMPLATE_VERSION,
            });
          } else {
            setSettings(DEFAULT_SETTINGS);
          }
          setLoading(false);
        },
        handleSnapshotError
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [isCloud, user]);

  // Derived current odometer = highest reading across fuel, trips, maintenance, and settings
  const currentOdometer = useMemo(() => {
    const candidates = [
      settings.initialOdometer || 0,
      ...fuelLogs.map((l) => l.odometer),
      ...trips.map((t) => t.endOdometer ?? t.startOdometer),
      ...maintenanceLogs.map((m) => m.odometer),
    ];
    return Math.max(0, ...candidates);
  }, [settings.initialOdometer, fuelLogs, trips, maintenanceLogs]);

  const activeTrip = useMemo(
    () => trips.find((t) => t.status === 'active') || null,
    [trips]
  );

  // CRUD helpers
  const saveFuelLog = async (log: FuelLog) => {
    if (isCloud && db && user) {
      await setDoc(doc(db, 'users', user.uid, 'fuelLogs', log.id), withoutUndefined(log));
    } else {
      setFuelLogs((prev) => [log, ...prev.filter((x) => x.id !== log.id)]);
    }
  };

  const deleteFuelLog = async (id: string) => {
    if (isCloud && db && user) {
      await deleteDoc(doc(db, 'users', user.uid, 'fuelLogs', id));
    } else {
      setFuelLogs((prev) => prev.filter((x) => x.id !== id));
    }
  };

  const saveTrip = async (trip: Trip) => {
    if (isCloud && db && user) {
      await setDoc(doc(db, 'users', user.uid, 'trips', trip.id), withoutUndefined(trip));
    } else {
      setTrips((prev) => [trip, ...prev.filter((x) => x.id !== trip.id)]);
    }
  };

  const deleteTrip = async (id: string) => {
    if (isCloud && db && user) {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', user.uid, 'trips', id));
      fuelLogs.filter((log) => log.tripId === id).forEach((log) => {
        batch.set(
          doc(db!, 'users', user.uid, 'fuelLogs', log.id),
          withoutUndefined({ ...log, tripId: null })
        );
      });
      timelineRides.filter((ride) => ride.tripId === id).forEach((ride) => {
        batch.set(
          doc(db!, 'users', user.uid, 'timelineRides', ride.id),
          withoutUndefined({ ...ride, tripId: null })
        );
      });
      await batch.commit();
    } else {
      setTrips((prev) => prev.filter((x) => x.id !== id));
      setFuelLogs((prev) => prev.map((log) => log.tripId === id ? { ...log, tripId: null } : log));
      setTimelineRides((prev) => prev.map((ride) => ride.tripId === id ? { ...ride, tripId: null } : ride));
    }
  };

  const completeMaintenanceTask = async (
    task: MaintenanceTask,
    log: MaintenanceLog
  ) => {
    const updatedTask: MaintenanceTask = {
      ...task,
      lastDoneOdometer: log.odometer,
      lastDoneDate: log.date,
      dueNowReason: undefined,
    };

    if (isCloud && db && user) {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', user.uid, 'maintenanceTasks', task.id), withoutUndefined(updatedTask));
      batch.set(doc(db, 'users', user.uid, 'maintenanceLogs', log.id), withoutUndefined(log));
      await batch.commit();
    } else {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updatedTask : t)));
      setMaintenanceLogs((prev) => [log, ...prev]);
    }
  };

  const saveMaintenanceTask = async (task: MaintenanceTask) => {
    if (isCloud && db && user) {
      await setDoc(
        doc(db, 'users', user.uid, 'maintenanceTasks', task.id),
        withoutUndefined(task)
      );
    } else {
      setTasks((prev) =>
        [...prev.filter((item) => item.id !== task.id), task].sort(
          (a, b) => a.intervalKm - b.intervalKm
        )
      );
    }
  };

  const deleteMaintenanceTask = async (id: string) => {
    if (isCloud && db && user) {
      await deleteDoc(doc(db, 'users', user.uid, 'maintenanceTasks', id));
    } else {
      setTasks((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const flagRainRide = async () => {
    const chainTask = tasks.find((task) => task.id === 'chain-care');
    if (!chainTask) return;
    await saveMaintenanceTask({
      ...chainTask,
      dueNowReason: 'Rode in rain — clean, dry and lubricate the chain',
    });
  };

  const saveIssue = async (issue: BikeIssue) => {
    if (isCloud && db && user) {
      await setDoc(doc(db, 'users', user.uid, 'issues', issue.id), withoutUndefined(issue));
    } else {
      setIssues((prev) => [issue, ...prev.filter((x) => x.id !== issue.id)]);
    }
  };

  const resolveIssue = async (id: string, resolutionNote: string) => {
    const resolvedDate = localDateInputValue();
    if (isCloud && db && user) {
      await updateDoc(doc(db, 'users', user.uid, 'issues', id), {
        status: 'resolved',
        resolvedDate,
        resolutionNote,
      });
    } else {
      setIssues((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, status: 'resolved', resolvedDate, resolutionNote }
            : i
        )
      );
    }
  };

  const deleteIssue = async (id: string) => {
    if (isCloud && db && user) {
      await deleteDoc(doc(db, 'users', user.uid, 'issues', id));
    } else {
      setIssues((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const saveTimelineRides = async (rides: TimelineRide[]) => {
    if (isCloud && db && user) {
      // Firestore batch limit is 500; chunk safely
      const chunks: TimelineRide[][] = [];
      for (let i = 0; i < rides.length; i += 400) {
        chunks.push(rides.slice(i, i + 400));
      }
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        for (const r of chunk) {
          batch.set(doc(db, 'users', user.uid, 'timelineRides', r.id), withoutUndefined(r));
        }
        await batch.commit();
      }
    } else {
      setTimelineRides((prev) => {
        const map = new Map(prev.map((r) => [r.id, r]));
        rides.forEach((r) => map.set(r.id, r));
        return Array.from(map.values()).sort((a, b) =>
          b.startTime.localeCompare(a.startTime)
        );
      });
    }
  };

  const deleteTimelineRide = async (id: string) => {
    if (isCloud && db && user) {
      await deleteDoc(doc(db, 'users', user.uid, 'timelineRides', id));
    } else {
      setTimelineRides((prev) => prev.filter((ride) => ride.id !== id));
    }
  };

  const saveSettings = async (next: AppSettings) => {
    if (isCloud && db && user) {
      await setDoc(doc(db, 'users', user.uid, 'meta', 'settings'), withoutUndefined(next));
    } else {
      setSettings(next);
    }
  };

  const importBackup = async (backup: GarageBackup) => {
    if (isCloud && db && user) {
      const writes: Array<{ collectionName: string; id: string; value: unknown }> = [];
      backup.fuelLogs?.forEach((item) => writes.push({ collectionName: 'fuelLogs', id: item.id, value: item }));
      backup.trips?.forEach((item) => writes.push({ collectionName: 'trips', id: item.id, value: item }));
      backup.tasks?.forEach((item) => writes.push({ collectionName: 'maintenanceTasks', id: item.id, value: item }));
      backup.maintenanceLogs?.forEach((item) => writes.push({ collectionName: 'maintenanceLogs', id: item.id, value: item }));
      backup.issues?.forEach((item) => writes.push({ collectionName: 'issues', id: item.id, value: item }));
      backup.timelineRides?.forEach((item) => writes.push({ collectionName: 'timelineRides', id: item.id, value: item }));
      backup.expenses?.forEach((item) => writes.push({ collectionName: 'expenses', id: item.id, value: item }));
      for (let index = 0; index < writes.length; index += 400) {
        const batch = writeBatch(db);
        for (const write of writes.slice(index, index + 400)) {
          batch.set(
            doc(db, 'users', user.uid, write.collectionName, write.id),
            withoutUndefined(write.value)
          );
        }
        await batch.commit();
      }
      if (backup.settings) await saveSettings(backup.settings);
      return;
    }
    if (backup.fuelLogs) setFuelLogs(backup.fuelLogs);
    if (backup.trips) setTrips(backup.trips);
    if (backup.tasks) setTasks(mergeMaintenanceTemplate(backup.tasks));
    if (backup.maintenanceLogs) setMaintenanceLogs(backup.maintenanceLogs);
    if (backup.issues) setIssues(backup.issues);
    if (backup.timelineRides) setTimelineRides(backup.timelineRides);
    if (backup.expenses) setExpenses(backup.expenses);
    if (backup.settings) {
      setSettings({
        ...DEFAULT_SETTINGS,
        ...backup.settings,
        maintenanceTemplateVersion: X440_MAINTENANCE_TEMPLATE_VERSION,
      });
    }
  };

  const saveExpense = async (expense: ExpenseLog) => {
    if (isCloud && db && user) {
      await setDoc(
        doc(db, 'users', user.uid, 'expenses', expense.id),
        withoutUndefined(expense)
      );
    } else {
      setExpenses((prev) => [expense, ...prev.filter((item) => item.id !== expense.id)]);
    }
  };

  const deleteExpense = async (id: string) => {
    if (isCloud && db && user) {
      await deleteDoc(doc(db, 'users', user.uid, 'expenses', id));
    } else {
      setExpenses((prev) => prev.filter((item) => item.id !== id));
    }
  };

  return {
    loading,
    dataError,
    isCloud,
    currentOdometer,
    activeTrip,
    fuelLogs,
    trips,
    tasks,
    maintenanceLogs,
    issues,
    timelineRides,
    expenses,
    settings,
    saveFuelLog,
    deleteFuelLog,
    saveTrip,
    deleteTrip,
    completeMaintenanceTask,
    saveMaintenanceTask,
    deleteMaintenanceTask,
    flagRainRide,
    saveIssue,
    resolveIssue,
    deleteIssue,
    saveTimelineRides,
    deleteTimelineRide,
    saveSettings,
    importBackup,
    saveExpense,
    deleteExpense,
  };
}
