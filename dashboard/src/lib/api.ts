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

// ── Streaming chat with tool use ──────────────────────────────────────────────

/**
 * Simple chat history entry — only user/assistant turns.
 * Tool internals are handled server-side by LangGraph and never sent to the client.
 */
export interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatMeta {
  timestamp: string;   // ISO string when done event arrived
  duration_ms: number; // wall-clock ms from send → done
  tokens: number | null;
}

export const streamChat = async (
  question: string,
  history: ApiMessage[],
  onToken: (chunk: string) => void,
  onTool:  (name: string) => void,
  onToolResult: (name: string, data: any, args: any) => void,
  onDone:  (answer: string, history: ApiMessage[], meta: ChatMeta) => void,
  onError: (err: string) => void,
): Promise<void> => {
  const startedAt = Date.now();
  try {
    const resp = await fetch(`${BASE_URL}/chat/stream`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ question, history }),
    });

    if (!resp.ok || !resp.body) {
      onError('Chat stream failed. Is the backend running?');
      return;
    }

    const reader  = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE lines are separated by \n\n; keep any incomplete line in the buffer
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === 'tool')  onTool(event.name);
          if (event.type === 'tool_result') onToolResult(event.name, event.data, event.args);
          if (event.type === 'token') onToken(event.content);
          if (event.type === 'done')  onDone(event.answer, event.history ?? [], {

            timestamp:   new Date().toISOString(),
            duration_ms: Date.now() - startedAt,
            tokens:      event.tokens ?? null,
          });
        } catch { /* skip malformed events */ }
      }
    }
  } catch {
    onError('Connection error. Make sure the backend is running.');
  }
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

export interface PipelineProgressData {
  running: boolean;
  phase: string | null;
  current_file: string | null;
  files_done: number;
  files_total: number;
  new_pdfs_found: number;
  log: string[];
  started_at: string | null;
  error: string | null;
  stale?: boolean;
}

export const fetchPipelineProgress = async (): Promise<PipelineProgressData | null> => {
  const resp = await fetch(`${BASE_URL}/pipeline/progress`);
  if (!resp.ok) return null;
  return resp.json();
};

export const exportUrls = {
  json:    `${BASE_URL}/export/json`,
  csv:     `${BASE_URL}/export/csv`,
  quality: `${BASE_URL}/export/quality`,
  pdf: (filename: string) => `${BASE_URL}/pdfs/${encodeURIComponent(filename)}`,
};
