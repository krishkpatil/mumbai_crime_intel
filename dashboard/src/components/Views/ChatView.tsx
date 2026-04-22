'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { streamChat, ApiMessage, ChatMeta } from '@/lib/api';
import { Send, Bot, User, Loader2, Zap, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'mcip_chat_history';

/** Maps LangChain tool function names → human-readable badge labels */
const TOOL_LABELS: Record<string, string> = {
  query_trends:     'Querying crime trends',
  get_categories:   'Querying crime categories',
  get_anomalies:    'Detecting anomalies',
  get_forecast:     'Loading forecast data',
  get_dataset_info: 'Getting dataset info',
};

const SUGGESTED = [
  'Which crime category grew most in 2023?',
  'How did COVID-19 affect crime rates?',
  'Compare women\'s safety trends before and after 2024',
  'What does the forecast predict for Fatal Crimes?',
  'Which months had the highest anomaly scores?',
  'What is the overall detection rate trend?',
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface DisplayMessage {
  role: 'user' | 'assistant';
  content: string;
  tools?: string[];   // human-readable labels for tool badges
  streaming?: boolean;
  meta?: ChatMeta;
}

// ── Sub-components ────────────────────────────────────────────────────────────

const ToolBadge: React.FC<{ label: string }> = ({ label }) => (
  <span className="inline-flex items-center gap-1 text-[10px] font-data font-black uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5">
    <Zap className="w-2.5 h-2.5" />
    {label}
  </span>
);

// ── Main component ────────────────────────────────────────────────────────────

export const ChatView: React.FC = () => {
  const [messages,   setMessages]   = useState<DisplayMessage[]>([]);
  const [apiHistory, setApiHistory] = useState<ApiMessage[]>([]);
  const [input,      setInput]      = useState('');
  const [streaming,  setStreaming]  = useState(false);
  const [error,      setError]      = useState('');
  const [hydrated,   setHydrated]   = useState(false);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const pendingTools = useRef<string[]>([]);

  // ── Session persistence ───────────────────────────────────────────────────

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { display, api } = JSON.parse(saved);
        if (Array.isArray(display) && Array.isArray(api)) {
          setMessages(display);
          setApiHistory(api);
        }
      }
    } catch {
      // ignore malformed storage
    }
    setHydrated(true);
  }, []);

  // Persist whenever messages or apiHistory change (skip before hydration)
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ display: messages, api: apiHistory }),
      );
    } catch {
      // quota exceeded or private browsing — ignore
    }
  }, [messages, apiHistory, hydrated]);

  // ── Scroll ────────────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  // ── New Chat ──────────────────────────────────────────────────────────────

  const newChat = useCallback(() => {
    if (streaming) return;
    setMessages([]);
    setApiHistory([]);
    setError('');
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [streaming]);

  // ── Send ──────────────────────────────────────────────────────────────────

  const send = useCallback(async (question: string) => {
    if (!question.trim() || streaming) return;
    setError('');
    setInput('');
    pendingTools.current = [];

    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setMessages(prev => [...prev, { role: 'assistant', content: '', streaming: true }]);
    setStreaming(true);

    await streamChat(
      question,
      apiHistory,

      // onToken — append chunk to last message
      (chunk) => {
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') {
            next[next.length - 1] = { ...last, content: last.content + chunk };
          }
          return next;
        });
      },

      // onTool — map name → label, update badge list
      (name) => {
        const label = TOOL_LABELS[name] ?? name;
        pendingTools.current = [...pendingTools.current, label];
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') {
            next[next.length - 1] = { ...last, tools: [...pendingTools.current] };
          }
          return next;
        });
      },

      // onDone — finalise message, persist history
      (answer, newHistory, meta) => {
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === 'assistant') {
            next[next.length - 1] = {
              role:      'assistant',
              content:   answer,
              tools:     pendingTools.current.length > 0 ? [...pendingTools.current] : undefined,
              streaming: false,
              meta,
            };
          }
          return next;
        });
        setApiHistory(newHistory);
        setStreaming(false);
        inputRef.current?.focus();
      },

      // onError
      (err) => {
        setError(err);
        setMessages(prev => prev.slice(0, -1));
        setStreaming(false);
        inputRef.current?.focus();
      },
    );
  }, [streaming, apiHistory]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-h-[780px] min-h-[500px]">

      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-display font-black tracking-tight text-[#09090B]">Ask AI</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ask anything about Mumbai crime data. Powered by Llama 3.3 70B · tool-augmented · streaming.
          </p>
        </div>

        {messages.length > 0 && (
          <button
            onClick={newChat}
            disabled={streaming}
            title="New chat"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 border border-[#E2E2E2] hover:border-[#09090B] hover:text-[#09090B] transition-colors disabled:opacity-40 shrink-0 mt-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            New chat
          </button>
        )}
      </div>

      {/* Message area */}
      <div className="flex-1 border border-[#E2E2E2] bg-white overflow-y-auto p-4 space-y-4">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-6 py-8">
            <div className="w-12 h-12 bg-[#09090B] flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-[#09090B]">Ask anything about Mumbai crime data</p>
              <p className="text-xs text-slate-400">
                The AI queries live data — anomalies, forecasts, trends — for precise answers
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-xl">
              {SUGGESTED.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="px-3 py-2 text-xs font-medium text-[#2563EB] border border-[#2563EB]/30 bg-blue-50 hover:bg-blue-100 transition-colors rounded-sm text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            {msg.role === 'assistant' && (
              <div className={cn(
                'w-7 h-7 flex items-center justify-center shrink-0 mt-0.5',
                msg.streaming ? 'bg-blue-600' : 'bg-[#09090B]'
              )}>
                {msg.streaming
                  ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                  : <Bot className="w-4 h-4 text-white" />
                }
              </div>
            )}

            <div className="flex flex-col gap-1.5 max-w-[78%]">
              {/* Tool badges */}
              {msg.role === 'assistant' && msg.tools && msg.tools.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {msg.tools.map((t, j) => <ToolBadge key={j} label={t} />)}
                </div>
              )}

              {/* Bubble */}
              <div
                className={cn(
                  'px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                  msg.role === 'user'
                    ? 'bg-[#09090B] text-white'
                    : 'bg-slate-50 border border-[#E2E2E2] text-[#09090B]'
                )}
              >
                {msg.content || (msg.streaming && (
                  <span className="flex items-center gap-2 text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {msg.tools && msg.tools.length > 0 ? 'Analysing data…' : 'Thinking…'}
                  </span>
                ))}
                {/* Blinking cursor while streaming */}
                {msg.streaming && msg.content && (
                  <span className="inline-block w-0.5 h-4 bg-slate-400 ml-0.5 animate-pulse align-middle" />
                )}
              </div>

              {/* Meta footer — shown only on completed assistant messages */}
              {msg.role === 'assistant' && !msg.streaming && msg.meta && (
                <div className="flex items-center gap-3 text-[10px] text-slate-400 font-data tabular-nums px-0.5">
                  <span title="Completed at">
                    {new Date(msg.meta.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className="text-slate-200">·</span>
                  <span title="Response time">
                    {msg.meta.duration_ms < 1000
                      ? `${msg.meta.duration_ms}ms`
                      : `${(msg.meta.duration_ms / 1000).toFixed(1)}s`}
                  </span>
                  {msg.meta.tokens != null && (
                    <>
                      <span className="text-slate-200">·</span>
                      <span title="Total tokens used">{msg.meta.tokens.toLocaleString()} tokens</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-7 h-7 border border-[#E2E2E2] flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4 text-slate-400" />
              </div>
            )}
          </div>
        ))}

        {/* Error */}
        {error && (
          <div className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border border-t-0 border-[#E2E2E2] bg-white p-3 flex gap-3 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about Mumbai crime statistics…"
          rows={1}
          disabled={streaming}
          className="flex-1 resize-none bg-transparent text-sm text-[#09090B] placeholder:text-slate-300 outline-none font-sans leading-relaxed max-h-32 overflow-y-auto disabled:opacity-50"
          style={{ scrollbarWidth: 'none' }}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || streaming}
          className="w-9 h-9 bg-[#09090B] flex items-center justify-center hover:bg-[#2563EB] transition-colors disabled:opacity-30 disabled:pointer-events-none shrink-0"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Suggested follow-ups */}
      {messages.length > 0 && (
        <div className="pt-3 flex flex-wrap gap-2">
          {SUGGESTED.slice(0, 3).map(q => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={streaming}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 border border-[#E2E2E2] hover:border-[#09090B] hover:text-[#09090B] transition-colors disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
