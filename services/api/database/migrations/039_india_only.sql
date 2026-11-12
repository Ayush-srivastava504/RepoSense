-- Migration 039: India-only listings.
-- InternFlow now serves job seekers in India only. Deactivate every active listing that is not in India:
--   1. everything from the removed global/remote/Japan/Europe boards;
--   2. ATS-board listings (Greenhouse, Lever, ...) whose location names no Indian place.
-- Deactivated jobs drop out of listings and sitemaps, and their pages answer 410 Gone (apps/web/middleware.ts),
-- which is the fastest way to get them out of Google's index. Mirrors crawler/src/processors/india_filter.py,
-- which stops new non-India rows at crawl time. Idempotent: safe to re-run on every boot.
UPDATE jobs
SET is_active = FALSE
WHERE is_active = TRUE
  AND COALESCE(is_government, FALSE) = FALSE
  AND (
        source IN (
            'remoteok', 'weworkremotely', 'remotive', 'himalayas', 'japan_jobs', 'japan_internships',
            'europe_jobicy', 'europe_arbeitnow', 'europe_remotive', 'europe_weworkremotely', 'europe_remoteok',
            'europe_himalayas', 'japandev', 'tokyodev', 'wayup'
        )
        OR (
            COALESCE(source, '') NOT IN ('internshala', 'naukri', 'unstop', 'cutshort', 'freejobalert', 'employment_news', 'prosple')
            AND COALESCE(source, '') NOT LIKE 'company_portal%'
            AND COALESCE(location, '') !~* '\m(india|bharat|bangalore|bengaluru|mumbai|bombay|thane|delhi|ncr|noida|gurgaon|gurugram|faridabad|ghaziabad|hyderabad|secunderabad|pune|chennai|madras|kolkata|calcutta|ahmedabad|gandhinagar|kochi|cochin|thiruvananthapuram|trivandrum|coimbatore|madurai|mysore|mysuru|mangalore|mangaluru|jaipur|indore|bhopal|nagpur|nashik|lucknow|kanpur|chandigarh|mohali|panchkula|bhubaneswar|visakhapatnam|vizag|vijayawada|warangal|vadodara|baroda|surat|rajkot|patna|ranchi|jamshedpur|raipur|dehradun|guwahati|goa|hubli|belgaum|belagavi|trichy|tiruchirappalli|salem|vellore|puducherry|pondicherry|amritsar|ludhiana|varanasi|agra|udaipur|jodhpur|aurangabad|kolhapur|manipal|karnataka|maharashtra|tamil nadu|telangana|andhra pradesh|kerala|gujarat|rajasthan|uttar pradesh|madhya pradesh|west bengal|haryana|punjab|odisha|bihar|jharkhand|chhattisgarh|uttarakhand|assam)\M'
        )
  );
