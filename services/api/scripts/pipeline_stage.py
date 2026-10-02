# Runs one pipeline stage as a subprocess and records it in pipeline_runs.
#   python scripts/pipeline_stage.py --run-id 123 --stage sitemap -- python scripts/build_sitemaps.py
# The wrapped command's stdout/stderr pass straight through and its exit code is
# returned unchanged. Logging is best-effort: a DB problem is printed to stderr
# and never changes the stage's outcome.
import argparse, asyncio, json, subprocess, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))

TAIL_LINES = 15


async def _db(sql: str, *args):
    import asyncpg
    from configs.config import settings
    conn = await asyncpg.connect(settings.DATABASE_URL, timeout=10)
    try:
        return await conn.fetchval(sql, *args)
    finally:
        await conn.close()


def _safe(sql: str, *args):
    try:
        return asyncio.run(_db(sql, *args))
    except Exception as exc:  # noqa: BLE001 - logging must never break the stage
        print(f'pipeline_stage: log write failed ({exc})', file=sys.stderr)
        return None


def run_stage(run_id: str, stage: str, cmd: list) -> int:
    row_id = _safe("INSERT INTO pipeline_runs (run_id, stage, status) VALUES ($1, $2, 'running') RETURNING id", run_id, stage)
    started = time.time()
    tail: list = []
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    for line in proc.stdout:
        sys.stdout.write(line)
        tail.append(line.rstrip())
        tail = tail[-TAIL_LINES:]
    code = proc.wait()
    elapsed = round(time.time() - started, 1)
    status = 'ok' if code == 0 else 'failed'
    detail = json.dumps({'exit_code': code, 'tail': tail})
    if row_id is not None:
        _safe("UPDATE pipeline_runs SET status=$2, finished_at=now(), duration_s=$3, detail=$4::jsonb WHERE id=$1", row_id, status, elapsed, detail)
    else:
        _safe("INSERT INTO pipeline_runs (run_id, stage, status, finished_at, duration_s, detail) VALUES ($1,$2,$3,now(),$4,$5::jsonb)",
              run_id, stage, status, elapsed, detail)
    print(f'pipeline_stage: {stage} {status} in {elapsed}s (run {run_id})')
    return code


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--run-id', required=True)
    p.add_argument('--stage', required=True)
    p.add_argument('cmd', nargs=argparse.REMAINDER)
    a = p.parse_args()
    cmd = a.cmd[1:] if a.cmd and a.cmd[0] == '--' else a.cmd
    if not cmd:
        p.error('no command given after --')
    sys.exit(run_stage(a.run_id, a.stage, cmd))
