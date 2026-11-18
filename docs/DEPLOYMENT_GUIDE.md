# Deployment: one small EC2 instance (Mumbai)

Everything for intern-flow.in runs from `infrastructure/docker/docker-compose.yml` on a single
2 GB instance:

| Always on | Memory cap | Role |
| --- | --- | --- |
| `caddy` | 64 MB | HTTPS (automatic Let's Encrypt) for `intern-flow.in` and `api.intern-flow.in` |
| `web` | 384 MB | Next.js site |
| `api` | 448 MB | FastAPI |
| `postgres` | 384 MB | Database |
| `redis` | 64 MB | Rate limiting / cache |

| On a schedule (cron) | Memory cap | When (UTC) |
| --- | --- | --- |
| `crawler` | 768 MB | 00:30, 08:30, 14:30 |
| `hackathon-crawler` | 512 MB | 22:00 |
| `pg_dump` backup | – | 21:00, keeps 7 days in `~/backups` |

The images are built by GitHub Actions (`backend-cicd.yml`) and pulled from GHCR. Never build on the
server: a Next.js build needs more RAM than the box has. The AI tools call hosted LLM APIs (Groq →
Gemini → NVIDIA, keys in `.env`), so no model runs on the server.

**Instance:** `t3a.small` (2 vCPU, 2 GB, x86) in **ap-south-1 (Mumbai)** with a 20 GB gp3 disk. Mumbai
keeps the site fast for Indian users. Check the current price in the EC2 console before launching.
Graviton (`t4g.small`) is a little cheaper but would need arm64 images; not set up.

---

## Migrating from the old instance

### 1. Back up the database on the OLD server
Start only Postgres, then dump it:
```bash
cd ~/RepoSense/infrastructure/docker
docker compose up -d postgres
docker compose exec -T postgres pg_dump -U postgres -Fc internship_db > ~/internflow.dump
ls -lh ~/internflow.dump
```
Copy `~/internflow.dump`, `infrastructure/docker/.env` and `infrastructure/docker/google-service-account.json`
(if present) to your PC with `scp`. Keep the old instance **stopped, not terminated** until the new one
has run well for a week.

### 2. Launch the new instance
- AMI: Amazon Linux 2023, type `t3a.small`, region `ap-south-1`, 20 GB gp3.
- Security group: inbound 22 (your IP only), 80 and 443 (anywhere). Nothing else: Postgres, Redis and
  the API are bound to localhost.
- Allocate an Elastic IP and attach it (the IP then survives stop/start).

### 3. Set it up
```bash
ssh ec2-user@<new-ip>
sudo dnf install -y git
git clone https://github.com/Ayush-srivastava504/RepoSense.git && cd RepoSense
bash infrastructure/scripts/setup-server.sh
exit   # log back in so the docker group applies
```

### 4. Configure
Upload the old `.env` to `~/RepoSense/infrastructure/docker/.env`, then compare it with `.env.prod.example`:
- `POSTGRES_PASSWORD`: set a real one (`openssl rand -hex 24`), and use the same value inside `DATABASE_URL`
  (`postgresql://postgres:<password>@postgres:5432/internship_db`).
- `DOMAIN=intern-flow.in`, `API_DOMAIN=api.intern-flow.in`.
- Keep `JWT_SECRET`, `GITHUB_TOKEN_ENCRYPTION_KEY`, `INTERNAL_API_KEY` and the LLM keys from the old file,
  otherwise existing logins and encrypted tokens break.
- `RAG_SERVICE_URL` / `NEURAL_GENERATOR_URL` are no longer used; delete them.

### 5. Restore the database
```bash
cd ~/RepoSense/infrastructure/docker
docker compose up -d postgres
cat ~/internflow.dump | docker compose exec -T postgres pg_restore -U postgres -d internship_db --no-owner --clean --if-exists
```

### 6. Start everything
GHCR images are private by default. Either make the three packages public on GitHub (Packages →
package → settings), or log in once with a classic token that has `read:packages`:
```bash
echo <token> | docker login ghcr.io -u Ayush-srivastava504 --password-stdin
docker compose --profile jobs pull
docker compose up -d
docker compose ps        # all "healthy" / "running"
```
On boot the API runs every migration, including `039_india_only.sql`, which deactivates the
non-India listings.

### 7. Switch DNS
In Cloudflare, point the `intern-flow.in`, `www` and `api` A records to the Elastic IP, **DNS only
(grey cloud)** for the first certificate. Caddy fetches certificates on its own within a minute; watch
it with `docker compose logs -f caddy`. You can turn the orange-cloud proxy back on afterwards (SSL
mode: Full (strict)).

### 8. Point GitHub Actions at the new server
GitHub no longer connects to the server (see "How deploys work" below), so no SSH secrets are needed.
Add `NEXT_PUBLIC_LOGO_DEV_TOKEN` (optional) for the web image build. The server needs to be logged in to
GHCR once (step 6) so `auto-deploy.sh` can pull new images.

### 9. Verify, then terminate the old instance
- `https://intern-flow.in` and `https://api.intern-flow.in/health` respond.
- `https://intern-flow.in/sitemap.xml` lists sitemaps.
- In Search Console: URL Inspection → Test live URL on the homepage, then resubmit `sitemap.xml`.
- After a week: terminate the old instance and delete its unattached EBS volumes and Elastic IP
  (both keep costing money otherwise).

---

## Day to day

```bash
cd ~/RepoSense/infrastructure/docker
docker compose ps                                  # status
docker compose logs -f --tail=100 api              # logs (web, caddy, postgres ...)
docker compose --profile jobs run --rm crawler     # crawl now
free -h && docker stats --no-stream                # memory
```
Logs for every scheduled job are in `~/logs/` (`deploy.log`, `sitemaps.log`, `daily.log`, ...).

### How deploys work
The server deploys itself. `infrastructure/scripts/auto-deploy.sh` runs from cron every 5 minutes:
it fast-forwards the checkout to `origin/master`, pulls the `:latest` images that **Backend CI/CD**
pushed to GHCR, and runs `docker compose up -d` only when something changed. So a push to `master`
is live about 5 minutes after the CI build finishes. GitHub never connects to the server, which is why
port 22 is open only to the owner's IP. Watch a deploy with `tail -f ~/logs/deploy.log`.

### Scheduled jobs
Everything that used to run as an SSH workflow now runs as cron on the server through
`infrastructure/scripts/server-jobs.sh` (installed by `setup-server.sh`; re-run it after changing the
schedule). Run any job by hand:
```bash
bash ~/RepoSense/infrastructure/scripts/server-jobs.sh sitemaps     # also: queue, daily, index-push,
                                                                    # indexnow, structured, companies, company-intel
```
GitHub Actions keeps only what needs no server access: tests + image builds (`backend-cicd.yml`),
an HTTPS uptime check every 15 minutes, and the daily Search Console / IndexNow pings (`daily-pipeline.yml`).
