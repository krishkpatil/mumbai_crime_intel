'use client';

import React, { useEffect, useState } from 'react';
import { fetchForecast, ForecastPoint } from '@/lib/api';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

const GROUPS = ['Women Crimes', 'Fatal Crimes', 'Kidnapping', 'Misc'] as const;
type Group = typeof GROUPS[number];

const CHANGEPOINTS: Record<string, string> = {
  '2020-03': 'COVID Lockdown',
  '2024-07': 'IPC → BNS Transition',
};

export const ForecastView: React.FC = () => {
  const [data, setData] = useState<Record<string, ForecastPoint[]>>({});
  const [group, setGroup] = useState<Group>('Women Crimes');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchForecast()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const points = data[group] ?? [];

  // Build recharts dataset with stacked CI band
  const chartData = points.map(p => ({
    month: p.ds,
    ci_base: p.yhat_lower,
    ci_band: Math.max(0, p.yhat_upper - p.yhat_lower),
    forecast: p.yhat,
    is_forecast: p.is_forecast,
  }));

  // First forecast month — for the reference line
  const forecastStart = points.find(p => p.is_forecast)?.ds ?? null;
  const forecastPoints = points.filter(p => p.is_forecast);
  const nextMonth = forecastPoints[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-black tracking-tight text-[#09090B]">Forecast</h1>
        <p className="mt-1 text-sm text-slate-500">
          6-month Prophet forecast with 80% confidence interval. Structural breaks at COVID-19 lockdown and IPC→BNS transition are modelled explicitly.
        </p>
      </div>

      {/* Group selector */}
      <div className="flex flex-wrap gap-2">
        {GROUPS.map(g => (
          <button
            key={g}
            onClick={() => setGroup(g)}
            className={cn(
              'px-4 py-2 text-xs font-data font-bold uppercase tracking-widest border transition-all',
              group === g
                ? 'bg-[#09090B] text-white border-[#09090B]'
                : 'bg-white text-slate-500 border-[#E2E2E2] hover:border-[#09090B]'
            )}
          >
            {g}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="border border-[#E2E2E2] bg-white h-[420px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-t-2 border-[#09090B] rounded-full animate-spin" />
            <p className="text-xs font-data text-slate-400 uppercase tracking-widest">Running Prophet models…</p>
          </div>
        </div>
      ) : (
        <>
          {/* Chart */}
          <div className="border border-[#E2E2E2] bg-white p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-sm font-data font-black uppercase tracking-widest">{group}</h2>
              <div className="flex flex-wrap gap-4 text-xs font-data text-slate-500">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-0.5 bg-[#09090B] inline-block" /> Historical fit
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-6 h-0.5 bg-[#2563EB] inline-block border-dashed border-t border-[#2563EB]" /> Forecast
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-4 h-3 bg-[#2563EB]/15 inline-block" /> 80% confidence interval
                </span>
              </div>
            </div>

            <div className="h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="#cbd5e1"
                    style={{ fontSize: '10px', fontFamily: 'var(--font-data)', fontWeight: 700 }}
                    tickLine={false}
                    axisLine={false}
                    interval={11}
                  />
                  <YAxis
                    stroke="#cbd5e1"
                    style={{ fontSize: '10px', fontFamily: 'var(--font-data)', fontWeight: 700 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#09090B', border: 'none', borderRadius: 0, padding: '12px 16px' }}
                    labelStyle={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}
                    itemStyle={{ color: '#fff', fontSize: 11, fontWeight: 700 }}
                    formatter={(value: any, name: any) => {
                      if (name === 'ci_base' || name === 'ci_band') return null;
                      return [value.toLocaleString(), name === 'forecast' ? 'Predicted' : String(name)];
                    }}
                  />

                  {/* CI band via stacking */}
                  <Area dataKey="ci_base" stackId="ci" fill="transparent" stroke="none" />
                  <Area dataKey="ci_band" stackId="ci" fill="#2563EB" fillOpacity={0.12} stroke="none" />

                  {/* Historical fitted line (solid) */}
                  <Line
                    dataKey="forecast"
                    stroke="#09090B"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />

                  {/* Changepoint verticals */}
                  {Object.entries(CHANGEPOINTS).map(([date, label]) => (
                    <ReferenceLine
                      key={date}
                      x={date}
                      stroke="#94a3b8"
                      strokeDasharray="4 4"
                      label={{ value: label, position: 'top', fontSize: 9, fill: '#94a3b8', fontFamily: 'var(--font-data)', fontWeight: 700 }}
                    />
                  ))}

                  {/* Forecast start line */}
                  {forecastStart && (
                    <ReferenceLine
                      x={forecastStart}
                      stroke="#2563EB"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      label={{ value: 'Forecast →', position: 'insideTopLeft', fontSize: 9, fill: '#2563EB', fontFamily: 'var(--font-data)', fontWeight: 700 }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Next 3 months preview */}
          {forecastPoints.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {forecastPoints.slice(0, 3).map((p, i) => (
                <div key={p.ds} className="border border-[#E2E2E2] bg-white p-5 space-y-2">
                  <p className="text-xs font-data text-slate-400 uppercase tracking-widest">{p.ds}</p>
                  <p className="text-3xl font-display font-black tracking-tight tabular-nums">
                    {p.yhat.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400">
                    80% CI: {p.yhat_lower.toLocaleString()} – {p.yhat_upper.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Methodology note */}
          <div className="border border-[#E2E2E2] bg-slate-50 p-5">
            <p className="text-xs font-data text-slate-500 leading-relaxed">
              <strong className="text-[#09090B]">Methodology:</strong> Facebook Prophet time series model trained on 90 months of data (2018–2026).
              Explicit changepoints at <strong>March 2020</strong> (COVID-19 lockdown) and <strong>July 2024</strong> (IPC→BNS legal transition).
              Yearly seasonality enabled. Forecasts groups with ≥24 months of history. Shaded band represents the 80% confidence interval.
            </p>
          </div>
        </>
      )}
    </div>
  );
};
