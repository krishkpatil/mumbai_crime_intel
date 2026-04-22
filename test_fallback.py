import asyncio
from langchain_groq import ChatGroq
from langchain_nvidia_ai_endpoints import ChatNVIDIA
from langchain_core.tools import tool
from dotenv import load_dotenv
import os

load_dotenv()

@tool
def get_forecast(group: str) -> str:
    """Get forecast"""
    return "forecast"

async def test():
    try:
        # Intentionally break Groq by passing a bad API key
        llm = ChatGroq(model="llama-3.3-70b-versatile", api_key="bad_key")
        nvidia_llm = ChatNVIDIA(model="meta/llama-3.3-70b-instruct")
        
        llm_with_tools = llm.bind_tools([get_forecast], tool_choice="auto").with_fallbacks(
            [nvidia_llm.bind_tools([get_forecast], tool_choice="auto")]
        )
        
        res = await llm_with_tools.ainvoke("what is the forecast for kidnapping?")
        print("Success:", res)
    except Exception as e:
        print("Fallback Error:", type(e).__name__, e)

asyncio.run(test())
