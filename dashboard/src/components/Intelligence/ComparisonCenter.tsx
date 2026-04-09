'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TrendData } from '@/lib/api';
import { ChevronRight, Calendar, Layers, Hash, Activity, ArrowUpRight, ArrowDownRight, Info, ChevronLeft, BarChart3 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ComparisonCenterProps {
  trends: TrendData[];
}

type ComparisonMode = 'standard' | 'aggregate' | 'yoy';

interface AggregatedData {
  label: string;
  registered: number;
  detected: number;
  count: number;
}

export const ComparisonCenter: React.FC<ComparisonCenterProps> = ({ trends }) => {
  const [mode, setMode] = useState<ComparisonMode>('standard');
  const [periodA, setPeriodA] = useState<string>('');
  const [periodB, setPeriodB] = useState<string>('');
  
  const scrollRefA = useRef<HTMLDivElement>(null);
  const scrollRefB = useRef<HTMLDivElement>(null);

  // 1. Generate Temporal Options
  const options = useMemo(() => {
    if (mode === 'standard') {
      return trends.map(t => ({ 
        value: t.report_date, 
        label: t.report_date,
        data: { registered: t.Registered, detected: t.Detected, count: 1 }
      }));
    }

    if (mode === 'aggregate') {
      // 3-Month Sliding Window
      const results: { value: string; label: string; data: any }[] = [];
      for (let i = 2; i < trends.length; i++) {
        const window = trends.slice(i - 2, i + 1);
        const registered = window.reduce((sum, t) => sum + t.Registered, 0);
        const detected = window.reduce((sum, t) => sum + t.Detected, 0);
        const label = `${trends[i-2].report_date} → ${trends[i].report_date}`;
        results.push({
          value: trends[i].report_date,
          label,
          data: { registered, detected, count: 3 }
        });
      }
      return results;
    }

    if (mode === 'yoy') {
      return trends.map(t => ({ 
        value: t.report_date, 
        label: t.report_date,
        data: { registered: t.Registered, detected: t.Detected, count: 1 }
      }));
    }

    return [];
  }, [mode, trends]);

  // Handle Defaults
  useEffect(() => {
    if (options.length === 0) return;
    
    if (mode === 'yoy') {
      const latest = options[options.length - 1].value;
      setPeriodB(latest);
      const date = new Date(latest);
      const prevYearTarget = `${date.getFullYear() - 1}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      const found = options.find(o => o.value === prevYearTarget);
      setPeriodA(found ? found.value : options[0].value);
    } else if (options.length >= 2) {
      setPeriodA(options[options.length - 2].value);
      setPeriodB(options[options.length - 1].value);
    } else {
      setPeriodA(options[0]?.value || '');
      setPeriodB(options[0]?.value || '');
    }
  }, [mode, options]);

  const dataA = useMemo(() => options.find(o => o.value === periodA)?.data || null, [periodA, options]);
  const dataB = useMemo(() => options.find(o => o.value === periodB)?.data || null, [periodB, options]);

  const calculateDelta = (valA: number, valB: number) => {
    if (!valA) return 0;
    return ((valB - valA) / valA) * 100;
  };

  const regDelta = dataA && dataB ? calculateDelta(dataA.registered, dataB.registered) : 0;
  const solveRateA = dataA ? (dataA.detected / (dataA.registered || 1)) * 100 : 0;
  const solveRateB = dataB ? (dataB.detected / (dataB.registered || 1)) * 100 : 0;
  const solveRateDelta = solveRateB - solveRateA;

  return (
    <div className="space-y-16 p-0 border-none bg-transparent">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-12 border-b border-[#09090B] pb-12">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-4 h-[1px] bg-[#2563EB]" />
            <span className="text-[10px] font-data font-black uppercase tracking-[0.4em] text-[#2563EB]">Protocol: Temporal_Ledger</span>
          </div>
          <h2 className="text-6xl md:text-8xl font-display font-black tracking-tighter uppercase leading-[0.8] italic">
            Comparative <br/> <span className="text-[#2563EB]">Analysis</span>
          </h2>
          <p className="text-lg font-medium max-w-lg text-slate-500 leading-snug">
            Precision-locked cross-reference of metropolitan safety vectors. Select temporal nodes to generate forensic delta coefficients.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex border border-[#09090B] bg-white p-1">
            {[
              { id: 'standard', label: 'Month' },
              { id: 'aggregate', label: '3-Mo Window' },
              { id: 'yoy', label: 'YoY' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setMode(item.id as ComparisonMode)}
                className={cn(
                  "px-8 py-3 text-[10px] font-data font-black uppercase tracking-widest transition-all",
                  mode === item.id 
                    ? "bg-[#09090B] text-white" 
                    : "text-[#09090B] hover:bg-slate-50"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Strip Selection Controls */}
        <div className="lg:col-span-12 space-y-12">
          
          {/* Picker A */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <label className="text-[10px] font-data font-black uppercase text-slate-400 tracking-[0.3em]">Node_A Baseline</label>
              <div className="text-[10px] font-data font-bold text-[#2563EB] uppercase">Current: {periodA}</div>
            </div>
            <div className="relative group">
              <div 
                ref={scrollRefA}
                className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mask-fade-edges scroll-smooth"
              >
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPeriodA(opt.value)}
                    className={cn(
                      "flex-shrink-0 px-6 py-6 border transition-all text-left w-[180px] space-y-3",
                      periodA === opt.value 
                        ? "border-[#09090B] bg-[#09090B] text-white" 
                        : "border-[#E2E2E2] bg-white hover:border-[#09090B] text-[#09090B]"
                    )}
                  >
                    <div className="text-[8px] font-data font-black opacity-40 uppercase tracking-widest">Temporal_Node</div>
                    <div className="text-xs font-data font-bold truncate">{opt.label}</div>
                    <div className="h-[1px] w-8 bg-current opacity-20" />
                    <div className="text-[14px] font-display font-black tracking-tighter uppercase">{opt.data.registered.toLocaleString()} <span className="text-[8px] opacity-60">REG</span></div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8 py-4 opacity-20">
            <div className="h-[1px] grow bg-[#09090B]" />
            <div className="text-[10px] font-data font-black uppercase tracking-[0.5em] italic">VS_MATRIX</div>
            <div className="h-[1px] grow bg-[#09090B]" />
          </div>

          {/* Picker B */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <label className="text-[10px] font-data font-black uppercase text-slate-400 tracking-[0.3em]">Node_B Target</label>
              <div className="text-[10px] font-data font-bold text-[#2563EB] uppercase">Current: {periodB}</div>
            </div>
            <div className="relative group">
              <div 
                ref={scrollRefB}
                className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mask-fade-edges scroll-smooth"
              >
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPeriodB(opt.value)}
                    className={cn(
                      "flex-shrink-0 px-6 py-6 border transition-all text-left w-[180px] space-y-3",
                      periodB === opt.value 
                        ? "border-[#09090B] bg-[#09090B] text-white" 
                        : "border-[#E2E2E2] bg-white hover:border-[#09090B] text-[#09090B]"
                    )}
                  >
                    <div className="text-[8px] font-data font-black opacity-40 uppercase tracking-widest">Temporal_Node</div>
                    <div className="text-xs font-data font-bold truncate">{opt.label}</div>
                    <div className="h-[1px] w-8 bg-current opacity-20" />
                    <div className="text-[14px] font-display font-black tracking-tighter uppercase">{opt.data.registered.toLocaleString()} <span className="text-[8px] opacity-60">REG</span></div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-8 pt-12">
            
            {/* Registration Variance */}
            <div className="border border-[#09090B] p-10 space-y-8 bg-white relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Layers className="w-16 h-16" />
               </div>
               <div className="space-y-2">
                  <span className="text-[10px] font-data font-black text-slate-400 uppercase tracking-widest">Registration_Delta</span>
                  <div className="text-6xl font-display font-black tracking-tighter tabular-nums flex items-baseline gap-2">
                    {regDelta > 0 ? '+' : ''}{regDelta.toFixed(1)}<span className="text-2xl">%</span>
                  </div>
               </div>
               <div className="flex gap-1 h-1 bg-slate-100">
                  <div className={cn(
                    "h-full transition-all duration-1000",
                    regDelta > 0 ? "bg-red-500" : "bg-emerald-500"
                  )} style={{ width: `${Math.min(100, Math.abs(regDelta) * 5)}%` }} />
               </div>
               <p className="text-[10px] font-data font-bold uppercase tracking-widest text-slate-500 leading-tight">
                  Forensic variance coefficient based on archival baseline.
               </p>
            </div>

            {/* Efficiency Variance */}
            <div className="border border-[#09090B] p-10 space-y-8 bg-white relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Activity className="w-16 h-16" />
               </div>
               <div className="space-y-2">
                  <span className="text-[10px] font-data font-black text-slate-400 uppercase tracking-widest">Clearance_Efficiency</span>
                  <div className="text-6xl font-display font-black tracking-tighter tabular-nums flex items-baseline gap-2">
                    {solveRateDelta > 0 ? '+' : ''}{solveRateDelta.toFixed(1)}<span className="text-2xl">PTS</span>
                  </div>
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-[8px] font-data font-black text-slate-300 uppercase">Base_Rate</div>
                    <div className="text-sm font-data font-bold">{solveRateA.toFixed(1)}%</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[8px] font-data font-black text-slate-300 uppercase">Target_Rate</div>
                    <div className="text-sm font-data font-bold">{solveRateB.toFixed(1)}%</div>
                  </div>
               </div>
               <p className="text-[10px] font-data font-bold uppercase tracking-widest text-[#2563EB] leading-tight">
                  Measure of detection effectiveness vs registration load.
               </p>
            </div>

            {/* Forensic Brief */}
            <div className="border border-[#09090B] p-10 space-y-8 bg-[#09090B] text-white">
               <div className="flex items-center justify-between">
                  <span className="text-[10px] font-data font-black text-white/40 uppercase tracking-widest">Forensic_Narrative</span>
                  <div className="w-2 h-2 bg-[#2563EB] animate-pulse" />
               </div>
               <div className="space-y-4">
                  <p className="text-2xl font-display font-medium leading-[1.1] uppercase italic tracking-tight">
                    {regDelta > 5 
                      ? "Systemic registration surge detected in target window." 
                      : regDelta < -5 
                        ? "Significant reduction in incident reporting observed." 
                        : "Nominal stability in registration baseline."}
                  </p>
                  <p className="text-[11px] font-data text-white/50 leading-relaxed uppercase tracking-widest">
                    Telemetry shows {solveRateDelta > 0 ? 'Improvement' : 'Strain'} in operational resolve operations. {mode.toUpperCase()} sync complete.
                  </p>
               </div>
               <button className="w-full py-4 border border-white/20 text-[10px] font-data font-black uppercase tracking-[0.3em] hover:bg-white hover:text-[#09090B] transition-colors">
                  Generate_PDF_Report
               </button>
            </div>
        </div>
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .mask-fade-edges {
          mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }
      `}</style>
    </div>
  );
};
