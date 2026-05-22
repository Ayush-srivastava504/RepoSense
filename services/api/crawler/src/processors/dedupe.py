import hashlib
import re
from typing import Dict, List, Set

from utils import get_logger


log = get_logger("dedupe")

try:

    from rapidfuzz import fuzz

    FUZZY_BACKEND = "rapidfuzz"

except ImportError:

    import difflib

    FUZZY_BACKEND = "difflib"

    log.warning(
        "rapidfuzz not installed; using difflib",
    )


TITLE_SIMILARITY_THRESHOLD = 0.82

COMPANY_MATCH_REQUIRED = True


def deduplicate(
    jobs: List[Dict],
) -> List[Dict]:

    before = len(jobs)

    jobs = _exact_dedup(jobs)

    jobs = _fuzzy_dedup(jobs)

    after = len(jobs)

    log.info(
        "Deduplicated: %d -> %d (removed %d)",
        before,
        after,
        before - after,
    )

    return jobs


def deduplicate_incremental(
    new_jobs: List[Dict],
    existing_ids: Set[str],
) -> List[Dict]:

    filtered = [
        job
        for job in new_jobs
        if job.get("id") not in existing_ids
    ]

    log.info(
        "Incremental dedupe: %d new, %d already exist",
        len(filtered),
        len(new_jobs) - len(filtered),
    )

    return deduplicate(filtered)


def _exact_dedup(
    jobs: List[Dict],
) -> List[Dict]:

    seen: Set[str] = set()

    results: List[Dict] = []

    for job in jobs:

        job_id = _job_id(job)

        if (
            job_id
            and job_id not in seen
        ):

            seen.add(job_id)

            results.append(job)

    return results


def _fuzzy_dedup(
    jobs: List[Dict],
) -> List[Dict]:

    kept: List[Dict] = []

    dropped: Set[int] = set()

    for index_a, job_a in enumerate(jobs):

        if index_a in dropped:
            continue

        kept.append(job_a)

        for index_b in range(
            index_a + 1,
            len(jobs),
        ):

            if index_b in dropped:
                continue

            job_b = jobs[index_b]

            if _is_duplicate(
                job_a,
                job_b,
            ):

                dropped.add(index_b)

    log.debug(
        "Fuzzy pass removed %d duplicates",
        len(dropped),
    )

    return kept


def _is_duplicate(
    job_a: Dict,
    job_b: Dict,
) -> bool:

    if COMPANY_MATCH_REQUIRED:

        company_a = _norm(
            job_a.get("company", "")
        )

        company_b = _norm(
            job_b.get("company", "")
        )

        if (
            company_a
            and company_b
            and company_a != company_b
        ):

            return False

    title_a = _norm(
        job_a.get("title", "")
    )

    title_b = _norm(
        job_b.get("title", "")
    )

    if (
        not title_a
        or not title_b
    ):

        return False

    similarity = _similarity(
        title_a,
        title_b,
    )

    return (
        similarity
        >= TITLE_SIMILARITY_THRESHOLD
    )


def _similarity(
    value_a: str,
    value_b: str,
) -> float:

    if FUZZY_BACKEND == "rapidfuzz":

        return (
            fuzz.token_sort_ratio(
                value_a,
                value_b,
            )
            / 100.0
        )

    return difflib.SequenceMatcher(
        None,
        value_a,
        value_b,
    ).ratio()


def _norm(
    value: str,
) -> str:

    value = str(value or "").lower()

    value = re.sub(
        r"[^a-z0-9\s]",
        " ",
        value,
    )

    return re.sub(
        r"\s+",
        " ",
        value,
    ).strip()


def _job_id(
    job: Dict,
) -> str:

    job_id = job.get("id")

    if job_id:
        return str(job_id)

    raw = (
        _norm(job.get("title", ""))
        + "|"
        + _norm(job.get("company", ""))
        + "|"
        + job.get("source", "")
        + "|"
        + (
            job.get("apply_url")
            or ""
        )
    )

    return hashlib.sha256(
        raw.encode()
    ).hexdigest()[:16]


def deduplicate_lsh(
    jobs: List[Dict],
    threshold: float = 0.75,
) -> List[Dict]:

    try:

        from datasketch import (
            MinHash,
            MinHashLSH,
        )

    except ImportError:

        log.warning(
            "datasketch not installed; using standard dedupe",
        )

        return deduplicate(jobs)

    lsh = MinHashLSH(
        threshold=threshold,
        num_perm=128,
    )

    kept = []

    duplicates = 0

    for index, job in enumerate(jobs):

        title = _norm(
            job.get("title", "")
        )

        company = _norm(
            job.get("company", "")
        )

        minhash = MinHash(
            num_perm=128
        )

        for token in (
            title
            + " "
            + company
        ).split():

            minhash.update(
                token.encode()
            )

        try:

            matches = lsh.query(
                minhash
            )

        except Exception:

            matches = []

        if not matches:

            lsh.insert(
                str(index),
                minhash,
            )

            kept.append(job)

        else:

            duplicates += 1

    log.info(
        "LSH dedup: %d -> %d (removed %d)",
        len(jobs),
        len(kept),
        duplicates,
    )

    return kept