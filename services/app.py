import os
import sys

from pathlib import Path

import uvicorn


sys.path.insert(
    0,
    str(
        Path(__file__).parent
        / "api"
        / "src"
    ),
)

from configs.config import settings


if __name__ == "__main__":
    port = int(
        os.environ.get(
            "PORT",
            settings.PORT,
        )
    )

    uvicorn.run(
        "core.app:app",
        host=settings.HOST,
        port=port,
        reload=(
            settings.ENVIRONMENT
            == "development"
        ),
        log_level="info",
    )