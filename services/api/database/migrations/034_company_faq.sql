-- Verbatim question/answer pairs lifted from a company's OWN FAQ page (FAQPage JSON-LD, <details>/<summary>,
-- <dl>). Not model-written. Read by GET /api/companies/by-slug/{slug} and rendered + marked up as FAQPage.
ALTER TABLE company_sources ADD COLUMN IF NOT EXISTS faq JSONB;
