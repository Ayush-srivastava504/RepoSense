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

echo "==> Cron: crawler 3x/day, hackathons daily, nightly DB backup (times are UTC)"
mkdir -p "$HOME/backups" "$HOME/logs"
CRON_FILE="$(mktemp)"
crontab -l 2>/dev/null | grep -v '# internflow' > "$CRON_FILE" || true
cat >> "$CRON_FILE" <<CRON
30 0,8,14 * * * $COMPOSE --profile jobs run --rm crawler >> $HOME/logs/crawler.log 2>&1 # internflow
0 22 * * * $COMPOSE --profile jobs run --rm hackathon-crawler >> $HOME/logs/hackathons.log 2>&1 # internflow
0 21 * * * $COMPOSE exec -T postgres pg_dump -U postgres -Fc internship_db > $HOME/backups/db_\$(date +\%F).dump 2>> $HOME/logs/backup.log && find $HOME/backups -name 'db_*.dump' -mtime +7 -delete # internflow
0 3 * * 0 truncate -s 0 $HOME/logs/*.log # internflow
CRON
crontab "$CRON_FILE"
rm -f "$CRON_FILE"

echo
echo "Done. Next:"
echo "  1. Log out and back in (docker group), then fill in infrastructure/docker/.env"
echo "  2. $COMPOSE --profile jobs pull && $COMPOSE up -d"
