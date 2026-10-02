"""Prompt construction and validation of model output. Pure functions: every published sentence
must be backed by crawled text, so output that invents numbers or names is rejected, not edited."""
import json
import re
from typing import Optional

PROMPT_VERSION = 'v1'
MAX_INPUT_CHARS = 6000
MIN_SOURCE_CHARS = 400
BODY_MIN, BODY_MAX = 200, 1400
MAX_BULLETS = 5
MAX_UNGROUNDED_NAMES = 1
FLUFF = re.compile(r'\b(world[- ]class|cutting[- ]edge|industry[- ]leading|leading provider|best[- ]in[- ]class|'
                   r'passionate|innovative solutions|state[- ]of[- ]the[- ]art|game[- ]chang\w+)\b', re.I)
_STOP = {'The', 'This', 'That', 'These', 'Those', 'They', 'Their', 'It', 'Its', 'And', 'But', 'For', 'With', 'From',
         'Its', 'Our', 'We', 'You', 'Your', 'In', 'On', 'At', 'As', 'By', 'An', 'A', 'Of', 'To', 'Is', 'Are', 'Was',
         'Were', 'Also', 'Candidates', 'Students', 'Employees', 'Customers', 'Clients', 'Teams'}

SYSTEM_PROMPT = (
    'You write short factual sections for a company profile page. Use ONLY the numbered source excerpts '
    'provided. Never add facts, numbers, names or dates that are not in them. No marketing language. '
    'If the excerpts do not contain enough to write the section, return {"body": null}. '
    'Return JSON only: {"body": "<60-180 words, plain prose>", "bullets": ["<=5 short factual points"], '
    '"source_ids": [numbers of the excerpts you used]}.')


def build_topic_input(sources: list, max_chars: int = MAX_INPUT_CHARS) -> tuple:
    """sources: [{'url','title','text','content_hash'}] -> (numbered prompt text, included sources)."""
    blocks, included, used = [], [], 0
    for s in sources:
        budget = max_chars - used
        if budget < 300:
            break
        snippet = s['text'][:min(len(s['text']), budget, 3000)]
        included.append(s)
        blocks.append(f"[{len(included)}] {s.get('title') or s['url']}\n{snippet}")
        used += len(snippet)
    return '\n\n'.join(blocks), included


def user_prompt(company: str, topic_title: str, guidance: str, excerpts: str) -> str:
    return (f'Company: {company}\nSection: {topic_title}\nCover: {guidance}\n\nSource excerpts:\n{excerpts}\n\n'
            'Write the section now (JSON only).')


def parse_model_json(raw: str) -> Optional[dict]:
    if not raw:
        return None
    raw = re.sub(r'^```(?:json)?|```$', '', raw.strip(), flags=re.M).strip()
    m = re.search(r'\{.*\}', raw, re.S)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


def _norm_numbers(text: str) -> set:
    return {n.replace(',', '').rstrip('.') for n in re.findall(r'\d[\d,]*(?:\.\d+)?', text)}


def ungrounded_numbers(output: str, source_text: str) -> list:
    src = _norm_numbers(source_text)
    return sorted(n for n in _norm_numbers(output) if len(n) >= 2 and n not in src)


def ungrounded_names(output: str, source_text: str, company: str) -> list:
    src = source_text.lower()
    company_tokens = {t.lower() for t in re.findall(r'[A-Za-z]+', company)}
    bad = []
    for sentence in re.split(r'(?<=[.!?])\s+', output):
        words = re.findall(r"[A-Za-z][A-Za-z'&-]*", sentence)
        for w in words[1:]:                        # first word of a sentence is capitalised anyway
            if w[0].isupper() and len(w) > 2 and w not in _STOP and w.lower() not in company_tokens and w.lower() not in src:
                bad.append(w)
    return sorted(set(bad))


def validate_output(data: Optional[dict], included: list, company: str) -> tuple:
    """-> (clean dict or None, reject_reason or None). 'insufficient' means the model declined."""
    if not data:
        return None, 'unparseable'
    body = data.get('body')
    if body is None:
        return None, 'insufficient'
    if not isinstance(body, str):
        return None, 'bad_body'
    body = ' '.join(body.split())
    if not BODY_MIN <= len(body) <= BODY_MAX:
        return None, f'body_length:{len(body)}'
    if FLUFF.search(body):
        return None, 'marketing_language'
    ids = [i for i in data.get('source_ids', []) if isinstance(i, int) and 1 <= i <= len(included)]
    if not ids:
        return None, 'no_valid_source_ids'
    bullets = [' '.join(b.split()) for b in data.get('bullets', []) if isinstance(b, str) and b.strip()][:MAX_BULLETS]
    source_text = ' '.join(s['text'] for s in included)
    combined = body + ' ' + ' '.join(bullets)
    nums = ungrounded_numbers(combined, source_text)
    if nums:
        return None, f'ungrounded_numbers:{",".join(nums[:5])}'
    names = ungrounded_names(combined, source_text, company)
    if len(names) > MAX_UNGROUNDED_NAMES:
        return None, f'ungrounded_names:{",".join(names[:5])}'
    return {'body': body, 'bullets': bullets, 'source_urls': [included[i - 1]['url'] for i in sorted(set(ids))]}, None
