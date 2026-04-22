"""
Chat router — LangGraph agentic Q&A with streaming.

POST /api/chat         — non-streaming (backward compat)
POST /api/chat/stream  — SSE streaming with live tool-use events
"""

import json

import dependencies
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from schemas import ChatRequest

router = APIRouter()


@router.post("/api/chat")
async def chat(req: ChatRequest):
    """Non-streaming endpoint — collects streamed events, returns full answer."""
    answer = ""
    history = req.history or []

    async for event_type, payload in dependencies.chat_agent.stream(req.question, history):
        if event_type == "done":
            answer   = payload["answer"]
            history  = payload["history"]

    return {"answer": answer, "history": history}


@router.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    """
    SSE streaming endpoint.

    Yields events:
      data: {"type": "tool",  "name": "..."}
      data: {"type": "token", "content": "..."}
      data: {"type": "done",  "answer": "...", "history": [...]}
    """
    async def event_gen():
        async for event_type, payload in dependencies.chat_agent.stream(
            req.question, req.history or []
        ):
            if event_type == "tool":
                yield (
                    "data: "
                    + json.dumps({"type": "tool", "name": payload})
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
            "Cache-Control":     "no-cache",
            "X-Accel-Buffering": "no",   # Disable nginx buffering (Render)
        },
    )
