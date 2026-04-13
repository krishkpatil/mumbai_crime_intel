'use client';

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navigation/Navbar';
import { Footer } from '@/components/Navigation/Footer';
import { ChatFAB } from '@/components/Navigation/ChatFAB';
import { OverviewView } from '@/components/Views/OverviewView';
import { TrendsView } from '@/components/Views/TrendsView';
import { ForecastView } from '@/components/Views/ForecastView';
import { AnomaliesView } from '@/components/Views/AnomaliesView';
import { ChatView } from '@/components/Views/ChatView';
import { DataView } from '@/components/Views/DataView';
import {
  fetchTrends, fetchCategories, fetchAnomalies, fetchInsights,
  TrendData, CategoryData, Anomaly, Insight,
} from '@/lib/api';

export type Tab = 'overview' | 'trends' | 'forecast' | 'anomalies' | 'chat' | 'data';

type StepStatus = 'waiting' | 'loading' | 'done' | 'error';
interface Step { label: string; detail: string; status: StepStatus; }

const STEPS: Omit<Step, 'status'>[] = [
  { label: 'Waking up backend',     detail: 'Free tier spins down after inactivity — cold start takes 30–50s' },
  { label: 'Loading crime records', detail: '2,658 records across 90 months (2018–2026)' },
  { label: 'Fetching categories',   detail: '41 canonical crime types via NLP clustering' },
  { label: 'Loading anomalies',     detail: 'Pre-computed Isolation Forest + CUSUM results from database' },
  { label: 'Loading insights',      detail: 'Detection rates, trends, period comparisons' },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<Step[]>(
    STEPS.map((s, i) => ({ ...s, status: i === 0 ? 'loading' : 'waiting' }))
  );

  const setStep = (i: number, status: StepStatus) =>
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, status } : s));

  useEffect(() => {
    (async () => {
      try {
        // Step 0: wake backend (trends call acts as the ping)
        setStep(0, 'loading');
        const t = await fetchTrends();
        setStep(0, 'done');
        setTrends(t || []);

        // Step 1: already done via trends
        setStep(1, 'loading');
        setStep(1, 'done');

        // Step 2: categories
        setStep(2, 'loading');
        const c = await fetchCategories();
        setStep(2, 'done');
        setCategories(c || []);

        // Step 3: anomalies
        setStep(3, 'loading');
        const a = await fetchAnomalies();
        setStep(3, 'done');
        setAnomalies(a || []);

        // Step 4: insights
        setStep(4, 'loading');
        const ins = await fetchInsights();
        setStep(4, 'done');
        setInsights(ins || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalRegistered = trends.reduce((s, r) => s + (r.Registered || 0), 0);
  const totalDetected = trends.reduce((s, r) => s + (r.Detected || 0), 0);
  const detectionRate = totalRegistered > 0 ? (totalDetected / totalRegistered) * 100 : 0;
  const latestMonth = trends[trends.length - 1] ?? null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center">
        <div className="flex flex-col gap-5 w-full max-w-sm px-6">
          <div className="flex flex-col gap-1 mb-2">
            <p className="text-sm font-semibold text-slate-800 uppercase tracking-widest">Mumbai Crime Intelligence</p>
            <p className="text-xs text-slate-400">Initialising platform…</p>
          </div>
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-0.5 w-5 h-5 flex-shrink-0 flex items-center justify-center">
                {step.status === 'done' && (
                  <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {step.status === 'loading' && (
                  <div className="w-4 h-4 border-2 border-t-[#09090B] border-slate-200 rounded-full animate-spin" />
                )}
                {step.status === 'waiting' && (
                  <div className="w-3 h-3 rounded-full bg-slate-200" />
                )}
                {step.status === 'error' && (
                  <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <p className={`text-sm font-medium ${step.status === 'waiting' ? 'text-slate-300' : 'text-slate-800'}`}>
                  {step.label}
                </p>
                {step.status !== 'waiting' && (
                  <p className="text-xs text-slate-400">{step.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-8 pb-24 md:pb-10">
        {activeTab === 'overview' && (
          <OverviewView
            trends={trends}
            insights={insights}
            anomalies={anomalies}
            totalRegistered={totalRegistered}
            detectionRate={detectionRate}
            latestMonth={latestMonth}
            onNavigate={setActiveTab}
          />
        )}
        {activeTab === 'trends' && (
          <TrendsView trends={trends} categories={categories} />
        )}
        {activeTab === 'forecast' && <ForecastView />}
        {activeTab === 'anomalies' && <AnomaliesView anomalies={anomalies} />}
        {activeTab === 'chat' && <ChatView />}
        {activeTab === 'data' && <DataView />}
      </main>

      <Footer />

      {/* Floating AI chat button — hidden on the chat tab itself */}
      {activeTab !== 'chat' && (
        <ChatFAB onClick={() => setActiveTab('chat')} />
      )}
    </div>
  );
}
