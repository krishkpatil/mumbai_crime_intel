from pathlib import Path

# Single source of truth for the project root.
# All other modules do `from config import PROJECT_ROOT` instead of redefining it.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
