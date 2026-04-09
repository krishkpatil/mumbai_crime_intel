'use client';

import React, { useState } from 'react';
import { Anomaly } from '@/lib/api';
import { cn } from '@/lib/utils';

const SEVERITIES = ['All', 'Critical', 'High', 'Medium', 'Info'];

const severityStyle = (s: string) => {
  switch (s) {
    case 'Critical': return { badge: 'bg-rose-600 text-white', card: 'border-l-rose-600' };
    case 'High':     return { badge: 'bg-orange-400 text-white', card: 'border-l-orange-400' };
    case 'Medium':   return { badge: 'bg-yellow-400 text-[#09090B]', card: 'border-l-yellow-400' };
    default:         return { badge: 'bg-[#2563EB] text-white', card: 'border-l-[#2563EB]' };
  }
};

const typeDescription: Record<string, string> = {
  'Detection Drop':       'Detection rate fell significantly below the expected baseline.',
  'Volume Drop':          'Registered cases were unusually low for this period.',
  'Volume Spike':         'Registered cases were unusually high for this period.',
  'Multivariate Outlier': 'Unusual pattern across multiple crime categories simultaneously.',
  'Change Point':         'CUSUM detected a structural shift in the crime rate baseline.',
};

interface Props {
  anomalies: Anomaly[];
}

export const AnomaliesView: React.FC<Props> = ({ anomalies }) => {
  const [filter, setFilter] = useState('All');

  const filtered = filter === 'All' ? anomalies : anomalies.filter(a => a.severity === filter);

  const counts = SEVERITIES.reduce((acc, s) => {
    acc[s] = s === 'All' ? anomalies.length : anomalies.filter(a => a.severity === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-black tracking-tight text-[#09090B]">Anomalies</h1>
        <p className="mt-1 text-sm text-slate-500">
          Detected by Isolation Forest on a multivariate monthly feature matrix, with CUSUM change-point analysis.
        </p>
      </div>

      {/* Method cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="border border-[#E2E2E2] bg-white p-5">
          <p className="text-xs font-data font-black uppercase tracking-widest text-[#2563EB] mb-2">Isolation Forest</p>
          <p className="text-sm text-slate-500 leading-snug">
            Detects months with unusual crime volume or category mix. Trained on 9 features including per-group monthly counts and detection rate. Contamination rate: 8%.
          </p>
        </div>
        <div className="border border-[#E2E2E2] bg-white p-5">
          <p className="text-xs font-data font-black uppercase tracking-widest text-[#2563EB] mb-2">CUSUM Change-Point</p>
          <p className="text-sm text-slate-500 leading-snug">
            Cumulative sum control chart that signals when the monthly crime rate has shifted structurally away from its long-run baseline of ~2,345 cases/month.
          </p>
        </div>
      </div>

      {/* Severity filter */}
      <div className="flex flex-wrap gap-2">
        {SEVERITIES.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-xs font-data font-bold uppercase tracking-widest border transition-all',
              filter === s
                ? 'bg-[#09090B] text-white border-[#09090B]'
                : 'bg-white text-slate-500 border-[#E2E2E2] hover:border-[#09090B]'
            )}
          >
            {s}
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-sm font-black',
              filter === s ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            )}>
              {counts[s]}
            </span>
          </button>
        ))}
      </div>

      {/* Anomaly list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <p className="text-sm text-slate-400 py-8 text-center">No anomalies match this filter.</p>
        )}
        {filtered.map((a, i) => {
          const style = severityStyle(a.severity);
          return (
            <div
              key={i}
              className={cn('border border-[#E2E2E2] border-l-4 bg-white p-5', style.card)}
            >
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className="font-display font-black text-sm text-[#09090B] tracking-tight">{a.date}</span>
                <span className={cn('text-[10px] font-data font-black uppercase tracking-widest px-2 py-0.5', style.badge)}>
                  {a.severity}
                </span>
                <span className="text-xs font-data font-bold text-slate-400 uppercase tracking-widest">{a.type}</span>
                {a.isolation_score !== null && a.isolation_score !== undefined && (
                  <span className="text-[10px] font-data text-slate-300 ml-auto">
                    IF score: {a.isolation_score}
                  </span>
                )}
              </div>
              <p className="text-sm text-[#09090B] font-medium">{a.details}</p>
              {typeDescription[a.type] && (
                <p className="text-xs text-slate-400 mt-1">{typeDescription[a.type]}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
