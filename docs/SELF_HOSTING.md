# Self-hosting the whole stack (frontend + API) on one server

Replaces Vercel for the frontend. Everything runs in Docker behind Caddy, which handles HTTPS.

## What you need
- A Linux VPS, **2 vCPU / 4 GB RAM** recommended (the Next.js build and the TeX Live resume compiler are the heavy parts). 2 GB works if you add swap and skip the `ai` profile.
- Docker Engine + the Compose plugin.
- Two DNS A records pointing at the server's IP: `intern-flow.in` and `api.intern-flow.in` (plus `www`, which redirects).
- Ports 80 and 443 open. Nothing else needs to be public.

## First deploy
```bash
git clone <your repo> && cd RepoSense/infrastructure/docker
cp .env.prod.example .env
nano .env                       # set DOMAIN, API_DOMAIN, POSTGRES_PASSWORD, JWT_SECRET, ...
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api web caddy
```
The first build takes several minutes (TeX Live is large). Caddy requests certificates as soon as DNS resolves.

Optional local-LLM resume features: add `--profile ai` to the `up` command.

## Moving existing data from your current database
```bash
# on the old server
pg_dump -U postgres -Fc internship_db > internship_db.dump
# on the new server (after `up -d postgres`)
docker compose -f docker-compose.prod.yml cp internship_db.dump postgres:/tmp/
docker compose -f docker-compose.prod.yml exec postgres \
  pg_restore -U postgres -d internship_db --clean --if-exists /tmp/internship_db.dump
```

## Updating
```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```
`NEXT_PUBLIC_*` values (including the API URL) are baked into the frontend at build time, so changing them needs `--build`.

## Cutting over from Vercel
1. Confirm `https://api.<domain>/health` and the site both work using the new server (test with a temporary hosts-file entry or a staging subdomain).
2. Lower the DNS TTL a day ahead, then point the A records to the new server.
3. Remove the project from Vercel once traffic has moved.

## Backups (do this before relying on it)
```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U postgres -Fc internship_db > backup_$(date +%F).dump
```
Run it from cron daily and copy the file off the server (object storage, another machine).

## Notes
- The crawler is not part of this compose file; keep running it the way you do today (cron on the host).
- API migrations re-run on every API start (existing behaviour of `entrypoint.sh`). Some older migrations are not idempotent, so harmless "already exists" errors in the logs are expected.
- Free Cloudflare in front of the site is a good extra: it caches static assets and absorbs bot traffic. Set its SSL mode to Full (strict).
