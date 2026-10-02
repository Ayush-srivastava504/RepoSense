-- Run BEFORE migration 037 to see how many government rows were leaking into /jobs and /internships:
--   docker exec -i reposense-postgres psql -U postgres -d internship_db < scripts/diagnose_government_leak.sql
SELECT source, is_government, type, count(*) AS active_rows
FROM jobs
WHERE is_active
  AND (source IN ('freejobalert','employment_news','ssc','upsc') OR is_government)
GROUP BY 1,2,3 ORDER BY 1,2,3;

-- Government-looking rows from OTHER sources (title/apply domain) that nothing flags: review before trusting.
SELECT source, left(title, 70) AS title, company, apply_domain
FROM jobs
WHERE is_active AND is_government IS NOT TRUE AND source NOT IN ('freejobalert','employment_news','ssc','upsc')
  AND (apply_domain ~* '\.(gov|nic)\.in$' OR title ~* '(recruitment 20[0-9]{2}|sarkari|notification 20[0-9]{2})')
LIMIT 40;
