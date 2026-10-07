# Running the frontend on your own server (replacing Vercel)

The frontend now runs as the `web` service in `infrastructure/docker/docker-compose.yml`, next to the
API, Postgres, Redis and the crawlers. A `caddy` service in front of it serves HTTPS for both domains.

## 1. Add these to `infrastructure/docker/.env` (the same file the api already uses)
```bash
DOMAIN=intern-flow.in
API_DOMAIN=api.intern-flow.in
INTERNAL_API_KEY=<same value the api already has; if empty, generate one: openssl rand -hex 32>
NEXT_PUBLIC_LOGO_DEV_TOKEN=<optional>
```
`CORS_ORIGINS`/`FRONTEND_URL` need no change if the site stays on `https://intern-flow.in`.

## 2. DNS and firewall
- A records for `intern-flow.in`, `www.intern-flow.in` and `api.intern-flow.in` -> this server's IP.
- Open ports 80 and 443 (Caddy needs them to get certificates).

## 3. Start
```bash
cd infrastructure/docker
docker compose up -d --build web caddy      # build the frontend and start HTTPS
docker compose logs -f web caddy
```
Your existing services keep running untouched; nothing else is rebuilt.

## Updating the frontend later
```bash
git pull && docker compose up -d --build web
```
`NEXT_PUBLIC_*` values are baked in at build time, so changing them needs `--build`.

## Cutting over from Vercel
1. Check the new site using a temporary hosts-file entry (or a staging subdomain) before touching DNS.
2. Lower the DNS TTL a day ahead, then switch the A records.
3. Remove the Vercel project once traffic has moved.

## Worth fixing soon (already in your compose, not changed here)
- `postgres` (5432), `redis` (6379) and `api` (8000) are published on all interfaces, and Postgres uses the
  password `password`. Caddy makes the public ports unnecessary: bind them to localhost
  (`"127.0.0.1:5432:5432"`, etc.) or delete the `ports:` lines, and set a real database password.
- Back up Postgres daily and copy the dump off the server:
  `docker compose exec -T postgres pg_dump -U postgres -Fc internship_db > backup_$(date +%F).dump`
