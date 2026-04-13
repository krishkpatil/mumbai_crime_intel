'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  fetchQuality, fetchPipelineStatus, fetchHealth, triggerPipeline, exportUrls,
  QualityRecord, PipelineRun,
} from '@/lib/api';
import { Database, Download, Play, CheckCircle, XCircle, Clock, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Helpers ───────────────────────────────────────────────────────────────────

const scoreBarColor = (score: number) =>
  score >= 0.8 ? 'bg-emerald-500' : score >= 0.5 ? 'bg-yellow-400' : 'bg-rose-500';

const scoreTextColor = (score: number) =>
  score >= 0.8 ? 'text-emerald-600' : score >= 0.5 ? 'text-yellow-600' : 'text-rose-600';

const runStatusStyle = (status: string) => {
  if (status === 'success') return 'bg-emerald-100 text-emerald-700';
  if (status === 'error')   return 'bg-rose-100 text-rose-700';
  return 'bg-blue-100 text-blue-700';
};

const formatTs = (ts: string | null): string => {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return ts;
  }
};

// ── Sub-components ────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}> = ({ icon, label, value, valueClass }) => (
  <div className="border border-[#E2E2E2] bg-white p-6 space-y-2">
    <div className="flex items-center gap-2 text-xs font-data text-slate-400 uppercase tracking-widest">
      <span className="w-3.5 h-3.5 flex-shrink-0">{icon}</span>
      {label}
    </div>
    <div className={cn(
      'font-display font-black tracking-tight tabular-nums',
      value.length > 12 ? 'text-xl' : 'text-4xl',
      valueClass
    )}>
      {value || '—'}
    </div>
  </div>
);

