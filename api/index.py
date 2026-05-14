import os
import sys

# Allow importing the root-level python modules (app.py, aws_client.py, etc.)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app import app  # noqa: F401  (Vercel's Python runtime detects `app` as ASGI)
