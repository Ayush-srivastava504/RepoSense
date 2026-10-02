-- FAQ extraction for company pages was removed (Google limits FAQ rich results to gov/health sites; copying a
-- company's own FAQ added little unique content). 034 added this column; drop it where 034 was applied.
-- IF EXISTS keeps this a no-op on databases that never ran 034.
ALTER TABLE company_sources DROP COLUMN IF EXISTS faq;
