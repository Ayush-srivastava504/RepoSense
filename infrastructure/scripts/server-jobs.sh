#!/usr/bin/env bash
# Scheduled server jobs. cron runs these on the instance itself (installed by setup-server.sh), so
# nothing depends on GitHub Actions being able to SSH in. Until Nov 2026 these ran as SSH workflows;
# when SSH broke (full disk, then a locked-down security group) every sitemap, index and enrichment
# run failed silently for weeks and the sitemaps went stale. Running them here removes that link.
#
#   bash infrastructure/scripts/server-jobs.sh <job>
#
# Jobs: sitemaps | queue | daily | index-push | indexnow | structured | article | companies | company-intel
# Each job takes a lock, so a slow run is never stacked on top of itself.
set -uo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE="docker compose -f $REPO_DIR/infrastructure/docker/docker-compose.yml"
JOB="${1:?usage: server-jobs.sh <job>}"
RUN_ID="cron-$(date -u +%Y%m%dT%H%M)"

exec 9>"/tmp/internflow-job-$JOB.lock"
if ! flock -n 9; then
  echo "$(date -u +%FT%TZ) $JOB: previous run still going, skipping"
  exit 0
fi

# A job inside the running API container (cheap: no new container).
api() { $COMPOSE exec -T api "$@" </dev/null; }
# A job in a one-off API container (for scripts that run long or need their own process).
api_run() { $COMPOSE run --rm --entrypoint python api "$@" </dev/null; }
# Record the step in pipeline_runs so the admin view shows it.
stage() { local name=$1; shift; api python scripts/pipeline_stage.py --run-id "$RUN_ID" --stage "$name" -- "$@"; }

echo "$(date -u +%FT%TZ) $JOB: start ($RUN_ID)"
status=0
case "$JOB" in
  sitemaps)
    stage sitemap python scripts/build_sitemaps.py || status=$?
    ;;
  queue)
    api python scripts/run_generation_queue.py --no-fallback --batch-size 20 --max-runtime-minutes 5 || status=$?
    ;;
  daily)
    # enrich -> charts -> sitemap -> index pushes. Enrichment or charts failing must not block the
    # sitemap; the index pushes only run on a fresh sitemap.
    stage enrich python scripts/enrich_all_content.py --target jobs --redo-fallback --no-fallback \
      --max-runtime-minutes 30 --limit 100 || status=$?
    stage charts python scripts/build_chart_stats.py || status=$?
    if stage sitemap python scripts/build_sitemaps.py; then
      for category in jobs internships remote government; do
        api_run scripts/pipeline_stage.py --run-id "$RUN_ID" --stage "index:$category" -- \
          python scripts/phase_f_priority_index_push.py --category "$category" || status=$?
      done
      stage index:routes python scripts/push_route_sitemaps.py || status=$?
    else
      status=1
    fi
    ;;
  index-push)
    api_run scripts/phase_f_priority_index_push.py --job-cap 60 --internship-cap 10 || status=$?
    ;;
  indexnow)
    api_run scripts/indexnow_push_changed.py --cap 500 || status=$?
    ;;
  structured)
    api python scripts/enrich_all_content.py --target structured --bulk --no-fallback \
      --max-runtime-minutes 25 --limit 300 || status=$?
    ;;
  article)
    # 1,500+ word job-specific guide per job (job_article_service.py). Top tiers first; nothing is stored
    # unless it passes validation, and only jobs with an article are listed in the job sitemaps.
    api python scripts/enrich_all_content.py --target article --no-fallback       --max-runtime-minutes 40 --limit 150 || status=$?
    ;;
  companies)
    api python scripts/enrich_all_content.py --target companies --limit 5000 || status=$?
    ;;
  company-intel)
    cd "$REPO_DIR" || exit 1
    docker build -q -f services/company_intel/Dockerfile -t company-intel . || exit 1
    ENV_FILE=infrastructure/docker/.env
    DB_URL="$(grep -m1 '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | sed 's/@postgres\b/@localhost/')"
    docker run --rm --network host --env-file "$ENV_FILE" -e DATABASE_URL="$DB_URL" company-intel \
      python -m company_intel.run all --limit 50 </dev/null || status=$?
    ;;
  *)
    echo "unknown job: $JOB" >&2
    exit 2
    ;;
esac
echo "$(date -u +%FT%TZ) $JOB: done (exit $status)"
exit $status
