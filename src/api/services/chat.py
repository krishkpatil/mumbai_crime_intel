"""
ChatEngine — Groq LLM integration for crime data Q&A.
Builds a rich context string from the dataset at startup; answers questions with history.
"""

import os
import pandas as pd
from fastapi import HTTPException


class ChatEngine:
    MODEL = "llama-3.3-70b-versatile"

    SYSTEM_PROMPT = """You are a crime data analyst for the Mumbai Crime Intelligence Platform.
You have access to official Mumbai Police monthly crime statistics from 2018 to early 2026.
Answer questions using ONLY the data provided in <data_context>. Be specific: cite months,
numbers, and percentage changes where relevant. If the data does not contain enough information
to answer the question, say so clearly — do not speculate or fabricate figures.
Keep responses concise (3–6 sentences) unless the user asks for detail."""

    def __init__(self, df: pd.DataFrame):
        self.context = self._build_context(df) if not df.empty else "No data loaded."
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from groq import Groq
            api_key = os.environ.get("GROQ_API_KEY")
            if not api_key:
                raise HTTPException(status_code=503, detail="GROQ_API_KEY not set.")
            self._client = Groq(api_key=api_key)
        return self._client

    def _build_context(self, df: pd.DataFrame) -> str:
        lines = ["=== Mumbai Crime Dataset Summary ==="]
        lines.append("Coverage: monthly reports, 2018-01 through 2026-02 (90 months)")
        lines.append(f"Total records: {len(df[df['is_total'] == False])}")
        lines.append("")

        base = df[(df["dt"].notnull()) & (df["is_total"] == False)]

        lines.append("--- Monthly Registered Crime Totals ---")
        monthly = base.groupby("dt")["registered"].sum().reset_index().sort_values("dt")
        for _, row in monthly.iterrows():
            lines.append(f"  {row['dt'].strftime('%Y-%m')}: {int(row['registered'])}")

        lines.append("")
        lines.append("--- Per-Group Annual Totals ---")
        annual = base.assign(year=base["dt"].dt.year).groupby(["year", "group"])["registered"].sum().reset_index()
        for year in sorted(annual["year"].unique()):
            lines.append(f"  {year}:")
            for _, row in annual[annual["year"] == year].sort_values("registered", ascending=False).iterrows():
                lines.append(f"    {row['group']}: {int(row['registered'])}")

        lines.append("")
        lines.append("--- Detection Rates by Group ---")
        det = base.groupby("group").agg(registered=("registered", "sum"), detected=("detected", "sum")).reset_index()
        for _, row in det.iterrows():
            rate = (row["detected"] / row["registered"] * 100) if row["registered"] > 0 else 0
            lines.append(f"  {row['group']}: {rate:.1f}%")

        lines.append("")
        lines.append("--- Key Structural Events ---")
        lines.append("  2020-03 to 2020-06: COVID-19 lockdown")
        lines.append("  2024-07 onwards: IPC replaced by BNS")

        return "\n".join(lines)

    def ask(self, question: str, history: list[dict]) -> str:
        if not history:
            messages = [{"role": "user", "content": f"<data_context>\n{self.context}\n</data_context>\n\n{question}"}]
        else:
            messages = list(history) + [{"role": "user", "content": question}]

        response = self.client.chat.completions.create(
            model=self.MODEL,
            messages=[{"role": "system", "content": self.SYSTEM_PROMPT}] + messages,
            max_tokens=512,
            temperature=0.3,
        )
        return response.choices[0].message.content
