"""A-Z company directory keys. Pure functions, no DB."""
import unicodedata


def _base_char(ch: str) -> str:
    """'É' -> 'e': first character of the NFKD decomposition, lower-cased."""
    return unicodedata.normalize('NFKD', ch)[0].lower()


def directory_letter(name: str) -> str:
    """URL key: 'a'..'z' (accents folded, so 'Élan' -> 'e'), '0-9' for digits, 'other' for anything else."""
    for ch in (name or '').strip():
        if not ch.isalnum():
            continue
        c = _base_char(ch)
        if 'a' <= c <= 'z':
            return c
        return '0-9' if ch.isdigit() else 'other'
    return 'other'


def sort_key(name: str) -> str:
    """Accent-insensitive, case-insensitive ordering so 'Élan' sorts with the E's."""
    return ''.join(_base_char(ch) if ch.isalnum() else ch.lower() for ch in (name or ''))
