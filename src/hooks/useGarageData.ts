import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, isFirebaseConfigured } from '../lib/firebase';
import {
  AppSettings,
  BikeIssue,
  FuelLog,
  MaintenanceLog,
  MaintenanceTask,
  TimelineRide,
  Trip,
} from '../types';
import { DEFAULT_SETTINGS, X440_MAINTENANCE_TEMPLATE } from '../data/x440Template';

const LOCAL_KEY = 'x440_garage_local_v1';

interface GarageState {
  fuelLogs: FuelLog[];
  trips: Trip[];
  tasks: MaintenanceTask[];
  maintenanceLogs: MaintenanceLog[];
  issues: BikeIssue[];
  timelineRides: TimelineRide[];
  settings: AppSettings;
}

function loadLocalState(): GarageState {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        fuelLogs: parsed.fuelLogs || [],
        trips: parsed.trips || [],
        tasks: parsed.tasks?.length ? parsed.tasks : X440_MAINTENANCE_TEMPLATE,
        maintenanceLogs: parsed.maintenanceLogs || [],
        issues: parsed.issues || [],
        timelineRides: parsed.timelineRides || [],
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
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
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

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
      setSettings(local.settings);
      setLoading(false);
      return;
    }

    const uid = user.uid;
    const firestore = db;
    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(collection(firestore, 'users', uid, 'fuelLogs'), (snap) => {
        setFuelLogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FuelLog, 'id'>) })));
      })
    );

    unsubs.push(
      onSnapshot(collection(firestore, 'users', uid, 'trips'), (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Trip, 'id'>) }))
          .sort((a, b) => b.createdAt - a.createdAt);
        setTrips(list);
      })
    );

    unsubs.push(
      onSnapshot(collection(firestore, 'users', uid, 'maintenanceTasks'), async (snap) => {
        if (snap.empty) {
          // Auto-seed Harley-Davidson X440 manual template on first login
          const batch = writeBatch(firestore);
          for (const t of X440_MAINTENANCE_TEMPLATE) {
            batch.set(doc(firestore, 'users', uid, 'maintenanceTasks', t.id), t);
          }
          await batch.commit();
        } else {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<MaintenanceTask, 'id'>),
          }));
          // Preserve manual order by intervalKm
          list.sort((a, b) => a.intervalKm - b.intervalKm);
          setTasks(list);
        }
      })
    );

    unsubs.push(
      onSnapshot(collection(firestore, 'users', uid, 'maintenanceLogs'), (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<MaintenanceLog, 'id'>) }))
          .sort((a, b) => b.createdAt - a.createdAt);
        setMaintenanceLogs(list);
      })
    );

    unsubs.push(
      onSnapshot(collection(firestore, 'users', uid, 'issues'), (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<BikeIssue, 'id'>) }))
          .sort((a, b) => b.createdAt - a.createdAt);
        setIssues(list);
      })
    );

    unsubs.push(
      onSnapshot(collection(firestore, 'users', uid, 'timelineRides'), (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<TimelineRide, 'id'>) }))
          .sort((a, b) => b.startTime.localeCompare(a.startTime));
        setTimelineRides(list);
      })
    );

    unsubs.push(
      onSnapshot(doc(firestore, 'users', uid, 'meta', 'settings'), (snap) => {
        if (snap.exists()) {
          setSettings({ ...DEFAULT_SETTINGS, ...(snap.data() as Partial<AppSettings>) });
        } else {
          setSettings(DEFAULT_SETTINGS);
        }
        setLoading(false);
      })
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
      await setDoc(doc(db, 'users', user.uid, 'fuelLogs', log.id), log);
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
      await setDoc(doc(db, 'users', user.uid, 'trips', trip.id), trip);
    } else {
      setTrips((prev) => [trip, ...prev.filter((x) => x.id !== trip.id)]);
    }
  };

  const deleteTrip = async (id: string) => {
    if (isCloud && db && user) {
      await deleteDoc(doc(db, 'users', user.uid, 'trips', id));
    } else {
      setTrips((prev) => prev.filter((x) => x.id !== id));
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
    };

    if (isCloud && db && user) {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', user.uid, 'maintenanceTasks', task.id), updatedTask);
      batch.set(doc(db, 'users', user.uid, 'maintenanceLogs', log.id), log);
      await batch.commit();
    } else {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updatedTask : t)));
      setMaintenanceLogs((prev) => [log, ...prev]);
    }
  };

  const saveIssue = async (issue: BikeIssue) => {
    if (isCloud && db && user) {
      await setDoc(doc(db, 'users', user.uid, 'issues', issue.id), issue);
    } else {
      setIssues((prev) => [issue, ...prev.filter((x) => x.id !== issue.id)]);
    }
  };

  const resolveIssue = async (id: string, resolutionNote: string) => {
    const resolvedDate = new Date().toISOString().slice(0, 10);
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
          batch.set(doc(db, 'users', user.uid, 'timelineRides', r.id), r);
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

  const saveSettings = async (next: AppSettings) => {
    if (isCloud && db && user) {
      await setDoc(doc(db, 'users', user.uid, 'meta', 'settings'), next);
    } else {
      setSettings(next);
    }
  };

  return {
    loading,
    isCloud,
    currentOdometer,
    activeTrip,
    fuelLogs,
    trips,
    tasks,
    maintenanceLogs,
    issues,
    timelineRides,
    settings,
    saveFuelLog,
    deleteFuelLog,
    saveTrip,
    deleteTrip,
    completeMaintenanceTask,
    saveIssue,
    resolveIssue,
    deleteIssue,
    saveTimelineRides,
    saveSettings,
  };
}
