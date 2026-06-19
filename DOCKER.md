# Docker Documentation

This document serves as the canonical quick-reference for the current Docker-compose environment.

## Architecture

The production Docker environment runs **only** the following two containers via Docker Compose:
1. **Next.js Web Application** (`web`)
2. **Nginx Reverse Proxy** (`nginx`)

All other services (Supabase, Google APIs, Apollo, Tavily, Gemini) remain hosted externally. The environment explicitly relies on a Monolith architecture—there are no separate backend workers, pg-boss instances, or Redis caches deployed in this stack. Next.js handles background refreshes entirely asynchronously.

## Core Commands

### Start Detached (Production Default)
```bash
docker compose --env-file .env.production up -d --build
```

### Stop
```bash
docker compose down
```

### View Logs
```bash
docker compose logs -f
```

### Rebuild Only
```bash
docker compose --env-file .env.production build
```

## Environment Variables
The build and runtime strictly depend on `.env.production`. 
Docker BuildKit securely mounts `.env.production` during the Next.js build step so that `NEXT_PUBLIC_*` variables are successfully baked into the client bundle without exposing them in the final image layers.
