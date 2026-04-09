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
import {
  fetchTrends, fetchCategories, fetchAnomalies, fetchInsights,
  TrendData, CategoryData, Anomaly, Insight,
} from '@/lib/api';

export type Tab = 'overview' | 'trends' | 'forecast' | 'anomalies' | 'chat';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchTrends(), fetchCategories(), fetchAnomalies(), fetchInsights()])
      .then(([t, c, a, i]) => {
        setTrends(t || []);
        setCategories(c || []);
        setAnomalies(a || []);
        setInsights(i || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalRegistered = trends.reduce((s, r) => s + (r.Registered || 0), 0);
  const totalDetected = trends.reduce((s, r) => s + (r.Detected || 0), 0);
  const detectionRate = totalRegistered > 0 ? (totalDetected / totalRegistered) * 100 : 0;
  const latestMonth = trends[trends.length - 1] ?? null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="w-10 h-10 border-t-2 border-[#09090B] rounded-full animate-spin" />
          <p className="text-sm font-data text-slate-400 uppercase tracking-widest">Loading data…</p>
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
      </main>

      <Footer />

      {/* Floating AI chat button — hidden on the chat tab itself */}
      {activeTab !== 'chat' && (
        <ChatFAB onClick={() => setActiveTab('chat')} />
      )}
    </div>
  );
}
