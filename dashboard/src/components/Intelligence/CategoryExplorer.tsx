'use client';

import React, { useState, useEffect } from 'react';
import { fetchCategories, CategoryData } from '@/lib/api';
import { Search, Filter, ArrowUpRight, ArrowDownRight, Database, Target, Shield, AlertTriangle, Pill } from 'lucide-react';
import { cn } from '@/lib/utils';

export const CategoryExplorer = () => {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchCategories();
        setCategories(data);
      } catch (err) {
        console.error("Ledger Loading Error:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const filtered = categories.filter(c => 
    c.category.toLowerCase().includes(search.toLowerCase())
  );

  // Focus specifically on Narcotics (NDPS) if available
  const narcoticsData = categories.find(c => c.category.includes('Narcotics') || c.category.includes('NDPS'));

  if (loading) return (
    <div className="h-[600px] w-full bg-white border border-[#09090B] flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="w-16 h-16 border-t-2 border-r-2 border-[#09090B] animate-spin" />
        <div className="text-[#09090B] font-data font-black uppercase tracking-[0.4em] text-[10px]">Assembling_Sectoral_Ledger...</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-12">
      {/* Sectoral Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-12 border-b border-[#09090B] pb-12">
        <div className="space-y-6">
          <div className="flex items-center gap-3">
             <div className="w-4 h-[1px] bg-[#2563EB]" />
             <span className="text-[10px] font-data font-black uppercase tracking-[0.4em] text-[#2563EB]">Protocol: Sectoral_Intelligence</span>
          </div>
          <h3 className="text-6xl md:text-8xl font-display font-black tracking-tighter uppercase leading-[0.8] italic">
            Intelligence <br/> <span className="text-[#2563EB]">Ledger</span>
          </h3>
          <p className="text-lg font-medium max-w-lg text-slate-500 leading-snug">
            Dense categorization of metropolitan incident vectors. Sector-specific forensic extraction for deep situational awareness.
          </p>
        </div>

        <div className="w-full md:w-96 relative group">
          <label className="text-[9px] font-data font-black uppercase text-slate-400 tracking-widest absolute -top-5 left-0">Search_Database</label>
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
          <input 
            type="text" 
            placeholder="FILTER_BY_CATEGORY..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-[#09090B] rounded-none px-16 py-5 text-xs font-data font-bold placeholder:text-slate-200 outline-none focus:bg-slate-50 transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 border border-[#09090B]">
        {/* Main Ledger Table */}
        <div className="lg:col-span-8 border-b lg:border-b-0 lg:border-r border-[#09090B] bg-white overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#09090B] text-white">
                <th className="p-8 text-left text-[10px] font-data font-black uppercase tracking-[0.3em]">Sector_Identifier</th>
                <th className="p-8 text-right text-[10px] font-data font-black uppercase tracking-[0.3em]">Volume</th>
                <th className="p-8 text-right text-[10px] font-data font-black uppercase tracking-[0.3em]">Clearance</th>
                <th className="p-8 text-right text-[10px] font-data font-black uppercase tracking-[0.3em]">Index</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((cat, idx) => {
                const solveRate = (cat.Detected / (cat.Registered || 1)) * 100;
                return (
                  <tr key={cat.category} className="hover:bg-slate-50 transition-colors group">
                    <td className="p-8">
                      <div className="flex items-center gap-6">
                        <span className="text-[10px] font-data font-black text-slate-200 uppercase tabular-nums">0{idx + 1}</span>
                        <div className="space-y-1">
                          <div className="text-[13px] font-display font-black text-[#09090B] uppercase tracking-tight group-hover:text-[#2563EB] transition-colors">{cat.category}</div>
                          <div className="text-[8px] font-data font-black text-slate-300 uppercase tracking-widest">BNS_REF_{cat.category.slice(0, 3).toUpperCase()}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-8 text-right font-data font-bold text-sm tracking-tighter">{cat.Registered.toLocaleString()}</td>
                    <td className="p-8 text-right font-data font-bold text-sm tracking-tighter tabular-nums">{cat.Detected.toLocaleString()}</td>
                    <td className="p-8 text-right">
                       <span className={cn(
                         "px-3 py-1 border text-[10px] font-data font-black",
                         solveRate > 70 ? "border-emerald-200 text-emerald-600 bg-emerald-50" : 
                         solveRate > 40 ? "border-[#2563EB]/20 text-[#2563EB] bg-[#2563EB]/5" : 
                         "border-red-200 text-red-600 bg-red-50"
                       )}>
                         {solveRate.toFixed(1)}%
                       </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Specialized Narcotic Ledger (Side-Bar Focus) */}
        <div className="lg:col-span-4 p-12 bg-slate-50 space-y-12">
           <div className="space-y-6">
              <div className="flex items-center gap-3">
                 <Pill className="w-5 h-5 text-[#2563EB]" />
                 <span className="text-[10px] font-data font-black uppercase tracking-[0.3em] text-[#2563EB]">Focus: Narcotics_Intel</span>
              </div>
              <h4 className="text-4xl font-display font-black tracking-tighter uppercase italic leading-none">NDPS Forensic Brief</h4>
              <p className="text-[11px] font-data font-bold text-slate-400 uppercase leading-relaxed tracking-widest">
                 High-intensity monitoring of narcotic distribution networks and recovery operations across the metropolitan domain.
              </p>
           </div>

           <div className="space-y-6">
              <div className="border border-[#09090B] p-8 bg-white space-y-6">
                 <div className="flex items-center justify-between">
                    <span className="text-[9px] font-data font-black text-slate-400 uppercase tracking-widest">Total_Narcotic_Records</span>
                    <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
                 </div>
                 <div className="text-5xl font-display font-black tracking-tighter text-[#09090B]">
                    {narcoticsData?.Registered || '—'}
                 </div>
                 <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <span className="text-[9px] font-data font-bold text-slate-400 uppercase">Clearance_Coefficient</span>
                    <span className="text-sm font-data font-black text-[#2563EB]">
                      {narcoticsData ? ((narcoticsData.Detected / narcoticsData.Registered)*100).toFixed(1) : '0'}%
                    </span>
                 </div>
              </div>

              <div className="bg-[#09090B] p-8 text-white space-y-6">
                 <div className="flex items-center justify-between">
                    <span className="text-[9px] font-data font-black text-white/40 uppercase tracking-widest">Hotspot_Activity</span>
                    <div className="w-2 h-2 bg-[#ef4444] animate-pulse" />
                 </div>
                 <div className="space-y-2">
                    <div className="text-[10px] font-data font-bold text-white/60 uppercase">Deterrence_Index</div>
                    <div className="text-4xl font-display font-black tracking-tighter uppercase italic">HIGH_OPS</div>
                 </div>
                 <p className="text-[9px] font-data font-bold uppercase text-white/30 tracking-widest leading-relaxed">
                    Surveillance protocols synchronized with centralized anti-narcotic cell data feeds.
                 </p>
              </div>
           </div>

           <div className="pt-6">
              <button className="w-full py-5 border border-[#09090B] text-[#09090B] text-[10px] font-data font-black uppercase tracking-[0.4em] hover:bg-[#09090B] hover:text-white transition-colors">
                DOWNLOAD_NDPS_REPORT
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};
