'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

interface InlineChatChartProps {
  toolName: string;
  data: any;
  args?: any;
}

const COLORS = [
  '#09090B', // Ink Black
  '#2563EB', // Intelligence Blue
  '#475569', // Slate 600
  '#64748b', // Slate 500
  '#1e293b', // Slate 800
  '#0f172a', // Slate 900
];

const TooltipContent = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#09090B] border border-[#2563EB] p-2 shadow-xl">
        <p className="text-[9px] font-data font-black text-[#2563EB] uppercase tracking-wider mb-1">
          {label}
        </p>
        {payload.map((item: any, idx: number) => (
          <div key={idx} className="flex items-center justify-between gap-4">
            <span className="text-[8px] font-data text-white/60 uppercase">{item.name}:</span>
            <span className="text-[10px] font-data font-bold text-white tabular-nums">
              {item.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const CompactTrendsChart = ({ data }: { data: any[] }) => {
  const latest = data[data.length - 1];
  const first = data[0];
  const diff = latest && first ? latest.Registered - first.Registered : 0;
  const pct = first && first.Registered !== 0 ? (diff / first.Registered) * 100 : 0;

  return (
    <div className="h-[260px] w-full">
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-4 text-[8px] font-data font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-[2px] bg-[#09090B]" />
            <span className="text-[#09090B]">Registered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-[1.5px] bg-[#2563EB]" />
            <span className="text-[#2563EB]">Detected</span>
          </div>
        </div>
        
        {latest && (
          <div className="text-right">
            <div className="text-[14px] font-data font-black text-[#09090B]">
              {latest.Registered.toLocaleString()}
            </div>
            <div className={cn(
              "text-[8px] font-data font-bold",
              pct >= 0 ? "text-rose-600" : "text-emerald-600"
            )}>
              {pct >= 0 ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}% vs start
            </div>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 20 }}>
          <defs>
            <linearGradient id="inlineReg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#09090B" stopOpacity={0.05} />
              <stop offset="95%" stopColor="#09090B" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="report_date"
            stroke="#cbd5e1"
            fontSize={8}
            fontFamily="JetBrains Mono"
            tickFormatter={(val) => {
              const parts = val.split('-');
              return `${parts[1]}/${parts[0].slice(2)}`;
            }}
            interval={5}
            dy={10}
          />
          <YAxis 
            stroke="#cbd5e1" 
            fontSize={8} 
            fontFamily="JetBrains Mono" 
            width={25}
          />
          <Tooltip content={<TooltipContent />} />
          <Area
            type="monotone"
            dataKey="Registered"
            stroke="#09090B"
            strokeWidth={1.5}
            fill="url(#inlineReg)"
            animationDuration={500}
          />
          <Area
            type="monotone"
            dataKey="Detected"
            stroke="#2563EB"
            strokeWidth={1}
            fill="transparent"
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const CompactCategoryChart = ({ data }: { data: any[] }) => {
  const sorted = [...data].sort((a, b) => b.Registered - a.Registered);
  const top = sorted[0];

  return (
    <div className="h-[260px] w-full">
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-4 text-[8px] font-data font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 bg-[#09090B]" />
            <span className="text-slate-500">Registered Cases</span>
          </div>
        </div>
        
        {top && (
          <div className="text-right">
            <div className="text-[8px] font-data font-bold text-slate-400 uppercase tracking-tighter">Top Category</div>
            <div className="text-[12px] font-data font-black text-[#09090B] truncate max-w-[120px]">
              {top.category}
            </div>
            <div className="text-[10px] font-data font-bold text-[#2563EB]">
              {top.Registered.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="category"
            stroke="#cbd5e1"
            fontSize={7}
            fontFamily="JetBrains Mono"
            interval={0}
            angle={-45}
            textAnchor="end"
            height={40}
          />
          <YAxis stroke="#cbd5e1" fontSize={8} fontFamily="JetBrains Mono" width={25} />
          <Tooltip content={<TooltipContent />} />
          <Bar dataKey="Registered" fill="#09090B" radius={0} barSize={16}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

const CompactForecastChart = ({ data }: { data: any }) => {
  // Forecast tool returns { group: [points...] }
  const points = Object.values(data)[0] as any[];
  const latest = points[points.length - 1];
  const max = Math.max(...points.map(p => p.yhat));

  return (
    <div className="h-[260px] w-full">
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-4 text-[8px] font-data font-bold uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-[1.5px] bg-[#2563EB]" />
            <span className="text-[#2563EB]">6-Month Forecast</span>
          </div>
        </div>
        
        {latest && (
          <div className="text-right">
            <div className="text-[8px] font-data font-bold text-slate-400 uppercase tracking-tighter">Forecasted Peak</div>
            <div className="text-[14px] font-data font-black text-[#2563EB]">
              {Math.round(max).toLocaleString()}
            </div>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={points} margin={{ top: 5, right: 5, left: -20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="ds"
            stroke="#cbd5e1"
            fontSize={8}
            fontFamily="JetBrains Mono"
            tickFormatter={(val) => {
              const parts = val.split('-');
              return `${parts[1]}/${parts[0].slice(2)}`;
            }}
            interval={1}
            dy={10}
          />
          <YAxis stroke="#cbd5e1" fontSize={8} fontFamily="JetBrains Mono" width={25} />
          <Tooltip content={<TooltipContent />} />
          <Line
            type="monotone"
            dataKey="yhat"
            name="Forecast"
            stroke="#2563EB"
            strokeWidth={2}
            dot={true}
            animationDuration={500}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const InlineChatChart: React.FC<InlineChatChartProps> = ({ toolName, data, args }) => {
  let chart = null;
  let label = '';

  const buildLabel = (base: string, argsObj: any) => {
    if (!argsObj || Object.keys(argsObj).length === 0) return base;
    const parts = [base];
    if (argsObj.year) parts.push(argsObj.year);
    if (argsObj.group) parts.push(argsObj.group);
    if (argsObj.domain) parts.push(argsObj.domain);
    // Fallback if args exist but aren't year/group/domain
    if (parts.length === 1 && Object.keys(argsObj).length > 0) {
      const firstVal = Object.values(argsObj)[0];
      if (typeof firstVal === 'string' || typeof firstVal === 'number') {
        parts.push(String(firstVal));
      }
    }
    return parts.join(' • ');
  };

  if (toolName === 'query_trends') {
    chart = <CompactTrendsChart data={data} />;
    label = buildLabel('Historical Trends', args);
  } else if (toolName === 'get_categories') {
    chart = <CompactCategoryChart data={data} />;
    label = buildLabel('Category Breakdown', args);
  } else if (toolName === 'get_forecast') {
    chart = <CompactForecastChart data={data} />;
    label = buildLabel('Predictive Forecast', args);
  }

  if (!chart) return null;

  return (
    <div className="mt-2 border border-[#E2E2E2] bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-3 bg-[#2563EB]" />
        <span className="text-[10px] font-data font-black uppercase tracking-widest text-slate-400">
          {label}
        </span>
      </div>
      {chart}
    </div>
  );
};
