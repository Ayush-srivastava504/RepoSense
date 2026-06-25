#!/usr/bin/env python3
"""
RepoSense Production Health Monitor
------------------------------------
Polls all 4 services and logs structured JSON.
Run standalone:  python monitor.py
Run as cronjob:  */5 * * * * /usr/bin/python3 /app/monitor.py >> /var/log/reposense-health.log 2>&1

Env vars (optional):
  ALERT_WEBHOOK_URL   – Slack/Discord webhook for down alerts
  ALERT_COOLDOWN_SECS – Minimum seconds between repeat alerts (default 300)
"""

import asyncio
import json
import os
import time
import logging
from datetime import datetime, timezone
from typing import Any

try:
    import httpx
    import aiofiles
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "httpx", "aiofiles", "-q"])
    import httpx
    import aiofiles

# ─── Config ───────────────────────────────────────────────────────────────────

SERVICES = [
    {"name": "API Gateway",       "url": "http://localhost:8000/health", "critical": True},
    {"name": "Neural Generator",  "url": "http://localhost:8002/health", "critical": False},
    {"name": "RAG Service",       "url": "http://localhost:8001/health", "critical": False},
    {"name": "Crawler",           "url": "http://localhost:8003/health", "critical": False},
]

TIMEOUT_SECONDS     = 5
ALERT_WEBHOOK_URL   = os.getenv("ALERT_WEBHOOK_URL", "")
ALERT_COOLDOWN_SECS = int(os.getenv("ALERT_COOLDOWN_SECS", "300"))
LOG_FILE            = os.getenv("HEALTH_LOG_FILE", "/tmp/reposense-health.log")

# Simple in-memory cooldown tracker (reset on process restart)
_last_alert: dict[str, float] = {}

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("monitor")


# ─── Core check ───────────────────────────────────────────────────────────────

async def check_service(client: httpx.AsyncClient, svc: dict) -> dict[str, Any]:
    start = time.monotonic()
    try:
        resp = await client.get(svc["url"], timeout=TIMEOUT_SECONDS)
        latency_ms = round((time.monotonic() - start) * 1000, 1)
        ok = resp.status_code == 200
        try:
            body = resp.json()
        except Exception:
            body = {}
        return {
            "service":    svc["name"],
            "status":     "up" if ok else "degraded",
            "http_code":  resp.status_code,
            "latency_ms": latency_ms,
            "detail":     body,
            "critical":   svc["critical"],
        }
    except httpx.ConnectError:
        return _down_result(svc, "connection_refused")
    except httpx.TimeoutException:
        return _down_result(svc, "timeout")
    except Exception as exc:
        return _down_result(svc, str(exc))


def _down_result(svc: dict, reason: str) -> dict[str, Any]:
    return {
        "service":    svc["name"],
        "status":     "down",
        "http_code":  None,
        "latency_ms": None,
        "detail":     {"error": reason},
        "critical":   svc["critical"],
    }


# ─── Alert ────────────────────────────────────────────────────────────────────

async def maybe_alert(result: dict) -> None:
    if not ALERT_WEBHOOK_URL:
        return
    now = time.time()
    key = result["service"]
    if now - _last_alert.get(key, 0) < ALERT_COOLDOWN_SECS:
        return
    _last_alert[key] = now
    severity = "🔴 CRITICAL" if result["critical"] else "🟡 WARNING"
    msg = (
        f"{severity} — *{result['service']}* is **{result['status'].upper()}**\n"
        f"> error: `{result['detail'].get('error', 'unknown')}`\n"
        f"> time: {datetime.now(timezone.utc).isoformat()}"
    )
    async with httpx.AsyncClient() as c:
        try:
            await c.post(ALERT_WEBHOOK_URL, json={"text": msg}, timeout=5)
        except Exception as e:
            log.warning("Alert webhook failed: %s", e)


# ─── Runner ───────────────────────────────────────────────────────────────────

async def run_checks() -> dict[str, Any]:
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(
            *[check_service(client, svc) for svc in SERVICES]
        )

    overall_up = all(
        r["status"] == "up" for r in results if r["critical"]
    )

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "overall":   "healthy" if overall_up else "degraded",
        "services":  list(results),
    }

    # Fire alerts for anything that's down or degraded
    for r in results:
        if r["status"] != "up":
            await maybe_alert(r)

    return report


async def main():
    report = await run_checks()
    line = json.dumps(report)
    log.info(line)

    # Also append to log file
    try:
        async with aiofiles.open(LOG_FILE, "a") as f:
            await f.write(line + "\n")
    except Exception:
        pass  # non-fatal; stdout is the primary output

    # Exit non-zero if a critical service is down (useful in CI)
    if report["overall"] != "healthy":
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())