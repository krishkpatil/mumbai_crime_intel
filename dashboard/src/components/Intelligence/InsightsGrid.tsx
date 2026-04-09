import React from 'react';
import { Lightbulb, ShieldAlert, Award, ChevronRight, Binary } from 'lucide-react';
import { Insight } from '@/lib/api';
import { cn } from '@/lib/utils';

interface InsightsGridProps {
  insights: Insight[];
}

export const InsightsGrid: React.FC<InsightsGridProps> = ({ insights }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-l border-[#09090B]">
      {insights.map((insight, idx) => (
        <div 
          key={idx}
          className={cn(
            "p-10 flex flex-col gap-10 min-h-[320px] transition-all group border-b border-r border-[#09090B] bg-white hover:bg-slate-50 relative",
            insight.type === 'positive' && "border-b-[#10B981]",
            insight.type === 'warning' && "border-b-rose-500"
          )}
        >
          <div className="flex items-center justify-between relative z-10">
            <div className={cn(
              "w-14 h-14 flex items-center justify-center border border-[#09090B] bg-white transition-all group-hover:bg-[#09090B] group-hover:text-white",
              insight.type === 'positive' ? 'text-[#10B981]' :
              insight.type === 'warning' ? 'text-rose-500' :
              'text-[#2563EB]'
            )}>
              {insight.type === 'positive' ? <Award className="w-7 h-7" /> : 
               insight.type === 'warning' ? <ShieldAlert className="w-7 h-7" /> : 
               <Lightbulb className="w-7 h-7" />}
            </div>
            
            <div className="text-[10px] font-data font-black text-slate-300 uppercase tracking-[0.3em] flex items-center gap-3">
              <span className={cn(
                "w-1.5 h-1.5",
                insight.type === 'positive' ? 'bg-[#10B981]' :
                insight.type === 'warning' ? 'bg-rose-500' :
                'bg-[#2563EB]'
              )} />
              INTEL_NODE_{idx + 1}
            </div>
          </div>

          <div className="space-y-6 relative z-10 flex-1">
            <h3 className="text-[#09090B] font-display font-black text-3xl tracking-tighter leading-[0.9] uppercase italic">
              {insight.title}
            </h3>
            <p className="text-slate-500 text-lg font-medium leading-snug">
              {insight.text}
            </p>
          </div>
          
          <div className="relative z-10 mt-auto pt-8 border-t border-slate-100 flex items-center justify-between">
            <button className="text-[10px] font-data font-black uppercase tracking-[0.4em] text-[#09090B] hover:text-[#2563EB] transition-colors flex items-center gap-2">
              Access_Dossier_File <ChevronRight className="w-3 h-3" />
            </button>
            <div className="flex gap-1">
              {[1,2,3].map(i => (
                <div key={i} className="w-2 h-0.5 bg-slate-100" />
              ))}
            </div>
          </div>

          {/* Absolute Background element */}
          <div className="absolute top-0 right-0 p-6 opacity-[0.02] pointer-events-none">
            <Binary className="w-32 h-32" />
          </div>
        </div>
      ))}
    </div>
  );
};
