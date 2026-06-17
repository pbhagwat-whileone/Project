# Whileone Outreach Assistant

## 1. Project Overview
The Whileone Outreach Assistant is an intelligent, AI-powered internal tool designed to automate and optimize the process of discovering and reaching out to potential client prospects. The application deeply analyzes the user's professional network and past company projects to surface the most relevant prospects using powerful, context-aware workflows.

## 2. Core Philosophy
The platform is built on two primary beliefs that govern how AI should generate outreach:

1. **Relationship Context > Conversation Context > Company Context > Generic Personalization.** The best outreach leverages real human connection. The AI explicitly prioritizes past relationship metadata over recent conversations, which in turn is prioritized over generic company intelligence.
2. **Warm Introductions > Cold Outreach.** The system aggressively prioritizes existing network connections and their extended company graphs over blindly scraping cold contacts.

## 3. Current Architecture

### Frontend
- **Framework:** Next.js 16 (App Router)
- **Styling:** Tailwind CSS, Radix UI (shadcn/ui)
- **State/Data:** React Server Components (RSC) and standard React Hooks

### Backend
- **Framework:** Next.js API Routes (Serverless)
- **Services:** Modular service layers located in `src/services/` for business logic

### Database
- **Provider:** Supabase (PostgreSQL)
- **Features:** pgvector for embeddings, heavily normalized relational schema for connections, messages, and caching

### AI Providers
The platform explicitly avoids OpenAI and Grok, relying instead on a specialized array of providers:
- **Cerebras (GPT-OSS):** The primary, lightning-fast inference engine (`llama3.3-70b` or similar fast models) used for high-throughput reasoning, extraction, and generation.
- **Gemini (Google):** Handles text embeddings (`text-embedding-004`) and serves as a powerful fallback for generation.
- **Claude (Anthropic):** Supported for advanced reasoning if explicitly requested by the user.

## 4. Major Features

- **Connections:** Import and track LinkedIn connections (first name, last name, company, position). Includes multi-owner support and deduplication.
- **Messages:** Import historical LinkedIn message threads to build deep conversational context and perform interaction analysis.
- **Profile Enrichment:** Generate structured intelligence on connections using Tavily to identify expertise, technology tags, and activity signals.
- **Companies:** A unified view to track companies within the network, view relationship scoring, and find internal champions.
- **Relationship Intelligence:** AI-driven classification of connections (e.g., Cold Outreach vs Warm Intro) and relationship strength scoring.
- **Conversation Intelligence:** Extract actionable insights, persistent context, and time-bound context from raw message histories.
- **Project Matching:** Connection-specific semantic search mapping a contact's expertise directly to past company projects via vector search.
- **Similar Contacts:** Apollo integration to identify the extended buying committee (adjacent stakeholders) at target companies.
- **Email Generation:** A comprehensive generative pipeline constructing dynamic outreach based on relationship intelligence, conversation context, company context, project matching, and skill templates.
- **Knowledge Base:** Google Drive sync to automatically ingest and chunk past project documentation (DOCX/PDF) into the pgvector database.
- **Discover Events:** Aggregation of upcoming industry events categorized by technology and location, helping to identify timely outreach opportunities.

## 5. Data Flow Diagrams

The orchestration of intelligence follows a strict, layered pipeline:

```text
[Connections] ────────┐
[Messages]    ────────┤
[Knowledge Base] ─────┼───▶ [Relationship/Conv Intelligence] ───▶ [Outreach Generation]
[Tavily]      ────────┤
[Apollo]      ────────┘
```

## 6. Cache Strategy
To optimize performance and minimize API costs, the platform utilizes aggressive database caching:
- **Profile Intelligence:** Cached persistently upon enrichment.
- **Company Intelligence (Tavily):** Cached for 7 days (`company_context_cache`).
- **Similar Contacts (Apollo):** Cached persistently to protect API credits (`company_similar_contacts_cache`).
- **Industry & Scoring:** Evaluated and cached persistently, recalculated only when data changes.

## 7. Environment Variables
The following environment variables are required to run the platform locally:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="your_supabase_project_url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"
SUPABASE_SERVICE_ROLE_KEY="your_supabase_service_role_key"

# LLM Provider API Keys
GOOGLE_GENAI_API_KEY="your_gemini_key"
CEREBRAS_API_KEY="your_cerebras_key"
ANTHROPIC_API_KEY="your_anthropic_key" # Optional fallback

# Search & Enrichment Services
TAVILY_API_KEY="your_tavily_key"
APOLLO_API_KEY="your_apollo_key"

# Google OAuth Integration
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/api/google/callback"
```

## 8. Setup Instructions
1. Clone the repository and run `npm install`.
2. Configure your environment variables in `.env.production` (for Docker) or `.env.local` (for local dev) based on the variables listed above.
3. Apply Supabase database migrations (schema matches `src/types/database.ts`).

### Local Development
Run the Next.js development server using `npm run dev`.

### Docker Production Deployment
The application is fully containerized using a secure Next.js + Nginx architecture.
1. Ensure `.env.production` is populated with all required variables.
2. Run `docker compose --env-file .env.production up -d --build`.
3. The application will be securely available on port 80 via the Nginx reverse proxy.

## 9. Project Structure
- `app/`: Next.js App Router pages and API routes (`app/api/`).
- `src/components/`: Reusable UI components (shadcn/ui).
- `src/features/`: Feature-specific UI components (e.g., discover, emails, knowledge-base).
- `src/services/`: Core business logic, AI orchestration, and third-party API integrations.
- `src/ai/`: LLM provider wrappers and dynamic prompt generation logic.
- `src/types/`: TypeScript definitions and Supabase database schema types.

## 10. Important Architectural Rules
- **No OpenAI or Grok:** Ensure no dependencies or API calls are made to these providers.
- **No Manual Relationship Selection:** Relationship intelligence is automatically derived from historical data; the user cannot manually force a relationship status.
- **No Company-Level Project Matching:** Project matching is strictly **connection-specific** (mapping a *person's* expertise to a project, not generalizing across their entire company).
- **No Automatic Apollo Searches:** Apollo searches are costly and must only be triggered via explicit user action (e.g., finding similar contacts).

## 11. Discover Events Architecture
The Discover feature is strictly focused on aggregating and displaying relevant industry Events. All historical News-related features, routes, and caches have been entirely removed to simplify the user experience and reduce noise. Events are categorized by location, date, and technology tags.

## 12. Troubleshooting
- **Type Errors on Build:** If `npm run build` fails with TypeScript errors related to `database.ts`, ensure your local Supabase schema is synced and `src/types/database.ts` accurately reflects all columns (such as newly added `persistent_context` and `time_bound_context` in metrics).
- **Caching Issues:** If fresh data isn't appearing for companies or profiles, check the `updated_at` or `expires_at` timestamps in the respective Supabase cache tables.
- **API Limits:** If email generation or enrichment fails silently, check the console for 429 status codes from Cerebras, Gemini, or Tavily.
