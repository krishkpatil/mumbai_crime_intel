'use client';

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const TrendsChart = ({ data }: { data: any[] }) => {
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-10 pb-6 border-b border-[#09090B]">
        <div className="flex gap-8 text-[10px] font-data font-black uppercase tracking-widest">
          <div className="flex items-center gap-2">
            <div className="w-4 h-[2px] bg-[#09090B]" />
            <span className="text-[#09090B]">Registered</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-[1px] bg-[#2563EB]" />
            <span className="text-[#2563EB]">Detected</span>
          </div>
        </div>
      </div>
      
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorReg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#09090B" stopOpacity={0.05}/>
                <stop offset="95%" stopColor="#09090B" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorDet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1}/>
                <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis 
              dataKey="report_date" 
              stroke="#cbd5e1" 
              style={{ fontSize: '10px', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 }}
              tickLine={true} 
              axisLine={true}
              dy={15}
            />
            <YAxis 
              stroke="#cbd5e1" 
              style={{ fontSize: '10px', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 }}
              tickLine={true} 
              axisLine={true}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#09090B', 
                border: '1px solid #2563EB', 
                borderRadius: '0px', 
                padding: '16px'
              }}
              itemStyle={{ color: '#fff', fontSize: '10px', fontFamily: '"JetBrains Mono", monospace', fontWeight: '800', textTransform: 'uppercase' }}
              labelStyle={{ color: '#2563EB', marginBottom: '8px', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.2em' }}
            />
            <Area 
              type="stepAfter" 
              dataKey="Registered" 
              stroke="#09090B" 
              strokeWidth={2} 
              fillOpacity={1} 
              fill="url(#colorReg)" 
              animationDuration={1000}
            />
            <Area 
              type="stepAfter" 
              dataKey="Detected" 
              stroke="#2563EB" 
              strokeWidth={1.5} 
              fillOpacity={1} 
              fill="url(#colorDet)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
