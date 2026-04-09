'use client';

import React from 'react';
import { TrendData, CategoryData, Anomaly, Insight } from '@/lib/api';
import { TrendsChart } from '@/components/Charts/TrendsChart';
import { ArrowRight, TrendingUp, Shield, Calendar, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tab } from '@/app/page';

interface Props {
  trends: TrendData[];
  insights: Insight[];
  anomalies: Anomaly[];
  totalRegistered: number;
  detectionRate: number;
  latestMonth: TrendData | null;
  onNavigate: (tab: Tab) => void;
}

const insightIcon = (type: Insight['type']) => {
  switch (type) {
    case 'positive': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
    case 'warning':  return <AlertCircle className="w-5 h-5 text-rose-500" />;
    case 'info':     return <Info className="w-5 h-5 text-[#2563EB]" />;
    default:         return <TrendingUp className="w-5 h-5 text-slate-400" />;
  }
};

const severityColor = (s: string) => {
  switch (s) {
    case 'Critical': return 'border-l-rose-600 bg-rose-50';
    case 'High':     return 'border-l-orange-400 bg-orange-50';
    case 'Medium':   return 'border-l-yellow-400 bg-yellow-50';
    default:         return 'border-l-[#2563EB] bg-blue-50';
  }
};

export const OverviewView: React.FC<Props> = ({
  trends, insights, anomalies, totalRegistered, detectionRate, latestMonth, onNavigate
}) => {
  const recentAnomalies = anomalies.filter(a => a.severity !== 'Info').slice(0, 3);
  const recentTrends = trends.slice(-24);

  return (
    <div className="space-y-10">

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-display font-black tracking-tight text-[#09090B]">Overview</h1>
        <p className="mt-1 text-sm text-slate-500">Mumbai Police crime statistics, 2018–2026</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="border border-[#E2E2E2] bg-white p-6 space-y-2">
          <div className="flex items-center gap-2 text-xs font-data text-slate-400 uppercase tracking-widest">
            <AlertTriangle className="w-3.5 h-3.5" /> Total Cases Registered
          </div>
          <div className="text-4xl font-display font-black tracking-tight tabular-nums">
            {totalRegistered.toLocaleString()}
          </div>
          <p className="text-xs text-slate-400">Across all categories, 2018–2026</p>
        </div>

        <div className="border border-[#E2E2E2] bg-white p-6 space-y-2">
          <div className="flex items-center gap-2 text-xs font-data text-slate-400 uppercase tracking-widest">
            <Shield className="w-3.5 h-3.5" /> Overall Detection Rate
          </div>
          <div className="text-4xl font-display font-black tracking-tight tabular-nums">
            {detectionRate.toFixed(1)}%
          </div>
          <p className="text-xs text-slate-400">Cases detected vs registered</p>
        </div>

        <div className="border border-[#E2E2E2] bg-white p-6 space-y-2">
          <div className="flex items-center gap-2 text-xs font-data text-slate-400 uppercase tracking-widest">
            <Calendar className="w-3.5 h-3.5" /> Latest Report
          </div>
          <div className="text-4xl font-display font-black tracking-tight tabular-nums">
            {latestMonth?.Registered.toLocaleString() ?? '—'}
          </div>
          <p className="text-xs text-slate-400">{latestMonth?.report_date ?? ''} — registered cases</p>
        </div>
      </div>

      {/* Trend chart (last 24 months) */}
      <div className="border border-[#E2E2E2] bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-data font-black uppercase tracking-widest">Crime Trend — Last 24 Months</h2>
          <button
            onClick={() => onNavigate('trends')}
            className="flex items-center gap-1 text-xs font-data text-[#2563EB] hover:underline"
          >
            Full trends <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="h-[280px] overflow-hidden">
          <TrendsChart data={recentTrends} />
        </div>
      </div>

      {/* Insights + Anomalies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Insights */}
        <div className="space-y-3">
          <h2 className="text-sm font-data font-black uppercase tracking-widest text-[#09090B]">Key Insights</h2>
          <div className="space-y-3">
            {insights.map((ins, i) => (
              <div key={i} className="border border-[#E2E2E2] bg-white p-5 flex gap-4">
                <div className="mt-0.5 shrink-0">{insightIcon(ins.type)}</div>
                <div>
                  <p className="text-sm font-bold text-[#09090B]">{ins.title}</p>
                  <p className="text-sm text-slate-500 mt-1 leading-snug">{ins.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent anomalies */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-data font-black uppercase tracking-widest text-[#09090B]">Recent Anomalies</h2>
            <button
              onClick={() => onNavigate('anomalies')}
              className="flex items-center gap-1 text-xs font-data text-[#2563EB] hover:underline"
            >
              See all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-3">
            {recentAnomalies.length === 0 && (
              <p className="text-sm text-slate-400">No significant anomalies detected.</p>
            )}
            {recentAnomalies.map((a, i) => (
              <div
                key={i}
                className={cn('border border-[#E2E2E2] border-l-4 p-5', severityColor(a.severity))}
              >
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs font-data font-black uppercase tracking-widest text-slate-500">{a.date}</span>
                  <span className={cn(
                    'text-[10px] font-data font-black uppercase tracking-widest px-2 py-0.5 rounded-sm',
                    a.severity === 'Critical' ? 'bg-rose-600 text-white' :
                    a.severity === 'High'     ? 'bg-orange-400 text-white' :
                    a.severity === 'Medium'   ? 'bg-yellow-400 text-[#09090B]' :
                                                'bg-[#2563EB] text-white'
                  )}>{a.severity}</span>
                </div>
                <p className="text-sm font-medium text-[#09090B]">{a.type}</p>
                <p className="text-xs text-slate-500 mt-0.5">{a.details}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
