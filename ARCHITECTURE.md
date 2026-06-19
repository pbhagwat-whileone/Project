# Whileone Outreach Platform Architecture Reference

## 1. Executive Summary

The Whileone Outreach Platform is a highly intelligent, context-aware engine designed to automate and scale hyper-personalized B2B business development. The core business problem solved is the elimination of generic, template-driven "spray and pray" outreach. Instead, the platform systematically ingests historical relationship data, profile intelligence, company signals, and internal company knowledge (projects/case studies) to orchestrate highly targeted, business-outcome-driven conversations.

**Core Philosophy:** The platform rejects the idea that an email's purpose is to summarize all available intelligence. Its sole purpose is to create interest in a conversation. 

To achieve this, the architecture strictly enforces two hierarchies:

**Context Priority:**
`Relationship Context > Conversation Context > Company Context > Generic Personalization`

**Relationship Warmth:**
`Warm Introductions > Cold Outreach`

These principles drive the entire architecture. The system is fundamentally designed to act as an intelligence router—selecting the single best angle and the single strongest proof point, and explicitly ignoring excess data to prevent "AI-sounding" intelligence dumps.

---

## 2. System Overview

The platform operates on a modern, serverless-friendly stack utilizing external AI and data providers to offload heavy computation.

* **Frontend:** Next.js 16 (App Router) — Provides the React-based presentation layer, dashboard, and settings interfaces.
* **Backend:** Next.js API Routes — Handles orchestration, external API communication, and LLM prompt assembly.
* **Database:** Supabase (PostgreSQL) — Acts as the primary operational database, handling persistence, user isolation, and caching.
* **AI Layer:** 
  * **Gemini (Google):** The primary and exclusive LLM engine handling generation, intelligence extraction, relationships analysis, and text embeddings (`text-embedding-004`).
* **External Services:**
  * **pgvector:** PostgreSQL extension used within Supabase for semantic vector search over knowledge chunks.
  * **Tavily:** Search API for live company and profile intelligence retrieval.
  * **Apollo:** B2B data provider for stakeholder discovery (similar contacts).
  * **Google Drive / Google OAuth:** Ingests internal documentation directly from user drives.

**Responsibilities:** The frontend handles user intent; the backend coordinates data pipelines; Supabase stores state and vectors; Tavily/Apollo fetch external reality; and Gemini synthesizes the data into structured outputs.

---

## 3. High-Level System Architecture

The complete architecture operates across six logical layers:

1. **Presentation Layer (Next.js UI):** 
   * **Purpose:** User interaction, file uploading (CSVs), and reviewing generated drafts.
   * **Dependencies:** Business Logic Layer.
2. **Business Logic Layer (Next.js API & Services):** 
   * **Purpose:** Pipeline orchestration. Coordinates imports, triggers background enrichment tasks, and manages data flow.
   * **Dependencies:** Intelligence Layer, Retrieval Layer, Persistence Layer.
3. **Intelligence Layer (Gemini):** 
   * **Purpose:** Transforms unstructured data (messages, search results) into structured JSON intelligence (e.g., extracting temporal context, scoring relationships).
   * **Dependencies:** Gemini API.
4. **Retrieval Layer (pgvector / Gemini):** 
   * **Purpose:** Semantic search. Matches profile/company intelligence against the internal knowledge base to find relevant project proof points.
   * **Dependencies:** Supabase RPCs, Gemini Embeddings.
5. **Persistence Layer (Supabase / Postgres):** 
   * **Purpose:** State management, caching, and user isolation via Row Level Security (RLS) / explicit `user_id` filtering.
6. **External Integration Layer (Tavily, Apollo, Google):** 
   * **Purpose:** Bridges the platform to the outside world for live data gathering.

---

## 4. User Authentication Flow

The platform relies on Supabase Auth, combined with Google OAuth for Drive access.

* **Login Flow:** User authenticates via Supabase (Email/Password or OAuth). Supabase issues a JWT.
* **Session Flow:** Next.js middleware and server components verify the Supabase session token on every request.
* **Google OAuth:** When a user links Google Drive, an OAuth flow is initiated. The `access_token` and `refresh_token` are securely stored in the `google_tokens` table.
* **User Isolation:** The platform uses a strict multi-tenant model. Every single operational table (`connections`, `prospects`, `knowledge_documents`, `linkedin_messages`) contains a `user_id` column. All queries filter by `user_id`, ensuring absolute data isolation between team members.

