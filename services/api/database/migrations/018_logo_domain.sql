-- Adds a logo-lookup domain separate from apply_domain.
--
-- apply_domain is "whatever domain the apply_url points at" — for
-- aggregator-sourced jobs (LinkedIn, Indeed, RemoteOK, ...) that's the
-- aggregator's own domain, not the employer's. The frontend logo widget
-- (apps/web/app/components/CompanyLogo.tsx) was fetching a logo for
-- apply_domain directly, so e.g. every LinkedIn-sourced job showed
-- LinkedIn's own logo instead of the hiring company's.
--
-- logo_domain is apply_domain UNLESS apply_domain is a known aggregator
-- domain, in which case it falls back to our curated TRUSTED_COMPANIES
-- mapping (or NULL, so the UI shows the initials avatar instead of a
-- wrong logo). See crawler/src/processors/trust.py score().

ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS logo_domain TEXT;

COMMENT ON COLUMN jobs.logo_domain IS
    'Domain to use for company logo lookup — NULL or a curated official domain when apply_domain is an aggregator (LinkedIn, Indeed, ...) rather than the employer''s own site. See processors/trust.py AGGREGATOR_DOMAINS.';

-- Backfill existing rows so old data isn't stuck showing an aggregator's
-- logo until the next crawl re-scores it. Mirrors the AGGREGATOR_DOMAINS
-- set in trust.py — keep in sync if that set changes.
UPDATE jobs
SET logo_domain = apply_domain
WHERE logo_domain IS NULL
  AND apply_domain IS NOT NULL
  AND apply_domain NOT IN (
      'linkedin.com', 'indeed.com', 'glassdoor.com', 'naukri.com',
      'internshala.com', 'unstop.com', 'cutshort.in', 'freejobalert.com',
      'remoteok.com', 'remoteok.io', 'weworkremotely.com', 'remotive.com',
      'wayup.com', 'hiring.cafe', 'jobicy.com', 'arbeitnow.com'
  );
