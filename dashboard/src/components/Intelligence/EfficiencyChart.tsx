'use client';

import React from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface EfficiencyChartProps {
  data: any[];
}

export const EfficiencyChart: React.FC<EfficiencyChartProps> = ({ data }) => {
  // Pre-process data for efficiency (Registered vs. Clearance Rate)
  const processedData = data.map(t => ({
    name: t.report_date,
    volume: t.Registered,
    efficiency: t.Registered > 0 ? (t.Detected / t.Registered) * 100 : 0,
    detected: t.Detected
  })).sort((a, b) => b.volume - a.volume);

  return (
    <div className="w-full h-[400px] flex flex-col">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
        <div className="space-y-1">
          <h4 className="text-[10px] font-data font-black text-white uppercase tracking-[0.3em] italic">System Efficiency Matrix</h4>
          <p className="text-[9px] text-white/40 font-data uppercase tracking-widest">Case_Load [X] vs. Clearance_Rate [Y]</p>
        </div>
      </div>
      
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
            <CartesianGrid strokeDasharray="0" stroke="rgba(255,255,255,0.05)" vertical={true} horizontal={true} />
            <XAxis 
              type="number" 
              dataKey="volume" 
              name="Volume" 
              stroke="rgba(255,255,255,0.2)" 
              style={{ fontSize: '9px', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 }}
              tickLine={true}
              axisLine={true}
              label={{ value: 'VOLUME', position: 'insideBottom', offset: -10, style: { fill: 'rgba(255,255,255,0.3)', fontSize: '8px', fontWeight: 900 } }}
            />
            <YAxis 
              type="number" 
              dataKey="efficiency" 
              name="Efficiency" 
              unit="%" 
              domain={[0, 100]}
              stroke="rgba(255,255,255,0.2)" 
              style={{ fontSize: '9px', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 }}
              tickLine={true}
              axisLine={true}
            />
            <ZAxis type="number" dataKey="detected" range={[50, 400]} name="Solved" />
            <Tooltip 
              cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }}
              contentStyle={{ 
                backgroundColor: '#09090B', 
                border: '1px solid #2563EB', 
                borderRadius: '0px', 
                padding: '12px'
              }}
              itemStyle={{ color: '#fff', fontSize: '10px', fontFamily: '"JetBrains Mono", monospace', fontWeight: '800', textTransform: 'uppercase' }}
              labelStyle={{ display: 'none' }}
            />
            <Scatter name="Crime Efficiency" data={processedData}>
              {processedData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.efficiency > 70 ? '#10b981' : entry.efficiency > 40 ? '#2563EB' : '#f43f5e'} 
                  fillOpacity={0.9}
                  strokeWidth={0}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-6 mt-6 pt-6 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-[#10b981]" />
          <span className="text-[9px] font-data font-black text-white/50 uppercase tracking-widest">Optimal_Resolve</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-[#2563EB]" />
          <span className="text-[9px] font-data font-black text-white/50 uppercase tracking-widest">Stable_Sector</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-[#f43f5e]" />
          <span className="text-[9px] font-data font-black text-white/50 uppercase tracking-widest">High_Strain</span>
        </div>
      </div>
    </div>
  );
};
