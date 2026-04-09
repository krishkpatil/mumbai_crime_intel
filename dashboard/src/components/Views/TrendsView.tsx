'use client';

import React, { useState, useMemo, useRef } from 'react';
import { TrendData, CategoryData } from '@/lib/api';
import { TrendsChart } from '@/components/Charts/TrendsChart';
import { CategoryChart } from '@/components/Charts/CategoryChart';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const YEARS = ['All', '2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2026'];

interface Props {
  trends: TrendData[];
  categories: CategoryData[];
}

export const TrendsView: React.FC<Props> = ({ trends, categories }) => {
  const [yearFilter, setYearFilter] = useState('All');
  const [modeA, setModeA] = useState<'standard' | 'yoy'>('standard');
  const [periodA, setPeriodA] = useState('');
  const [periodB, setPeriodB] = useState('');
  const scrollRefA = useRef<HTMLDivElement>(null);
  const scrollRefB = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() =>
    yearFilter === 'All' ? trends : trends.filter(t => t.report_date.startsWith(yearFilter)),
    [trends, yearFilter]
  );

  // Comparison setup
  const options = useMemo(() => {
    if (modeA === 'yoy') {
      return trends.map(t => ({ value: t.report_date, label: t.report_date, registered: t.Registered, detected: t.Detected }));
    }
    return trends.map(t => ({ value: t.report_date, label: t.report_date, registered: t.Registered, detected: t.Detected }));
  }, [trends, modeA]);

  const dataA = options.find(o => o.value === periodA) ?? options[options.length - 2] ?? null;
  const dataB = options.find(o => o.value === periodB) ?? options[options.length - 1] ?? null;

  const regDelta = dataA && dataB && dataA.registered > 0
    ? ((dataB.registered - dataA.registered) / dataA.registered) * 100
    : 0;
  const rateA = dataA ? (dataA.detected / (dataA.registered || 1)) * 100 : 0;
  const rateB = dataB ? (dataB.detected / (dataB.registered || 1)) * 100 : 0;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-display font-black tracking-tight text-[#09090B]">Trends</h1>
        <p className="mt-1 text-sm text-slate-500">Monthly registered and detected crime over time</p>
      </div>

      {/* Year filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-data text-slate-400 uppercase tracking-widest mr-2">Year:</span>
        {YEARS.map(y => (
          <button
            key={y}
            onClick={() => setYearFilter(y)}
            className={cn(
              'px-3 py-1.5 text-xs font-data font-bold uppercase tracking-widest border transition-all',
              yearFilter === y
                ? 'bg-[#09090B] text-white border-[#09090B]'
                : 'bg-white text-slate-500 border-[#E2E2E2] hover:border-[#09090B]'
            )}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Main trends chart */}
      <div className="border border-[#E2E2E2] bg-white p-6">
        <div className="h-[380px]">
          <TrendsChart data={filtered} />
        </div>
      </div>

      {/* Category breakdown */}
      <div className="border border-[#E2E2E2] bg-white p-6">
        <h2 className="text-sm font-data font-black uppercase tracking-widest mb-4">Cases by Category (All Time)</h2>
        <div className="h-[320px]">
          <CategoryChart data={categories} />
        </div>
      </div>

      {/* Category table */}
      <div className="border border-[#E2E2E2] bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E2E2E2]">
          <h2 className="text-sm font-data font-black uppercase tracking-widest">Category Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#09090B] text-white text-left">
                <th className="px-6 py-3 text-xs font-data font-black uppercase tracking-widest">#</th>
                <th className="px-6 py-3 text-xs font-data font-black uppercase tracking-widest">Category</th>
                <th className="px-6 py-3 text-xs font-data font-black uppercase tracking-widest text-right">Registered</th>
                <th className="px-6 py-3 text-xs font-data font-black uppercase tracking-widest text-right">Detected</th>
                <th className="px-6 py-3 text-xs font-data font-black uppercase tracking-widest text-right">Detection Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E2E2]">
              {categories.map((cat, idx) => {
                const rate = (cat.Detected / (cat.Registered || 1)) * 100;
                return (
                  <tr key={cat.category} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-xs font-data text-slate-300 tabular-nums">{String(idx + 1).padStart(2, '0')}</td>
                    <td className="px-6 py-4 text-sm font-medium text-[#09090B]">{cat.category}</td>
                    <td className="px-6 py-4 text-sm font-data text-right tabular-nums">{cat.Registered.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm font-data text-right tabular-nums">{cat.Detected.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={cn(
                        'text-xs font-data font-bold px-2 py-1',
                        rate > 70 ? 'bg-emerald-50 text-emerald-700' :
                        rate > 40 ? 'bg-blue-50 text-[#2563EB]' :
                                    'bg-red-50 text-red-600'
                      )}>
                        {rate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Period comparison */}
      <div className="border border-[#E2E2E2] bg-white p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-data font-black uppercase tracking-widest">Period Comparison</h2>
          <div className="flex border border-[#E2E2E2] p-0.5 gap-0.5">
            {[{ id: 'standard', label: 'Monthly' }, { id: 'yoy', label: 'Year on Year' }].map(m => (
              <button
                key={m.id}
                onClick={() => setModeA(m.id as 'standard' | 'yoy')}
                className={cn(
                  'px-3 py-1.5 text-xs font-data font-bold uppercase tracking-widest transition-all',
                  modeA === m.id ? 'bg-[#09090B] text-white' : 'text-slate-500 hover:bg-slate-50'
                )}
              >{m.label}</button>
            ))}
          </div>
        </div>

        {/* Period pickers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { label: 'Period A', current: periodA || (options[options.length - 2]?.value ?? ''), setter: setPeriodA, ref: scrollRefA },
            { label: 'Period B', current: periodB || (options[options.length - 1]?.value ?? ''), setter: setPeriodB, ref: scrollRefB },
          ].map(({ label, current, setter, ref }) => (
            <div key={label} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-data font-bold uppercase tracking-widest text-slate-400">{label}</span>
                <span className="text-xs font-data text-[#2563EB] font-bold">{current}</span>
              </div>
              <div
                ref={ref}
                className="flex gap-1.5 overflow-x-auto pb-2 scroll-smooth"
                style={{ scrollbarWidth: 'none' }}
              >
                {options.slice(-24).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setter(opt.value)}
                    className={cn(
                      'flex-shrink-0 px-3 py-2 border text-xs font-data font-bold transition-all',
                      current === opt.value
                        ? 'bg-[#09090B] text-white border-[#09090B]'
                        : 'bg-white text-slate-500 border-[#E2E2E2] hover:border-[#09090B]'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Delta cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="border border-[#E2E2E2] p-5 space-y-2">
            <p className="text-xs font-data text-slate-400 uppercase tracking-widest">Registered cases change</p>
            <div className={cn('text-3xl font-display font-black tracking-tight flex items-center gap-2', regDelta > 0 ? 'text-rose-600' : 'text-emerald-600')}>
              {regDelta > 0 ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
              {Math.abs(regDelta).toFixed(1)}%
            </div>
          </div>
          <div className="border border-[#E2E2E2] p-5 space-y-2">
            <p className="text-xs font-data text-slate-400 uppercase tracking-widest">Detection rate — Period A</p>
            <div className="text-3xl font-display font-black tracking-tight">{rateA.toFixed(1)}%</div>
          </div>
          <div className="border border-[#E2E2E2] p-5 space-y-2">
            <p className="text-xs font-data text-slate-400 uppercase tracking-widest">Detection rate — Period B</p>
            <div className={cn('text-3xl font-display font-black tracking-tight', rateB > rateA ? 'text-emerald-600' : 'text-rose-600')}>
              {rateB.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
