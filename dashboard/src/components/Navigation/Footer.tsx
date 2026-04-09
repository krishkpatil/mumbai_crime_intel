import React from 'react';

export const Footer: React.FC = () => (
  <footer className="hidden md:block border-t border-[#E2E2E2] bg-white mt-auto">
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
      <p className="text-xs font-data text-slate-400 uppercase tracking-widest">
        © 2026 Mumbai Crime Intelligence Platform — Data sourced from official Mumbai Police monthly reports
      </p>
      <p className="text-xs font-data text-slate-400 uppercase tracking-widest">
        2018 – 2026 · 90 months · 2,658 records
      </p>
    </div>
  </footer>
);
