export interface TrendData {
  report_date: string;
  Registered: number;
  Detected: number;
}

export interface CategoryData {
  category: string;
  Registered: number;
  Detected: number;
}

export interface ReliabilityData {
  date: string;
  extraction_score: number;
  semantic_score: number;
}

export interface Anomaly {
  date: string;
  type: string;
  severity: string;
  details: string;
  isolation_score?: number | null;
}

export interface Insight {
  title: string;
  text: string;
  type: 'standard' | 'positive' | 'info' | 'warning';
}

export interface LineageData {
  filename: string;
  page: number;
  extraction: number;
  semantic: number;
}

export interface ForecastPoint {
  ds: string;
  yhat: number;
  yhat_lower: number;
  yhat_upper: number;
  is_forecast: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'https://mcip-backend.onrender.com/api').replace(/\/$/, '');

export const fetchTrends = async (group?: string): Promise<TrendData[]> => {
  const url = group ? `${BASE_URL}/trends?group=${encodeURIComponent(group)}` : `${BASE_URL}/trends`;
  const resp = await fetch(url);
  return resp.json();
};

export const fetchCategories = async (): Promise<CategoryData[]> => {
  const resp = await fetch(`${BASE_URL}/categories`);
  return resp.json();
};

export const fetchReliability = async (): Promise<ReliabilityData[]> => {
  const resp = await fetch(`${BASE_URL}/reliability`);
  return resp.json();
};

export const fetchAnomalies = async (): Promise<Anomaly[]> => {
  const resp = await fetch(`${BASE_URL}/anomalies`);
  return resp.json();
};

export const fetchInsights = async (): Promise<Insight[]> => {
  const resp = await fetch(`${BASE_URL}/insights`);
  return resp.json();
};

export const fetchLineage = async (date: string): Promise<LineageData[]> => {
  const resp = await fetch(`${BASE_URL}/lineage?date=${date}`);
  return resp.json();
};

export const fetchForecast = async (group?: string): Promise<Record<string, ForecastPoint[]>> => {
  const url = group
    ? `${BASE_URL}/forecast?group=${encodeURIComponent(group)}`
    : `${BASE_URL}/forecast`;
  const resp = await fetch(url);
  return resp.json();
};

export const sendChat = async (
  question: string,
  history: ChatMessage[]
): Promise<{ answer: string; history: ChatMessage[] }> => {
  const resp = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, history }),
  });
  return resp.json();
};

// ── Data tab ──────────────────────────────────────────────────────────────────

export interface QualityRecord {
  filename: string;
  report_date: string;
  layout: string;
  extraction_score: number;
  semantic_score: number;
  status: 'SUCCESS' | 'ERROR';
}

export interface PipelineRun {
  started_at: string;
  finished_at: string | null;
  trigger: string;
  new_pdfs: number;
  status: string;
  error: string | null;
  records_total: number;
}

export const fetchQuality = async (): Promise<QualityRecord[]> => {
  const resp = await fetch(`${BASE_URL}/quality`);
  if (!resp.ok) return [];
  return resp.json();
};

export const fetchPipelineStatus = async (): Promise<PipelineRun[]> => {
  const resp = await fetch(`${BASE_URL}/pipeline/status`);
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.runs ?? [];
};

export const triggerPipeline = async (): Promise<boolean> => {
  const resp = await fetch(`${BASE_URL}/pipeline/trigger`, { method: 'POST' });
  return resp.ok;
};

export const fetchHealth = async (): Promise<{ records: number } | null> => {
  const resp = await fetch(`${BASE_URL}/health`);
  if (!resp.ok) return null;
  return resp.json();
};

export const exportUrls = {
  json:    `${BASE_URL}/export/json`,
  csv:     `${BASE_URL}/export/csv`,
  quality: `${BASE_URL}/export/quality`,
  pdf: (filename: string) => `${BASE_URL}/pdfs/${encodeURIComponent(filename)}`,
};
