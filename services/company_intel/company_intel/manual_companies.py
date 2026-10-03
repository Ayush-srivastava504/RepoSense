"""Curated employers seeded with a VERIFIED official domain (domain_source = 'manual').

Why: `seed` only creates entities for companies already in the jobs table with a usable apply domain, so large
employers whose jobs arrive through aggregators (apply_domain = linkedin.com / naukri.com ...) never got an entity,
and therefore never got a crawled company page. Domains here are the companies' own corporate sites, never a
job board / ATS host (asserted in the tests). `manual` rows are never overwritten by the jobs-derived domain.
"""

# (display name, official domain)
MANUAL_COMPANIES = (
    # IT services / consulting (India campus + off-campus hirers)
    ('TCS', 'tcs.com'), ('Infosys', 'infosys.com'), ('Wipro', 'wipro.com'), ('HCLTech', 'hcltech.com'),
    ('Tech Mahindra', 'techmahindra.com'), ('Cognizant', 'cognizant.com'), ('Capgemini', 'capgemini.com'),
    ('Accenture', 'accenture.com'), ('GlobalLogic', 'globallogic.com'), ('LTIMindtree', 'ltimindtree.com'),
    ('Mphasis', 'mphasis.com'), ('Coforge', 'coforge.com'), ('Persistent Systems', 'persistent.com'),
    ('Hexaware', 'hexaware.com'), ('Birlasoft', 'birlasoft.com'), ('Zensar', 'zensar.com'),
    ('Cyient', 'cyient.com'), ('Sonata Software', 'sonata-software.com'), ('Happiest Minds', 'happiestminds.com'),
    ('KPIT', 'kpit.com'), ('Tata Elxsi', 'tataelxsi.com'), ('Genpact', 'genpact.com'), ('EPAM', 'epam.com'),
    ('Virtusa', 'virtusa.com'),
    # Big Four / consulting
    ('Deloitte', 'deloitte.com'), ('EY', 'ey.com'), ('KPMG', 'kpmg.com'), ('PwC', 'pwc.com'),
    # Product / engineering
    ('Zoho', 'zoho.com'), ('Zeta', 'zeta.tech'), ('Caterpillar', 'caterpillar.com'), ('Freshworks', 'freshworks.com'),
    ('Razorpay', 'razorpay.com'), ('Postman', 'postman.com'), ('Bosch', 'bosch.com'), ('Siemens', 'siemens.com'),
    ('Honeywell', 'honeywell.com'), ('IBM', 'ibm.com'), ('Oracle', 'oracle.com'), ('SAP', 'sap.com'),
)
