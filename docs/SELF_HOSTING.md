# Running the frontend on your own server (replacing Vercel) with the existing nginx

The frontend is the `web` service in `infrastructure/docker/docker-compose.yml`. It listens on
`127.0.0.1:3000` only. The host's **nginx** (which already serves `api.intern-flow.in`) terminates HTTPS and
proxies `intern-flow.in` to it. The API setup is not touched.

## 1. Variables in `infrastructure/docker/.env` (each on its own line)
```bash
DOMAIN=intern-flow.in
API_DOMAIN=api.intern-flow.in
INTERNAL_API_KEY=<the value the api already has>
NEXT_PUBLIC_LOGO_DEV_TOKEN=<Logo.dev publishable key pk_..., optional>
```

## 2. Build and start the frontend (a few minutes; nothing else is affected)
```bash
cd infrastructure/docker
docker compose up -d --build web
docker compose ps web                       # wait for "healthy"
curl -sI http://127.0.0.1:3000/ | head -1   # expect HTTP/1.1 200 OK
```

## 3. nginx + certificate for the main domain
DNS for `intern-flow.in` and `www` must already point at this server (certbot checks it).
```bash
sudo cp ../nginx/intern-flow.in.conf /etc/nginx/conf.d/intern-flow.in.conf
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d intern-flow.in -d www.intern-flow.in --redirect
```
Then, inside the `listen 443` server block certbot created for `intern-flow.in`, add as the first line:
```nginx
if ($host = www.intern-flow.in) { return 301 https://intern-flow.in$request_uri; }
```
and run `sudo nginx -t && sudo systemctl reload nginx`. Check renewal with `sudo certbot renew --dry-run`.

## 4. Verify
`https://intern-flow.in` loads, `https://www.intern-flow.in` redirects to it, `https://api.intern-flow.in/health` works.

## Updating the frontend later
```bash
git pull && docker compose up -d --build web
```
`NEXT_PUBLIC_*` values are baked in at build time, so changing them needs `--build`.

## Cutting over from Vercel with little downtime
Do step 2 first while DNS still points at Vercel (the build is the slow part). Then switch the
`intern-flow.in` A record and the `www` CNAME in Cloudflare and run step 3 immediately. To roll back, point
the records back to Vercel; keep the Vercel project until you are sure. Delete the two `_vercel` TXT records
only afterwards.

## Worth fixing soon (already in your compose, not changed here)
- `postgres` (5432), `redis` (6379), `api` (8000), `rag` (8001) and `neural-generator` (8002) are published on
  all interfaces and Postgres uses the password `password`. nginx makes the public ports unnecessary: bind
  them to `127.0.0.1` (or remove the `ports:` lines) and set a real database password.
- Back up Postgres daily and copy the dump off the server:
  `docker compose exec -T postgres pg_dump -U postgres -Fc internship_db > backup_$(date +%F).dump`
