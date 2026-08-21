"""
Lightweight company/domain trust scoring.

This module is intentionally additive: it does not change scraping,
normalization, deduplication, or enrichment. It only reads fields already
present on a job dict (company, apply_url) and attaches a confidence score
plus a few supporting flags that the API layer can use for badges and
first-page ranking.

Call `score_batch(jobs)` once, after `enrich_batch()` and before the job is
written to the database (see index.py).
"""

import re
from difflib import SequenceMatcher
from typing import Dict, List, Optional
from urllib.parse import urlparse

from utils import get_logger

log = get_logger("trust")


# Manually curated company -> official domain(s) mapping.
# This is the ONLY source that can earn "is_official_domain = True" / the
# "Verified Source" badge. Expand over time as more companies are confirmed.
TRUSTED_COMPANIES: Dict[str, List[str]] = {
    "ey": ["ey.com"],
    "ernst & young": ["ey.com"],
    "electronic arts": ["ea.com"],
    "ea": ["ea.com"],
    "razorpay": ["razorpay.com"],
    "google": ["google.com", "careers.google.com"],
    "microsoft": ["microsoft.com", "careers.microsoft.com"],
    "amazon": ["amazon.jobs", "amazon.com"],
    "flipkart": ["flipkart.com"],
    "swiggy": ["swiggy.com"],
    "zomato": ["zomato.com"],
    "infosys": ["infosys.com"],
    "tcs": ["tcs.com"],
    "wipro": ["wipro.com"],
    "accenture": ["accenture.com"],
    "deloitte": ["deloitte.com"],
    "kpmg": ["kpmg.com"],
    "pwc": ["pwc.com"],
    "adobe": ["adobe.com", "careers.adobe.com"],
    "salesforce": ["salesforce.com"],
    "ibm": ["ibm.com"],
    "meta": ["meta.com", "metacareers.com"],
    "goldman sachs": ["goldmansachs.com"],
    "jpmorgan": ["jpmorgan.com", "jpmorganchase.com"],
    "morgan stanley": ["morganstanley.com"],

    # Government recruitment bodies. These map to official *.gov.in / *.nic.in
    # domains, so a job whose apply_url resolves there is our strongest
    # possible signal — it's a direct-apply link on the notifying authority's
    # own site, not a third-party aggregator republishing the notice.
    #
    # Note: SSC and UPSC are intentionally NOT listed here anymore. We used
    # to scrape ssc.nic.in / upsc.gov.in directly, which is exactly the kind
    # of official-domain apply_url this mapping exists for — but that
    # scraper was retired (see scrapers/freejobalert.py) in favor of a
    # third-party aggregator, so those jobs' apply_url now points at
    # freejobalert.com and won't (and shouldn't) match here.
    "employment news": ["employmentnews.gov.in"],
    "ministry of information and broadcasting": ["employmentnews.gov.in"],
}

# Companies here get a small first-page ranking bump (top_company_boost) even
# when we haven't (yet) confirmed their apply-domain mapping above. Kept
# separate from TRUSTED_COMPANIES since "known big brand" and "domain we've
# manually verified" are different claims — only the latter should ever say
# "Verified Source".
TOP_COMPANY_TIER: set = {
    "ey", "ernst & young", "electronic arts", "ea", "google", "microsoft",
    "amazon", "meta", "goldman sachs", "jpmorgan", "morgan stanley",
    "flipkart", "razorpay", "swiggy", "zomato", "infosys", "tcs", "wipro",
    "accenture", "deloitte", "kpmg", "pwc", "adobe", "salesforce", "ibm",
}

# Known applicant-tracking-system / careers-hosting domains. A job hosted on
# one of these is not automatically "the company's own domain", but it's a
# legitimate, professionally-run hiring pipeline rather than a random link.
KNOWN_ATS_DOMAINS: set = {
    "greenhouse.io", "boards.greenhouse.io", "lever.co", "jobs.lever.co",
    "myworkdayjobs.com", "workday.com", "smartrecruiters.com",
    "bamboohr.com", "icims.com", "successfactors.com", "oraclecloud.com",
    "ashbyhq.com", "jobs.ashbyhq.com", "zohorecruit.com", "freshteam.com",
    "recruitee.com", "workable.com", "breezy.hr", "jazzhr.com",
    "taleo.net", "paylocity.com",
}

FREE_EMAIL_DOMAINS: set = {
    "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
    "rediffmail.com", "protonmail.com", "icloud.com", "aol.com",
}

# Job boards / aggregators whose own domain the apply_url points at — the
# domain is real and legitimate for apply_domain/trust purposes (that IS
# where you apply), but it is never the *employer's* domain, so it must
# never be used to look up a company logo. Without this, e.g. every
# LinkedIn-sourced job showed LinkedIn's own favicon/logo instead of the
# hiring company's, since CompanyLogo just fetched a logo for apply_domain.
AGGREGATOR_DOMAINS: set = {
    "linkedin.com", "indeed.com", "glassdoor.com", "naukri.com",
    "internshala.com", "unstop.com", "cutshort.in", "freejobalert.com",
    "remoteok.com", "remoteok.io", "weworkremotely.com", "remotive.com",
    "wayup.com", "hiring.cafe", "jobicy.com", "arbeitnow.com",
}

