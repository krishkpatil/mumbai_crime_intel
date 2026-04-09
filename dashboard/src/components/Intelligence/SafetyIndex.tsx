'use client';

import React, { useState, useEffect } from 'react';
import { fetchTrends, TrendData } from '@/lib/api';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, ShieldCheck, TrendingUp, AlertCircle, ArrowUpRight, ArrowDownRight, Zap, Target, Fingerprint } from 'lucide-react';
import { cn } from '@/lib/utils';

export const WomenSafetyIndex = () => {
  const [data, setData] = useState<TrendData[]>([]);
  const [cityData, setCityData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [women, city] = await Promise.all([
          fetchTrends('Women Crimes'),
          fetchTrends()
        ]);
        setData(women);
        setCityData(city);
      } catch (err) {
        console.error("Safety Bureau Loading Error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  const latest = data[data.length - 1];
  const previous = data[data.length - 2];
  
  const diff = latest && previous ? ((latest.Registered - previous.Registered) / (previous.Registered || 1)) * 100 : 0;
  const womenSolveRate = latest ? (latest.Detected / (latest.Registered || 1)) * 100 : 0;
  
  const cityLatest = cityData[cityData.length - 1];
  const citySolveRate = cityLatest ? (cityLatest.Detected / (cityLatest.Registered || 1)) * 100 : 0;
  
  const totalArrests = data.reduce((acc, curr) => acc + curr.Detected, 0);
  const totalRegistrations = data.reduce((acc, curr) => acc + curr.Registered, 0);
  const aggregateSolveRate = (totalArrests / (totalRegistrations || 1)) * 100;

  // Trend Velocity Calculation (Last 3 months)
  const last3 = data.slice(-3);
  const trendVelocity = last3.length >= 2 
    ? (last3[last3.length-1].Registered - last3[0].Registered) / (last3[0].Registered || 1) * 100 
    : 0;

  const benchmarkDelta = womenSolveRate - citySolveRate;

  if (loading) return (
    <div className="h-[700px] w-full bg-white border border-[#09090B] flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="w-16 h-16 border-t-2 border-r-2 border-[#09090B] animate-spin" />
        <div className="text-[#09090B] font-data font-black uppercase tracking-[0.4em] text-[10px]">Syncing_Safety_Bureau_Feed...</div>
      </div>
    </div>
  );

  return (
    <div className="border border-[#09090B] overflow-hidden flex flex-col xl:flex-row min-h-[700px] bg-white">
      
      {/* Sidebar Metrics - Forensic Sidebar */}
      <div className="xl:w-[400px] p-12 border-b xl:border-b-0 xl:border-r border-[#09090B] flex flex-col justify-between space-y-16">
        <div className="space-y-10">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-[#ef4444] animate-pulse" />
            <span className="text-[10px] font-data font-black uppercase tracking-[0.4em] text-[#ef4444]">Node: Specialized_Safety</span>
          </div>
          <div className="space-y-6">
            <h3 className="text-5xl font-display font-black text-[#09090B] tracking-tighter leading-[0.8] uppercase italic">Women <br/>Safety <br/>Bureau</h3>
            <p className="text-slate-500 text-[11px] font-data font-bold uppercase tracking-[0.2em] leading-relaxed">
              Monitoring metropolitan safety vectors via high-fidelity extraction from archival incident records. [BNS_COMPLIANT]
            </p>
          </div>
        </div>

        <div className="space-y-10">
          <div className="space-y-4">
             <div className="flex items-center justify-between text-[10px] font-data font-black text-slate-400 uppercase tracking-widest">
                Trend_Velocity
                <span className={cn(
                  "px-2 py-0.5 border text-[9px]",
                  trendVelocity > 0 ? "text-red-600 border-red-200 bg-red-50" : "text-emerald-600 border-emerald-200 bg-emerald-50"
                )}>
                  {trendVelocity > 0 ? 'RISING' : 'FALLING'}
                </span>
             </div>
             <div className="text-6xl font-display font-black tracking-tighter tabular-nums text-[#09090B]">
                {Math.abs(trendVelocity).toFixed(1)}<span className="text-2xl">%</span>
             </div>
             <div className="h-1 bg-slate-100 w-full">
                <div className={cn(
                  "h-full transition-all duration-1000",
                  trendVelocity > 0 ? "bg-red-500" : "bg-emerald-500"
                )} style={{ width: `${Math.min(100, Math.abs(trendVelocity) * 2)}%` }} />
             </div>
          </div>

          <div className="grid grid-cols-1 gap-6 pt-10 border-t border-slate-100">
             <div className="flex items-start justify-between">
                <div className="space-y-1">
                   <div className="text-[10px] font-data font-black text-slate-400 uppercase tracking-widest">Aggregate_Solve_Rate</div>
                   <div className="text-3xl font-display font-black tracking-tighter text-[#09090B]">
                      {aggregateSolveRate.toFixed(1)}%
                   </div>
                </div>
                <Target className="w-5 h-5 text-[#2563EB]" />
             </div>
             <div className="flex items-start justify-between">
                <div className="space-y-1">
                   <div className="text-[10px] font-data font-black text-slate-400 uppercase tracking-widest">Total_Clearance</div>
                   <div className="text-3xl font-display font-black tracking-tighter text-[#09090B]">
                      {totalArrests.toLocaleString()}
                   </div>
                </div>
                <ShieldCheck className="w-5 h-5 text-[#2563EB]" />
             </div>
          </div>
        </div>
        
        <div className="pt-8 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-[9px] font-data font-black text-slate-400 uppercase tracking-widest">
            <Fingerprint className="w-3 h-3" /> Source: Verified_Records_MUM
          </div>
          <button className="w-full py-5 bg-[#09090B] text-white text-[10px] font-data font-bold uppercase tracking-[0.4em] hover:bg-[#2563EB] transition-colors">
            ACCESS_AUDIT_PROTOCOL
          </button>
        </div>
      </div>

      {/* Main Visualization Area */}
      <div className="grow p-12 bg-transparent flex flex-col justify-between space-y-16">
        <div className="space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-[#09090B] pb-10">
            <div className="space-y-3">
               <div className="flex items-center gap-2 text-[#ef4444] font-data font-black text-[10px] tracking-[0.3em] uppercase">
                <Activity className="w-4 h-4" />
                Telemetry: Pattern_Analysis
              </div>
              <h4 className="text-3xl font-display font-black text-[#09090B] tracking-tight uppercase italic leading-none">Registration vs Clearance Lattice</h4>
            </div>
            <div className="flex items-center gap-12 border border-[#09090B] p-4 px-6 bg-white">
               <div className="flex items-center gap-3">
                 <div className="w-3 h-3 bg-[#ef4444]" />
                 <span className="text-[10px] font-data font-black text-[#09090B] uppercase tracking-widest">Registered</span>
               </div>
               <div className="flex items-center gap-3">
                 <div className="w-3 h-3 bg-[#09090B]" />
                 <span className="text-[10px] font-data font-black text-[#09090B] uppercase tracking-widest">Cleared</span>
               </div>
            </div>
          </div>

          <div className="h-[400px] w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.05}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="1 8" stroke="#000" vertical={false} opacity={0.1} />
                <XAxis 
                  dataKey="report_date" 
                  stroke="#000" 
                  fontSize={10} 
                  fontWeight={800}
                  tickLine={true}
                  axisLine={true}
                  dy={15}
                  tickFormatter={(val) => val.split('-').slice(1).join('/')}
                  fontFamily="JetBrains Mono"
                />
                <YAxis 
                  stroke="#000" 
                  fontSize={10} 
                  fontWeight={800}
                  tickLine={true}
                  axisLine={true}
                  fontFamily="JetBrains Mono"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#09090B', 
                    border: 'none', 
                    borderRadius: '0px', 
                    padding: '16px'
                  }}
                  itemStyle={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#fff', fontFamily: 'JetBrains Mono' }}
                  labelStyle={{ color: '#fff', opacity: 0.4, marginBottom: '12px', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'JetBrains Mono' }}
                  cursor={{ stroke: '#09090B', strokeWidth: 1 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="Registered" 
                  stroke="#ef4444" 
                  fillOpacity={1} 
                  fill="url(#colorReg)"
                  strokeWidth={2} 
                  dot={{ fill: '#ef4444', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="Detected" 
                  stroke="#09090B" 
                  strokeWidth={1.5} 
                  dot={{ fill: '#09090B', r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Benchmarking Footer */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border border-[#09090B] p-10 flex items-center gap-10 bg-slate-50 relative overflow-hidden group">
             <div className="w-16 h-16 bg-[#09090B] flex items-center justify-center border border-[#09090B] shrink-0">
                <Zap className="w-8 h-8 text-white" />
             </div>
             <div>
                <span className="text-[10px] font-data font-black text-slate-400 uppercase tracking-widest block mb-1">Benchmarking_Variance</span>
                <div className="text-4xl font-display font-black text-[#09090B] tracking-tighter tabular-nums">
                  {benchmarkDelta > 0 ? '+' : ''}{benchmarkDelta.toFixed(1)} <span className="text-xs uppercase font-data text-[#ef4444] font-black">VS CITY_AVG</span>
                </div>
                <p className="text-[10px] font-data font-bold text-slate-400 uppercase tracking-wider mt-3">High intensity sectoral solve rate.</p>
             </div>
          </div>

          <div className="border border-[#09090B] p-10 flex items-center gap-10 bg-[#ef4444] text-white">
             <div className="w-16 h-16 bg-white flex items-center justify-center border border-white shrink-0">
                <AlertCircle className="w-8 h-8 text-[#ef4444]" />
             </div>
             <div>
                <span className="text-[10px] font-data font-black text-white/60 uppercase tracking-widest block mb-1">Response_Protocol</span>
                <div className="text-4xl font-display font-black text-white tracking-tighter uppercase italic leading-none">
                  HIGH_PRIORITY
                </div>
                <p className="text-[10px] font-data font-bold text-white/70 mt-4 leading-tight uppercase tracking-widest">Enhanced archival surveillance active.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
