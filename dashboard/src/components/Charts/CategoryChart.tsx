'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Forensic Monochromatic Palette
const COLORS = [
  '#09090B', // Ink Black
  '#2563EB', // Intelligence Blue
  '#475569', // Slate 600
  '#64748b', // Slate 500
  '#1e293b', // Slate 800
  '#0f172a', // Slate 900
];

export const CategoryChart = ({ data }: { data: any[] }) => {
  return (
    <div className="w-full h-full min-h-[450px] flex flex-col">
      <div className="flex items-center justify-between mb-10 pb-6 border-b border-slate-100">
        <div className="text-[10px] font-data font-black text-slate-400 uppercase tracking-widest">
          Registered cases by category (all time)
        </div>
      </div>
      
      <div className="flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="0" stroke="#f8fafc" vertical={false} />
            <XAxis 
              dataKey="category" 
              stroke="#64748b" 
              style={{ fontSize: '10px', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 }}
              tickLine={false} 
              axisLine={false}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={100}
              dy={10}
            />
            <YAxis 
              stroke="#cbd5e1" 
              style={{ fontSize: '10px', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 }}
              tickLine={false} 
              axisLine={false}
              tickFormatter={(value) => {
                if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                return value;
              }}
              width={50}
            />
            <Tooltip 
              cursor={{ fill: 'rgba(37, 99, 235, 0.04)' }} 
              contentStyle={{ 
                backgroundColor: '#09090B', 
                border: '1px solid #2563EB', 
                borderRadius: '0px',
                padding: '12px'
              }}
              itemStyle={{ color: '#fff', fontSize: '10px', fontFamily: '"JetBrains Mono", monospace', fontWeight: '800', textTransform: 'uppercase' }}
              labelStyle={{ color: '#2563EB', marginBottom: '8px', fontSize: '9px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }}
            />
            <Bar dataKey="Registered" radius={[2, 2, 0, 0]} animationDuration={1000} barSize={48}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index === 0 ? '#2563EB' : '#09090B'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
