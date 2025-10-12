# Docker Deployment Guide

## Futures Movement Predictor - Containerized Deployment

This guide covers deploying the Futures Movement Predictor application using Docker and Docker Compose.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [Deployment Steps](#deployment-steps)
- [Production Deployment](#production-deployment)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Docker Engine 20.10+ installed
- Docker Compose v2.0+ installed
- At least 2GB of available RAM
- 10GB of free disk space

### Install Docker (Ubuntu/Debian)
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### Install Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd futures-predictor
```

### 2. Configure Environment Variables
```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file and update:
# - SESSION_SECRET (generate with: openssl rand -base64 32)
# - POSTGRES_PASSWORD (use a strong password)
nano .env
```

### 3. Build and Start Services
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Check service status
docker-compose ps
```

### 4. Access the Application
- **Web UI**: http://localhost:5000
- **Health Check**: http://localhost:5000/health

## Architecture

### Services Overview

```
┌─────────────────────────────────────────────────┐
│                  Docker Compose                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐      ┌──────────────────┐   │
│  │   Web        │      │   Scheduler      │   │
│  │   Service    │      │   Service        │   │
│  │              │      │                  │   │
│  │ - Express    │      │ - Nightly Job    │   │
│  │ - WebSocket  │      │ - 5:30 PM ET     │   │
│  │ - Frontend   │      │ - Yahoo Finance  │   │
│  └──────┬───────┘      └────────┬─────────┘   │
│         │                       │             │
│         └───────────┬───────────┘             │
│                     ↓                         │
│         ┌───────────────────────┐             │
│         │   PostgreSQL          │             │
│         │   Database            │             │
│         │                       │             │
│         │ - Volume: postgres_data│             │
│         └───────────────────────┘             │
│                     ↑                         │
│         ┌───────────────────────┐             │
│         │   Migrations          │             │
│         │   (one-shot)          │             │
│         └───────────────────────┘             │
└─────────────────────────────────────────────────┘
```

### Container Details

1. **Web Service** (`futures-web`)
   - Handles HTTP requests and WebSocket connections
   - Serves frontend static assets
   - Exposes port 5000
   - Environment: `SCHEDULER_ENABLED=false`

2. **Scheduler Service** (`futures-scheduler`)
   - Runs nightly calculations at 5:30 PM ET
   - Syncs Yahoo Finance data
   - Updates volatility predictions
   - Environment: `SCHEDULER_ENABLED=true`

3. **PostgreSQL Database** (`futures-postgres`)
   - Stores historical data and predictions
   - Persists data in named volume
   - Health checks enabled

4. **Migrations Service** (`futures-migrations`)
   - One-shot initialization
   - Runs database migrations
   - Exits after completion

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Required Configuration
NODE_ENV=production
PORT=5000
DATABASE_URL=postgres://futures:futures_password@postgres:5432/futures_db
SESSION_SECRET=<generate-random-secret>

# Optional Configuration
TZ=America/New_York
SCHEDULER_ENABLED=true  # Only for scheduler service
```

### Generate Secure Secrets

```bash
# Generate SESSION_SECRET
openssl rand -base64 32

# Generate strong database password
openssl rand -base64 24
```

## Deployment Steps

### Development Deployment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f web
docker-compose logs -f scheduler

# Stop services
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

### Building Images

```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build web

# Build with no cache
docker-compose build --no-cache
```

## Production Deployment

### 1. Security Hardening

```bash
# Generate production secrets
export SESSION_SECRET=$(openssl rand -base64 32)
export POSTGRES_PASSWORD=$(openssl rand -base64 24)

# Update .env file with generated secrets
```

### 2. Production docker-compose.yml

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  postgres:
    restart: always
    volumes:
      - /data/postgres:/var/lib/postgresql/data  # Persistent storage
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
    secrets:
      - postgres_password

  web:
    restart: always
    environment:
      SESSION_SECRET_FILE: /run/secrets/session_secret
    secrets:
      - session_secret
      - postgres_password

  scheduler:
    restart: always
    secrets:
      - session_secret
      - postgres_password

secrets:
  postgres_password:
    file: ./secrets/postgres_password.txt
  session_secret:
    file: ./secrets/session_secret.txt
```

### 3. Deploy to Production

```bash
# Deploy with production config
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verify deployment
docker-compose ps
curl http://localhost:5000/health
```

### 4. Nginx Reverse Proxy (Optional)

```nginx
server {
    listen 80;
    server_name futures.example.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

## Monitoring & Maintenance

### Health Checks

```bash
# Check web service health
curl http://localhost:5000/health

# Check all service status
docker-compose ps

# View resource usage
docker stats
```

### Logs

```bash
# View all logs
docker-compose logs

# Follow logs
docker-compose logs -f

# Filter by service
docker-compose logs web
docker-compose logs scheduler

# View last 100 lines
docker-compose logs --tail=100
```

### Database Backup

```bash
# Backup database
docker-compose exec postgres pg_dump -U futures futures_db > backup.sql

# Restore database
docker-compose exec -T postgres psql -U futures futures_db < backup.sql
```

### Updates

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose build
docker-compose up -d

# View changes
docker-compose logs -f
```

## Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Check what's using port 5000
sudo lsof -i :5000

# Change port in .env
PORT=5001
```

#### 2. Database Connection Failed
```bash
# Check postgres logs
docker-compose logs postgres

# Verify DATABASE_URL in .env
# Ensure postgres service is healthy
docker-compose ps
```

#### 3. Migrations Failed
```bash
# Check migrations logs
docker-compose logs migrations

# Manually run migrations
docker-compose run --rm migrations npm run db:push
```

#### 4. Scheduler Not Running
```bash
# Check scheduler logs
docker-compose logs scheduler

# Verify SCHEDULER_ENABLED=true
docker-compose exec scheduler env | grep SCHEDULER

# Check timezone
docker-compose exec scheduler date
```

#### 5. Out of Memory
```bash
# Check memory usage
docker stats

# Increase Docker memory limit (Docker Desktop)
# Settings > Resources > Memory > 4GB+
```

### Reset Everything

```bash
# Stop and remove all containers, volumes, and networks
docker-compose down -v

# Remove images
docker-compose down --rmi all

# Rebuild from scratch
docker-compose build --no-cache
docker-compose up -d
```

### Debug Container

```bash
# Access container shell
docker-compose exec web sh
docker-compose exec postgres sh

# Check environment variables
docker-compose exec web env

# Check running processes
docker-compose exec web ps aux
```

## Performance Tuning

### PostgreSQL Optimization

Add to `docker-compose.yml`:

```yaml
postgres:
  environment:
    POSTGRES_SHARED_BUFFERS: 256MB
    POSTGRES_EFFECTIVE_CACHE_SIZE: 1GB
    POSTGRES_MAX_CONNECTIONS: 100
```

### Application Scaling

```bash
# Scale web service (horizontal scaling)
docker-compose up -d --scale web=3

# Use load balancer (nginx/traefik) to distribute traffic
```

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [PostgreSQL Docker Hub](https://hub.docker.com/_/postgres)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

## Support

For issues and questions:
1. Check the logs: `docker-compose logs`
2. Review this guide
3. Check Docker status: `docker-compose ps`
4. Open an issue on GitHub

---

**Last Updated**: October 2025  
**Version**: 1.0.0
