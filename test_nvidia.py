import asyncio
from langchain_nvidia_ai_endpoints import ChatNVIDIA
from dotenv import load_dotenv

load_dotenv()

async def test():
    try:
        llm = ChatNVIDIA(model="meta/llama-3.3-70b-instruct")
        res = await llm.ainvoke("Hello")
        print("Success:", res.content)
    except Exception as e:
        print("Error:", e)

asyncio.run(test())
