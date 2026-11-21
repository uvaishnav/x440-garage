import React from 'react';
import { CareIcon, CockpitIcon, DropIcon, FuelNozzleIcon, RouteIcon } from './Icons';

export type TabKey = 'home' | 'fuel' | 'trips' | 'care';

interface BottomNavProps {
  activeTab: TabKey;
  onChangeTab: (tab: TabKey) => void;
  onOpenFuelLog: () => void;
  alertCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  onOpenFuelLog,
  alertCount = 0,
}) => {
  const tabClass = (tab: TabKey) =>
    `flex flex-col items-center justify-center gap-1 min-w-[56px] min-h-[44px] transition-colors ${
      activeTab === tab ? 'text-[#FF6600]' : 'text-[#8E8E93]'
    }`;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 glass-bar border-t border-white/[0.08] safe-bottom">
      <div className="max-w-lg mx-auto px-3 pt-1.5 pb-1 flex items-center justify-between">
        <button onClick={() => onChangeTab('home')} className={tabClass('home')}>
          <CockpitIcon className="w-[22px] h-[22px]" />
          <span className="text-[10px] font-medium tracking-wide">Cockpit</span>
        </button>

        <button onClick={() => onChangeTab('fuel')} className={tabClass('fuel')}>
          <DropIcon className="w-[22px] h-[22px]" />
          <span className="text-[10px] font-medium tracking-wide">Fuel</span>
        </button>

        {/* Dedicated 1-Tap Center Fuel Log Button */}
        <div className="-mt-6 flex flex-col items-center">
          <button
            onClick={onOpenFuelLog}
            aria-label="Log Fuel"
            className="w-14 h-14 rounded-full bg-gradient-to-b from-[#FF751A] to-[#FF6600] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(255,102,0,0.45)] border border-white/20 active:scale-95 transition-transform"
          >
            <FuelNozzleIcon className="w-6 h-6" />
          </button>
        </div>

        <button onClick={() => onChangeTab('trips')} className={tabClass('trips')}>
          <RouteIcon className="w-[22px] h-[22px]" />
          <span className="text-[10px] font-medium tracking-wide">Trips</span>
        </button>

        <button onClick={() => onChangeTab('care')} className={`${tabClass('care')} relative`}>
          <CareIcon className="w-[22px] h-[22px]" />
          {alertCount > 0 && (
            <span className="absolute top-1 right-2.5 w-2 h-2 rounded-full bg-[#FF453A] ring-2 ring-[#101114]" />
          )}
          <span className="text-[10px] font-medium tracking-wide">Care</span>
        </button>
      </div>
    </nav>
  );
};
