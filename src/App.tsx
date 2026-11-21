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
import { FuelLog, MaintenanceTask } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [localPreview, setLocalPreview] = useState(false);

  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [fuelSheetOpen, setFuelSheetOpen] = useState(false);
  const [editingFuelLog, setEditingFuelLog] = useState<FuelLog | null>(null);
  const [preselectedTask, setPreselectedTask] = useState<MaintenanceTask | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [activeTab]);

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

  if (isFirebaseConfigured && !user && !localPreview) {
    return <AuthScreen onContinueLocal={() => setLocalPreview(true)} />;
  }

  if (!isFirebaseConfigured && !localPreview) {
    return <AuthScreen onContinueLocal={() => setLocalPreview(true)} />;
  }

  if (garage.loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 animate-pulse">
          <img src="/assets/icon-192.png" alt="" className="w-full h-full" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#F5F5F7]">Loading your garage</p>
          <p className="text-xs text-[#8E8E93] mt-1">Syncing fuel, trips and service records…</p>
        </div>
      </div>
    );
  }

  const overdueCount = garage.tasks.filter(
    (t) => t.enabled !== false && evaluateTaskHealth(t, garage.currentOdometer).status === 'overdue'
  ).length;
  const openIssueCount = garage.issues.filter((i) => i.status === 'open').length;

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-[#F5F5F7]">
      {/* iOS status bar / Dynamic Island backdrop blur overlay on scroll */}
      <div className="status-bar-scrim" />

      <main className="max-w-lg mx-auto px-4 pb-28 safe-top">
        {garage.dataError && (
          <div role="alert" className="mb-4 rounded-xl border border-[#FF453A]/30 bg-[#FF453A]/10 px-4 py-3 text-xs leading-relaxed text-[#FFAAA5]">
            {garage.dataError}
          </div>
        )}
        {activeTab === 'home' && (
          <HomePage
            currentOdometer={garage.currentOdometer}
            fuelLogs={garage.fuelLogs}
            tasks={garage.tasks}
            issues={garage.issues}
            activeTrip={garage.activeTrip}
            settings={garage.settings}
            maintenanceLogs={garage.maintenanceLogs}
            expenses={garage.expenses}
            bikeEvents={garage.bikeEvents}
            timelineRides={garage.timelineRides}
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
            bikeEvents={garage.bikeEvents}
            maintenanceLogs={garage.maintenanceLogs}
            onDeleteLog={garage.deleteFuelLog}
            onEditLog={(log) => {
              setEditingFuelLog(log);
              setFuelSheetOpen(true);
            }}
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
            onDeleteTrip={garage.deleteTrip}
            onImportTimeline={garage.saveTimelineRides}
            onDeleteTimelineRide={garage.deleteTimelineRide}
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
            expenses={garage.expenses}
            bikeEvents={garage.bikeEvents}
            timelineRides={garage.timelineRides}
            preselectedTask={preselectedTask}
            onClearPreselectedTask={() => setPreselectedTask(null)}
            onCompleteTask={garage.completeMaintenanceTask}
            onSaveTask={garage.saveMaintenanceTask}
            onDeleteTask={garage.deleteMaintenanceTask}
            onFlagRain={garage.flagRainRide}
            onSaveIssue={garage.saveIssue}
            onResolveIssue={garage.resolveIssue}
            onDeleteIssue={garage.deleteIssue}
            onSaveExpense={garage.saveExpense}
            onDeleteExpense={garage.deleteExpense}
            onSaveBikeEvent={garage.saveBikeEvent}
            onDeleteBikeEvent={garage.deleteBikeEvent}
            onImportBackup={garage.importBackup}
            onSaveSettings={garage.saveSettings}
            onSignOut={auth && user ? () => signOut(auth!) : undefined}
          />
        )}
      </main>

      <BottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        onOpenFuelLog={() => {
          setEditingFuelLog(null);
          setFuelSheetOpen(true);
        }}
        alertCount={overdueCount + openIssueCount}
      />

      <FuelSheet
        open={fuelSheetOpen}
        onClose={() => {
          setFuelSheetOpen(false);
          setEditingFuelLog(null);
        }}
        currentOdometer={garage.currentOdometer}
        settings={garage.settings}
        activeTrip={garage.activeTrip}
        recentLogs={garage.fuelLogs}
        onSave={garage.saveFuelLog}
        editingLog={editingFuelLog}
      />
    </div>
  );
}
