"""
ChatAgent — LangGraph agentic loop with LangChain @tool decorators.

Uses a StateGraph(MessagesState) with a ToolNode so the LLM can call
tools as many times as needed before streaming the final answer.
"""

import json
import os
from datetime import datetime
from typing import AsyncGenerator

import pandas as pd

# ── System prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = f"""You are a crime data analyst for the Mumbai Crime Intelligence Platform.
You have access to official Mumbai Police monthly crime statistics from 2018 to early 2026.
Current Date: {datetime.now().strftime('%B %Y')}

Always use the provided tools to retrieve precise data before answering.
Never estimate or fabricate numbers — call a tool to get exact figures first.

Rules:
- Use tools proactively; one tool call per data need
- When calling a tool, provide only the tool call, no preamble
- Be specific: cite exact months, numbers, percentage changes
- Keep responses concise (3–6 sentences) unless the user asks for detail
- If a question is outside the dataset scope, say so clearly"""


# ── Tool factory (avoids circular imports with dependencies.py) ───────────────

def create_tools(store, forecast_engine):
    """
    Build and return a list of LangChain @tool instances wired to the live
    data store and forecast engine.  Called once inside ChatAgent.__init__.
    """
    from langchain_core.tools import tool

    @tool
    def query_trends(
        group: str | None = None, domain: str | None = None, year: int | None = None
    ) -> str:
        """Get monthly registered and detected crime totals.

        Optionally filter by crime group (e.g. 'Women Crimes', 'Cyber Crime',
        'Fatal Crimes', 'Theft & Robbery', 'Violent Crimes', 'White Collar',
        'Kidnapping', 'Misc'), domain, or a specific year.

        If no year is provided, returns the 36 most recent months.
        """
        kwargs = {}
        if group:
            kwargs["group"] = group
        if domain:
            kwargs["domain"] = domain
        if year:
            kwargs["year"] = year
        data = store.get_summary(**kwargs)

        # If filtered by year, return all available months for that year
        if year:
            return json.dumps(data)

        # Default to last 36 months for broader trends
        return json.dumps(data[-36:])

    @tool
    def get_categories(year: int | None = None) -> str:
        """Get total registered/detected crimes broken down by category.

        Optional year filter (e.g. 2023).  Returns every category with
        its registered and detected totals.
        """
        data = store.get_categories(year=year)
        return json.dumps(data)

    @tool
    def get_anomalies() -> str:
        """Get statistically detected anomalies and structural change points.

        Uses Isolation Forest + CUSUM algorithms.  Returns date, type,
        severity, detail text, and isolation score for each anomaly.
        """
        return json.dumps(store.get_anomalies())

    @tool
    def get_forecast(group: str) -> str:
        """Get 6-month Prophet forecast for a crime group.

        Available groups: 'Women Crimes', 'Fatal Crimes', 'Kidnapping', 'Misc'.
        Returns only future forecast points (is_forecast=True) with
        yhat, yhat_lower, yhat_upper confidence bands.
        """
        result = forecast_engine.get(group)
        if group in result:
            result[group] = [r for r in result[group] if r.get("is_forecast")]
        return json.dumps(result)

    @tool
    def get_dataset_info() -> str:
        """Get dataset overview: date range, total records, available crime groups.

        Call this first when you are unsure what data is available or what
        crime groups / categories the dataset contains.
        """
        df = store.df
        groups = (
            sorted(df["group"].dropna().unique().tolist())
            if "group" in df.columns
            else []
        )
        date_range = ""
        if "dt" in df.columns:
            valid = df["dt"].dropna()
            if not valid.empty:
                date_range = (
                    f"{valid.min().strftime('%Y-%m')} to {valid.max().strftime('%Y-%m')}"
                )
        total = (
            len(df[df["is_total"] == False])
            if "is_total" in df.columns
            else len(df)
        )
        return json.dumps(
            {
                "total_records": total,
                "date_range": date_range,
                "crime_groups": groups,
                "forecastable_groups": [
                    "Women Crimes",
                    "Fatal Crimes",
                    "Kidnapping",
                    "Misc",
                ],
            }
        )

    return [query_trends, get_categories, get_anomalies, get_forecast, get_dataset_info]


# ── ChatAgent ─────────────────────────────────────────────────────────────────

class ChatAgent:
    MODEL = "llama-3.3-70b-versatile"

    def __init__(self, df: pd.DataFrame, store=None, forecast_engine=None):
        self._store = store
        self._forecast_engine = forecast_engine
        self._graph = None   # built lazily on first use

    # ── Lazy graph construction ───────────────────────────────────────────────

    @property
    def graph(self):
        if self._graph is None:
            self._graph = self._build_graph()
        return self._graph

    def _build_graph(self):
        from langchain_groq import ChatGroq
        from langchain_core.messages import SystemMessage
        from langgraph.graph import StateGraph, MessagesState, END
        from langgraph.prebuilt import ToolNode, tools_condition

        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY not set.")

        tools = create_tools(self._store, self._forecast_engine)

        llm = ChatGroq(
            model=self.MODEL,
            temperature=0.3,
            api_key=api_key,
            max_tokens=1024,
        )
        llm_with_tools = llm.bind_tools(tools, tool_choice="auto")

        async def agent_node(state: MessagesState):
            messages = [SystemMessage(content=SYSTEM_PROMPT)] + state["messages"]
            response = await llm_with_tools.ainvoke(messages)
            return {"messages": [response]}

        builder = StateGraph(MessagesState)
        builder.add_node("agent", agent_node)
        builder.add_node("tools", ToolNode(tools))
        builder.set_entry_point("agent")
        builder.add_conditional_edges("agent", tools_condition)
        builder.add_edge("tools", "agent")
        return builder.compile()

    # ── Message conversion helpers ────────────────────────────────────────────

    @staticmethod
    def _to_lc_messages(history: list) -> list:
        """Convert plain {role, content} dicts → LangChain message objects."""
        from langchain_core.messages import HumanMessage, AIMessage

        result = []
        for m in history:
            role = m.get("role", "user")
            content = m.get("content", "")
            if role == "user":
                result.append(HumanMessage(content=content))
            elif role == "assistant":
                result.append(AIMessage(content=content))
        return result

    # ── Streaming API ─────────────────────────────────────────────────────────

    async def stream(self, question: str, history: list) -> AsyncGenerator:
        """
        Async generator yielding events:
          ('tool',  tool_name)                          — tool being called
          ('token', text_chunk)                         — streaming answer token
          ('done',  {'answer': str, 'history': list})   — final state
        """
        from langchain_core.messages import HumanMessage

        lc_history = self._to_lc_messages(history)
        input_messages = lc_history + [HumanMessage(content=question)]

        full_answer = ""
        tool_calls_seen: set[str] = set()
        total_tokens = 0
        # Track whether any tools have fired in the current agent turn so we
        # can discard pre-tool preamble tokens (e.g. "Let me look that up…").
        pending_tool_in_current_turn = False

        async for event in self.graph.astream_events(
            {"messages": input_messages},
            version="v2",
            config={"recursion_limit": 25},
        ):
            kind = event["event"]
            name = event.get("name", "")

            # New agent turn starts — reset the tool-in-turn flag
            if kind == "on_chain_start" and name == "agent":
                pending_tool_in_current_turn = False
                # Reset accumulated text so we only keep the final answer pass
                full_answer = ""

            # Tool start — emit badge event (deduplicate parallel calls)
            elif kind == "on_tool_start":
                pending_tool_in_current_turn = True
                key = f"{name}_{event.get('run_id','')}"
                if key not in tool_calls_seen:
                    tool_calls_seen.add(key)
                    yield ("tool", name)

            # Tool end — emit result event for inline visualizations
            elif kind == "on_tool_end":
                run_id = event.get("run_id", "")
                if run_id not in tool_calls_seen:
                    tool_calls_seen.add(run_id)
                    output = event["data"].get("output", {})
                    # output is a ToolMessage; .content is the JSON string result
                    content = output.content if hasattr(output, "content") else str(output)
                    try:
                        yield ("tool_result", {"name": name, "data": json.loads(content)})
                    except Exception:
                        pass  # skip if not valid JSON

            # Streaming tokens from the agent's LLM call
            elif kind == "on_chat_model_stream":
                chunk = event["data"].get("chunk")
                if chunk and chunk.content and not pending_tool_in_current_turn:
                    token = chunk.content
                    full_answer += token
                    yield ("token", token)

            # Accumulate token usage across all LLM calls (tool turns + final answer)
            elif kind == "on_chat_model_end":
                output = event["data"].get("output")
                if output and hasattr(output, "usage_metadata") and output.usage_metadata:
                    total_tokens += output.usage_metadata.get("total_tokens", 0)

        # Build clean history (only user/assistant turns)
        new_history = list(history) + [
            {"role": "user",      "content": question},
            {"role": "assistant", "content": full_answer},
        ]
        yield ("done", {
            "answer":  full_answer,
            "history": new_history,
            "tokens":  total_tokens or None,
        })
