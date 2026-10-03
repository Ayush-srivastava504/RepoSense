# Candidate career boards for big companies, Indian unicorns/startups and YC-backed startups.
#
# WHY: config.ATS_COMPANIES held ~50 mostly-US boards and 6 Lever boards, so Swiggy, Zomato, PwC, Razorpay,
# CRED, Meesho etc. were never fetched at all. This file is merged into ATS_COMPANIES at import (config.py).
#
# NOT LIVE-VERIFIED: the build sandbox had no internet. Slugs are best guesses. A wrong slug costs one
# 404 request (ats_common.fetch_json returns None on 404) and nothing else, so over-listing is safe.
# Run `python probe_boards.py` from services/api/crawler on EC2: it prints which slugs really exist and how
# many jobs / India jobs each has, so you can delete the dead ones and keep the rest.
from typing import Dict, List

CANDIDATE_ATS: Dict[str, List[str]] = {
    'greenhouse': [
        # Indian companies / startups
        'razorpay', 'groww', 'postman', 'phonepe', 'meesho', 'swiggy', 'zepto', 'dunzo', 'chargebee', 'hasura',
        'innovaccer', 'browserstack', 'druva', 'thoughtspot', 'unacademy', 'upgrad', 'sharechat', 'cars24',
        # Global tech / YC-backed
        'doordash', 'lyft', 'uber', 'datadog', 'intercom', 'hubspot', 'mixpanel', 'segment', 'opendoor', 'flexport',
        'gitlab', 'airbnb', 'checkr', 'faire', 'ironclad', 'lattice', 'mercury', 'plaid', 'amplitude', 'whatnot',
    ],
    'lever': [
        'cred', 'meesho', 'swiggy', 'zepto', 'phonepe', 'upstox', 'slice', 'khatabook', 'urbancompany', 'rapido',
        'shadowfax', 'jupiter', 'sharechat', 'dream11', 'zomato', 'eternal', 'paytm', 'mindtickle', 'whatfix',
        'spotify', 'palantir', 'coupa', 'kong', 'mistral', 'attentive', 'highspot',
    ],
    'ashby': [
        'openai', 'perplexity', 'anysphere', 'supabase', 'posthog', 'clerk', 'cohere', 'zapier', 'resend',
        'modal', 'ramp', 'brex', 'rippling', 'linear', 'notion', 'cursor', 'sierra', 'harvey',
    ],
    'smartrecruiters': [
        'swiggy', 'wipro', 'mcdonalds', 'publicissapient', 'capgemini', 'nvidia', 'servicenow', 'adidas',
        # IT services / consulting (unverified slugs; probe_boards.py reports which exist)
        'globallogic', 'cognizant', 'accenture', 'techmahindra', 'tcs', 'infosys', 'hcltech', 'ltimindtree',
        'mphasis', 'coforge', 'persistent', 'zeta', 'zoho',
    ],
    'workable': ['zomato', 'swiggy', 'razorpay'],
}

