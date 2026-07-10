from fastapi import APIRouter, HTTPException, Query
from configs.db import get_db_pool

router = APIRouter(
    prefix="/api/jobs",
    tags=["jobs"],
)

TOP_COMPANY_TIER = [
    "tcs", "tata consultancy services", "infosys", "wipro", "hcl",
    "hcltech", "cognizant", "accenture", "capgemini", "tech mahindra",
    "coforge", "lti", "ltimindtree", "l&t infotech", "mindtree",
    "persistent systems", "persistent", "mphasis", "zensar",
    "zensar technologies", "hexaware", "hexaware technologies", "cyient",
    "niit technologies", "niit", "birlasoft", "sonata software",
    "happiest minds", "tata elxsi", "kpit", "kpit technologies",
    "virtusa", "globant", "publicis sapient", "epam", "epam systems",
    "thoughtworks", "newgen", "newgen software", "intellect design",
    "firstsource", "wns", "wns global services", "genpact", "exl",
    "exl service", "concentrix", "ttec", "teleperformance", "conduent",
    "infosys bpm", "tcs ion", "quess corp", "randstad", "adecco",
    "ibm", "microsoft", "google", "alphabet", "amazon", "meta",
    "facebook", "apple", "netflix", "adobe", "salesforce", "oracle",
    "sap", "vmware", "cisco", "intel", "nvidia", "qualcomm", "samsung",
    "dell", "hp", "hewlett packard", "lenovo", "sony", "lg", "xiaomi",
    "oneplus", "ericsson", "nokia", "juniper networks", "arista",
    "f5", "f5 networks", "palo alto networks", "crowdstrike",
    "servicenow", "workday", "atlassian", "slack", "dropbox",
    "snowflake", "databricks", "mongodb", "confluent", "elastic",
    "twilio", "stripe", "paypal", "square", "block",
    "uber", "ola", "ola cabs", "swiggy", "zomato", "flipkart",
    "myntra", "paytm", "phonepe", "razorpay", "cred", "zepto",
    "meesho", "nykaa", "policybazaar", "freshworks", "zoho",
    "inmobi", "browserstack", "postman", "chargebee", "druva",
    "mindtickle", "cars24", "urban company", "dream11", "groww",
    "upstox", "byju's", "byjus", "unacademy", "vedantu", "upgrad",
    "whitehat jr", "physicswallah", "lenskart", "bigbasket",
    "grofers", "blinkit", "dunzo", "delhivery", "shiprocket",
    "sharechat", "moj", "dailyhunt", "hike", "gojek",
    "deloitte", "pwc", "kpmg", "ey", "ernst & young", "electronic arts",
    "ea", "mckinsey", "mckinsey & company", "bcg",
    "boston consulting group", "bain", "bain & company", "goldman sachs",
    "jpmorgan", "jp morgan", "jpmorgan chase", "morgan stanley",
    "barclays", "citi", "citibank", "citigroup", "hsbc",
    "deutsche bank", "american express", "amex", "visa", "mastercard",
    "bank of america", "ubs", "nomura", "wells fargo",
    "standard chartered", "credit suisse", "state street", "blackrock",
    "fidelity", "fidelity investments", "d.e. shaw", "de shaw",
    "two sigma", "optiver", "citadel", "jane street",
    "reliance industries", "reliance", "jio", "tata group", "tata sons",
    "mahindra", "mahindra & mahindra", "aditya birla group",
    "aditya birla", "bajaj", "bajaj finserv", "larsen & toubro", "l&t",
    "adani", "adani group", "itc", "hindustan unilever", "hul",
    "asian paints", "godrej", "godrej group",
    "maruti suzuki", "tata motors", "bosch", "siemens", "honeywell",
    "ge", "general electric", "schneider electric", "abb",
    "airtel", "bharti airtel", "vodafone idea", "vi", "bsnl",
    "juspay", "cashfree", "innovaccer", "postman inc", "yellow.ai",
    "darwinbox", "clevertap", "hasura", "rocketlane", "zeta",
    "amagi", "gupshup", "wingify", "vwo", "cure.fit", "cult.fit",
    "curefit", "licious", "rebel foods", "eternal",
]

JOB_COLUMNS = """
    id,
    title,
    company,
    description,
    url,
    source,
    posted_at,
    location,
    salary,
    stipend,
    type,
    deadline,
    confidence_score,
    confidence_label,
    apply_domain,
    is_official_domain,
    is_remote,
    is_government,
    country,
    department,
    vacancies,
    notification_number
"""

BADGE_EXPRESSIONS = """
    (posted_at IS NOT NULL AND posted_at > now() - interval '24 hours') AS is_new,
    (lower(company) = ANY(:top_companies)) AS is_top_company,
    (confidence_score >= 90 AND is_official_domain) AS is_verified_source,
    (
        deadline IS NOT NULL
        AND deadline > now()
        AND deadline < now() + interval '2 days'
    ) AS is_hot
"""

