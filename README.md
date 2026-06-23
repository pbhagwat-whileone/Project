# Whileone Outreach Assistant

## Overview

The Whileone Outreach Assistant is an intelligent, AI-powered internal platform designed to optimize the process of discovering and reaching out to potential client prospects. The application deeply analyzes professional networks, historical messages, and past company project documentation to surface the most relevant outreach targets with context-aware workflows.

### Core Philosophy
1. **Relationship Context > Generic Personalization:** The best outreach leverages real human connection. The AI explicitly prioritizes past relationship metadata over generic company intelligence.
2. **Warm Introductions > Cold Outreach:** The system aggressively prioritizes existing network connections over scraping cold contacts.

---

## Features

- **Connections:** Import and track professional connections. Supports multi-owner tracking and automated deduplication.
- **Messages:** Import historical message threads to build deep conversational context and perform interaction analysis.
- **Relationship Intelligence:** AI-driven classification of connection types (e.g., Cold Outreach vs. Warm Intro) and relationship strength scoring.
- **Project Matching:** Connection-specific semantic search mapping a contact's expertise directly to past company projects.
- **Email Generation:** A comprehensive generative pipeline constructing dynamic outreach based on relationship intelligence, company context, and project matching.
- **Companies:** A unified view to track companies within the network, view relationship scoring, and find internal champions.
- **Knowledge Base:** Google Drive sync to automatically ingest and chunk past project documentation into the database.
- **Discover Events:** Aggregation of upcoming industry events categorized by technology and location, helping to identify timely outreach opportunities.
- **Similar Contacts:** Apollo integration to identify the extended buying committee (adjacent stakeholders) at target companies.
- **Company Classification:** Dynamic classification of companies by domains (Cloud, AI, etc.), architectures, and technology layers (Silicon, Systems, Software).
- **Case Studies-Master Sheet Integration:** Google Sheets integration to parse and synchronize authoritative case studies and client success stories for project matching.

---

## Architecture

- **Next.js 16 App Router:** Frontend framework for routing and UI rendering.
- **Next.js API Routes:** Serverless backend endpoints.
- **Supabase PostgreSQL:** Relational database for core entities and caching.
- **pgvector:** Vector embedding storage for semantic search over knowledge documents.
- **Gemini:** The primary AI engine for high-quality narrative writing (Email Generation & Refinement).
- **Cerebras:** The primary AI engine for structured intelligence workloads (Company Classification, Summarization, Extractions, and Rankings).
- **Tavily:** Search API for profile and company enrichment.
- **Apollo:** Contact and stakeholder discovery API.
- **Google Drive:** Knowledge base document storage.
- **Google Sheets:** Case studies and structured asset synchronization.

---

## Data Flow

- **Knowledge Base Sync:** `[Google Drive / Sheets] -> [Knowledge Sync] -> [Text Chunking & Embedding] -> [pgvector]`
- **Company Intelligence Pipeline:** `[Tavily Web Search] -> [Cerebras Extraction & Classification] -> [Structured Database Cache]`
- **Email Generation Pipeline:** `[Connections & Messages] + [Company Context] + [Project Matching] -> [Gemini Generation] -> [Email Drafts]`
- **Company Classification Pipeline:** `[Raw Public Data] -> [Cerebras Confidence-Based Classifier] -> [UI Rendering by Relevance]`

---

## Project Structure

- `app/` - Next.js App Router pages and API routes (`app/api/`).
- `src/components/` - Reusable UI components.
- `src/domains/` - Core business logic separated by domain (companies, connections, discover, emails, knowledge, prospects).
- `src/features/` - Feature-specific React UI components.
- `src/infrastructure/` - Database clients, vector search setup, and fundamental application infrastructure.
- `src/services/` - Cross-domain services (AI providers like Gemini/Cerebras, external integrations like Apollo and Tavily).
- `src/types/` - TypeScript definitions and generated database types.
- `public/` - Static assets.
- `skills/` - Custom agent/tool definitions.

---

## Environment Variables

The following environment variables are required to run the platform locally or in Docker. Configure these in your `.env.local` or `.env.production` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI Providers
GEMINI_API_KEY=
CEREBRAS_API_KEY=

# Google OAuth Integration (Drive/Sheets)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Base URLs
NEXT_PUBLIC_SITE_URL=

# Optional Integrations
TAVILY_API_KEY=
APOLLO_API_KEY=
```

---

## Local Development

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Configure your environment variables in `.env.local`.
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
4. Access the application at `http://localhost:3000`.

---

## Docker Deployment

The application is containerized for production readiness.

1. Ensure `.env.production` is populated with all required variables.
2. Build and run the containers using Docker Compose:
   ```bash
   docker compose --env-file .env.production up -d --build
   ```

---

## Troubleshooting

- **Vector Search Issues:** Ensure the Google Drive and Sheets sync has successfully populated `knowledge_chunks` and that `pgvector` is enabled on your Supabase instance.
- **Provider API Errors:** If email generation or classification fails, check the logs for 429 status codes (Rate Limiting) from Gemini or Cerebras.
- **Sync Issues:** If auto-sync fails, ensure your Google OAuth credentials are valid and the user's `google_drive_folder_ids` or `case_studies_sheet_url` are configured correctly in the application settings.