const ScoreBar: React.FC<{ score: number }> = ({ score }) => (
  <div className="flex items-center gap-2 min-w-[90px]">
    <div className="flex-1 h-1.5 bg-slate-100 overflow-hidden">
      <div
        className={cn('h-full transition-all', scoreBarColor(score))}
        style={{ width: `${(score * 100).toFixed(0)}%` }}
      />
    </div>
    <span className={cn('text-[10px] font-data font-black tabular-nums w-7 text-right', scoreTextColor(score))}>
      {(score * 100).toFixed(0)}%
    </span>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

export const DataView: React.FC = () => {
  const [quality, setQuality]                 = useState<QualityRecord[]>([]);
  const [runs, setRuns]                       = useState<PipelineRun[]>([]);
  const [health, setHealth]                   = useState<{ records: number } | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [filter, setFilter]                   = useState<'All' | 'SUCCESS' | 'ERROR'>('All');
  const [triggering, setTriggering]           = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pdfsAvailable, setPdfsAvailable]     = useState<boolean | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const r = await fetchPipelineStatus();
      setRuns(r);
      if (r[0]?.status !== 'running') {
        stopPolling();
        setPipelineRunning(false);
      }
    }, 4000);
  }, [stopPolling]);

  useEffect(() => {
    Promise.all([fetchQuality(), fetchPipelineStatus(), fetchHealth()])
      .then(([q, r, h]) => {
        setQuality(q);
        setRuns(r);
        setHealth(h);
        if (r[0]?.status === 'running') {
          setPipelineRunning(true);
          startPolling();
        }
      })
      .finally(() => setLoading(false));
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  // Single HEAD probe to check if PDFs are available in this deployment
  useEffect(() => {
    if (quality.length === 0) return;
    fetch(exportUrls.pdf(quality[0].filename), { method: 'HEAD' })
      .then(r => setPdfsAvailable(r.ok))
      .catch(() => setPdfsAvailable(false));
  }, [quality]);

  const handleTrigger = async () => {
    setTriggering(true);
    const ok = await triggerPipeline();
    setTriggering(false);
    if (ok) {
      setPipelineRunning(true);
      startPolling();
    }
  };

  // Derived stats
  const totalPdfs     = quality.length;
  const avgExtraction = totalPdfs
    ? quality.reduce((s, r) => s + r.extraction_score, 0) / totalPdfs
    : 0;
  const lastRunTs     = runs[0]?.finished_at ?? null;
  const totalRecords  = health?.records ?? 0;
  const filteredQuality = filter === 'All' ? quality : quality.filter(r => r.status === filter);

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-black tracking-tight text-[#09090B]">Data Pipeline</h1>
          <p className="mt-1 text-sm text-slate-500">Source PDF ingestion transparency — quality scores, pipeline runs, and dataset exports.</p>
        </div>
        <div className="border border-[#E2E2E2] bg-white h-[200px] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-t-2 border-[#09090B] rounded-full animate-spin" />
            <p className="text-xs font-data text-slate-400 uppercase tracking-widest">Loading pipeline data…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-display font-black tracking-tight text-[#09090B]">Data Pipeline</h1>
        <p className="mt-1 text-sm text-slate-500">
          Source PDF ingestion transparency — quality scores, pipeline runs, and dataset exports.
        </p>
      </div>

      {/* ── Section 1: Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={<FileText className="w-3.5 h-3.5" />}
          label="PDFs Processed"
          value={totalPdfs.toString()}
        />
        <StatCard
          icon={<Database className="w-3.5 h-3.5" />}
          label="Records in DB"
          value={totalRecords.toLocaleString()}
        />
        <StatCard
          icon={<CheckCircle className="w-3.5 h-3.5" />}
          label="Avg Extraction Quality"
          value={`${(avgExtraction * 100).toFixed(0)}%`}
          valueClass={scoreTextColor(avgExtraction)}
        />
        <StatCard
          icon={<Clock className="w-3.5 h-3.5" />}
          label="Last Pipeline Run"
          value={formatTs(lastRunTs)}
        />
      </div>

      {/* ── Section 2: Pipeline Control ── */}
      <div className="border border-[#E2E2E2] bg-white">
        <div className="p-6 border-b border-[#E2E2E2] flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-sm font-data font-black uppercase tracking-widest text-[#09090B]">
              Pipeline Control
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Trigger a new ingestion run to process any new PDFs from the Mumbai Police portal.
            </p>
          </div>
          <button
            onClick={handleTrigger}
            disabled={pipelineRunning || triggering}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-xs font-data font-bold uppercase tracking-widest transition-all',
              pipelineRunning || triggering
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                : 'bg-[#09090B] text-white hover:bg-[#2563EB]'
            )}
          >
            {pipelineRunning || triggering ? (
              <><div className="w-3 h-3 border-t-2 border-slate-400 rounded-full animate-spin" /> Pipeline running…</>
            ) : (
              <><Play className="w-3.5 h-3.5" /> Run Pipeline</>
            )}
          </button>
        </div>

        {runs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#09090B] text-white">
                  {['Started', 'Trigger', 'New PDFs', 'Records', 'Status'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left font-data font-black uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 5).map((run, i) => (
                  <tr key={i} className={cn('border-t border-[#E2E2E2]', i % 2 === 1 && 'bg-slate-50')}>
                    <td className="px-4 py-3 text-slate-600">{formatTs(run.started_at)}</td>
                    <td className="px-4 py-3 font-data font-bold uppercase text-slate-500 text-[10px] tracking-widest">{run.trigger}</td>
                    <td className="px-4 py-3 tabular-nums">{run.new_pdfs}</td>
                    <td className="px-4 py-3 tabular-nums">{run.records_total.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-[10px] font-data font-black uppercase tracking-widest px-2 py-0.5', runStatusStyle(run.status))}>
                        {run.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-400 text-center py-8">No pipeline runs recorded yet.</p>
        )}
      </div>

      {/* ── Section 3: Source Files ── */}
      <div className="border border-[#E2E2E2] bg-white">
        <div className="p-6 border-b border-[#E2E2E2] flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-sm font-data font-black uppercase tracking-widest text-[#09090B]">
              Source Files
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Per-PDF extraction quality and semantic validation scores.
            </p>
          </div>
          <div className="flex gap-2">
            {(['All', 'SUCCESS', 'ERROR'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-3 py-1.5 text-xs font-data font-bold uppercase tracking-widest border transition-all',
                  filter === f
                    ? 'bg-[#09090B] text-white border-[#09090B]'
                    : 'bg-white text-slate-500 border-[#E2E2E2] hover:border-[#09090B]'
                )}
              >
                {f}
                {f !== 'All' && (
                  <span className="ml-1.5 opacity-60">
                    {quality.filter(r => r.status === f).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#09090B] text-white">
                {['Filename', 'Report Date', 'Layout', 'Extraction', 'Semantic', 'Status', 'PDF'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-data font-black uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredQuality.map((rec, i) => (
                <tr key={rec.filename} className={cn('border-t border-[#E2E2E2]', i % 2 === 1 && 'bg-slate-50')}>
                  <td className="px-4 py-3 text-slate-700 max-w-[160px] truncate" title={rec.filename}>
                    {rec.filename}
                  </td>
                  <td className="px-4 py-3 text-slate-600 tabular-nums whitespace-nowrap">{rec.report_date}</td>
                  <td className="px-4 py-3 text-slate-400 font-data text-[10px] uppercase tracking-wide max-w-[140px] truncate" title={rec.layout}>
                    {rec.layout}
                  </td>
                  <td className="px-4 py-3"><ScoreBar score={rec.extraction_score} /></td>
                  <td className="px-4 py-3"><ScoreBar score={rec.semantic_score} /></td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'text-[10px] font-data font-black uppercase tracking-widest px-2 py-0.5',
                      rec.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                    )}>
                      {rec.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {pdfsAvailable === null ? (
                      <div className="w-3 h-3 border-t border-slate-300 rounded-full animate-spin" />
                    ) : pdfsAvailable ? (
                      <a
                        href={exportUrls.pdf(rec.filename)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Download ${rec.filename}`}
                        className="text-[#09090B] hover:text-[#2563EB] transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                      </a>
                    ) : (
                      <span
                        className="text-slate-300 cursor-not-allowed"
                        title="PDFs not available in cloud deployment"
                      >
                        <FileText className="w-4 h-4" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredQuality.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-8">No records match this filter.</p>
          )}
        </div>
      </div>

      {/* ── Section 4: Export ── */}
      <div className="border border-[#E2E2E2] bg-white p-6">
        <h2 className="text-sm font-data font-black uppercase tracking-widest text-[#09090B] mb-1">
          Export Dataset
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          Files are generated from the live database. JSON preserves full lineage metadata.
        </p>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Download JSON',        url: exportUrls.json    },
            { label: 'Download CSV',         url: exportUrls.csv     },
            { label: 'Download Quality CSV', url: exportUrls.quality },
          ].map(({ label, url }) => (
            <button
              key={label}
              onClick={() => window.open(url, '_blank')}
              className="flex items-center gap-2 px-4 py-2 text-xs font-data font-bold uppercase tracking-widest border border-[#E2E2E2] bg-white text-slate-500 hover:bg-[#09090B] hover:text-white hover:border-[#09090B] transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
};
