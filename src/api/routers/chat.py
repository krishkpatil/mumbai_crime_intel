"""
Chat router — Groq LLM Q&A with tool use and streaming.

POST /api/chat         — non-streaming (kept for backward compat)
POST /api/chat/stream  — SSE streaming with live tool-use events
"""

import json

import dependencies
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from schemas import ChatRequest

router = APIRouter()

# Human-readable names for tool-use status display
_TOOL_LABELS = {
    "query_trends":    "Querying crime trends",
    "get_categories":  "Querying crime categories",
    "get_anomalies":   "Detecting anomalies",
    "get_forecast":    "Loading forecast data",
    "get_dataset_info":"Getting dataset info",
}


@router.post("/api/chat")
def chat(req: ChatRequest):
    """Non-streaming endpoint — returns full answer + updated history."""
    answer = dependencies.chat_engine.ask(req.question, req.history or [])
    history = list(req.history or []) + [
        {"role": "user",      "content": req.question},
        {"role": "assistant", "content": answer},
    ]
    return {"answer": answer, "history": history}


@router.post("/api/chat/stream")
def chat_stream(req: ChatRequest):
    """
    SSE streaming endpoint.

    Yields events:
      data: {"type": "tool",  "name": "...", "label": "..."}
      data: {"type": "token", "content": "..."}
      data: {"type": "done",  "answer": "...", "messages": [...]}
    """
    def event_gen():
        for event_type, payload in dependencies.chat_engine.stream(
            req.question, req.history or []
        ):
            if event_type == "tool":
                yield (
                    "data: "
                    + json.dumps({
                        "type":  "tool",
                        "name":  payload,
                        "label": _TOOL_LABELS.get(payload, payload),
                    })
                    + "\n\n"
                )
            elif event_type == "token":
                yield (
                    "data: "
                    + json.dumps({"type": "token", "content": payload})
                    + "\n\n"
                )
            elif event_type == "done":
                yield (
                    "data: "
                    + json.dumps({"type": "done", **payload})
                    + "\n\n"
                )

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",   # Disable nginx buffering (Render)
        },
    )
