# Architecture Reference: Whileone Outreach

## System Overview
* **High-level architecture**: The platform operates as a serverless-friendly Next.js web application utilizing Supabase (PostgreSQL + pgvector) for state management and semantic vector storage. It coordinates external intelligence gathering via Tavily and Apollo APIs, and uses Gemini as the primary LLM engine for reasoning, entity extraction, embeddings, and email generation.
* **Major components**: 
  - Next.js 16 Frontend (React 19)
  - Next.js API Routes (Backend logic)
  - Supabase Database (Persistence, Auth, Vector Store)
  - Intelligence Services (Gemini, Tavily, Apollo)
  - Integrations (Google Drive/Sheets via OAuth)
* **Data flow**: Users import CSVs or connect Google Drive -> Next.js APIs parse and orchestrate data -> Supabase stores records -> Background tasks fetch enriched data from external APIs -> Gemini processes embeddings and relationship data -> Supabase pgvector stores embedded chunks -> Generation pipeline fetches from Supabase and queries Gemini to formulate outreach.
* **Request lifecycle**: Client -> Next.js Middleware (Auth check) -> API Route -> Supabase Query / External Service Call -> JSON Response.

## Frontend Architecture
* **Technology stack**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Radix UI, Lucide React.
* **Directory structure**: `app/` (Next.js App Router endpoints), `src/components/` (UI and layout components).
* **Routing architecture**: Next.js App Router.
* **State management**: React Hooks, Server Components, and Supabase real-time/database state via SSR.
* **API communication layer**: Direct fetch calls to internal `/api/*` routes.
* **Authentication flow**: Supabase SSR (Server-Side Rendering) authentication handling session cookies via middleware (`src/middleware.ts`).
* **Component organization**: Split into `src/components/ui/` (Radix primitives), `src/components/layout/`, and `src/components/shared/`.
* **Error handling**: Standard Next.js error boundaries and `sonner` toasts for UI notifications.
* **Build and bundling process**: Managed by Next.js (`npm run build`), producing optimized artifacts.

## Backend Architecture
* **Runtime and framework**: Node.js running Next.js 16 API Routes.
* **Module structure**: Organized by domains (`src/domains/`) and features (`src/features/`) reflecting a Domain-Driven Design pattern. Infrastructure code is in `src/infrastructure/` and complex logic in `src/services/`.
* **API architecture**: RESTful-like JSON APIs located in `app/api/`.
* **Middleware chain**: `src/middleware.ts` intercepts requests for Supabase auth token validation and route protection.
* **Authentication and authorization**: Supabase Auth (JWT validation). Server-side queries enforce isolation via `requireUser()` helper and `user_id` filtering.
* **Validation layer**: Zod schemas used for robust API payload validation.
* **Service layer**: Heavy business logic is abstracted into `src/services/` (e.g., `ai/generation`, `integrations/apollo`, `integrations/tavily`).
* **Database access patterns**: Direct usage of Supabase JS Client (`@supabase/supabase-js` and `@supabase/ssr`), fetching typed data via generated `src/types/database.ts`.
* **Logging strategy**: Not confirmed from code inspection.
* **Error handling strategy**: Try-catch blocks in API routes returning explicit error payloads with 500 status codes.

## API Deep Dive

### `GET /api/connections`
* **Endpoint path**: `/api/connections`
* **HTTP method**: GET
* **Purpose**: Retrieves a user's network connections with optional filtering and search parameters.
* **Request schema**: Query parameters `q`, `company`, `location`, `position`, `owner`.
* **Validation flow**: Basic string parsing and extraction from URL search params.
* **Business logic flow**: Authenticates user -> Queries `connections` table joining `connection_profiles` -> Merges duplicate connections based on profile URLs or identity match -> Applies search string filters -> Returns filtered JSON array.
* **Database interactions**: `supabase.from("connections").select("id, first_name, ..., connection_profiles(*)").order(...)`
* **Response structure**: `{ "connections": [...] }` or `{ "error": "message" }`.
* **Failure scenarios**: Database connection failure or invalid auth token (returns 500 status).

*(Note: Other endpoints under `/api/emails`, `/api/knowledge`, `/api/discover` follow similar structural patterns but execute domain-specific logic like LLM generation or pgvector queries).*

## Data Layer
* **Database technology**: PostgreSQL (via Supabase) utilizing the `pgvector` extension.
* **Schema overview**: 
  - Core Entities: `profiles`, `user_settings`, `connections`, `knowledge_documents`, `prospects`
  - Caches: `company_context_cache`, `company_similar_contacts_cache`, `company_industry_cache`, `company_score_cache`, `case_studies_sheet_cache`
  - History/Logs: `linkedin_messages`, `sync_logs`, `generated_emails`, `prospect_analysis`
  - AI Context: `connection_profiles`, `connection_relationship_metrics`, `knowledge_chunks`
* **Entity relationships**: `connections` has a 1:1 relationship with `connection_profiles`. `knowledge_documents` maps 1:N to `knowledge_chunks`. All critical operational records contain a `user_id` for multi-tenant isolation.
* **Migrations**: Maintained as incremental raw SQL files in `supabase/migrations/` (e.g., `001_initial_schema.sql`, `018_connection_project_cache.sql`).
* **Data lifecycle**: Raw data is imported, progressively enriched by background API calls, stored in long-lived tables, and aggregated into cache tables to minimize downstream API costs.

## Security Architecture
* **Authentication**: Managed exclusively by Supabase Auth (Email/Password or OAuth).
* **Authorization**: User-level isolation is enforced via mandatory `user_id` columns on all tenant tables and validated on the backend.
* **Secret management**: Environment variables (`.env.local`, `.env.production`). Docker Secrets mount production variables securely during the build phase.
* **Input validation**: Handled via Zod schemas for POST/PUT payloads.
* **Security controls**: Not confirmed from code inspection.

## Design Decisions
* **Architectural choices**: Utilizing Domain-Driven Design principles within a Next.js App Router context ensures the extensive business logic (AI prompt generation, vector matching) remains cleanly separated from UI rendering.
* **Tradeoffs**: Heavy reliance on Supabase types and the `pgvector` extension tightly couples the persistence layer to the Postgres ecosystem. Caching extensive API data locally mitigates rate limits but introduces cache invalidation complexity.
* **Current limitations**: Parsing large Google Drive documents synchronously within Next.js API routes risks hitting serverless execution timeouts.
* **Future improvement opportunities**: Transitioning long-running intelligence tasks (like scraping and bulk embedding) to an asynchronous worker queue (e.g., Inngest/BullMQ).

## Repository Structure Reference
* `app/`: Next.js App Router structure defining all pages and `/api/` HTTP endpoints.
* `src/application/`: High-level application use-cases.
* `src/components/`: Reusable React components (UI library, layout wrappers).
* `src/domains/`: Domain logic separated by feature area (e.g., companies, connections, emails).
* `src/features/`: Feature-specific implementation bindings.
* `src/infrastructure/`: Low-level integrations (Supabase clients, vector store interfaces).
* `src/lib/`: Shared utilities and helpers.
* `src/services/`: External integrations (Tavily, Apollo, Google) and AI logic (Gemini embeddings/generation).
* `src/types/`: TypeScript definitions, primarily `database.ts` representing the exact Supabase schema.
* `supabase/migrations/`: Sequential SQL schema migration files.
* `docker-compose.yml` & `Dockerfile`: Infrastructure-as-Code for standalone deployment.