---

## 5. Knowledge Base Architecture

The Knowledge Base transforms unstructured internal documents into searchable semantic vectors used for proof points.

**End-to-End Flow:**
`Google Drive ↓ Document Sync ↓ Document Parsing ↓ Chunking ↓ Embeddings ↓ Vector Storage ↓ Retrieval`

* **Google Drive Sync:** The system periodically polls connected folders defined in `user_settings`.
* **Parsing:** Supports multiple formats: DOCX (via `mammoth`), PDFs, Google Docs (via Google API export), and Google Sheets.
* **Chunking Strategy:** Documents are broken into semantically meaningful chunks (typically paragraph or section-level).
* **Embedding Generation:** Each chunk's text is sent to the Gemini Embedding API to generate a high-dimensional vector array.
* **Vector Storage:** Stored in the `knowledge_chunks` table utilizing the `pgvector` extension for efficient indexing (IVFFlat/HNSW).
* **Knowledge Ownership:** Documents and chunks are tied to a `document_id`, which is tied to a `user_id` in `knowledge_documents`.

---

## 6. Connections Architecture

Connections are the core entity for outreach.

**End-to-End Flow:**
`LinkedIn CSV ↓ Import ↓ Normalization ↓ Ownership ↓ Storage`

* **Import & Normalization:** Users upload LinkedIn connection CSVs. The system parses names, companies, positions, and URLs.
* **Deduplication:** Connections are uniquely identified and deduplicated by `profile_url` and `user_id`. 
* **Multi-Owner Support:** Because multiple users might connect with the same person, the `connection_owner_name` field tracks which user's network this connection belongs to, preserving context for "warm introductions."
* **Lifecycle:** Connections begin raw, and are progressively enriched with profiles and relationship metrics.

---

## 7. Messages Architecture

Messages provide the historical context required for relationship and conversation intelligence.

**End-to-End Flow:**
`LinkedIn Messages CSV ↓ Import ↓ Hashing ↓ Deduplication ↓ Storage`

* **Import & Hashing:** When an archive is uploaded, the system generates a unique `message_hash` (typically an MD5 of sender, receiver, date, and content).
* **Idempotent Imports:** The `message_hash` ensures that re-uploading the same CSV does not result in duplicate messages.
* **Sender Attribution:** Normalizes "From" and "To" to reconstruct the timeline accurately.
* **Conversation Reconstruction:** Messages are grouped by `conversation_id` to provide chronological transcripts to the Intelligence Layer.

---

## 8. Profile Enrichment Architecture

To select the best outreach angle, raw connections must be enriched with live external data.

**End-to-End Flow:**
`Connection ↓ Tavily Search ↓ Profile Extraction ↓ LLM Structuring ↓ Persistence`

* **Tavily Search:** The system executes targeted searches combining the connection's name, company, and role.
* **LLM Structuring:** The raw search results are fed into Gemini, which is instructed to extract JSON arrays of specific entities.
* **Data Extracted:**
  * `expertise_tags` (e.g., "Cloud Architecture")
  * `technology_tags` (e.g., "Kubernetes", "AWS")
  * `activity_signals` (e.g., "Recently spoke at KubeCon")
  * `location`, `education`, `certifications`
* **Caching Strategy:** Data is stored in `connection_profiles` with an `enriched_at` timestamp. Refresh behavior occurs only if the data is older than a specific threshold or manually triggered.

---

## 9. Relationship Intelligence Architecture

Determines *how* we speak to the person based on past interactions.

**End-to-End Flow:**
`Messages ↓ Relationship Analysis ↓ Classification ↓ Skill Selection`

* **Analysis:** All historical messages are fed to Gemini.
* **Classification Outputs:**
  * **Relationship Types:** (e.g., `warm-relationship`, `cold-outreach`, `past-customer`, `dormant-relationship`).
  * **Confidence Scoring:** Validates the classification accuracy.
  * **Outreach Goal:** (e.g., `opportunity_exploration`, `reconnect`).
  * **Capability Prominence:** (`low`, `medium`, `high`). Determines how aggressively Whileone services should be pitched.
