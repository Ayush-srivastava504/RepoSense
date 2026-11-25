# Writes the long-form, job-specific guide shown on every job page (target 1,700 words, published only at
# 1,500+ after validation). Stored as enriched_sections->'article' so no migration is needed. Same provider
# chain, pacing and health handling as ContentEnrichmentService (Groq -> Gemini -> NVIDIA).
#
# Why this exists: scraped listings are short (median description is a handful of words), so a job page was
# mostly site template, and Search Console left most job URLs as "Discovered - currently not indexed". Each
# article combines the listing's own facts with guidance written for that exact role, company, location and
# eligibility, so the page has a reason to be indexed on its own.
#
# Grounding and uniqueness, enforced in code (not just asked for in the prompt):
#   * a sentence with a number that is not in the listing facts is dropped (no invented salary, vacancies,
#     dates, rounds, percentages)
#   * marketing filler and emoji are dropped
#   * an article that copies the scraped description (> 25% shared 6-word shingles) is rejected
#   * an article whose phrasing overlaps other stored articles (> 25% shared shingles) is rejected, so the
#     site never fills up with one template reworded 1,000 times
#   * fewer than MIN_WORDS words after all of the above means nothing is stored; the job is retried later

import asyncio
import re
from collections import Counter
from dataclasses import dataclass
from typing import Iterable, Optional

import httpx

from services.content_enrichment_service import ContentEnrichmentService, REQUEST_TIMEOUT_S, _extract_json
from services.llm_providers import ProviderConfig, ProviderHTTPError, call_chat_completion

MIN_WORDS = 1500
TARGET_WORDS = 1700
SHINGLE = 6
MAX_SOURCE_OVERLAP = 0.25
MAX_CORPUS_OVERLAP = 0.25
FLUFF = re.compile(r"\b(exciting|dynamic|rockstar|ninja|world[- ]class|cutting[- ]edge|passionate|thrilled|unique opportunity|"
                   r"fast[- ]paced|synerg\w*|game[- ]chang\w*|look no further|in today's (?:competitive|fast)|"
                   r"dream job|golden opportunity|don't miss)\b", re.I)
EMOJI = re.compile('[\U0001F300-\U0001FAFF☀-➿⭐✅]')
NUMBER = re.compile(r'\d+(?:[.,]\d+)?')
WORD = re.compile(r"[A-Za-z0-9][\w'’+#.-]*")
SENTENCE = re.compile(r'(?<=[.!?])\s+(?=[A-Z0-9"“(])')

SECTION_PLAN = [
    ('overview', 'About this role', 'What this specific role is, what team or function it sits in, and who it suits. 170-200 words.'),
    ('work', 'What the work involves', 'Day-to-day duties for THIS role and THIS kind of employer, the tools or processes used, and what a good first few months look like. 220-260 words.'),
    ('eligibility', 'Who can apply', 'Eligibility using the listing facts (degree, course, batch, experience, qualification, category, location). Where a fact is missing, say the listing does not state it and tell the reader where to confirm. 150-190 words.'),
    ('skills', 'Skills that matter for this role', 'The technical and soft skills this role needs, why each matters here, and a practical way to build or show each one. 220-260 words.'),
    ('apply', 'How to prepare your application', 'Resume, cover note and documents tailored to this role and employer, keywords worth using, and mistakes to avoid. 190-230 words.'),
    ('selection', 'Interview and selection preparation', 'How selection usually works for this type of role and employer (say "usually" / "typically"; never state a number of rounds), what to revise, and sample questions. 220-260 words.'),
    ('growth', 'Career growth after this role', 'Realistic next roles, skills to add, and how this role is viewed by future employers. 150-180 words.'),
    ('location', 'Location and work setup', 'What the listed location or work mode means in practice: commute, relocation, remote or hybrid etiquette, and local hiring context. Do not invent cost-of-living numbers. 120-150 words.'),
    ('decide', 'Is this role a good fit for you?', 'An honest checklist of who should apply and who might prefer a different role, written for this listing. 120-150 words.'),
]

