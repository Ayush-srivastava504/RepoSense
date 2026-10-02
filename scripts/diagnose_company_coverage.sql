-- Why is company X missing? Run on EC2:
--   docker exec -i reposense-postgres psql -U postgres -d internship_db < scripts/diagnose_company_coverage.sql
-- Read the output top to bottom: the first query that returns 0 rows is where the company is lost.

-- 1) Did the scraper ever store them? (0 rows = scraper never produced them -> scraper problem)
SELECT company, source, count(*) total, count(*) FILTER (WHERE is_active) active,
       max(created_at) last_created, max(last_seen_at) last_seen
FROM jobs
WHERE company ~* '(microsoft|amazon|tcs|tata consultancy|tech ?mahindra|infosys|wipro)'
GROUP BY 1, 2 ORDER BY 1, 2;

-- 2) Stored but hidden by the 10/20-day listing freshness window (routes/jobs.py _freshness_conditions)?
SELECT company, type, count(*) active_rows,
       count(*) FILTER (WHERE deadline IS NULL OR deadline > now()) not_expired,
       count(*) FILTER (WHERE posted_at IS NULL
                           OR (type = 'internship' AND posted_at > now() - interval '10 days')
                           OR (type <> 'internship' AND posted_at > now() - interval '20 days')) visible_in_lists
FROM jobs
WHERE is_active AND company ~* '(microsoft|amazon|tcs|tata consultancy|tech ?mahindra)'
GROUP BY 1, 2 ORDER BY 1, 2;

-- 3) Visible but kept out of the sitemap/index (thin + no AI overview)?
SELECT company, count(*) visible, count(*) FILTER (WHERE is_thin) thin,
       count(*) FILTER (WHERE enriched_overview IS NOT NULL) with_overview
FROM jobs
WHERE is_active AND company ~* '(microsoft|amazon|tcs|tata consultancy|tech ?mahindra)'
GROUP BY 1 ORDER BY 1;

-- 4) Per-source health over the last 3 days: a source that suddenly writes 0 rows is failing/blocked.
SELECT source, count(*) rows_created_3d FROM jobs WHERE created_at > now() - interval '3 days' GROUP BY 1 ORDER BY 2 DESC;
