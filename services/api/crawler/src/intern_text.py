# Module: crawler/src/intern_text.py
# Dependency-free on purpose (only `re`), so tests can load it by file path without the crawler's boto3/psycopg2 imports.
import re

# "intern" as a WORD. The old substring test ('intern' in text) also matched "International", "Internal",
# "Internet", so "Regional Manager - International Sales" was typed 'internship' and showed on /internships.
INTERN_WORD_RE = re.compile(r"\b(intern|interns|internship|internships)\b", re.IGNORECASE)


def has_intern_word(text) -> bool:
    return bool(INTERN_WORD_RE.search(str(text or '')))
