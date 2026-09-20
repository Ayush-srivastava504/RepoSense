"""The web tier's server-side calls must be able to skip the per-IP rate limit.

Without this, SSR/ISR/sitemap traffic shares one anonymous 50/min bucket (Vercel
egress IPs) and legitimate page renders get 429s. The bypass must be opt-in
(no key configured -> disabled) and compare in constant time.
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1] / 'src'
RATE = (ROOT / 'middleware' / 'rate_limit.py').read_text()
CONFIG = (ROOT / 'configs' / 'config.py').read_text()


def test_setting_exists_and_defaults_to_disabled():
    assert "INTERNAL_API_KEY: str = ''" in CONFIG


def test_bypass_is_wired_into_the_middleware():
    body = RATE.split('async def rate_limit_middleware')[1]
    assert '_internal_bypass(request)' in body


def test_bypass_needs_a_configured_key_and_uses_constant_time_compare():
    fn = RATE.split('def _internal_bypass')[1].split('def get_client_ip')[0]
    assert 'if not configured_key:' in fn and 'return False' in fn
    assert "request.headers.get('X-Internal-Key'" in fn
    assert 'hmac.compare_digest' in fn
