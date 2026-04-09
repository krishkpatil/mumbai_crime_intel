'use client';

import React, { useState, useEffect } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  onClick: () => void;
}

export const ChatFAB: React.FC<Props> = ({ onClick }) => {
  const [hovered, setHovered] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Show the "Ask about Mumbai crime data" hint bubble after 4s on first load
  useEffect(() => {
    const t = setTimeout(() => setShowHint(true), 4000);
    return () => clearTimeout(t);
  }, []);

  // Auto-dismiss hint after it appears
  useEffect(() => {
    if (!showHint) return;
    const t = setTimeout(() => setShowHint(false), 4000);
    return () => clearTimeout(t);
  }, [showHint]);

  return (
    <div
      className="fixed bottom-24 right-5 md:bottom-8 md:right-8 z-40 flex flex-col items-end gap-3"
      onMouseEnter={() => { setHovered(true); setShowHint(false); }}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Hint bubble */}
      <div className={cn(
        'bg-[#09090B] text-white text-xs font-data font-bold px-4 py-2.5 max-w-[200px] text-right leading-snug shadow-lg transition-all duration-500',
        (showHint || hovered)
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 translate-y-2 pointer-events-none'
      )}>
        <span className="text-[#2563EB]">AI-powered</span> — ask anything about Mumbai crime data
        {/* Arrow pointing down-right */}
        <div className="absolute -bottom-2 right-5 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-[#09090B]" />
      </div>

      {/* FAB */}
      <div className="relative">
        {/* Pulse rings */}
        <div className="fab-ring absolute inset-0 bg-[#2563EB] opacity-30 pointer-events-none" />
        <div className="fab-ring-2 absolute inset-0 bg-[#2563EB] opacity-20 pointer-events-none" />

        <button
          onClick={onClick}
          aria-label="Open AI chat"
          className={cn(
            'fab-float relative w-14 h-14 flex items-center justify-center shadow-2xl transition-all duration-300',
            hovered
              ? 'bg-[#2563EB] scale-110'
              : 'bg-[#09090B]'
          )}
        >
          {/* Sparkle badge top-right */}
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#2563EB] flex items-center justify-center">
            <Sparkles className="w-3 h-3 text-white" />
          </div>

          <Bot className={cn(
            'w-6 h-6 text-white transition-transform duration-300',
            hovered && 'scale-110'
          )} />
        </button>
      </div>
    </div>
  );
};
