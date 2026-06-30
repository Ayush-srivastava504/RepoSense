"""
services/api/src/services/linkedin_rules.py

Deterministic, zero-LLM rule engine for the LinkedIn Profile Optimizer.

Why deterministic rules at all (instead of asking the LLM to "score the
profile")?  Small local models like Qwen3-0.6B are unreliable at arithmetic
and consistency — ask it twice for the same profile and the score drifts.
So scoring + pass/fail is computed in plain Python (fast, free, consistent),
and the LLM (see linkedin_ai_service.py) is only used for the part it's
actually good at: writing human, specific suggestions and rewriting
headline/about copy.

Input shape (`ProfileInput`, see schemas in routes/linkedin.py):
    headline, about, current_title, current_company,
    has_photo, has_banner, custom_url,
    experience: [{title, company, bullets: [str]}],
    education: [{...}],
    skills: [str],
    certifications: [str],
    projects: [str],
    featured_items: int,
    recommendations_received: int,
    connections: int,
    open_to_work: bool

Each rule returns:
    {
        "id": str,
        "label": str,
        "category": str,
        "weight": int,          # contribution to the 100-point score
        "passed": bool,
        "detail": str,          # short factual explanation of why it passed/failed
        "tip": str,             # generic improvement tip, shown even without AI
    }
"""

from __future__ import annotations

import re
from typing import Any, Dict, List

# Total weights below sum to 100.
RULE_WEIGHTS = {
    "profile_photo":        6,
    "background_banner":    5,
    "headline_length":       8,
    "headline_keywords":     7,
    "custom_url":            4,
    "about_length":          9,
    "about_cta":             6,
    "current_role":          6,
    "experience_count":      8,
    "experience_detail":    10,
    "education":             5,
    "skills_count":          9,
    "recommendations":       9,
    "certifications_or_projects": 8,
}
assert sum(RULE_WEIGHTS.values()) == 100

_CTA_PATTERNS = [
    r"\bconnect\b", r"\breach out\b", r"\bdm me\b", r"\bmessage me\b",
    r"\bemail me\b", r"\blet'?s talk\b", r"\bfeel free to\b", r"\bget in touch\b",
    r"\bopen to\b",
]

_FILLER_HEADLINE = re.compile(r"^\s*[\w.\- ]+\s+at\s+[\w.\- ]+\s*$", re.IGNORECASE)


def _has_cta(text: str) -> bool:
    text = text.lower()
    return any(re.search(p, text) for p in _CTA_PATTERNS)


def _word_count(text: str) -> int:
    return len((text or "").strip().split())


