'use client';

import React, { useState, useRef, useEffect } from 'react';
import { sendChat, ChatMessage } from '@/lib/api';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const SUGGESTED = [
  'Which crime category grew most in 2023?',
  'How did COVID-19 affect crime rates?',
  'Compare women\'s safety trends before and after 2024',
  'What is the overall detection rate trend?',
  'Which year had the most registered cases?',
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (question: string) => {
    if (!question.trim() || loading) return;
    setError('');
    const userMsg: Message = { role: 'user', content: question };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await sendChat(question, history);
      setMessages(prev => [...prev, { role: 'assistant', content: res.answer }]);
      setHistory(res.history);
    } catch (e) {
      setError('Could not reach the API. Make sure the backend is running on port 8000.');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-h-[780px] min-h-[500px]">
      <div className="mb-4">
        <h1 className="text-3xl font-display font-black tracking-tight text-[#09090B]">Ask AI</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ask questions about the Mumbai crime data. Powered by Llama 3.3 70B via Groq.
        </p>
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
              <p className="text-xs text-slate-400">The AI has access to all 90 months of statistics</p>
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
              <div className="w-7 h-7 bg-[#09090B] flex items-center justify-center shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            <div
              className={cn(
                'max-w-[78%] px-4 py-3 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-[#09090B] text-white'
                  : 'bg-slate-50 border border-[#E2E2E2] text-[#09090B]'
              )}
            >
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 border border-[#E2E2E2] flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4 text-slate-400" />
              </div>
            )}
          </div>
        ))}

        {/* Loading bubble */}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 bg-[#09090B] flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-slate-50 border border-[#E2E2E2] px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              <span className="text-sm text-slate-400">Thinking…</span>
            </div>
          </div>
        )}

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
          disabled={loading}
          className="flex-1 resize-none bg-transparent text-sm text-[#09090B] placeholder:text-slate-300 outline-none font-sans leading-relaxed max-h-32 overflow-y-auto disabled:opacity-50"
          style={{ scrollbarWidth: 'none' }}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          className="w-9 h-9 bg-[#09090B] flex items-center justify-center hover:bg-[#2563EB] transition-colors disabled:opacity-30 disabled:pointer-events-none shrink-0"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Suggested questions (after first message) */}
      {messages.length > 0 && (
        <div className="pt-3 flex flex-wrap gap-2">
          {SUGGESTED.slice(0, 3).map(q => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={loading}
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
