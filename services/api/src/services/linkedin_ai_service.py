# services/api/src/services/linkedin_ai_service.py
# Calls the hosted LLM providers (services/llm_text.py) to turn the deterministic
# 14-rule report (linkedin_rules.py) into specific, human-sounding feedback:

import json
from services.llm_text import generate_text

class LinkedInAIService:

    async def generate_feedback(self, profile: dict, rule_report: dict) -> dict:
        failed_rules = [r for r in rule_report['rules'] if not r['passed']]
        failed_labels = '\n'.join((f'- {r["label"]}: {r["detail"]}' for r in failed_rules)) or 'None — profile passes every rule.'
        prompt = f'You are a LinkedIn profile coach. Output only a single valid JSON object. No markdown, no explanation, no code fences, no text before or after.\n\nThe JSON must follow this exact structure:\n{{\n  "overall_feedback": "2-3 sentence verdict on the profile, encouraging but honest",\n  "headline_rewrite": "one improved headline, under 220 characters",\n  "about_rewrite": "an improved 2-3 sentence opening for the About section",\n  "priority_tips": ["most important fix first", "second most important fix", "third most important fix"]\n}}\n\nProfile score: {rule_report["score"]}/100 ({rule_report["tier"]})\nCurrent headline: {profile.get("headline") or "(empty)"}\nCurrent about section: {(profile.get("about") or "(empty)")[:600]}\nCurrent title: {profile.get("current_title") or "(none)"}\nCurrent company: {profile.get("current_company") or "(none)"}\nTop skills: {", ".join((profile.get("skills") or [])[:10]) or "(none listed)"}\n\nRules that failed:\n{failed_labels}\n\nOutput the JSON now:'
        try:
            text = await generate_text(prompt, temperature=0.4, json_object=True)
        except Exception:
            return self._fallback(rule_report)
        text = text.replace('```json', '').replace('```', '').replace('`', '').strip()
        json_text = self._extract_first_json(text)
        if not json_text:
            return self._fallback(rule_report)
        try:
            parsed = json.loads(json_text)
        except json.JSONDecodeError:
            return self._fallback(rule_report)
        return self._normalize(parsed, rule_report)

    def _extract_first_json(self, text: str):
        decoder = json.JSONDecoder()
        start = text.find('{')
        if start == -1:
            return None
        try:
            obj, end = decoder.raw_decode(text[start:])
            return text[start:start + end]
        except json.JSONDecodeError:
            for i in range(start + 1, len(text)):
                if text[i] == '{':
                    try:
                        obj, end = decoder.raw_decode(text[i:])
                        return text[i:i + end]
                    except json.JSONDecodeError:
                        continue
        return None

    def _normalize(self, data: dict, rule_report: dict) -> dict:
        data.setdefault('overall_feedback', '')
        data.setdefault('headline_rewrite', '')
        data.setdefault('about_rewrite', '')
        tips = data.get('priority_tips')
        if not isinstance(tips, list):
            tips = []
        data['priority_tips'] = [str(t) for t in tips if str(t).strip()][:5]
        if not data['priority_tips']:
            data['priority_tips'] = [r['tip'] for r in rule_report['rules'] if not r['passed']][:3]
        return data

    def _fallback(self, rule_report: dict) -> dict:
        failed = [r for r in rule_report['rules'] if not r['passed']]
        return {'overall_feedback': f'Your profile scores {rule_report["score"]}/100 ({rule_report["tier"]}). {len(failed)} of {rule_report["total_rules"]} checks need attention.', 'headline_rewrite': '', 'about_rewrite': '', 'priority_tips': [r['tip'] for r in failed][:3]}
