import uvicorn
from configs.config import settings
import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", settings.api.PORT))
    
    uvicorn.run(
        "app.core.app:app",
        host="0.0.0.0",
        port=port,
        reload=settings.is_development,
        log_level=settings.logging.LOG_LEVEL.lower()
    )