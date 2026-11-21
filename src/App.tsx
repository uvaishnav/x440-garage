import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth, isFirebaseConfigured } from './lib/firebase';
import { useGarageData } from './hooks/useGarageData';
import { AuthScreen } from './components/AuthScreen';
import { BottomNav, TabKey } from './components/BottomNav';
import { FuelSheet } from './components/FuelSheet';
import { HomePage } from './pages/HomePage';
import { FuelPage } from './pages/FuelPage';
import { TripsPage } from './pages/TripsPage';
import { CarePage } from './pages/CarePage';
import { evaluateTaskHealth } from './lib/calculations';
import { MaintenanceTask } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [localPreview, setLocalPreview] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [fuelSheetOpen, setFuelSheetOpen] = useState(false);
  const [preselectedTask, setPreselectedTask] = useState<MaintenanceTask | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  const garage = useGarageData(user);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center">
        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 animate-pulse">
          <img src="/assets/icon-192.png" alt="Loading" className="w-full h-full" />
        </div>
      </div>
    );
  }

  if (isFirebaseConfigured && !user) {
    return <AuthScreen onContinueLocal={() => setLocalPreview(true)} />;
  }

  if (!isFirebaseConfigured && !localPreview) {
    return <AuthScreen onContinueLocal={() => setLocalPreview(true)} />;
  }

  const overdueCount = garage.tasks.filter(
    (t) => evaluateTaskHealth(t, garage.currentOdometer).status === 'overdue'
  ).length;
  const openIssueCount = garage.issues.filter((i) => i.status === 'open').length;

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#F5F5F7]">
      <main className="max-w-lg mx-auto px-4 pt-4 pb-28 safe-top">
        {activeTab === 'home' && (
          <HomePage
            currentOdometer={garage.currentOdometer}
            fuelLogs={garage.fuelLogs}
            tasks={garage.tasks}
            issues={garage.issues}
            activeTrip={garage.activeTrip}
            onNavigate={(tab) => setActiveTab(tab)}
            onQuickMarkTask={(task) => {
              setPreselectedTask(task);
              setActiveTab('care');
            }}
          />
        )}

        {activeTab === 'fuel' && (
          <FuelPage
            fuelLogs={garage.fuelLogs}
            onDeleteLog={garage.deleteFuelLog}
          />
        )}

        {activeTab === 'trips' && (
          <TripsPage
            currentOdometer={garage.currentOdometer}
            trips={garage.trips}
            fuelLogs={garage.fuelLogs}
            tasks={garage.tasks}
            timelineRides={garage.timelineRides}
            settings={garage.settings}
            onSaveTrip={garage.saveTrip}
            onImportTimeline={garage.saveTimelineRides}
          />
        )}

        {activeTab === 'care' && (
          <CarePage
            currentOdometer={garage.currentOdometer}
            tasks={garage.tasks}
            maintenanceLogs={garage.maintenanceLogs}
            issues={garage.issues}
            settings={garage.settings}
            fuelLogs={garage.fuelLogs}
            trips={garage.trips}
            preselectedTask={preselectedTask}
            onClearPreselectedTask={() => setPreselectedTask(null)}
            onCompleteTask={garage.completeMaintenanceTask}
            onSaveIssue={garage.saveIssue}
            onResolveIssue={garage.resolveIssue}
            onDeleteIssue={garage.deleteIssue}
            onSaveSettings={garage.saveSettings}
            onSignOut={auth && user ? () => signOut(auth!) : undefined}
          />
        )}
      </main>

      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenFuelLog={() => setFuelSheetOpen(true)}
        alertCount={overdueCount + openIssueCount}
      />

      <FuelSheet
        open={fuelSheetOpen}
        onClose={() => setFuelSheetOpen(false)}
        currentOdometer={garage.currentOdometer}
        settings={garage.settings}
        activeTrip={garage.activeTrip}
        recentLogs={garage.fuelLogs}
        onSave={garage.saveFuelLog}
      />
    </div>
  );
}
