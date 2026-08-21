"""
Generates short, unique "overview" copy for job/internship listings that
are otherwise too thin to be worth indexing on their own — see the
"Discovered - currently not indexed" bucket in Search Console coverage
reports. Most scraped postings are just a title, company, and a couple of
lines lifted from the source board, which reads to Google as boilerplate
duplicated across thousands of near-identical pages.

This calls xAI's Grok API (OpenAI-compatible /v1/chat/completions) to
produce, per listing:
  - a 120-220 word overview grounded in the actual title/company/location/
    description (company context, what the role likely involves day to
    day, who it suits) — never invented facts like salary or eligibility
    that weren't in the source data
  - a short list of role-relevant keywords for internal search/SEO use

Deliberately conservative: if the API key is missing, the call fails, or
the response doesn't look sane, callers get `None` back and the listing is
left alone rather than writing garbage content. It never touches
`description` (the original scraped data) — only the new `enriched_*`
columns added in migration 017.
"""

import json
import re
from dataclasses import dataclass
from typing import Optional

import httpx

from configs.config import settings

GROK_API_URL = "https://api.x.ai/v1/chat/completions"
# xAI's model lineup/aliases change fairly often — check https://console.x.ai
# / https://docs.x.ai for the current cheapest model that supports JSON
# response_format before deploying. This is a bulk-content job with no
# reasoning requirement, so prefer whatever xAI's current lightweight/"fast"
# tier is over the flagship if one is available; grok-4.6 is the flagship
# as of writing and always a safe (if pricier) default.
GROK_MODEL = "grok-4.6"

REQUEST_TIMEOUT_S = 30
MAX_OVERVIEW_WORDS = 220
MIN_OVERVIEW_WORDS = 60

SYSTEM_PROMPT = (
    "You write short, factual overview blurbs for job/internship listing "
    "pages on an Indian internship-and-jobs platform. You are given the "
    "raw scraped title, company, location, and description for one "
    "listing. Write 120-220 words of original, specific copy covering: "
    "what the company does (if inferable from its name/domain — say "
    "'a company in <space>' if not confidently known, never invent a "
    "specific product or history you're not given), what the role likely "
    "involves day to day based on the title/description, and what kind "
    "of candidate it suits. "
    "\n\nHard rules: never invent salary, stipend, deadline, headcount, or "
    "eligibility criteria that aren't present in the input — omit them "
    "rather than guess. Never claim the company has a specific culture, "
    "award, or perk you weren't told about. Write in plain, direct "
    "prose, not marketing fluff or listicle language. No headers, no "
    "bullet points, no emoji. Do not repeat the title or company name as "
    "a heading — start straight into the content. "
    "\n\nRespond with strict JSON only, no markdown fences: "
    '{"overview": "...", "keywords": ["...", "..."]}. '
    "keywords should be 5-10 lowercase phrases relevant to the role "
    "(skills, role type, seniority, domain) suitable for internal search "
    "— not generic filler like 'job' or 'career'."
)


@dataclass
class EnrichmentResult:
    overview: str
    keywords: list[str]
    model: str


def _build_user_prompt(
    title: str,
    company: str,
    location: Optional[str],
    description: Optional[str],
    job_type: Optional[str],
) -> str:
    lines = [
        f"Title: {title}",
        f"Company: {company}",
        f"Location: {location or 'not specified'}",
        f"Listing type: {job_type or 'not specified'}",
        "Original description (may be short or messy — it's raw scraped "
        "text):",
        (description or "(no description provided)").strip()[:4000],
    ]
    return "\n".join(lines)


def _extract_json(raw: str) -> Optional[dict]:
    raw = raw.strip()
    # Grok occasionally wraps JSON in ```json fences despite instructions.
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
    candidate = fence_match.group(1) if fence_match else raw
    try:
        return json.loads(candidate)
    except (json.JSONDecodeError, TypeError):
        return None


class ContentEnrichmentService:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key if api_key is not None else settings.XAI_API_KEY

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    async def enrich(
        self,
        *,
        title: str,
        company: str,
        location: Optional[str] = None,
        description: Optional[str] = None,
        job_type: Optional[str] = None,
    ) -> Optional[EnrichmentResult]:
        if not self.enabled:
            return None

        payload = {
            "model": GROK_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": _build_user_prompt(
                        title, company, location, description, job_type
                    ),
                },
            ],
            "temperature": 0.4,
            "response_format": {"type": "json_object"},
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_S) as client:
                resp = await client.post(
                    GROK_API_URL, headers=headers, json=payload
                )
                resp.raise_for_status()
                body = resp.json()
        except (httpx.HTTPError, ValueError) as exc:
            print(f"[content_enrichment] Grok request failed: {exc}")
            return None

        try:
            content = body["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            print(f"[content_enrichment] Unexpected Grok response shape: {body}")
            return None

        parsed = _extract_json(content)
        if not parsed:
            print("[content_enrichment] Could not parse Grok JSON output")
            return None

        overview = str(parsed.get("overview", "")).strip()
        keywords = parsed.get("keywords", [])

        if not isinstance(keywords, list):
            keywords = []
        keywords = [str(k).strip().lower() for k in keywords if str(k).strip()]

        word_count = len(overview.split())
        if word_count < MIN_OVERVIEW_WORDS:
            print(
                f"[content_enrichment] Overview too short ({word_count} "
                "words), discarding"
            )
            return None

        # Trim runaway output rather than reject it outright.
        if word_count > MAX_OVERVIEW_WORDS:
            overview = " ".join(overview.split()[:MAX_OVERVIEW_WORDS]) + "…"

        return EnrichmentResult(
            overview=overview,
            keywords=keywords[:10],
            model=GROK_MODEL,
        )
