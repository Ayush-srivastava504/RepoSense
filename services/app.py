import sys
import uvicorn
from pathlib import Path
import os

# Add api/src to Python path
sys.path.insert(0, str(Path(__file__).parent / "api" / "src"))

from configs.config import settings

if __name__ == "__main__":
    port = int(os.environ.get("PORT", settings.api.PORT))

    uvicorn.run(
        "core.app:app",
        host="0.0.0.0",
        port=port,
        reload=settings.is_development,
        log_level=settings.logging.LOG_LEVEL.lower()
    )