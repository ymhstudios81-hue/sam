import React from 'react';
import { LayoutDashboard, FolderKanban, Film, SlidersHorizontal } from 'lucide-react';

export type TabType = 'dashboard' | 'projects' | 'queue' | 'settings';

interface NavigationProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  queueCount: number;
  projectsCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  queueCount,
  projectsCount,
}) => {
  const tabs = [
    {
      id: 'dashboard' as TabType,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'projects' as TabType,
      label: 'Projects',
      icon: FolderKanban,
      count: projectsCount,
    },
    {
      id: 'queue' as TabType,
      label: 'Render Queue',
      icon: Film,
      count: queueCount,
      highlight: queueCount > 0,
    },
    {
      id: 'settings' as TabType,
      label: 'Settings',
      icon: SlidersHorizontal,
    },
  ];

  return (
    <nav className="border-b border-neutral-800 bg-neutral-900/50 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                isActive
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-neutral-400'}`} />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-xs px-1.5 py-0.2 rounded-full font-mono ${
                    isActive
                      ? 'bg-amber-400 text-neutral-950 font-bold'
                      : tab.highlight
                      ? 'bg-amber-500/30 text-amber-300'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
