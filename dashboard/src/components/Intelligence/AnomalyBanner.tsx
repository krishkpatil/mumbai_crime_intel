import React from 'react';
import { AlertOctagon, Zap, ShieldAlert } from 'lucide-react';
import { Anomaly } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AnomalyBannerProps {
  anomalies: Anomaly[];
}

export const AnomalyBanner: React.FC<AnomalyBannerProps> = ({ anomalies }) => {
  if (anomalies.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-4 h-[1px] bg-rose-500" />
        <span className="text-[10px] font-data font-black uppercase tracking-[0.4em] text-rose-500 italic">
          CRITICAL_SYSTEM_ALERTS // ANOMALY_DETECTION_LIVE
        </span>
      </div>
      
      {anomalies.map((anomaly, idx) => (
        <div 
          key={idx}
          className={cn(
            "relative overflow-hidden p-8 flex flex-col md:flex-row md:items-center gap-10 border-l-[6px] transition-all border border-[#09090B] bg-white",
            anomaly.severity === 'High' 
              ? 'border-l-rose-500' 
              : 'border-l-[#2563EB]'
          )}
        >
          <div className={cn(
            "w-20 h-20 shrink-0 flex items-center justify-center border border-[#09090B]",
            anomaly.severity === 'High' 
              ? 'bg-rose-500 text-white animate-pulse' 
              : 'bg-[#2563EB]/10 text-[#2563EB]'
          )}>
            {anomaly.severity === 'High' ? <AlertOctagon className="w-10 h-10" /> : <Zap className="w-10 h-10" />}
          </div>

          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-6">
              <div className="px-4 py-1.5 border border-[#09090B] text-[10px] font-data font-black uppercase tracking-[0.3em] bg-white">
                NODE_TYPE: {anomaly.type}
              </div>
              <span className="text-[10px] font-data font-black text-slate-400 uppercase tracking-[0.3em]">
                TIMESTAMP: {anomaly.date}
              </span>
            </div>
            <p className="text-xl md:text-2xl font-medium text-[#09090B] leading-tight max-w-5xl italic tracking-tighter">
              {anomaly.details}
            </p>
          </div>

          <div className="flex flex-col items-start md:items-end gap-4 shrink-0">
            <div className={cn(
              "px-6 py-2 text-[10px] font-data font-black uppercase tracking-[0.4em] border border-[#09090B]",
              anomaly.severity === 'High' ? 'bg-rose-500 text-white' : 'bg-white text-[#2563EB]'
            )}>
              {anomaly.severity}_PRIORITY
            </div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <div 
                  key={s} 
                  className={cn(
                    "w-1 h-3",
                    anomaly.severity === 'High' ? 'bg-rose-500' : 'bg-[#2563EB]',
                    s > 3 && 'opacity-20'
                  )} 
                />
              ))}
            </div>
          </div>
          
          {/* Subtle Background Pattern */}
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
            <ShieldAlert className="w-32 h-32" />
          </div>
        </div>
      ))}
    </div>
  );
};