def run_rules(profile: Dict[str, Any]) -> Dict[str, Any]:
    """Run all 14 rules against the given profile dict and return the report."""
    headline = (profile.get("headline") or "").strip()
    about = (profile.get("about") or "").strip()
    experience: List[dict] = profile.get("experience") or []
    education: List[dict] = profile.get("education") or []
    skills: List[str] = [s for s in (profile.get("skills") or []) if str(s).strip()]
    certifications: List[str] = [c for c in (profile.get("certifications") or []) if str(c).strip()]
    projects: List[str] = [p for p in (profile.get("projects") or []) if str(p).strip()]

    rules: List[Dict[str, Any]] = []

    def add(rule_id, label, category, passed, detail, tip):
        rules.append({
            "id": rule_id,
            "label": label,
            "category": category,
            "weight": RULE_WEIGHTS[rule_id],
            "passed": bool(passed),
            "detail": detail,
            "tip": tip,
        })

    # 1. Profile photo
    add(
        "profile_photo", "Profile photo", "Branding",
        profile.get("has_photo"),
        "A profile photo is set." if profile.get("has_photo") else "No profile photo detected.",
        "Add a clear, friendly, recent headshot — profiles with photos get up to 14x more views.",
    )

    # 2. Background banner
    add(
        "background_banner", "Custom background banner", "Branding",
        profile.get("has_banner"),
        "Custom banner image set." if profile.get("has_banner") else "Using the default LinkedIn banner.",
        "Upload a banner that reflects your role, industry, or personal brand instead of the default blue.",
    )

    # 3. Headline length (LinkedIn allows up to 220 chars; default if blank is just job title)
    h_len = len(headline)
    headline_long_enough = h_len >= 40
    add(
        "headline_length", "Headline uses available space", "Headline",
        headline_long_enough,
        f"Headline is {h_len} characters." if headline else "No headline written.",
        "LinkedIn gives you 220 characters for your headline — use 80-220 of them to state what you do, who you help, and how.",
    )

    # 4. Headline isn't just "Title at Company"
    headline_has_value_prop = bool(headline) and not _FILLER_HEADLINE.match(headline)
    add(
        "headline_keywords", "Headline goes beyond \"Title at Company\"", "Headline",
        headline_has_value_prop,
        "Headline includes more than just a job title." if headline_has_value_prop
        else "Headline looks like a plain \"Title at Company\" with no keywords or value proposition.",
        "Add searchable keywords (skills, niche, outcomes) — e.g. \"Backend Engineer | Python & Go | Building fintech APIs at scale\".",
    )

    # 5. Custom URL
    add(
        "custom_url", "Custom profile URL", "Branding",
        profile.get("custom_url"),
        "Profile uses a custom linkedin.com/in/ URL." if profile.get("custom_url")
        else "Still using the auto-generated numeric profile URL.",
        "Edit your public profile URL to linkedin.com/in/yourname — cleaner for resumes and business cards.",
    )

    # 6. About section length
    about_words = _word_count(about)
    about_long_enough = about_words >= 100
    add(
        "about_length", "About section is substantial", "About",
        about_long_enough,
        f"About section is {about_words} words." if about else "About section is empty.",
        "Aim for 150-300 words in your About section: what you do, the impact you've had, and what you're looking for.",
    )

    # 7. About section has a call to action / is personal
    about_has_cta = bool(about) and _has_cta(about)
    add(
        "about_cta", "About section invites contact", "About",
        about_has_cta,
        "About section includes an invitation to connect or reach out." if about_has_cta
        else "About section doesn't invite the reader to do anything next.",
        "End your About section with a clear call to action, e.g. \"Open to new opportunities — feel free to connect or message me.\"",
    )

    # 8. Current role filled
    has_current_role = bool((profile.get("current_title") or "").strip()) and bool((profile.get("current_company") or "").strip())
    add(
        "current_role", "Current position filled in", "Experience",
        has_current_role,
        "Current title and company are set." if has_current_role else "Current title/company is missing.",
        "Make sure your most recent role has both a title and a company — recruiters filter on this first.",
    )

    # 9. Experience count
    exp_count = len(experience)
    add(
        "experience_count", "At least 2 work experiences listed", "Experience",
        exp_count >= 2,
        f"{exp_count} experience entr{'y' if exp_count == 1 else 'ies'} listed.",
        "List at least 2 roles (internships count) so recruiters can see a trajectory, not just one data point.",
    )

    # 10. Experience entries have bullet detail
    entries_with_bullets = sum(1 for e in experience if len([b for b in (e.get("bullets") or []) if str(b).strip()]) >= 2)
    detail_ok = exp_count > 0 and entries_with_bullets == exp_count
    add(
        "experience_detail", "Experience entries have achievement bullets", "Experience",
        detail_ok,
        f"{entries_with_bullets}/{exp_count} experience entries have 2+ bullet points." if exp_count
        else "No experience entries to check.",
        "Add 2-4 bullets per role focused on impact and numbers (\"Cut deploy time 40% by...\") instead of just duties.",
    )

    # 11. Education present
    add(
        "education", "Education listed", "Education",
        len(education) > 0,
        f"{len(education)} education entr{'y' if len(education) == 1 else 'ies'} listed." if education
        else "No education listed.",
        "Add your degree(s) — even bootcamps and certifications count if you don't have a traditional degree.",
    )

    # 12. Skills count
    skills_count = len(skills)
    add(
        "skills_count", "10+ relevant skills added", "Skills",
        skills_count >= 10,
        f"{skills_count} skill(s) listed.",
        "List at least 10-15 skills — LinkedIn lets recruiters filter search results by skill, so under-filled skills sections are invisible.",
    )

    # 13. Recommendations
    recs = int(profile.get("recommendations_received") or 0)
    add(
        "recommendations", "Has received recommendations", "Social proof",
        recs >= 1,
        f"{recs} recommendation(s) received." if recs else "No recommendations received yet.",
        "Ask 2-3 former managers or colleagues for a short written recommendation — social proof outweighs self-description.",
    )

    # 14. Certifications or projects/featured
    cert_or_proj_count = len(certifications) + len(projects) + int(profile.get("featured_items") or 0)
    add(
        "certifications_or_projects", "Certifications, projects, or featured items", "Credibility",
        cert_or_proj_count >= 2,
        f"{cert_or_proj_count} certification/project/featured item(s) found." if cert_or_proj_count
        else "No certifications, projects, or featured items found.",
        "Add certifications, pin 2-3 projects to Featured, or link writing/talks — this is often the first thing visitors scan.",
    )

    score = sum(r["weight"] for r in rules if r["passed"])
    passed_count = sum(1 for r in rules if r["passed"])

    if score >= 85:
        tier = "Excellent"
    elif score >= 65:
        tier = "Good"
    elif score >= 40:
        tier = "Needs work"
    else:
        tier = "Poor"

    return {
        "score": score,
        "tier": tier,
        "passed_count": passed_count,
        "total_rules": len(rules),
        "rules": rules,
    }
