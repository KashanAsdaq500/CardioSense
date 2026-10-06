import sys
import types
from pathlib import Path

# Ensure the backend directory is in sys.path
CURRENT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = CURRENT_DIR.parent

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# When Vercel sets Root Directory to 'backend', the package name 'backend'
# is not at the root of sys.path. Alias sys.modules['backend'] to BACKEND_DIR
# so all existing imports (e.g. 'from backend.auth import ...') resolve without any modification.
if "backend" not in sys.modules:
    backend_pkg = types.ModuleType("backend")
    backend_pkg.__path__ = [str(BACKEND_DIR)]
    sys.modules["backend"] = backend_pkg

# Import the existing working FastAPI app from main.py
from main import app

# Vercel's Python runtime discovers 'app' at api/index.py
