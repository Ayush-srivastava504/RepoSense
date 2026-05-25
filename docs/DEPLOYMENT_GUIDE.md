# Deployment Guide

> Production deployment guide for RepoSense across multiple platforms: Docker, Railway, AWS, Azure, DigitalOcean, and on-premises servers.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Deployment Platforms](#deployment-platforms)
   - [Docker](#docker)
   - [Railway](#railway)
   - [AWS](#aws)
   - [Azure](#azure)
   - [DigitalOcean](#digitalocean)
   - [On-Premises](#on-premises)
6. [SSL/TLS Configuration](#ssltls-configuration)
7. [Monitoring & Logging](#monitoring--logging)
8. [Scaling](#scaling)
9. [Backup & Recovery](#backup--recovery)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

```
CPU: 2+ cores (minimum)
RAM: 4GB (minimum), 8GB+ recommended
Disk: 20GB+ (for models, indices, databases)
Network: Static IP/domain for production
OS: Linux (recommended), macOS, or Windows Server
```

### Required Software

```
Docker 20.10+ (for containerized deployment)
Docker Compose 2.0+
Git
Node.js 18+ (for Next.js frontend)
Python 3.11+ (for backend services)
PostgreSQL client tools
```

### Required Accounts/Services (Optional)

```
GitHub OAuth app (for authentication)
Stripe account (for payments)
HuggingFace account (for model access)
Domain name & DNS
SSL certificate (Let's Encrypt recommended)
```

---

## Pre-Deployment Checklist

Before deploying to production, verify:

- [ ] All environment variables configured (see [Environment Configuration](#environment-configuration))
- [ ] Database migrations run successfully
- [ ] SSL/TLS certificates obtained and installed
- [ ] Backups automated
- [ ] Monitoring/alerts configured
- [ ] Load testing completed
- [ ] Security audit performed
- [ ] Disaster recovery plan documented
- [ ] Team trained on deployment process
- [ ] Rollback procedure tested

---

## Environment Configuration

### Configuration Files

Create configuration files in the project root:

**`.env.production`** (Never commit to git)

```bash
# App Settings
APP_ENV=production
APP_NAME=RepoSense
APP_VERSION=1.0.0
DEBUG=false

# Frontend (Next.js)
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_github_client_id

# Backend - Database
DATABASE_URL=postgresql://user:password@db-host:5432/repo_sense_prod
DATABASE_POOL_SIZE=20
DATABASE_ECHO=false

# Backend - Redis (optional)
REDIS_URL=redis://redis-host:6379/0
REDIS_PASSWORD=your_redis_password

# Authentication
JWT_SECRET_KEY=your_super_secret_jwt_key_min_32_chars
JWT_ALGORITHM=HS256
JWT_EXPIRY_HOURS=24
ENCRYPTION_KEY=your_encryption_key_base64

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=https://yourdomain.com/api/auth/github/callback

# Stripe (for payments)
STRIPE_API_KEY=sk_live_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Services
CRAWLER_SERVICE_URL=http://crawler:8003
RAG_SERVICE_URL=http://rag:8002
NEURAL_GENERATOR_URL=http://neural-generator:8001

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM=noreply@yourdomain.com

# Logging
LOG_LEVEL=info
SENTRY_DSN=your_sentry_dsn_for_error_tracking

# Models
MODEL_CACHE_DIR=/models
EMBEDDING_MODEL=all-MiniLM-L6-v2
```

### Secure Configuration Management

```bash
# Using HashiCorp Vault
vault kv put secret/repo-sense/prod \
  DATABASE_PASSWORD="your_db_password" \
  JWT_SECRET_KEY="your_jwt_secret" \
  STRIPE_API_KEY="your_stripe_key"

# Using AWS Secrets Manager
aws secretsmanager create-secret \
  --name repo-sense/prod/db \
  --secret-string '{"password":"your_db_password"}'

# Using Azure Key Vault
az keyvault secret set \
  --vault-name reposense-kv \
  --name DatabasePassword \
  --value "your_db_password"
```

---

## Database Setup

### PostgreSQL Installation

```bash
# Using Docker
docker run -d \
  --name postgres \
  -e POSTGRES_USER=repo_user \
  -e POSTGRES_PASSWORD=secure_password \
  -e POSTGRES_DB=repo_sense_prod \
  -p 5432:5432 \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine

# Or on system
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start

# macOS
brew install postgresql
brew services start postgresql
```

### Running Migrations

```bash
# Method 1: Using Python script
python run_migrations.py --env production --host db.yourdomain.com

# Method 2: Manual
psql -h db-host -U repo_user -d repo_sense_prod -f database/migrations/001_users.sql
psql -h db-host -U repo_user -d repo_sense_prod -f database/migrations/002_resumes.sql
psql -h db-host -U repo_user -d repo_sense_prod -f database/migrations/003_jobs.sql
psql -h db-host -U repo_user -d repo_sense_prod -f database/migrations/004_subscriptions.sql
psql -h db-host -U repo_user -d repo_sense_prod -f database/migrations/005_repo_docs.sql

# Method 3: Using Alembic (if configured)
alembic upgrade head
```

### Database Backup

```bash
# One-time backup
pg_dump -h db-host -U repo_user repo_sense_prod > backup.sql

# Automated daily backup
# Add to crontab (Linux/Mac)
0 2 * * * pg_dump -h db-host -U repo_user repo_sense_prod | \
  gzip > /backups/db-backup-$(date +\%Y\%m\%d).sql.gz

# Restore from backup
psql -h db-host -U repo_user repo_sense_prod < backup.sql
```

---

## Deployment Platforms

### Docker

#### Docker Compose (Recommended)

```bash
# 1. Clone repository
git clone https://github.com/yourusername/repo-sense.git
cd repo-sense

# 2. Create .env.production
cp .env.example .env.production
# Edit with production values
nano .env.production

# 3. Build images
docker-compose -f docker-compose.prod.yml build

# 4. Start services
docker-compose -f docker-compose.prod.yml up -d

# 5. Verify services
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f

# 6. Health check
curl http://localhost:8000/health
curl http://localhost:3000/api/health
```

**docker-compose.prod.yml** template:

```yaml
version: '3.9'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: repo_sense_prod
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # Redis (Optional cache)
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # Main FastAPI Service
  api:
    build: ./services
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/repo_sense_prod
      REDIS_URL: redis://redis:6379/0
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      STRIPE_API_KEY: ${STRIPE_API_KEY}
    ports:
      - "8000:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./models:/models
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Crawler Service
  crawler:
    build: ./services/api/crawler
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/repo_sense_prod
    ports:
      - "8003:8003"
    depends_on:
      - postgres
    restart: unless-stopped

  # RAG Service
  rag:
    build: ./services/api/rag
    environment:
      NEURAL_GENERATOR_URL: http://neural-generator:8001
    ports:
      - "8002:8002"
    volumes:
      - ./indices:/app/indices
      - ./models:/models
    depends_on:
      - neural-generator
    restart: unless-stopped

  # Neural Generator Service
  neural-generator:
    build: ./services/api/neural_generator
    environment:
      MODEL_PATH: /models/qwen-0.5b-q4.gguf
      DEVICE: cpu
    ports:
      - "8001:8001"
    volumes:
      - ./models:/models
    restart: unless-stopped

  # Next.js Frontend
  web:
    build: ./apps/web
    environment:
      NEXT_PUBLIC_API_BASE_URL: ${NEXT_PUBLIC_API_BASE_URL}
      NEXT_PUBLIC_GITHUB_CLIENT_ID: ${NEXT_PUBLIC_GITHUB_CLIENT_ID}
    ports:
      - "3000:3000"
    depends_on:
      - api
    restart: unless-stopped

  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./infrastructure/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./infrastructure/nginx/ssl:/etc/nginx/ssl
    depends_on:
      - api
      - web
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

#### Single Container Deployment

```bash
# Build image
docker build -t repo-sense:latest .

# Run container
docker run -d \
  --name repo-sense \
  -p 3000:3000 \
  -p 8000:8000 \
  -e DATABASE_URL="postgresql://user:pass@db-host/db" \
  -e JWT_SECRET_KEY="your_secret" \
  -v /data/models:/models \
  -v /data/indices:/app/indices \
  repo-sense:latest

# View logs
docker logs -f repo-sense
```

---

### Railway

Railway.app provides the simplest deployment for RepoSense.

#### Step-by-Step

1. **Push code to GitHub**

```bash
git remote add origin https://github.com/yourusername/repo-sense.git
git push -u origin main
```

2. **Connect Railway to GitHub**

   - Visit [railway.app](https://railway.app)
   - Click "New Project" → "Deploy from GitHub"
   - Select your repository

3. **Configure Environment**

   In Railway dashboard:
   - Click "Variables"
   - Add all variables from `.env.production`

4. **Add PostgreSQL

   - Click "Add Service" → "PostgreSQL"
   - Copy `DATABASE_URL` to variables

5. **Configure Services**

```yaml
# railway.json
{
  "services": [
    {
      "name": "web",
      "root": "apps/web",
      "buildCommand": "npm run build",
      "startCommand": "npm start",
      "port": 3000
    },
    {
      "name": "api",
      "root": "services",
      "buildCommand": "pip install -r requirements.txt",
      "startCommand": "uvicorn app:app --host 0.0.0.0 --port 8000",
      "port": 8000
    }
  ]
}
```

6. **Deploy**

   - Click "Deploy"
   - Monitor deployment progress
   - Access at `https://yourdomain-railway.app`

---

### AWS

#### Using EC2 + RDS

**Architecture:**
```
Internet Gateway
       ↓
    Nginx (port 80, 443)
       ↓
    ┌──────────────────────────────┐
    │  EC2 Instance (t3.medium)    │
    │  ├─ Next.js (port 3000)      │
    │  ├─ FastAPI (port 8000)      │
    │  ├─ Crawler (port 8003)      │
    │  ├─ RAG (port 8002)          │
    │  └─ Neural Gen (port 8001)   │
    └──────────────────────────────┘
            ↓
    ┌─────────────────┐
    │  RDS PostgreSQL │
    │  Multi-AZ       │
    └─────────────────┘
```

**Launch EC2 Instance:**

```bash
# AWS CLI commands
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.medium \
  --key-name my-key-pair \
  --security-groups web-app \
  --subnet-id subnet-1a2b3c4d

# SSH into instance
ssh -i my-key.pem ubuntu@ec2-instance-ip

# Install dependencies
sudo apt-get update
sudo apt-get install -y docker.io docker-compose git

# Clone and deploy
git clone https://github.com/yourusername/repo-sense.git
cd repo-sense
docker-compose -f docker-compose.prod.yml up -d
```

**Create RDS Database:**

```bash
aws rds create-db-instance \
  --db-instance-identifier repo-sense-prod \
  --db-instance-class db.t3.small \
  --engine postgres \
  --master-username admin \
  --master-user-password "YourSecurePassword123!" \
  --allocated-storage 100 \
  --backup-retention-period 7 \
  --multi-az
```

**Setup Load Balancer:**

```bash
aws elbv2 create-load-balancer \
  --name repo-sense-alb \
  --subnets subnet-12345 subnet-67890 \
  --security-groups sg-12345

# Register targets
aws elbv2 register-targets \
  --target-group-arn arn:aws:elasticloadbalancing:... \
  --targets Id=i-12345678 Id=i-87654321
```

---

### Azure

#### App Service + Azure Database for PostgreSQL

**Create Resource Group:**

```bash
az group create \
  --name repo-sense-rg \
  --location eastus
```

**Create PostgreSQL Database:**

```bash
az postgres server create \
  --resource-group repo-sense-rg \
  --name repo-sense-db \
  --admin-user dbadmin \
  --admin-password "YourSecurePassword123!" \
  --sku-name B_Gen5_2 \
  --storage-size 51200

# Allow connections
az postgres server firewall-rule create \
  --resource-group repo-sense-rg \
  --server repo-sense-db \
  --name AllowAzure \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

**Deploy App Service:**

```bash
# Create App Service Plan
az appservice plan create \
  --name repo-sense-plan \
  --resource-group repo-sense-rg \
  --sku S1 \
  --is-linux

# Create Web App
az webapp create \
  --resource-group repo-sense-rg \
  --plan repo-sense-plan \
  --name repo-sense-app \
  --runtime "PYTHON|3.11"

# Deploy code
az webapp deployment source config-zip \
  --resource-group repo-sense-rg \
  --name repo-sense-app \
  --src deploy.zip

# Set environment variables
az webapp config appsettings set \
  --resource-group repo-sense-rg \
  --name repo-sense-app \
  --settings DATABASE_URL="postgresql://..." JWT_SECRET_KEY="..."
```

---

### DigitalOcean

#### Using App Platform + Managed Database

**Create via doctl CLI:**

```bash
# Login
doctl auth init

# Create PostgreSQL database
doctl databases create \
  --name repo-sense-db \
  --engine pg \
  --region nyc3 \
  --size db-s-1vcpu-1gb

# Create app
doctl apps create --spec app.yaml

# Where app.yaml contains:
name: repo-sense
services:
  - name: api
    github:
      repo: yourusername/repo-sense
      branch: main
      deploy_on_push: true
    build_command: pip install -r requirements.txt
    run_command: uvicorn app:app --host 0.0.0.0 --port 8080
    envs:
      - key: DATABASE_URL
        scope: RUN_TIME
        type: SECRET
        value: ${db.connection_string}

databases:
  - name: db
    engine: PG
    version: "15"
    production: true
```

---

### On-Premises

#### Linux Server Deployment

**Prerequisites:**

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install dependencies
sudo apt-get install -y \
  curl wget git \
  python3 python3-venv python3-pip \
  nodejs npm \
  postgresql postgresql-contrib \
  nginx \
  certbot python3-certbot-nginx
```

**Setup Application:**

```bash
# Create app directory
sudo mkdir -p /opt/repo-sense
sudo chown $USER:$USER /opt/repo-sense
cd /opt/repo-sense

# Clone repository
git clone https://github.com/yourusername/repo-sense.git .

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install -r services/requirements.txt

# Install Node dependencies
cd apps/web && npm install && npm run build
cd ../..

# Configure .env
cp .env.example .env
nano .env  # Edit with production values
```

**Setup Systemd Services:**

```bash
# Create backend service
sudo tee /etc/systemd/system/repo-sense-api.service << EOF
[Unit]
Description=RepoSense API
After=network.target postgresql.service

[Service]
Type=notify
User=repo-sense
WorkingDirectory=/opt/repo-sense
Environment="PATH=/opt/repo-sense/venv/bin"
EnvironmentFile=/opt/repo-sense/.env
ExecStart=/opt/repo-sense/venv/bin/uvicorn services.app:app \
    --host 0.0.0.0 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Create frontend service
sudo tee /etc/systemd/system/repo-sense-web.service << EOF
[Unit]
Description=RepoSense Web
After=network.target

[Service]
Type=simple
User=repo-sense
WorkingDirectory=/opt/repo-sense/apps/web
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Enable services
sudo systemctl daemon-reload
sudo systemctl enable repo-sense-api repo-sense-web
sudo systemctl start repo-sense-api repo-sense-web
```

**Setup Nginx:**

```bash
sudo tee /etc/nginx/sites-available/repo-sense << 'EOF'
upstream api {
    server localhost:8000;
}

upstream web {
    server localhost:3000;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location /api/ {
        proxy_pass http://api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        proxy_pass http://web;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/repo-sense /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**Setup SSL Certificate:**

```bash
# Using Let's Encrypt (free)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal check
sudo certbot renew --dry-run
```

---

## SSL/TLS Configuration

### Obtaining Certificate

**Option 1: Let's Encrypt (Free)**

```bash
# Using certbot
sudo apt-get install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com

# Using Docker
docker run -it --rm \
  -v /etc/letsencrypt:/etc/letsencrypt \
  certbot/certbot certonly \
  --standalone -d yourdomain.com
```

**Option 2: Commercial Certificate**

```bash
# Purchase from provider (e.g., Comodo, DigiCert)
# Place certificate files in secure location:
# - Certificate: /etc/ssl/certs/yourdomain.crt
# - Private Key: /etc/ssl/private/yourdomain.key
# - CA Bundle: /etc/ssl/certs/ca-bundle.crt
```

### Nginx SSL Configuration

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;

    location / {
        proxy_pass http://localhost:3000;
    }
}
```

---

## Monitoring & Logging

### Application Logging

**Configure Logging in FastAPI:**

```python
import logging
from pythonjsonlogger import jsonlogger

# JSON logging for structured logs
logHandler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter()
logHandler.setFormatter(formatter)
logger = logging.getLogger()
logger.addHandler(logHandler)
```

**Docker Logging:**

```bash
# View logs
docker logs -f container_name

# Docker compose
docker-compose logs -f api web

# Send to ELK Stack
docker-compose.yml:
  logging:
    driver: splunk
    options:
      splunk-token: ${SPLUNK_TOKEN}
      splunk-url: https://splunk-host:8088
```

### Monitoring Setup

**Prometheus + Grafana:**

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'api'
    static_configs:
      - targets: ['localhost:8000']

  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:5432']
```

**Uptime Monitoring:**

```bash
# Using UptimeRobot (free tier available)
# Setup HTTP checks every 5 minutes:
# - https://yourdomain.com/health
# - https://yourdomain.com/api/health

# Or use Datadog
curl -X POST https://api.datadoghq.com/api/v1/check_run \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -d '{"check": "http.can_connect", "host_name": "yourdomain.com", "status": 0}'
```

### Error Tracking

**Sentry Setup:**

```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    integrations=[FastApiIntegration()],
    traces_sample_rate=0.1
)
```

---

## Scaling

### Horizontal Scaling (Multiple Servers)

**Load Balancer Configuration:**

```nginx
upstream backend {
    least_conn;
    server api1.internal:8000;
    server api2.internal:8000;
    server api3.internal:8000;
    keepalive 64;
}

server {
    listen 80;
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
}
```

### Vertical Scaling (Larger Servers)

```bash
# AWS EC2 instance upgrade
aws ec2 stop-instances --instance-ids i-12345678
aws ec2 modify-instance-attribute \
  --instance-id i-12345678 \
  --instance-type t3.large
aws ec2 start-instances --instance-ids i-12345678
```

### Database Connection Pooling

```python
# PgBouncer configuration
[databases]
repo_sense = host=db.internal port=5432 dbname=repo_sense_prod

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
reserve_pool_size = 5
```

### Caching Strategy

```bash
# Redis caching for frequently accessed data
# Cache layer:
Client → Nginx → Redis → FastAPI → PostgreSQL

# TTL strategy:
# - User profiles: 1 hour
# - Job listings: 30 minutes
# - Search results: 10 minutes
# - Code reviews: 24 hours
```

---

## Backup & Recovery

### Automated Backups

**Database Backup:**

```bash
# Daily automated backup
0 2 * * * pg_dump -h prod-db.internal -U repo_user \
  repo_sense_prod | gzip > /backups/db-$(date +\%Y\%m\%d).sql.gz

# Retention: 30 days
find /backups -name "db-*.sql.gz" -mtime +30 -delete

# Off-site backup
0 3 * * * aws s3 sync /backups s3://repo-sense-backups/db/ \
  --delete --region us-east-1
```

**File System Backup:**

```bash
# Backup models and indices
0 4 * * * tar -czf /backups/files-$(date +\%Y\%m\%d).tar.gz \
  /opt/repo-sense/models /opt/repo-sense/indices

# Upload to S3
aws s3 cp /backups/files-*.tar.gz s3://repo-sense-backups/files/
```

### Recovery Procedures

**Database Recovery:**

```bash
# 1. Stop application
sudo systemctl stop repo-sense-api

# 2. Restore from backup
gzip -d backups/db-20240115.sql.gz
psql -h prod-db.internal -U repo_user repo_sense_prod < backups/db-20240115.sql

# 3. Verify data
psql -h prod-db.internal -U repo_user repo_sense_prod \
  -c "SELECT COUNT(*) FROM users;"

# 4. Restart application
sudo systemctl start repo-sense-api
```

**File System Recovery:**

```bash
# 1. Restore files
tar -xzf /backups/files-20240115.tar.gz -C /opt/repo-sense

# 2. Verify integrity
md5sum -c manifests/files.md5

# 3. Restart services
docker-compose restart
```

---

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -h db-host -U repo_user -d repo_sense_prod -c "SELECT 1;"

# View logs
sudo journalctl -u postgresql -n 50 -f

# Reset password
sudo -u postgres psql -c "ALTER USER repo_user WITH PASSWORD 'newpassword';"
```

### API Service Not Starting

```bash
# Check logs
docker logs api
docker-compose logs -f api
journalctl -u repo-sense-api -n 50 -f

# Check port availability
sudo netstat -tlnp | grep 8000

# Check environment variables
docker exec api env | grep DATABASE_URL

# Test API directly
curl -v http://localhost:8000/health
```

### Frontend Build Failures

```bash
# Clear Next.js cache
rm -rf apps/web/.next
rm -rf node_modules/.cache

# Rebuild
cd apps/web
npm run build

# Check build output
tail -100 docker_build.log
```

### Out of Memory Errors

```bash
# Check memory usage
free -h
docker stats

# Increase swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Reduce model size or batch processing
```

### SSL Certificate Expiring

```bash
# Check expiration date
openssl x509 -in /etc/ssl/certs/yourdomain.crt -noout -dates

# Renew certificate
sudo certbot renew --force-renewal

# Auto-renewal status
sudo systemctl status certbot.timer
sudo systemctl enable certbot.timer
```

### Slow Queries

```bash
# Enable PostgreSQL query logging
sudo -u postgres psql -c "
  ALTER SYSTEM SET log_statement = 'all';
  ALTER SYSTEM SET log_duration = on;
"

# View slow queries
sudo tail -f /var/log/postgresql/postgresql.log | grep duration

# Create indexes
psql -h db-host -U repo_user repo_sense_prod << EOF
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_jobs_category ON jobs(category);
CREATE INDEX idx_reviews_user ON code_reviews(user_id);
EOF
```

---

## Rollback Procedures

```bash
# Quick rollback to previous version
git revert HEAD
docker-compose -f docker-compose.prod.yml up -d api

# Rollback database migrations
psql -h prod-db.internal -U repo_user repo_sense_prod \
  -f database/rollback/001_users_rollback.sql

# Verify rollback
curl https://yourdomain.com/api/health
```

---

## Support & Documentation

- **Frontend Docs:** [apps/web/README.md](../apps/web/README.md)
- **Backend Docs:** [services/README.md](../services/README.md)
- **API Reference:** [services/api/README.md](../services/api/README.md)
- **Main README:** [README.md](../README.md)

For issues or questions, open an issue on [GitHub](https://github.com/yourusername/repo-sense/issues).
