# Whileone Outreach Assistant

## 1. Project Overview
The Whileone Outreach Assistant is an intelligent, AI-powered internal platform designed to optimize the process of discovering and reaching out to potential client prospects. The application deeply analyzes a user's professional network and historical company project documentation to surface the most relevant prospects using powerful, context-aware workflows.

## 2. Core Philosophy
The platform is built on two primary beliefs that govern how AI should assist in B2B outreach:

1. **Relationship Context > Generic Personalization:** The best outreach leverages real human connection. The AI explicitly prioritizes past relationship metadata over generic company intelligence.
2. **Warm Introductions > Cold Outreach:** The system aggressively prioritizes existing network connections over blindly scraping cold contacts.

## 3. Current Feature Set

- **Connections:** Import and track LinkedIn connections. Supports multi-owner tracking and automated deduplication.
- **Messages:** Import historical LinkedIn message threads to build deep conversational context and perform interaction analysis.
- **Relationship Intelligence:** AI-driven classification of connections (e.g., Cold Outreach vs Warm Intro) and relationship strength scoring.
- **Project Matching:** Connection-specific semantic search mapping a contact's expertise directly to past company projects via vector search.
- **Email Generation:** A comprehensive generative pipeline constructing dynamic outreach based on relationship intelligence, company context, and project matching.
- **Companies:** A unified view to track companies within the network, view relationship scoring, and find internal champions.
- **Knowledge Base:** Google Drive sync to automatically ingest and chunk past project documentation into the pgvector database.
- **Discover Events:** Aggregation of upcoming industry events categorized by technology and location, helping to identify timely outreach opportunities.
- **Similar Contacts:** Apollo integration to identify the extended buying committee (adjacent stakeholders) at target companies.

## 4. Architecture

### Frontend
- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS, Radix UI (shadcn/ui)

### Backend
- **Framework:** Next.js API Routes (Serverless)
- **Domains:** Modular domain-driven design located in `src/domains/` for isolated business logic.
- **Infrastructure:** Centralized database and vector search logic in `src/infrastructure/`.

### Database
- **Provider:** Supabase (PostgreSQL)
- **Features:** `pgvector` for semantic search, heavily normalized relational schema for connections, messages, and caching.

### AI Providers & Integrations
- **Gemini (Google):** The primary engine for generation, relationship intelligence, and text embeddings (`text-embedding-004`).
- **Tavily:** Search API for profile and company enrichment.
- **Apollo:** Contact and stakeholder discovery.

## 5. Data Flow

### Intelligence Orchestration
```text
[Connections] ────────┐
[Messages]    ────────┤
[Tavily]      ────────┼───▶ [Relationship/Conv Intelligence] ───▶ [Project Matching] ───▶ [Email Generation]
[Apollo]      ────────┘
```

### Knowledge Base Ingestion
```text
[Google Drive] ───▶ [Knowledge Sync] ───▶ [Text Chunking] ───▶ [Vector Embeddings (pgvector)]
```

## 6. Database Overview
Major tables include:
- `connections`: Stores individual prospect profiles.
- `companies`: Normalizes company data.
- `connection_metrics`: Caches computed relationship and conversation intelligence.
- `knowledge_documents` & `knowledge_chunks`: Stores synced Google Drive documents and their vector embeddings.
- Cache tables (`discover_events_cache`, `company_context_cache`, `company_similar_contacts_cache`): Protect API credits by caching enrichment data.

## 7. Environment Variables
The following environment variables are required to run the platform:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="your_supabase_project_url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"
SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_role_key"

# LLM Provider API Keys
GEMINI_API_KEY="your_gemini_key"

# Search & Enrichment Services
TAVILY_API_KEY="your_tavily_key"
APOLLO_API_KEY="your_apollo_key"

# Google OAuth Integration
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/google/callback"
```

## 8. Local Development

1. Clone the repository and run `npm install`.
2. Configure your environment variables in `.env.local`.
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```

## 9. Docker Deployment

The application is containerized using a secure Next.js architecture.

1. Ensure `.env.production` is populated with all required variables.
2. Build and run the containers:
   ```bash
   docker compose --env-file .env.production up -d --build
   ```

## 10. Project Structure

- `app/`: Next.js App Router pages and API routes (`app/api/`).
- `src/components/`: Reusable UI components.
- `src/domains/`: Core business logic (companies, connections, discover, emails, knowledge, prospects).
- `src/features/`: Feature-specific React UI components.
- `src/infrastructure/`: Database clients, vector search, and core infrastructure code.
- `src/services/`: Cross-domain services (AI providers, external integrations like Apollo and Tavily).
- `src/types/`: TypeScript definitions and generated database types.

## 11. Troubleshooting

- **Vector Search Issues:** Ensure Google Drive sync has successfully populated `knowledge_chunks` and that `pgvector` is enabled on your Supabase instance.
- **Provider API Errors:** If email generation fails silently, check the terminal/logs for 429 status codes from Gemini or Tavily.
- **Sync Issues:** If auto-sync fails, ensure your Google OAuth credentials are valid and the user's `google_drive_folder_ids` are configured correctly in the settings.
