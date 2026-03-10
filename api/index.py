import sys
from pathlib import Path

# Add the backend directory to sys.path so "backends.*" imports resolve
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from backends.main import app  
