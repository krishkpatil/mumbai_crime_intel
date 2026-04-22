"""
ChatEngine — Groq LLM with tool use and streaming.

Instead of pre-stuffing a massive context string, the LLM calls tools to
retrieve precise data on demand, then streams its answer token by token.
"""

import json
import os
from typing import Generator

import pandas as pd
from fastapi import HTTPException

# ── Tool definitions ──────────────────────────────────────────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "query_trends",
            "description": (
                "Get monthly registered and detected crime totals. "
                "Optionally filter by crime group (e.g. 'Women Crimes', 'Cyber Crime', "
                "'Fatal Crimes', 'Theft & Robbery', 'Violent Crimes', 'White Collar', "
                "'Kidnapping', 'Misc') or domain."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "group":  {"type": "string", "description": "Crime group name"},
                    "domain": {"type": "string", "description": "Crime domain name"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_categories",
            "description": "Get total registered/detected crimes broken down by category. Optional year filter.",
            "parameters": {
                "type": "object",
                "properties": {
                    "year": {"type": "integer", "description": "Year to filter (e.g. 2020)"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_anomalies",
            "description": "Get statistically detected anomalies and structural change points (Isolation Forest + CUSUM).",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_forecast",
            "description": (
                "Get 6-month Prophet forecast for a crime group. "
                "Available groups: 'Women Crimes', 'Fatal Crimes', 'Kidnapping', 'Misc'."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "group": {"type": "string", "description": "Crime group to forecast"},
                },
                "required": ["group"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_dataset_info",
            "description": "Get dataset overview: date range, total records, available crime groups.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]

SYSTEM_PROMPT = """You are a crime data analyst for the Mumbai Crime Intelligence Platform.
You have access to official Mumbai Police monthly crime statistics from 2018 to early 2026.

Always use the provided tools to retrieve precise data before answering.
Never estimate or fabricate numbers — call a tool to get exact figures first.

Rules:
- Use tools proactively; one tool call per data need
- Be specific: cite exact months, numbers, percentage changes
- Keep responses concise (3–6 sentences) unless the user asks for detail
- If a question is outside the dataset scope, say so clearly"""


# ── Engine ────────────────────────────────────────────────────────────────────

class ChatEngine:
    MODEL = "llama-3.3-70b-versatile"

    def __init__(self, df: pd.DataFrame, store=None, forecast_engine=None):
        self._client       = None
        self._store        = store
        self._forecast_eng = forecast_engine

    # ── Groq client (lazy) ────────────────────────────────────────────────────

    @property
    def client(self):
        if self._client is None:
            from groq import Groq
            api_key = os.environ.get("GROQ_API_KEY")
            if not api_key:
                raise HTTPException(status_code=503, detail="GROQ_API_KEY not set.")
            self._client = Groq(api_key=api_key)
        return self._client

    # ── Tool execution ────────────────────────────────────────────────────────

    def _execute_tool(self, name: str, args: dict) -> str:
        """Run a tool call against the live data store and return JSON string."""
        try:
            if name == "query_trends":
                data = self._store.get_summary(**{k: v for k, v in args.items() if k in ("group", "domain")})
                # Cap to 36 months so we don't blow the context window
                return json.dumps(data[-36:])

            elif name == "get_categories":
                year = args.get("year")
                data = self._store.get_categories(year=year)
                return json.dumps(data)

            elif name == "get_anomalies":
                return json.dumps(self._store.get_anomalies())

            elif name == "get_forecast":
                group = args.get("group", "")
                result = self._forecast_eng.get(group)
                # Return only forecast points (is_forecast=True) to keep payload small
                if group in result:
                    result[group] = [r for r in result[group] if r.get("is_forecast")]
                return json.dumps(result)

            elif name == "get_dataset_info":
                df = self._store.df
                groups = sorted(df["group"].dropna().unique().tolist()) if "group" in df.columns else []
                date_range = ""
                if "dt" in df.columns:
                    valid = df["dt"].dropna()
                    if not valid.empty:
                        date_range = f"{valid.min().strftime('%Y-%m')} to {valid.max().strftime('%Y-%m')}"
                total = len(df[df["is_total"] == False]) if "is_total" in df.columns else len(df)
                return json.dumps({
                    "total_records":        total,
                    "date_range":           date_range,
                    "crime_groups":         groups,
                    "forecastable_groups":  ["Women Crimes", "Fatal Crimes", "Kidnapping", "Misc"],
                })

            else:
                return json.dumps({"error": f"Unknown tool: {name}"})

        except Exception as e:
            return json.dumps({"error": str(e)})

    # ── Message builder ───────────────────────────────────────────────────────

    def _build_messages(self, question: str, history: list) -> list:
        return list(history) + [{"role": "user", "content": question}]

    # ── Agentic tool loop (shared by ask + stream) ────────────────────────────

    def _run_tool_loop(self, messages: list):
        """
        Run tool calls until the model stops requesting them.
        Mutates `messages` in place; yields ('tool', name) for each call.
        Returns when no more tool calls are needed.
        """
        for _ in range(4):
            resp = self.client.chat.completions.create(
                model=self.MODEL,
                messages=[{"role": "system", "content": SYSTEM_PROMPT}] + messages,
                tools=TOOLS,
                tool_choice="auto",
                max_tokens=256,   # Just enough to decide on tool calls
                temperature=0.3,
            )
            msg = resp.choices[0].message
            if not msg.tool_calls:
                return   # Done — no more tools needed

            # Append assistant's tool-call decision
            messages.append({
                "role":       "assistant",
                "content":    msg.content or "",
                "tool_calls": [tc.model_dump() for tc in msg.tool_calls],
            })
            # Execute each tool and append results
            for tc in msg.tool_calls:
                yield ("tool", tc.function.name)
                result = self._execute_tool(
                    tc.function.name,
                    json.loads(tc.function.arguments or "{}"),
                )
                messages.append({
                    "role":         "tool",
                    "tool_call_id": tc.id,
                    "content":      result,
                })

    # ── Public API ────────────────────────────────────────────────────────────

    def ask(self, question: str, history: list) -> str:
        """Non-streaming: run tool loop then return final text answer."""
        messages = self._build_messages(question, history)
        list(self._run_tool_loop(messages))   # Exhaust generator (side-effects only)

        resp = self.client.chat.completions.create(
            model=self.MODEL,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}] + messages,
            max_tokens=1024,
            temperature=0.3,
        )
        return resp.choices[0].message.content or ""

    def stream(self, question: str, history: list) -> Generator:
        """
        Generator yielding events:
          ('tool',  tool_name)                         — tool being called
          ('token', text_chunk)                        — streaming answer token
          ('done',  {'answer': str, 'messages': list}) — final state for history
        """
        messages = self._build_messages(question, history)

        # Phase 1: run tool calls (synchronous — data is local, fast)
        yield from self._run_tool_loop(messages)

        # Phase 2: stream the final answer (no tools this time)
        stream = self.client.chat.completions.create(
            model=self.MODEL,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}] + messages,
            max_tokens=1024,
            temperature=0.3,
            stream=True,
        )
        full_text = ""
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                full_text += delta
                yield ("token", delta)

        messages.append({"role": "assistant", "content": full_text})
        yield ("done", {"answer": full_text, "messages": messages})
