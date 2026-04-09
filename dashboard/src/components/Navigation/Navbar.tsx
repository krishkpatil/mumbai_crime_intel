'use client';

import React, { useState } from 'react';
import { BarChart2, TrendingUp, AlertTriangle, MessageSquare, LayoutDashboard, Menu, X, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tab } from '@/app/page';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview',   label: 'Overview',   icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'trends',     label: 'Trends',     icon: <BarChart2 className="w-4 h-4" /> },
  { id: 'forecast',   label: 'Forecast',   icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'anomalies',  label: 'Anomalies',  icon: <AlertTriangle className="w-4 h-4" /> },
  { id: 'chat',       label: 'Ask AI',     icon: <MessageSquare className="w-4 h-4" /> },
];

interface NavbarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleTab = (tab: Tab) => {
    setActiveTab(tab);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#E2E2E2]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 bg-[#09090B] flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-black text-sm tracking-tight uppercase">
              Mumbai Crime Intelligence
            </span>
          </div>

          {/* Desktop tabs */}
          <nav className="hidden md:flex items-center gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-xs font-data font-bold uppercase tracking-widest transition-all',
                  activeTab === tab.id
                    ? 'bg-[#09090B] text-white'
                    : 'text-slate-500 hover:text-[#09090B] hover:bg-slate-50'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-[#09090B]"
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#E2E2E2] bg-white">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTab(tab.id)}
              className={cn(
                'w-full flex items-center gap-3 px-6 py-4 text-sm font-data font-bold uppercase tracking-widest text-left transition-colors border-b border-[#E2E2E2] last:border-0',
                activeTab === tab.id
                  ? 'bg-[#09090B] text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E2E2E2] flex">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTab(tab.id)}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-3 transition-colors',
              activeTab === tab.id ? 'text-[#09090B]' : 'text-slate-400'
            )}
          >
            {tab.icon}
            <span className="text-[9px] font-data font-bold uppercase tracking-widest">{tab.label}</span>
          </button>
        ))}
      </nav>
    </header>
  );
};
