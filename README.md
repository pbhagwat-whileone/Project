# Whileone Outreach Assistant

## Overview
The Whileone Outreach Assistant is an intelligent, AI-powered internal tool designed to automate and optimize the process of discovering and reaching out to potential client prospects. 

It is designed with a fundamental philosophy: **Relationship Intelligence, Warm Introductions, and Conversation-Aware Outreach are the primary differentiators of successful sales motions.** The system ingests the user's professional network, deeply analyzes target companies against proprietary knowledge of past projects, and surfaces the most relevant prospects using powerful context-aware workflows.

## Core Philosophy
The platform is built on two primary beliefs:
1. **Relationship Context > Conversation History > Company Intelligence > Generic Personalization.** The best outreach leverages real human connection.
2. **Warm Introductions > Cold Outreach.** The system aggressively prioritizes existing network connections and their extended company graphs over blindly scraping cold contacts.

## Major Features

### Connections Management
- **LinkedIn Connections CSV Import:** Seamlessly ingest and parse first-degree connections.
- **Multi-Owner Network Support:** Aggregate and track relationships across multiple team members in a single network graph.
- **Owner Statistics:** Track network footprint per team member.
- **Profile Enrichment:** Generate structured intelligence on connections.
- **Email & Location Enrichment:** Use Apollo and Tavily to automatically identify contact information and geolocate stakeholders.

### LinkedIn Messages
- **Message Import:** Ingest raw message histories to build deep conversational context.
- **Idempotent Imports & Hashing:** Safely re-import overlapping message dumps without duplicating data.
- **Conversation History:** View complete timelines of previous interactions.
- **Conversation Summaries:** Automatically extract actionable insights and historical facts from raw message threads.

### Relationship Intelligence
- **Relationship Classification:** Dynamically categorize the strength of connections.
- **Interaction Analysis:** Evaluate conversational velocity and depth.
- **Recency Analysis:** Detect stale vs. active relationships.
- **Outreach Recommendations:** Rank contacts based on their likelihood of responding to a warm re-engagement.

### Company Search
- **Company Search:** Robust resolution of company names and discovery of key contacts within organizations.
- **Relationship-First Ranking:** Emphasize companies where strong network ties already exist.
- **Conversation Access:** View historical communication directly at the company level.
- **Summarization & Email Generation:** Kick off outreach pipelines directly from the company overview.

### Company Intelligence
- **Tavily Integration:** Deep-dive live web searches to synthesize real-time company intelligence.
- **Company Context Generation:** Build comprehensive profiles of target companies, including their tech stacks and current initiatives.
- **Caching Strategy:** Intelligent 30-day persistence layers to drastically reduce API costs.
- **Relevance Evaluation:** Score companies against past project archetypes.

### Profile Enrichment
- **Tavily LinkedIn Extraction:** Synthesize rich professional profiles even without direct API access to LinkedIn.
- **Cached Profile Intelligence:** Extract and persist normalized fields:
  - Location
  - Company
  - Position
  - Expertise Tags
  - Technology Tags
  - Activity Signals

### Similar Contacts
- **Apollo Integration:** Interface with Apollo's B2B database to identify the extended buying committee.
- **Company-Level Discovery:** Discover the full organizational chart at a target company in a single, unified view.
- **Duplicate Filtering:** Exclude existing network connections to ensure recommendations are strictly **net-new stakeholders** rather than people you already know.
- **Caching:** Aggressive DB caching to protect Apollo API credits.

### Project Matching
- **Connection-Specific Project Matching:** Map a specific person's exact expertise directly to past company projects.
- **Embedding-Based Retrieval:** Use vector similarity to find historically relevant projects.
- **Profile-Driven Retrieval:** Uses extracted `Expertise Tags`, `Technology Tags`, and `Activity Signals` as inputs to the matching engine.

### Email Generation
The complete generative pipeline constructs outreach dynamically based on:
`Relationship Intelligence` + `Conversation Context` + `Company Intelligence` + `Connection-Specific Projects` + `Skill Templates` ↓ `Draft Generation`

### Knowledge Base
- **Google Drive Sync:** Automated ingestion of past project documentation (DOCX format).
- **Embeddings:** pgvector indexing of chunked documents.
- **Knowledge Chunks & Project Retrieval:** Semantic search capability to inject past performance directly into sales collateral.

## AI Architecture
The platform is powered by an abstracted LLM routing layer, explicitly moving away from OpenAI and Grok toward open-source and specialized providers:
- **Cerebras (GPT-OSS):** The primary, lightning-fast inference engine (`gpt-oss-120b`) for email generation, reasoning, and context analysis.
- **Gemini (Google):** Handles embeddings (`gemini-embedding-001`) and fallback generative tasks (`gemini-2.5-flash`, `gemini-2.0-flash`).
- **Claude (Anthropic):** Supported for advanced reasoning if explicitly requested.

*(Note: OpenAI and Grok have been entirely removed from the application architecture.)*

## Current Data Flow
The orchestration of intelligence follows a strict, layered pipeline:

```text
[Connections] ────────┐
[Messages]    ────────┤
[Knowledge Base] ─────┼───▶ [Relationship Intelligence] ───▶ [Outreach Generation]
[Tavily]      ────────┤
[Apollo]      ────────┘
```

## Environment Variables
The following environment variables are required to run the platform locally:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="your_supabase_project_url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your_supabase_anon_key"

# LLM Provider API Keys
GOOGLE_GENAI_API_KEY="your_gemini_key"
CEREBRAS_API_KEY="your_cerebras_key"
ANTHROPIC_API_KEY="your_anthropic_key" # Optional fallback

# Search & Enrichment Services
TAVILY_API_KEY="your_tavily_key"
APOLLO_API_KEY="your_apollo_key"

# Google Drive Integration
GOOGLE_DRIVE_FOLDER_ID="target_folder_id"
GOOGLE_SERVICE_ACCOUNT_EMAIL="service_account_email"
GOOGLE_PRIVATE_KEY="service_account_private_key"
```
