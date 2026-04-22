import asyncio
from langchain_nvidia_ai_endpoints import ChatNVIDIA
from langchain_core.tools import tool
from dotenv import load_dotenv

load_dotenv()

@tool
def get_forecast(group: str) -> str:
    """Get forecast"""
    return "forecast"

async def test():
    try:
        llm = ChatNVIDIA(model="meta/llama-3.3-70b-instruct")
        llm_with_tools = llm.bind_tools([get_forecast], tool_choice="auto")
        res = await llm_with_tools.ainvoke("what is the forecast for kidnapping?")
        print("Success:", res)
    except Exception as e:
        print("Error:", e)

asyncio.run(test())
