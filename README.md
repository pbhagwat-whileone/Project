# WhileOne Outreach Assistant

## Overview
The Whileone Outreach Assistant is an intelligent, AI-powered internal tool designed to automate and optimize the process of discovering and reaching out to potential client prospects.

The system ingests the user's professional network (via LinkedIn CSV exports of connections and messages), deeply analyzes target companies against Whileone's proprietary knowledge base of past projects (synced from Google Drive DOCX files), and surfaces the most relevant prospects. It features advanced conversation intelligence, multi-owner network support, and uses state-of-the-art LLMs to draft hyper-personalized outreach emails.

## Features
- **LinkedIn Connections Import:** Seamlessly ingest and parse first-degree connections.
- **LinkedIn Messages Import:** Ingest message histories to build deep conversation context.
- **Conversation History:** View complete timelines of previous interactions with contacts.
- **Conversation Intelligence:** Automatically summarize conversation threads to extract actionable insights.
- **Relationship-Aware Contact Ranking:** Score and rank contacts based on conversation volume, recency, and connection strength.
- **Multi-Owner Networks:** Support for multiple connection owners, tracking who in your team owns which relationship.
- **Company Search:** Robust resolution of company names and discovery of key contacts within organizations.
- **Knowledge Base Search:** Chunking and vector search of past project documentation (DOCX format) synced from Google Drive.
- **Project Matching:** Evaluates how well a prospect company aligns with Whileone's historical project expertise.
- **Recommendations:** Aggregates relationship metrics, seniority, and project relevance into unified prospect scores.
- **Email Generation:** Generates outcome-focused outreach drafts using specialized relationship skills.
- **Email Refinement:** Interactive, AI-assisted refinement of generated emails.
- **Multi-LLM Support:** Leverages Gemini, Claude, and Cerebras (GPT-OSS) for content generation with built-in fallbacks.
- **Google Drive Sync:** Automated fetching of past project documentation directly from Google Drive.
- **Caching:** Extensive caching of company data, scores, and relationship metrics to ensure fast and resilient load times.

## Architecture
The application flow encompasses the following domains:
- **Connections & Messages:** Data flows from LinkedIn exports into a unified connection graph, linking contacts to their communication histories.
- **Knowledge Base:** Documents are synced from Google Drive, chunked, and embedded into a vector database for semantic retrieval.
- **Recommendations:** The recommendation engine synthesizes relationship metrics, seniority, and project match scores to surface top prospects.
- **Conversation Intelligence:** Message threads are passed through LLMs to generate concise, contextual summaries.
- **Outreach Generation:** Ranked companies and conversation contexts are fed into the email generator to draft hyper-personalized, outcome-focused communication.

## Database
The application runs on Supabase (PostgreSQL). The core active tables are:
- **`profiles`**: Stores user authentication and profile data.
- **`connections`**: Stores imported LinkedIn connections. Includes `connection_owner_name` support for multi-owner tracking.
- **`linkedin_messages`**: Stores imported LinkedIn message threads, linking them to connections and companies.
- **`connection_relationship_metrics`**: Stores aggregated metrics (e.g., message counts, last interaction date) to quantify relationship strength.
- **`knowledge_documents`**: Tracks metadata for DOCX files synced from Google Drive.
- **`knowledge_chunks`**: Stores text chunks and their pgvector embeddings derived from `knowledge_documents`.
- **`company_industry_cache`**: Caches basic metadata (industry, size, etc.) about companies.
- **`company_score_cache`**: Persistently stores highly-computed recommendation breakdowns.
- **`prospects`**: Tracks manually saved or evaluated prospects.
- **`generated_emails`**: Stores generated drafts and tracks refinement history.
- **`sync_logs`**: Audit trail for Google Drive synchronization runs.

## AI Layer
The application leverages an abstraction layer (`src/ai/models.ts`) to route generation tasks across supported providers:
- **Gemini (Google):** Handles embeddings (`gemini-embedding-001`) and fast classification tasks.
- **Claude (Anthropic):** Used for advanced reasoning and contextual generation tasks.
- **Cerebras (GPT-OSS):** Acts as the primary engine (`gpt-oss-120b`) for email generation, refinement, scoring, and conversation summarization.

The routing strategy relies on specific provider mappings per task, with graceful fallbacks across the available models within a provider if rate limits are encountered.

## Setup & Local Development
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Create a `.env.local` file with the following variables:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL="your_supabase_project_url"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"

   # LLM Provider API Keys
   GOOGLE_GENAI_API_KEY="your_gemini_key"
   ANTHROPIC_API_KEY="your_anthropic_key"
   CEREBRAS_API_KEY="your_cerebras_key" # If applicable

   # Google Drive Integration
   GOOGLE_DRIVE_FOLDER_ID="target_folder_id"
   GOOGLE_SERVICE_ACCOUNT_EMAIL="service_account_email"
   GOOGLE_PRIVATE_KEY="service_account_private_key"
   ```
4. Run Supabase migrations to ensure the vector database and caching tables are initialized.
5. Run `npm run dev` to start the Next.js development server.
6. Navigate to `http://localhost:3000`.

## Current Limitations
- **Google Drive Rate Limits:** Very large DOCX syncs may encounter Google API rate limits. The sync log will note partial completions.
- **Vector Search Quotas:** The system relies on external embedding providers. Generating recommendations for large batches of new companies may temporarily exhaust embedding quotas.
- **Incomplete Industry Data:** If a company lacks sufficient online presence, the industry resolution might fall back to "Unknown", which slightly weakens project matching accuracy.