RANKING_EXPRESSION = """
    (
        CASE WHEN lower(company) = ANY(:top_companies) THEN 40 ELSE 0 END
        + CASE
            WHEN posted_at > now() - interval '24 hours' THEN 35
            WHEN posted_at > now() - interval '72 hours' THEN 20
            WHEN posted_at > now() - interval '7 days' THEN 8
            ELSE 0
          END
        + (COALESCE(confidence_score, 0)::float / 100.0) * 25
    )
"""


def _lower_top_companies() -> list[str]:
    return [c.lower() for c in TOP_COMPANY_TIER]


@router.get("/")
async def get_jobs(
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    source: str | None = Query(default=None),
    search: str | None = Query(default=None),
    type: str | None = Query(default=None, description="Filter by job type, e.g. 'internship'"),
    category: str | None = Query(
        default=None,
        pattern="^(remote|government)$",
        description="'remote' for is_remote=true, 'government' for is_government=true",
    ),
    sort: str = Query(
        default="recent",
        pattern="^(recent|ranked)$",
        description="'recent' (default, unchanged) or 'ranked' for the boosted first-page ordering",
    ),
):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    conditions = ["is_active = true"]
    params: list = []

    if source:
        params.append(source)
        conditions.append(f"source = ${len(params)}")

    if type:
        params.append(type)
        conditions.append(f"type = ${len(params)}")

    if category == "remote":
        conditions.append("is_remote = true")
    elif category == "government":
        conditions.append("is_government = true")

    if search:
        params.append(f"%{search}%")
        n = len(params)
        conditions.append(
            f"(title ILIKE ${n} OR company ILIKE ${n} OR description ILIKE ${n})"
        )

    where = "WHERE " + " AND ".join(conditions)

    total: int = await pool.fetchval(
        f"SELECT COUNT(*) FROM jobs {where}",
        *params,
    )

    top_companies_pos = len(params) + 1
    params_with_companies = params + [_lower_top_companies()]

    limit_pos = len(params_with_companies) + 1
    offset_pos = len(params_with_companies) + 2

    placeholder = f"${top_companies_pos}"
    order_by = "posted_at DESC"
    if sort == "ranked":
        ranking_sql = RANKING_EXPRESSION.replace(":top_companies", placeholder)
        order_by = f"{ranking_sql} DESC, posted_at DESC"

    badges_sql = BADGE_EXPRESSIONS.replace(":top_companies", placeholder)

    rows = await pool.fetch(
        f"""
        SELECT
            {JOB_COLUMNS},
            {badges_sql}
        FROM jobs
        {where}
        ORDER BY {order_by}
        LIMIT ${limit_pos} OFFSET ${offset_pos}
        """,
        *params_with_companies, limit, offset,
    )

    return {
        "jobs": [dict(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/featured")
async def get_featured_jobs(
    limit: int = Query(default=6, ge=1, le=12),
    type: str | None = Query(default=None),
    category: str | None = Query(
        default=None,
        pattern="^(remote|government)$",
        description="'remote' for is_remote=true, 'government' for is_government=true",
    ),
):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    conditions = [
        "is_active = true",
        "posted_at > now() - interval '14 days'",
        "(lower(company) = ANY($1) OR confidence_score >= 80)",
    ]
    params: list = [_lower_top_companies()]

    if type:
        params.append(type)
        conditions.append(f"type = ${len(params)}")

    if category == "remote":
        conditions.append("is_remote = true")
    elif category == "government":
        conditions.append("is_government = true")

    where = "WHERE " + " AND ".join(conditions)

    placeholder = "$1"
    ranking_sql = RANKING_EXPRESSION.replace(":top_companies", placeholder)
    badges_sql = BADGE_EXPRESSIONS.replace(":top_companies", placeholder)

    limit_pos = len(params) + 1

    rows = await pool.fetch(
        f"""
        SELECT
            {JOB_COLUMNS},
            {badges_sql}
        FROM jobs
        {where}
        ORDER BY {ranking_sql} DESC, posted_at DESC
        LIMIT ${limit_pos}
        """,
        *params, limit,
    )

    return {"jobs": [dict(row) for row in rows]}


@router.get("/{job_id}")
async def get_job(job_id: str):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    placeholder = "$2"
    badges_sql = BADGE_EXPRESSIONS.replace(":top_companies", placeholder)

    row = await pool.fetchrow(
        f"""
        SELECT
            {JOB_COLUMNS},
            {badges_sql}
        FROM jobs
        WHERE id = $1 AND is_active = true
        """,
        job_id,
        _lower_top_companies(),
    )

    if row is None:
        raise HTTPException(404, "Job not found")

    return dict(row)