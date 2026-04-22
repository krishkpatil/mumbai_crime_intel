"""
Chat router — Groq LLM Q&A endpoint.
"""

import dependencies
from fastapi import APIRouter
from schemas import ChatRequest

router = APIRouter()


@router.post("/api/chat")
def chat(req: ChatRequest):
    answer = dependencies.chat_engine.ask(req.question, req.history or [])
    if not req.history:
        updated_history = [
            {"role": "user", "content": f"<data_context>\n{dependencies.chat_engine.context}\n</data_context>\n\n{req.question}"},
            {"role": "assistant", "content": answer},
        ]
    else:
        updated_history = list(req.history) + [
            {"role": "user", "content": req.question},
            {"role": "assistant", "content": answer},
        ]
    return {"answer": answer, "history": updated_history}