* **Skill Selection:** The `relationship_type` directly maps to a specific markdown file in the `skills/` directory (e.g., `skills/dormant-relationship.md`), injecting explicit tone and familiarity rules into the final prompt.

---

## 10. Conversation Intelligence Architecture

Operates alongside Relationship Intelligence to extract usable facts from historical messages.

**End-to-End Flow:**
`Messages ↓ Conversation Analysis ↓ Persistent Context ↓ Time-Bound Context ↓ Relationship Memory`

* **Categorization:**
  * **Persistent Context:** Enduring facts (e.g., "Deepak prefers deep technical details", "Their team uses mostly PyTorch").
  * **Time-Bound Context:** Events tied to a specific date (e.g., "Going on vacation next week").
* **Temporal Reasoning:** The LLM is instructed to identify time-bound events.
* **Stale Context Prevention:** During email generation, if the `last_interaction_date` is > 180 days, time-bound context is strictly treated as historical (e.g., "Hope your trip went well") to prevent embarrassing mistakes. If > 365 days, it is ignored entirely.

---

## 11. Company Intelligence Architecture

Determines "Why Now?" by finding corporate momentum.

**End-to-End Flow:**
`Company ↓ Tavily ↓ Analysis ↓ Relevance Scoring ↓ Caching`

* **Analysis:** Searches for recent news, initiatives, and hiring trends regarding the company.
* **Relevance Scoring:** Evaluates the findings and outputs a `CompanyContextRelevance` score. 
* **Downstream Usage:** If `recommendedUsage` is `ignore`, it is stripped from the prompt. Otherwise, it is strictly used in Block 2 (Reason for Outreach) to answer "Why now?" and is explicitly prevented from dominating the email body.

---

## 12. Project Matching Architecture

Finds the strongest proof point for the outreach angle.

**End-to-End Flow:**
`Profile Intelligence ↓ Query Construction ↓ Embedding Generation ↓ Vector Search ↓ Ranking ↓ Caching`

* **Query Generation:** The system uses the connection's `technology_tags` and `activity_signals` to construct an optimized natural language search query.
* **Embedding:** Gemini converts this query into a vector.
* **Vector Search:** A Supabase RPC (`match_knowledge_chunks`) performs a cosine similarity search against `knowledge_chunks` using `pgvector`.
* **Ranking Logic:** Results are ordered by similarity. The top result becomes the *primary* project evidence.
* **Email Usage:** The matched chunk text is provided to the email generator. The generator is strictly instructed to extract business outcomes rather than technical jargon to prove capability.

---

## 13. Similar Contacts Architecture

Allows discovery of alternative stakeholders within a targeted company.

**End-to-End Flow:**
`Company ↓ Apollo Search ↓ Stakeholder Discovery ↓ Filtering ↓ Caching`

* **Search:** Calls Apollo's people search API using the target company domain.
* **Filtering:** Explicitly excludes individuals already present in the user's `connections` table to prevent redundant outreach.
* **Caching:** Results are stored as JSON in `company_similar_contacts_cache` to minimize expensive Apollo API calls.

---

## 14. Company Recommendation Engine

Surfaces the most lucrative companies to target.

**End-to-End Flow:**
`Connections + Messages + Intelligence ↓ Scoring ↓ Ranking`

* **Score Generation:** A weighted algorithm aggregates data:
  * `project_relevance_score` (How well they match our knowledge base)
  * `connection_score` (Volume and warmth of existing connections)
  * `seniority_score` (Density of decision-makers in the network)
* **Company Page Behavior:** Drives the dashboard and company lists, prioritizing companies with high scores and strong warm relationships.

---

## 15. Email Generation Architecture

The culmination of the platform. Executes the Strategic Redesign rules.

**End-to-End Flow:**
`Intelligence Gathering ↓ Project Matching ↓ Skill Selection ↓ Prompt Construction ↓ LLM Generation ↓ Email Output`

### Prompt Assembly
The pipeline merges the dynamic Context Hierarchy with the Markdown file from `skills/[relationship].md` and the system-wide `WHILEONE_MESSAGING_RULES`.

### Internal Planning Stage
The LLM is forced to output JSON containing an `internal_planning` key. Before writing the email body, it must answer: *Why this person? Why this company? Why now? Best angle? Strongest proof?* This prevents context-dumping in the actual email.

