import signal
from contextlib import contextmanager
from typing import Iterator


class ScraperTimeout(Exception):
    pass


@contextmanager
def time_budget(seconds: int, source_name: str) -> Iterator[None]:
    """Hard wall-clock ceiling for a single scraper's run.

    Without this, a single slow/hanging source (e.g. naukri.com under
    a connect-timeout retry storm) can consume the entire remaining
    Lambda execution budget, starving every scraper queued after it.
    Use SIGALRM since this runs in the main thread of a single-purpose
    Lambda invocation (not safe inside worker threads).
    """

    def _handler(signum, frame):
        raise ScraperTimeout(f"{source_name} exceeded {seconds}s budget")

    previous = signal.signal(signal.SIGALRM, _handler)
    signal.alarm(seconds)
    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, previous)


# Usage in the Lambda handler / orchestrator:
#
# from utils.time_budget import time_budget, ScraperTimeout
#
# for scraper in scrapers:
#     try:
#         with time_budget(90, scraper.source_name):
#             jobs = scraper.scrape(keywords, locations, max_pages)
#     except ScraperTimeout as e:
#         log.warning("Skipping %s: %s", scraper.source_name, str(e))
#         continue
#     except Exception as e:
#         log.warning("%s failed: %s", scraper.source_name, str(e))
#         continue