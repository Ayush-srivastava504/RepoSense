"""GET /api/jobs/{id}/status must separate expired rows from unknown ids.

The web middleware answers 410 Gone only for state == 'gone'; a 404 here
(never stored) must stay a normal 404 page.
"""
import pathlib

SRC = (pathlib.Path(__file__).resolve().parents[1] / 'src' / 'routes' / 'jobs.py').read_text()


def test_status_route_exists_and_does_not_filter_on_is_active():
    assert "@router.get('/{job_id}/status')" in SRC
    assert "SELECT is_active FROM jobs WHERE id = $1" in SRC


def test_status_maps_inactive_to_gone_and_missing_to_404():
    assert "'active' if row['is_active'] else 'gone'" in SRC
    body = SRC.split("async def get_job_status")[1].split("@router.get('/{job_id}')")[0]
    assert "raise HTTPException(404" in body