# Workday tenants (enterprises that do NOT expose Greenhouse/Lever). One entry per career site:
# host = <tenant>.wd<N>.myworkdayjobs.com, site = the path segment after the host.
# Unverified, same caveat as above; probe_boards.py tests each one.
WORKDAY_TENANTS: List[Dict[str, str]] = [
    {'company': 'PwC', 'host': 'pwc.wd3.myworkdayjobs.com', 'tenant': 'pwc', 'site': 'Global_Campus_Careers'},
    {'company': 'PwC', 'host': 'pwc.wd3.myworkdayjobs.com', 'tenant': 'pwc', 'site': 'Global_Experienced_Careers'},
    {'company': 'NVIDIA', 'host': 'nvidia.wd5.myworkdayjobs.com', 'tenant': 'nvidia', 'site': 'NVIDIAExternalCareerSite'},
    {'company': 'Adobe', 'host': 'adobe.wd5.myworkdayjobs.com', 'tenant': 'adobe', 'site': 'external_experienced'},
    {'company': 'Salesforce', 'host': 'salesforce.wd12.myworkdayjobs.com', 'tenant': 'salesforce', 'site': 'External_Career_Site'},
    {'company': 'Intel', 'host': 'intel.wd1.myworkdayjobs.com', 'tenant': 'intel', 'site': 'External'},
    {'company': 'Dell', 'host': 'dell.wd1.myworkdayjobs.com', 'tenant': 'dell', 'site': 'External'},
    {'company': 'Mastercard', 'host': 'mastercard.wd1.myworkdayjobs.com', 'tenant': 'mastercard', 'site': 'CorporateCareers'},
    {'company': 'Qualcomm', 'host': 'qualcomm.wd5.myworkdayjobs.com', 'tenant': 'qualcomm', 'site': 'External'},
    {'company': 'Walmart', 'host': 'walmart.wd5.myworkdayjobs.com', 'tenant': 'walmart', 'site': 'WalmartExternal'},
    # Added for the requested IT-services / Big Four / industrial employers. Same caveat: tenant + site are
    # best guesses, a wrong one 404s and is skipped. Verify with `python probe_boards.py workday` on EC2 and
    # correct the host/site from the company's real careers URL (https://<host>/<locale>/<site>).
    {'company': 'Caterpillar', 'host': 'cat.wd5.myworkdayjobs.com', 'tenant': 'cat', 'site': 'CaterpillarCareers'},
    {'company': 'KPMG', 'host': 'kpmg.wd1.myworkdayjobs.com', 'tenant': 'kpmg', 'site': 'KPMG'},
    {'company': 'Capgemini', 'host': 'capgemini.wd3.myworkdayjobs.com', 'tenant': 'capgemini', 'site': 'CapgeminiCareers'},
    {'company': 'Cognizant', 'host': 'cognizant.wd1.myworkdayjobs.com', 'tenant': 'cognizant', 'site': 'CognizantCareers'},
    {'company': 'Accenture', 'host': 'accenture.wd3.myworkdayjobs.com', 'tenant': 'accenture', 'site': 'AccentureCareers'},
    {'company': 'Deloitte', 'host': 'deloitte.wd1.myworkdayjobs.com', 'tenant': 'deloitte', 'site': 'Deloitte_Careers'},
    {'company': 'EY', 'host': 'ey.wd3.myworkdayjobs.com', 'tenant': 'ey', 'site': 'EY_Careers'},
    {'company': 'GlobalLogic', 'host': 'globallogic.wd1.myworkdayjobs.com', 'tenant': 'globallogic', 'site': 'GlobalLogicCareers'},
    {'company': 'Zeta', 'host': 'zeta.wd1.myworkdayjobs.com', 'tenant': 'zeta', 'site': 'Zeta'},
]

# Board slug -> proper display name. Without this the scrapers title-case the slug ('scaleai' -> 'Scaleai',
# 'urbancompany' -> 'Urbancompany'), which also breaks the lower(company) match against the top-company tier.
DISPLAY_NAMES: Dict[str, str] = {
    'scaleai': 'Scale AI', 'urbancompany': 'Urban Company', 'phonepe': 'PhonePe', 'sharechat': 'ShareChat',
    'browserstack': 'BrowserStack', 'thoughtspot': 'ThoughtSpot', 'upgrad': 'upGrad', 'cars24': 'CARS24',
    'dream11': 'Dream11', 'doordash': 'DoorDash', 'hubspot': 'HubSpot', 'gitlab': 'GitLab', 'openai': 'OpenAI',
    'posthog': 'PostHog', 'anysphere': 'Cursor', 'mcdonalds': "McDonald's", 'publicissapient': 'Publicis Sapient',
    'servicenow': 'ServiceNow', 'khatabook': 'Khatabook', 'cred': 'CRED', 'eternal': 'Zomato (Eternal)',
    'mindtickle': 'Mindtickle', 'grafana-labs': 'Grafana Labs', 'pagerduty': 'PagerDuty', 'crowdstrike': 'CrowdStrike',
    'palantir': 'Palantir', 'clevertap': 'CleverTap', 'hasura': 'Hasura', 'wipro': 'Wipro', 'zepto': 'Zepto',
    'globallogic': 'GlobalLogic', 'cognizant': 'Cognizant', 'accenture': 'Accenture', 'techmahindra': 'Tech Mahindra',
    'tcs': 'TCS', 'infosys': 'Infosys', 'hcltech': 'HCLTech', 'ltimindtree': 'LTIMindtree', 'mphasis': 'Mphasis',
    'coforge': 'Coforge', 'persistent': 'Persistent Systems', 'zeta': 'Zeta', 'zoho': 'Zoho', 'capgemini': 'Capgemini',
}


def display_company_name(token: str) -> str:
    return DISPLAY_NAMES.get(token) or token.replace('-', ' ').replace('_', ' ').title()
