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
