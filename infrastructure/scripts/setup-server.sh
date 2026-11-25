#!/usr/bin/env bash
# One-time setup for a fresh Amazon Linux 2023 instance (run as ec2-user, from the repo root):
#   bash infrastructure/scripts/setup-server.sh
# Safe to re-run. See docs/DEPLOYMENT_GUIDE.md for the full migration steps.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE="docker compose -f $REPO_DIR/infrastructure/docker/docker-compose.yml"

echo "==> Docker + compose plugin"
if ! command -v docker >/dev/null; then
  sudo dnf install -y docker cronie git
  sudo systemctl enable --now docker crond
  sudo usermod -aG docker "$USER"
fi
if ! docker compose version >/dev/null 2>&1; then
  sudo mkdir -p /usr/local/lib/docker/cli-plugins
  sudo curl -fsSL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-$(uname -m)" \
    -o /usr/local/lib/docker/cli-plugins/docker-compose
  sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi

echo "==> 2 GB swap (safety margin for crawler runs on a 2 GB instance)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
  echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf
  sudo sysctl --system >/dev/null
fi

echo "==> Cron: deploys, crawlers, SEO pipeline, backups (times are UTC)"
mkdir -p "$HOME/backups" "$HOME/logs"
JOBS="bash $REPO_DIR/infrastructure/scripts/server-jobs.sh"
CRON_FILE="$(mktemp)"
crontab -l 2>/dev/null | grep -v '# internflow' > "$CRON_FILE" || true
cat >> "$CRON_FILE" <<CRON
*/5 * * * * bash $REPO_DIR/infrastructure/scripts/auto-deploy.sh >> $HOME/logs/deploy.log 2>&1 # internflow
30 0,8,14 * * * $COMPOSE --profile jobs run --rm crawler >> $HOME/logs/crawler.log 2>&1 # internflow
0 22 * * * $COMPOSE --profile jobs run --rm hackathon-crawler >> $HOME/logs/hackathons.log 2>&1 # internflow
17 * * * * $JOBS sitemaps >> $HOME/logs/sitemaps.log 2>&1 # internflow
*/20 * * * * $JOBS queue >> $HOME/logs/queue.log 2>&1 # internflow
0 4 * * * $JOBS daily >> $HOME/logs/daily.log 2>&1 # internflow
0 5,8,11,14,17,20 * * * $JOBS index-push >> $HOME/logs/index-push.log 2>&1 # internflow
30 5,8,11,14,17,20 * * * $JOBS indexnow >> $HOME/logs/indexnow.log 2>&1 # internflow
30 3 * * * $JOBS structured >> $HOME/logs/structured.log 2>&1 # internflow
40 0,6,9,12,15,18 * * * $JOBS article >> $HOME/logs/article.log 2>&1 # internflow
0 2 * * * $JOBS companies >> $HOME/logs/companies.log 2>&1 # internflow
30 3 * * 0 $JOBS company-intel >> $HOME/logs/company-intel.log 2>&1 # internflow
0 21 * * * $COMPOSE exec -T postgres pg_dump -U postgres -Fc internship_db > $HOME/backups/db_\$(date +\%F).dump 2>> $HOME/logs/backup.log && find $HOME/backups -name 'db_*.dump' -mtime +7 -delete # internflow
0 3 * * 0 truncate -s 0 $HOME/logs/*.log # internflow
CRON
crontab "$CRON_FILE"
rm -f "$CRON_FILE"

echo
echo "Done. Next:"
echo "  1. Log out and back in (docker group), then fill in infrastructure/docker/.env"
echo "  2. $COMPOSE --profile jobs pull && $COMPOSE up -d"
