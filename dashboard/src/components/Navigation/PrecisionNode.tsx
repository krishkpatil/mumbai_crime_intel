'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface PrecisionNodeProps {
  status?: 'SECURE' | 'SYNCING' | 'ENCRYPTED' | 'LIVE';
  className?: string;
}

export const PrecisionNode: React.FC<PrecisionNodeProps> = ({ 
  status = 'LIVE', 
  className 
}) => {
  return (
    <div className={cn("flex items-center gap-4 px-4 py-2 border border-[#09090B] bg-white", className)}>
      <div className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2563EB] opacity-75"></span>
        <span className="relative inline-flex h-2 w-2 bg-[#2563EB]"></span>
      </div>
      
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-data font-black uppercase tracking-[0.2em] text-[#09090B]">
            Node_Status
          </span>
          <span className="text-[10px] font-data font-bold text-[#2563EB] tracking-widest animation-pulse-fast">
            [{status}]
          </span>
        </div>
        <div className="text-[8px] font-data font-bold text-slate-400 uppercase tracking-widest">
          Telemetry: Active // 0ms_Lat
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse-fast {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animation-pulse-fast {
          animation: pulse-fast 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
};
