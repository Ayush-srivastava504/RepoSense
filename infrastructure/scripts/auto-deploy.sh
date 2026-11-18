#!/usr/bin/env bash
# Pull-based deploys. cron runs this every 5 minutes (installed by setup-server.sh):
#   1. fast-forward the checkout to origin/master (compose file, Caddyfile, these scripts)
#   2. pull the :latest images CI pushed to GHCR
#   3. if either changed, `docker compose up -d` -- compose only recreates containers whose
#      image or config actually changed -- then wait for the API health check
# The server reaches out to GitHub; GitHub never has to reach in, so port 22 can stay closed
# to everything but the owner's IP. A push to master is live ~5 min after CI finishes building.
set -uo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE="docker compose -f $REPO_DIR/infrastructure/docker/docker-compose.yml"
cd "$REPO_DIR" || exit 1

exec 9>/tmp/internflow-auto-deploy.lock
flock -n 9 || exit 0

log() { echo "$(date -u +%FT%TZ) $*"; }

# Image ids of every service (incl. the cron-only crawler images), to detect a real change.
image_ids() { $COMPOSE --profile jobs config --images 2>/dev/null | sort -u | xargs -r docker image inspect --format '{{.Id}}' 2>/dev/null | sort; }

changed=0

if git fetch -q origin master; then
  if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/master)" ]; then
    if git merge -q --ff-only origin/master; then
      log "code updated to $(git log -1 --format='%h %s')"
      changed=1
    else
      log "ERROR: local checkout has diverged from origin/master; not deploying code"
    fi
  fi
else
  log "WARN: git fetch failed"
fi

before="$(image_ids)"
if ! $COMPOSE --profile jobs pull -q </dev/null; then
  log "WARN: image pull failed (GHCR login expired?)"
fi
after="$(image_ids)"
if [ "$before" != "$after" ]; then
  log "new images pulled"
  changed=1
fi

[ "$changed" = 1 ] || exit 0

log "deploying"
$COMPOSE up -d --remove-orphans </dev/null || { log "ERROR: compose up failed"; exit 1; }
docker image prune -f >/dev/null

for i in $(seq 1 18); do
  if [ "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/health)" = 200 ]; then
    log "deploy ok (API healthy after ~$((i * 10))s)"
    exit 0
  fi
  sleep 10
done
log "ERROR: API not healthy 3 minutes after deploy"
$COMPOSE ps </dev/null
exit 1