SYSTEM_PROMPT = (
    'You write the long-form guide for ONE job, internship or government post on an Indian jobs platform for students and early-career '
    'applicants. You receive the listing facts. Write about THIS listing: its title, employer, location, eligibility and skills, so that '
    'the text could not be pasted onto a different job unchanged. Vary sentence structure; do not use stock openings. '
    'Output strict JSON only (no markdown fences): {"sections": {<key>: [<paragraph>, ...]}, "faqs": [{"q": ..., "a": ...}]}. '
    'Use exactly these section keys, each a list of 2-4 plain-text paragraphs: ' +
    '; '.join(f'"{k}": {brief}' for k, _, brief in SECTION_PLAN) +
    '. "faqs": 6-8 questions an applicant would really ask about this listing, each answer 2-4 complete sentences. '
    f'The whole output must be at least {TARGET_WORDS} words. '
    'Hard rules: never invent a salary, stipend, deadline, vacancy count, number of interview rounds, exam pattern marks, cut-off, '
    'percentage, award, funding, office count, employee count or company history that is not in the facts. Write no number at all '
    'unless that exact number appears in the facts. If a fact is not given, say the listing does not state it and that the applicant '
    'should check the official notice or careers page. For government posts, tell readers to confirm every rule in the official '
    'notification. Plain direct English, no marketing language, no emoji, no headings or bullet characters inside paragraphs.'
)


@dataclass
class ArticleResult:
    article: dict
    words: int
    model: str


def _j(v) -> str:
    return ', '.join(map(str, v)) if isinstance(v, (list, tuple)) and v else ''


def build_source_text(job: dict) -> str:
    """The facts block: goes into the prompt AND is the corpus every number in the output is checked against."""
    table = job.get('content_table') or []
    table_txt = '; '.join(f"{r.get('label')}: {r.get('value')}" for r in table if isinstance(r, dict) and r.get('value'))
    parts = [
        f"Title: {job.get('title') or ''}",
        f"Employer: {job.get('company') or ''}",
        f"Department: {job.get('department') or 'not stated'}",
        f"Location: {job.get('location') or 'not stated'}",
        f"Type: {job.get('type') or 'not stated'}",
        f"Government post: {'yes' if job.get('is_government') else 'no'}",
        f"Compensation: {job.get('salary') or job.get('stipend') or 'not stated'}",
        f"Vacancies: {job.get('vacancies') or 'not stated'}",
        f"Last date: {job.get('deadline') or 'not stated'}",
        f"Work mode: {job.get('work_mode') or 'not stated'}",
        (f"Experience (years): {job.get('experience_min')}-{job.get('experience_max')}"
         if job.get('experience_max') is not None else 'Experience: not stated'),
        f"Job function: {job.get('job_function') or 'not stated'}",
        f"Eligible degrees: {_j(job.get('allowed_degrees')) or 'not stated'}",
        f"Eligible courses: {_j(job.get('allowed_courses')) or 'not stated'}",
        f"Eligible batches: {_j(job.get('allowed_passout_years')) or 'not stated'}",
        f"Required skills: {_j(job.get('required_skills')) or _j(job.get('enriched_keywords')) or 'not stated'}",
        f"Listing facts: {table_txt or 'none'}",
        f"Highlights: {job.get('notes_highlights') or 'none'}",
        f"Overview: {job.get('enriched_overview') or 'none'}",
        'Description:', (job.get('structured_description') or job.get('description') or '').strip()[:4000],
    ]
    return '\n'.join(parts)


def has_enough_source(job: dict) -> bool:
    """Title + employer are the minimum: the article is about the role, so even a one-line notice can carry one."""
    return bool((job.get('title') or '').strip() and (job.get('company') or '').strip())


def words(text: str) -> int:
    return len(WORD.findall(text or ''))


def article_words(article: dict) -> int:
    total = sum(words(p) for paras in (article.get('sections') or {}).values() for p in paras)
    return total + sum(words(f.get('q', '')) + words(f.get('a', '')) for f in article.get('faqs') or [])


def shingles(text: str) -> set:
    toks = [t.lower() for t in WORD.findall(text or '')]
    return {' '.join(toks[i:i + SHINGLE]) for i in range(max(0, len(toks) - SHINGLE + 1))}


def article_text(article: dict) -> str:
    paras = [p for ps in (article.get('sections') or {}).values() for p in ps]
    return ' '.join(paras + [f"{f.get('q', '')} {f.get('a', '')}" for f in article.get('faqs') or []])


def _clean(s) -> str:
    return re.sub(r'\s+', ' ', str(s or '')).replace('**', '').strip().lstrip('-•* ').strip()


def _grounded(sentence: str, source_lower: str) -> bool:
    if FLUFF.search(sentence) or EMOJI.search(sentence):
        return False
    src = source_lower.replace(',', '')
    return all(n.replace(',', '') in src for n in NUMBER.findall(sentence))


