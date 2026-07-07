from typing import Dict, List, Optional

from scrapers.hackathons.base import BaseHackathonScraper

# Devpost exposes an (unauthenticated, publicly used by their own frontend)
# JSON search endpoint, so this scraper skips Playwright entirely — plain
# requests is enough and far more reliable than rendering the SPA.
API_URL = "https://devpost.com/api/hackathons"


class DevpostScraper(BaseHackathonScraper):

    source_name = "devpost"
    uses_browser = False

    def scrape(
        self,
        keywords: List[str],
        locations: List[str],
        max_pages: int,
    ) -> List[Dict]:

        results: List[Dict] = []

        for page_num in range(1, 4):

            params = {
                "status[]": "open",
                "order_by": "recently-added",
                "page": page_num,
            }

            self.log.info("Scraping Devpost page %d", page_num)

            resp = None
            try:
                resp = self.session.get(API_URL, params=params, timeout=20)
                resp.raise_for_status()
            except Exception as e:
                self.log.warning("Devpost API error: %s", str(e))
                continue

            try:
                data = resp.json()
            except Exception:
                self.log.warning("Devpost API returned non-JSON")
                continue

            entries = data.get("hackathons", [])

            if not entries:
                break

            for entry in entries:
                h = self._parse_entry(entry)
                if h:
                    results.append(h)

        self.log.info("Collected %d hackathons from devpost", len(results))
        return results

    def _parse_entry(self, entry: Dict) -> Optional[Dict]:

        title = (entry.get("title") or "").strip()
        if not title:
            return None

        url = entry.get("url") or ""

        h = self._empty_hackathon()
        h["title"] = title
        h["organizer"] = (entry.get("organization_name") or "Devpost host") or None
        h["description"] = entry.get("tagline") or entry.get("description") or ""
        h["participation_mode"] = "online" if entry.get("open_state") == "open" and entry.get("displayed_location", {}).get("location") in (None, "Online") else None
        h["location"] = (entry.get("displayed_location") or {}).get("location")
        h["is_global"] = h["location"] in (None, "Online", "Worldwide")

        prizes = entry.get("prize_amount")
        h["prize_pool_text"] = prizes

        h["registration_deadline"] = entry.get("submission_period_dates")

        h["themes"] = [t.get("name") for t in (entry.get("themes") or []) if t.get("name")][:8]

        h["source"] = self.source_name
        h["source_url"] = url
        h["apply_url"] = url
        h["image_url"] = entry.get("thumbnail_url")

        return h