URL_SHORTENERS: set = {
    "bit.ly", "tinyurl.com", "t.co", "rebrand.ly", "cutt.ly", "is.gd",
    "buff.ly", "ow.ly", "shorturl.at", "rb.gy",
}

CONFIDENCE_LABELS = (
    (90, "verified"),
    (70, "high_confidence"),
    (40, "review_recommended"),
    (0, "unverified"),
)


def score_batch(jobs: List[Dict]) -> List[Dict]:
    for job in jobs:
        score(job)

    log.info("Scored %d jobs for company/domain trust", len(jobs))

    return jobs


def score(job: Dict) -> Dict:
    try:
        _score_single(job)
    except Exception as exc:
        log.warning("Trust scoring error for %s: %s", job.get("id", "?"), exc)
        job.setdefault("confidence_score", 0)
        job.setdefault("confidence_label", "unverified")
        job.setdefault("apply_domain", None)
        job.setdefault("logo_domain", None)
        job.setdefault("is_official_domain", False)
        job.setdefault("domain_similarity", 0.0)

    return job


def _score_single(job: Dict) -> None:
    company = (job.get("company") or "").strip()
    apply_url = (job.get("apply_url") or job.get("url") or "").strip()

    domain = extract_domain(apply_url)
    is_https = apply_url.lower().startswith("https://")

    company_key = _normalize_company(company)
    trusted_domains = TRUSTED_COMPANIES.get(company_key, [])
    is_official = bool(domain) and any(
        domain == d or domain.endswith("." + d) for d in trusted_domains
    )

    is_known_ats = bool(domain) and any(
        domain == d or domain.endswith("." + d) for d in KNOWN_ATS_DOMAINS
    )

    is_known_company = company_key in TOP_COMPANY_TIER or bool(trusted_domains)

    similarity = _domain_similarity(company, domain) if domain else 0.0

    is_free_email_domain = domain in FREE_EMAIL_DOMAINS
    is_shortener = domain in URL_SHORTENERS

    # A mismatch is only meaningful once we actually expect a match: known
    # company, real domain, but nowhere near the confirmed/similar domain.
    is_mismatch = (
        bool(domain)
        and is_known_company
        and not is_official
        and not is_known_ats
        and similarity < 0.35
    )

    score_value = 0
    if is_official:
        score_value += 40
    if bool(domain) and not is_free_email_domain and not is_shortener:
        score_value += 20  # "company_domain_verified" proxy: a real, non-throwaway domain
    if is_https:
        score_value += 5
    if is_known_company:
        score_value += 20
    if is_known_ats:
        score_value += 10  # legitimate hiring pipeline, not a brand match but not suspicious either
    if similarity > 0.8:
        score_value += 10
    if is_free_email_domain:
        score_value -= 30
    if is_shortener:
        score_value -= 20
    if is_mismatch:
        score_value -= 20

    score_value = max(0, min(score_value, 100))

    job["apply_domain"] = domain
    job["is_official_domain"] = is_official
    job["domain_similarity"] = round(similarity, 2)
    job["confidence_score"] = score_value
    job["confidence_label"] = _label_for(score_value, is_official)

    # Logo lookup domain: same as apply_domain UNLESS apply_domain is a
    # job-board/aggregator (LinkedIn, Indeed, ...), in which case using it
    # would fetch the *platform's* logo, not the employer's. Fall back to
    # our curated official-domain mapping when we have one for this
    # company; otherwise leave it unset so the UI shows the initials
    # avatar rather than a misleading logo.
    is_aggregator_domain = bool(domain) and any(
        domain == d or domain.endswith("." + d) for d in AGGREGATOR_DOMAINS
    )
    if is_aggregator_domain:
        job["logo_domain"] = trusted_domains[0] if trusted_domains else None
    else:
        job["logo_domain"] = domain


def _label_for(score_value: int, is_official: bool) -> str:
    # "verified" requires strong evidence (an official/curated domain match),
    # never just a high numeric score on its own.
    if score_value >= 90 and is_official:
        return "verified"

    for threshold, label in CONFIDENCE_LABELS:
        if score_value >= threshold:
            return "high_confidence" if label == "verified" else label

    return "unverified"


def extract_domain(url: str) -> Optional[str]:
    if not url:
        return None

    try:
        parsed = urlparse(url if "//" in url else f"//{url}")
        host = (parsed.hostname or "").lower()
    except Exception:
        return None

    if not host:
        return None

    if host.startswith("www."):
        host = host[4:]

    return host or None


def _normalize_company(company: str) -> str:
    company = company.lower().strip()
    company = re.sub(r"[^a-z0-9& ]+", "", company)
    company = re.sub(
        r"\b(pvt|private|ltd|limited|inc|llc|corp|corporation|technologies|technology|india)\b",
        "",
        company,
    )
    return re.sub(r"\s+", " ", company).strip()


def _domain_similarity(company: str, domain: Optional[str]) -> float:
    if not domain:
        return 0.0

    company_key = _normalize_company(company).replace(" ", "")
    domain_root = domain.split(".")[0]

    if not company_key or not domain_root:
        return 0.0

    if company_key == domain_root:
        return 1.0

    return SequenceMatcher(None, company_key, domain_root).ratio()
