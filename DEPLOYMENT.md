# Deployment Guide: Whileone Outreach

## Prerequisites
* **Required software**: Node.js (v20+ recommended) for local development, Docker and Docker Compose for deployment.
* **Required services**: Supabase instance (cloud or self-hosted) with `pgvector` enabled.
* **Required accounts**: Google Cloud (OAuth credentials for Drive/Sheets integration).
* **Version requirements**: Node.js v22 (used in Dockerfile), Next.js 16, React 19.

## Dependency Inventory
* **Frontend dependencies**: Next.js 16, React 19, Tailwind CSS 4, Radix UI primitives, Lucide React, date-fns.
* **Backend dependencies**: `@google/genai` (Gemini integration), `@supabase/supabase-js`, `@supabase/ssr`, `googleapis`, `papaparse`, `mammoth`, `fuzzyset`, `zod`.
* **Database dependencies**: PostgreSQL with the `pgvector` extension.
* **Infrastructure dependencies**: Nginx (alpine image) for Docker Compose proxy.
* **External integrations**: Google APIs, Tavily API (optional), Apollo API (optional), Gemini API.

## Environment Variables

| Variable Name | Purpose | Required/Optional | Example Value | Where Used |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Connects to Supabase instance | Required | `https://xyz.supabase.co` | Frontend & Backend |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public key for Supabase access | Required | `eyJhbG...` | Frontend & Backend |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin key for backend operations | Required | `eyJhbG...` | Backend API routes |
| `GEMINI_API_KEY` | Authenticates with Google AI | Required | `AIzaSy...` | Generation and Embeddings |
| `CEREBRAS_API_KEY` | Alternative AI provider | Optional | `cer_...` | AI generation models |
| `GOOGLE_CLIENT_ID` | OAuth for Google Drive/Sheets | Required | `123-abc.apps.googleusercontent.com` | Google Integrations |
| `GOOGLE_CLIENT_SECRET` | OAuth secret for Google Drive | Required | `GOCSPX-...` | Google Integrations |
| `NEXT_PUBLIC_SITE_URL` | Base URL for auth callbacks | Required | `http://localhost:3000` | Auth middleware / UI |
| `TAVILY_API_KEY` | Public web search enrichment | Optional | `tvly-...` | Web search integration |
| `APOLLO_API_KEY` | B2B contact data enrichment | Optional | `apollo_...` | Contact data integration |

## Local Development Setup
1. **Installation**: Clone the repository and run `npm install` to install dependencies.
2. **Configuration**: Copy `.env.example` to `.env.local` and populate all the required keys.
3. **Database setup**: Provision your Supabase instance. Run the migrations sequentially from `supabase/migrations/` (e.g., using `supabase db push` with the Supabase CLI).
4. **Frontend startup**: Run `npm run dev` to start the Next.js development server.
5. **Backend startup**: Handled concurrently by the Next.js dev server on `http://localhost:3000`.
6. **Validation steps**: Navigate to `http://localhost:3000`, verify that the application loads successfully, and attempt to log in using Supabase Auth.

## Build Process
* **Frontend build commands**: `npm run build`
* **Backend build commands**: Combined with frontend using `npm run build`.
* **Generated artifacts**: The build process produces an optimized production bundle inside the `.next/` directory.

## Deployment Instructions

### Docker Compose
This repository natively supports self-hosted deployment using `docker-compose.yml`, spinning up the Next.js app and an Nginx reverse proxy.

* **Environment preparation**: Create a `.env.production` file at the root containing all variables.
* **Configuration**: Review and customize `nginx/nginx.conf` if necessary to fit your reverse proxy requirements.
* **Build**: Docker Compose triggers the Dockerfile build process natively. Docker BuildKit is utilized to mount the environment secret.
* **Deployment**: Execute `docker compose up -d`.
* **Verification**: Run `docker compose ps` to ensure both `web` and `nginx` containers are healthy. Navigate to the configured Nginx port (default `80`).

### Standalone Docker
* **Environment preparation**: Ensure `.env.production` is present.
* **Build**: Execute the Dockerfile build utilizing the secret mount for Next.js to bake in public variables: `DOCKER_BUILDKIT=1 docker build --secret id=env_prod,src=.env.production -t whileone-outreach .`
* **Deployment**: Run the generated image, ensuring variables are passed: `docker run -p 3000:3000 --env-file .env.production whileone-outreach`
* **Verification**: Navigate to `http://localhost:3000`.

*(Other methods like Kubernetes, VMs, or specific Cloud providers are not currently templated within the repository).*

## Database Operations
* **Provisioning**: Managed via Supabase cloud dashboard or standalone Supabase Docker setup.
* **Migration execution**: Run sequentially using `supabase db push` or by executing the SQL files located in `supabase/migrations/` directly on the database.
* **Seeding**: Not confirmed from code inspection. (No standard seeding scripts exist).
* **Backup procedures**: Handled natively by the Supabase platform infrastructure.
* **Restore procedures**: Handled natively by the Supabase platform via Point-in-Time Recovery.

## Monitoring and Logging
* **Health checks**: The `docker-compose.yml` configures a health check polling `http://localhost:3000/` using `wget` every 30 seconds.
* **Metrics**: Not confirmed from code inspection.
* **Log locations**: Application logs are output to stdout/stderr and captured by Docker (`docker compose logs web`).
* **Monitoring integrations**: Not confirmed from code inspection.

## Troubleshooting
* **Common startup failures**: Application crashing immediately due to a missing or malformed `NEXT_PUBLIC_SUPABASE_URL`.
* **Environment variable issues**: The Docker build will fail if `.env.production` is missing, as the `Dockerfile` expects it to be mounted as a build secret.
* **Database issues**: Failing to run migrations (specifically `pgvector` enablement) will result in backend API 500 errors when attempting to query or generate embeddings.
* **Build failures**: TypeScript compiler failures if `src/types/database.ts` falls out of sync with actual database structure or code implementation.
* **Deployment failures**: The Nginx container restarting in a loop if the `web` container is failing its health checks.

## Maintenance
* **Upgrade procedure**: Pull the latest changes, build a new container (`docker compose build --no-cache`), and deploy (`docker compose up -d`).
* **Rollback procedure**: Re-tag and deploy the previously known good Docker image.
* **Backup strategy**: Rely on Supabase automated backups for production database snapshots. Codebase history is preserved in version control.
