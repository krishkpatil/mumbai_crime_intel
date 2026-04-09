'use client';

import React from 'react';
import { Home, BarChart2, Repeat, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export const MobileNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/80 backdrop-blur-xl border-t border-slate-200 px-6 py-3">
      <div className="flex items-center justify-between max-w-md mx-auto">
        <NavButton icon={<Home className="w-5 h-5" />} label="Home" active />
        <NavButton icon={<Repeat className="w-5 h-5" />} label="Compare" />
        <NavButton icon={<BarChart2 className="w-5 h-5" />} label="Trends" />
        <NavButton icon={<Info className="w-5 h-5" />} label="Insights" />
      </div>
    </nav>
  );
};

const NavButton = ({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) => (
  <button className={cn(
    "flex flex-col items-center gap-1 transition-colors duration-300",
    active ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
  )}>
    {icon}
    <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
  </button>
);
