# Generates the unique, grounded page sections for one job/internship listing: responsibilities, preparation
# tips, common mistakes, ATS keywords and FAQ answers. Same provider chain, pacing and health handling as
# ContentEnrichmentService (Groq -> Gemini -> NVIDIA); only the prompt and the validation differ.
#
# Grounding rules (enforced by validate_sections, not just requested in the prompt):
#   * every number in any output string must appear in the input facts/description, otherwise that item is dropped
#   * ATS keywords must be words the listing itself contains
#   * marketing fluff and emoji are rejected
# Output that fails validation is discarded (nothing stored, retried on a later run) -- there is no template
# fallback: a generic filler section is worse for the page than no section.

import asyncio
import re
from dataclasses import dataclass
from typing import Optional

import httpx

from services.content_enrichment_service import ContentEnrichmentService, REQUEST_TIMEOUT_S, _extract_json
from services.llm_providers import ProviderConfig, ProviderHTTPError, call_chat_completion

MIN_SOURCE_CHARS = 250          # below this the listing has too little to ground sections on
MAX_ITEMS = {'responsibilities': 7, 'prep_tips': 5, 'common_mistakes': 5, 'ats_keywords': 12, 'faqs': 6}
ITEM_CHARS = (20, 240)
ANSWER_CHARS = (30, 420)
FLUFF = re.compile(r"\b(exciting|dynamic|rockstar|ninja|world[- ]class|cutting[- ]edge|passionate|thrilled|unique opportunity|"
                   r"fast[- ]paced|synerg\w*|game[- ]chang\w*)\b", re.I)
EMOJI = re.compile('[\U0001F300-\U0001FAFF\u2600-\u27BF\u2B50\u2705]')
NUMBER = re.compile(r'\d+(?:[.,]\d+)?')

SYSTEM_PROMPT = (
    'You write factual page sections for one job or internship listing on an Indian jobs platform for engineering students. '
    'You receive the listing facts and its description. Output strict JSON only (no markdown fences) with these keys: '
    '"responsibilities": 4-7 short sentences describing the day-to-day duties. Use only duties stated or directly implied by the description; '
    'if the description states none, return an empty list. '
    '"prep_tips": 3-5 concrete tips for preparing an application or interview for THIS role, based on the listed skills and duties. '
    '"common_mistakes": 3-5 mistakes applicants make for THIS kind of role, each with the fix, in one sentence. '
    '"ats_keywords": 6-12 exact skill or tool names that appear in the listing text, suitable for a resume. '
    '"faqs": 4-6 objects {"q","a"}. Questions an applicant would really ask about this listing (eligibility, skills, interview preparation, '
    'work mode, growth). Each answer is 1-3 complete sentences that state the actual answer using the facts given. '
    'Hard rules: never invent a salary, stipend, deadline, headcount, award, funding, benefit, interview stage or company history that is not in the input; '
    'if a fact is not given, say the listing does not state it. Do not repeat a number unless it is in the input. '
    'Plain direct English, no marketing language, no emoji, no headings, do not start items with the company name.'
)


@dataclass
class SectionsResult:
    sections: dict
    model: str


def build_source_text(job: dict) -> str:
    """The facts block that goes into the prompt AND is the corpus validation checks numbers/keywords against."""
    def j(v):
        return ', '.join(map(str, v)) if isinstance(v, (list, tuple)) and v else ''
    parts = [
        f"Title: {job.get('title') or ''}", f"Company: {job.get('company') or ''}",
        f"Location: {job.get('location') or 'not stated'}", f"Type: {job.get('type') or 'not stated'}",
        f"Compensation: {job.get('salary') or job.get('stipend') or 'not stated'}",
        f"Deadline: {job.get('deadline') or 'not stated'}",
        f"Work mode: {job.get('work_mode') or 'not stated'}",
        f"Experience (years): {job.get('experience_min')}-{job.get('experience_max')}" if job.get('experience_max') is not None else 'Experience: not stated',
        f"Eligible degrees: {j(job.get('allowed_degrees')) or 'not stated'}",
        f"Eligible courses: {j(job.get('allowed_courses')) or 'not stated'}",
        f"Eligible batches: {j(job.get('allowed_passout_years')) or 'not stated'}",
        f"Required skills: {j(job.get('required_skills')) or 'not stated'}",
        'Description:', (job.get('structured_description') or job.get('description') or '').strip()[:3500],
    ]
    return '\n'.join(parts)


