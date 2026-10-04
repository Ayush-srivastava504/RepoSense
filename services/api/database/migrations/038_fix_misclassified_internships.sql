-- Rows typed 'internship' that are not internships (e.g. "Regional Manager - International Sales": the old scraper test
-- was a substring match on 'intern'). They showed on /internships. Same rule as REAL_INTERNSHIP_SQL in routes/jobs.py and
-- _guard_internship_type in crawler/src/processors/normalizer.py:
--   real = title has the WORD intern/internship, OR an internship-only marketplace (internshala/unstop) and not a senior title.
-- Their canonical URL moves /internships/<slug> -> /jobs/<slug>; the internships detail route 308-redirects to the canonical
-- path (apps/web/app/internships/[slug]/page.tsx), so old indexed URLs are not lost. Safe to re-run.
UPDATE jobs
SET type = 'full-time'
WHERE type = 'internship'
  AND title !~* '\m(intern|interns|internship|internships)\M'
  AND NOT (
        source IN ('internshala', 'unstop')
        AND title !~* '\m(manager|director|vp|vice president|senior|sr|principal|chief|head of|team lead|tech lead|architect)\M'
  );

-- Report what moved (visible in the migration log).
-- SELECT count(*) FROM jobs WHERE type = 'internship';