def _filter_paragraph(text: str, source_lower: str) -> str:
    kept = [s for s in SENTENCE.split(_clean(text)) if s and _grounded(s, source_lower)]
    return ' '.join(kept).strip()


class ShingleCorpus:
    """Shingles of articles already published; an article that mostly repeats them is template filler."""

    def __init__(self):
        self.counts: Counter = Counter()

    def add(self, text: str) -> None:
        self.counts.update(shingles(text))

    def overlap(self, text: str) -> float:
        sh = shingles(text)
        return (sum(1 for s in sh if self.counts[s] > 0) / len(sh)) if sh else 1.0


def validate_article(parsed: Optional[dict], source_text: str, corpus: Optional[ShingleCorpus] = None) -> Optional[dict]:
    """Grounded, unique, long enough -> {'sections': [{key, heading, paragraphs}], 'faqs': [...] , 'words': n}; else None."""
    if not isinstance(parsed, dict) or not isinstance(parsed.get('sections'), dict):
        return None
    src = source_text.lower()
    sections = []
    for key, heading, _ in SECTION_PLAN:
        raw = parsed['sections'].get(key)
        paras = [_filter_paragraph(p, src) for p in (raw if isinstance(raw, list) else [raw] if isinstance(raw, str) else [])]
        paras = [p for p in paras if words(p) >= 12]
        if paras:
            sections.append({'key': key, 'heading': heading, 'paragraphs': paras})
    faqs, seen = [], set()
    for it in parsed.get('faqs') if isinstance(parsed.get('faqs'), list) else []:
        if not isinstance(it, dict):
            continue
        q, a = _clean(it.get('q')), _filter_paragraph(it.get('a'), src)
        if q.endswith('?') and 12 <= len(q) <= 180 and _grounded(q, src) and words(a) >= 15 and q.lower() not in seen:
            seen.add(q.lower())
            faqs.append({'q': q, 'a': a})
    if len(sections) < 7 or len(faqs) < 4:
        return None
    article = {'sections': {s['key']: s['paragraphs'] for s in sections}, 'faqs': faqs[:8]}
    n = article_words(article)
    if n < MIN_WORDS:
        return None
    text = article_text(article)
    desc = source_text.split('Description:', 1)[-1]
    desc_sh = shingles(desc)
    art_sh = shingles(text)
    if desc_sh and art_sh and len(art_sh & desc_sh) / len(art_sh) > MAX_SOURCE_OVERLAP:
        return None
    if corpus is not None and corpus.overlap(text) > MAX_CORPUS_OVERLAP:
        return None
    return {
        'sections': [{'key': s['key'], 'heading': s['heading'], 'paragraphs': s['paragraphs']} for s in sections],
        'faqs': article['faqs'],
        'words': n,
    }


def stored_article_text(article: dict) -> str:
    """Text of an article in its STORED shape (sections as a list), for seeding the corpus."""
    paras = [p for s in article.get('sections') or [] for p in s.get('paragraphs') or []]
    return ' '.join(paras + [f"{f.get('q', '')} {f.get('a', '')}" for f in article.get('faqs') or []])


class JobArticleService(ContentEnrichmentService):
    """Reuses the parent's provider list, round-robin and health tracking; only generation + validation differ."""

    def __init__(self, seed_articles: Iterable[dict] = ()):
        super().__init__()
        self.corpus = ShingleCorpus()
        for a in seed_articles:
            self.corpus.add(stored_article_text(a))

    async def generate(self, job: dict) -> Optional[ArticleResult]:
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
            res = await self._article_from(provider, source)
            if res:
                self.corpus.add(stored_article_text(res.article))
                return res
        return None

    async def _article_from(self, provider: ProviderConfig, source: str) -> Optional[ArticleResult]:
        health = self._health[provider.name]
        models = provider.models
        for idx in range(health.model_idx, len(models)):
            model = models[idx]
            if model in health.retired_models:
                continue
            try:
                content = await call_chat_completion(
                    provider, system_prompt=SYSTEM_PROMPT, user_prompt=source, temperature=0.6,
                    timeout_s=max(REQUEST_TIMEOUT_S, 150), json_object=True, model=model)
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
            article = validate_article(_extract_json(content), source, self.corpus)
            if article is None:
                print(f'[job_article] {provider.name}/{model} output failed validation (short, ungrounded or duplicated); row left for a later run')
                return None
            return ArticleResult(article=article, words=article['words'], model=model)
        health.dead = True
        return None