def has_enough_source(job: dict) -> bool:
    return len((job.get('structured_description') or job.get('description') or '').strip()) >= MIN_SOURCE_CHARS


def _clean(s) -> str:
    return re.sub(r'\s+', ' ', str(s or '')).strip()


def _item_ok(text: str, bounds: tuple, source_lower: str) -> bool:
    if not (bounds[0] <= len(text) <= bounds[1]) or FLUFF.search(text) or EMOJI.search(text):
        return False
    return all(n.replace(',', '') in source_lower.replace(',', '') for n in NUMBER.findall(text))


def validate_sections(parsed: Optional[dict], source_text: str) -> Optional[dict]:
    """Keep only grounded items. Returns None unless the result is worth publishing (>= 3 FAQ answers or >= 3 responsibilities)."""
    if not isinstance(parsed, dict):
        return None
    src = source_text.lower()
    out: dict = {}
    for key in ('responsibilities', 'prep_tips', 'common_mistakes'):
        raw = parsed.get(key) if isinstance(parsed.get(key), list) else []
        seen, items = set(), []
        for it in raw:
            t = _clean(it)
            if _item_ok(t, ITEM_CHARS, src) and t.lower() not in seen:
                seen.add(t.lower())
                items.append(t)
        out[key] = items[:MAX_ITEMS[key]]
    kws, seen = [], set()
    for it in (parsed.get('ats_keywords') if isinstance(parsed.get('ats_keywords'), list) else []):
        t = _clean(it)
        if 2 <= len(t) <= 40 and t.lower() in src and t.lower() not in seen and not EMOJI.search(t):
            seen.add(t.lower())
            kws.append(t)
    out['ats_keywords'] = kws[:MAX_ITEMS['ats_keywords']]
    faqs, seen = [], set()
    for it in (parsed.get('faqs') if isinstance(parsed.get('faqs'), list) else []):
        if not isinstance(it, dict):
            continue
        q, a = _clean(it.get('q')), _clean(it.get('a'))
        if (q.endswith('?') and 15 <= len(q) <= 160 and not EMOJI.search(q) and q.lower() not in seen
                and _item_ok(a, ANSWER_CHARS, src)):
            seen.add(q.lower())
            faqs.append({'q': q, 'a': a})
    out['faqs'] = faqs[:MAX_ITEMS['faqs']]
    if len(out['faqs']) < 3 and len(out['responsibilities']) < 3:
        return None
    return out


class JobSectionsService(ContentEnrichmentService):
    """Reuses the parent's provider list, round-robin and health tracking; only generation + validation differ."""

    async def generate(self, job: dict) -> Optional[SectionsResult]:
        if not self.enabled or not has_enough_source(job):
            return None
        source = build_source_text(job)
        providers = sorted(self._ordered_providers(), key=lambda p: self._health[p.name].slot_wait())
        for provider in providers:
            health = self._health[provider.name]
            wait = health.slot_wait()
            if wait > 0:
                await asyncio.sleep(min(wait, 90.0))
            health.reserve_slot()
            res = await self._sections_from(provider, source)
            if res:
                return res
        return None

    async def _sections_from(self, provider: ProviderConfig, source: str) -> Optional[SectionsResult]:
        health = self._health[provider.name]
        models = provider.models
        for idx in range(health.model_idx, len(models)):
            model = models[idx]
            if model in health.retired_models:
                continue
            try:
                content = await call_chat_completion(
                    provider, system_prompt=SYSTEM_PROMPT, user_prompt=source, temperature=0.3,
                    timeout_s=max(REQUEST_TIMEOUT_S, 60), json_object=True, model=model)
                health.model_idx = idx
                health.succeeded()
            except ProviderHTTPError as exc:
                if exc.status_code == 429:
                    health.rate_limited(exc.retry_after)
                    return None
                if exc.status_code in (401, 403):
                    health.dead = True
                    return None
                if exc.status_code in (404, 400, 410):
                    health.retired_models.add(model)
                    continue
                return None
            except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
                return None
            sections = validate_sections(_extract_json(content), source)
            if sections is None:
                print(f'[job_sections] {provider.name} output failed validation; row left for a later run')
                return None
            return SectionsResult(sections=sections, model=model)
        health.dead = True
        return None