### Output Structure
The generated email strictly adheres to 7 blocks:
* **Block 1:** Greeting
* **Block 2:** Reason for outreach (1 sentence)
* **Block 3:** Relevant Industry Challenge (Max 2 sentences)
* **Block 4:** Whileone Proof
* **Block 5:** Supporting Evidence (Max 3 outcome bullets)
* **Block 6:** CTA
* **Block 7:** Attachment Mention (If configured)

---

## 16. Discover Architecture

Surfaces events, trends, and conferences for temporal outreach angles.

**End-to-End Flow:**
`Technology Categories ↓ Event Discovery ↓ Tavily ↓ Extraction ↓ Filtering ↓ Caching`

* **Event Generation:** Periodically searches for upcoming industry events related to core capabilities (AI, Cloud, HPC).
* **Extraction:** Gemini parses unstructured search results into structured event schemas (Name, Date, URL, Relevance).
* **Caching:** Cached via Supabase (`discover_events_cache`) to drive the Discover UI using non-blocking background refreshes.

---

## 17. AI Architecture

The platform utilizes a dynamic, robust AI generation pipeline (`src/services/ai/generation/generation.ts`).

* **Gemini (Google):** The sole LLM provider handling prompt execution, schema-constrained generation (strict JSON outputs), relationship classification, inference, and text embeddings via the `@google/genai` SDK.

---

## 18. Database Architecture

**Core Tables:**
* `profiles`: User accounts. Tied to Supabase Auth.
* `user_settings`: User preferences, Drive folder IDs.
* `google_tokens`: OAuth tokens for Drive Sync.
* `connections`: Central entity for people.
* `connection_profiles`: Enriched Tavily data. 
* `linkedin_messages`: Raw message history. Deduplicated by hash.
* `connection_relationship_metrics`: AI-analyzed intelligence derived from messages.
* `knowledge_documents`: Metadata about synced files.
* `knowledge_chunks`: pgvector table containing embedded document slices.
* `generated_emails`: Audit log and history of all generated content.
* `prospects` / `prospect_analysis`: Pipeline tracking for manual targets.
* `sync_logs`: Audit trail for knowledge base sync operations.

**Cache Tables:**
* `company_context_cache`: Stores Tavily company analysis. Features TTL/`expires_at`.
* `company_industry_cache`: Normalizes company names to industries/sizes.
* `company_score_cache`: Stores aggregated recommendation scores.
* `company_similar_contacts_cache`: Stores Apollo API results.
* `discover_events_cache`: Stores generated industry events.

---

## 19. Caching Architecture

Caching is vital to prevent runaway API costs (Tavily/Apollo/LLMs).

* **Profile Cache (`connection_profiles`):** Soft TTL. Refreshed manually via UI or via background tasks.
* **Company Context (`company_context_cache`):** Hard TTL via `expires_at` column. Ensures "Why Now" signals remain fresh but aren't queried on every email generation.
* **Similar Contacts (`company_similar_contacts_cache`):** Results are heavily cached because corporate structures change slowly. Invalidation occurs manually or after 30+ days.
* **Discover Events (`discover_events_cache`):** Uses a Serve-Stale-Refresh-Background pattern to provide instant reads while updating asynchronously.

---

## 20. API Architecture

Next.js API routes (`app/api/`) serve as the network boundary.

* **`/api/connections`:** Handles CSV imports, triggers idempotent upserts, and orchestrates background profile enrichment.
* **`/api/knowledge`:** Interfaces with Google APIs to pull document streams, chunks them, calls Gemini for embeddings, and persists to pgvector.
* **`/api/emails`:** The generation controller. Gathers data from 5+ database tables, constructs the prompt, invokes the AI generation module, and returns the JSON payload.
* **`/api/discover/events`:** Exposes cached events and triggers non-blocking background refreshes.
* **`/api/google`:** OAuth callback handlers and token refresh logic.

**Flow Rule:** APIs strictly return structured JSON. They do not maintain state, pushing all state to Supabase.

---

*This document serves as the single source of truth for the Whileone Outreach architecture. It provides the logical blueprints necessary to generate detailed sequence, data-flow, and entity-relationship diagrams.*
