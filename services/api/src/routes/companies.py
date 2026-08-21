from fastapi import APIRouter, HTTPException, Query
from configs.db import get_db_pool

from routes.jobs import TOP_COMPANY_TIER

router = APIRouter(
    prefix="/api/companies",
    tags=["companies"],
)

# A company only ever needs to clear ONE of these tiers, checked in this
# order, so every company lands in exactly one bucket:
#
#   1. top       — in TOP_COMPANY_TIER (the same curated list that drives
#                  the "Top Company" badge and ranking boost in
#                  routes/jobs.py — reused, not duplicated, so a company
#                  can't be "Top Company" on a job card but miss the Top
#                  tier here, or vice versa).
#   2. mass_hire — not in the top tier, but currently has a lot of active
#                  listings open at once. This is a volume signal (a
#                  company running a big hiring drive right now), not a
#                  prestige signal — a company drops out of this bucket
#                  the moment its open-listings count falls back down, no
#                  manual list to maintain.
#   3. startup   — everyone else with at least one active listing.
#
# Threshold picked from the shape of this dataset: most sources here
# (Internshala, HiringCafe, company career pages, ATS boards) post a
# handful of roles per company at a time — a company simultaneously
# running 8+ active listings is a genuine outlier worth calling out as
# "hiring at scale" rather than a single opening.
MASS_HIRE_THRESHOLD = 8

# Cap per section so the page stays fast and scannable even once the
# crawler has accumulated thousands of distinct companies (each section's
# `total` tells the frontend how many exist beyond the cap).
MAX_PER_SECTION = 60


def _lower_top_companies() -> list[str]:
    return [c.lower() for c in TOP_COMPANY_TIER]


@router.get("/")
async def get_companies(
    limit_per_section: int = Query(default=MAX_PER_SECTION, ge=1, le=200),
):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    rows = await pool.fetch(
        """
        SELECT
            company,
            count(*)                                   AS job_count,
            bool_or(is_official_domain)                 AS is_official_domain,
            (array_agg(apply_domain) FILTER (WHERE apply_domain IS NOT NULL))[1] AS apply_domain,
            (array_agg(location) FILTER (WHERE location IS NOT NULL))[1]         AS sample_location,
            max(posted_at)                              AS last_posted_at
        FROM jobs
        WHERE is_active = true AND company IS NOT NULL AND company != ''
        GROUP BY company
        """,
    )

    top_companies = set(_lower_top_companies())

    top: list[dict] = []
    mass_hire: list[dict] = []
    startup: list[dict] = []

    for row in rows:
        entry = {
            "company": row["company"],
            "job_count": row["job_count"],
            "is_official_domain": row["is_official_domain"],
            "apply_domain": row["apply_domain"],
            "sample_location": row["sample_location"],
            "last_posted_at": row["last_posted_at"],
        }

        if row["company"].lower() in top_companies:
            entry["tier"] = "top"
            top.append(entry)
        elif row["job_count"] >= MASS_HIRE_THRESHOLD:
            entry["tier"] = "mass_hire"
            mass_hire.append(entry)
        else:
            entry["tier"] = "startup"
            startup.append(entry)

    # Top: alphabetical — it's a curated/known-name list already, so
    # browsing A-Z is more useful than re-sorting by count.
    top.sort(key=lambda c: c["company"].lower())

    # Mass hire: biggest hiring drives first.
    mass_hire.sort(key=lambda c: c["job_count"], reverse=True)

    # Startup: most recently active first, so freshly-posting companies
    # surface over ones with a single stale listing. Sort key avoids
    # comparing None to a datetime directly (which Python errors on) by
    # sorting on "has a timestamp" first, then the timestamp itself.
    startup.sort(
        key=lambda c: (c["last_posted_at"] is not None, c["last_posted_at"]),
        reverse=True,
    )

    return {
        "top": {
            "companies": top[:limit_per_section],
            "total": len(top),
        },
        "mass_hire": {
            "companies": mass_hire[:limit_per_section],
            "total": len(mass_hire),
        },
        "startup": {
            "companies": startup[:limit_per_section],
            "total": len(startup),
        },
        "mass_hire_threshold": MASS_HIRE_THRESHOLD,
    }
