# WhileOne AI Client Outreach Assistant

Internal web application for syncing project knowledge from Google Drive, matching LinkedIn connections to target companies, and generating personalized outreach emails with Gemini AI.

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript**, **Tailwind CSS**, **shadcn/ui**
- **Supabase** (PostgreSQL, Auth, pgvector)
- **Google Drive & Docs API**, **Gemini 2.5 Pro**, **Gemini Embeddings**

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in values:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server only) |
| `NEXT_PUBLIC_APP_URL` | App URL for OAuth callbacks (`http://localhost:3000`) |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `GOOGLE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_DRIVE_FOLDER_ID` | Default Drive folder ID (optional if set in Settings) |

### 3. Supabase setup

1. Create a Supabase project.
2. Run the SQL migration in `supabase/migrations/001_initial_schema.sql` via the Supabase SQL Editor (or CLI).
3. Enable **Google** provider under Authentication → Providers.
4. Add redirect URL: `http://localhost:3000/auth/callback` (and production URL).
5. In Google Cloud Console, add OAuth redirect URIs:
   - `https://<project-ref>.supabase.co/auth/v1/callback` (Supabase Auth)
   - `http://localhost:3000/api/google/callback` (Drive API)

### 4. Google Cloud setup

1. Enable **Google Drive API** and **Google Docs API**.
2. Create OAuth 2.0 credentials (Web application).
3. Add authorized redirect URIs (see above).
4. For Drive sync, users connect Drive from **Settings** (separate OAuth with `drive.readonly` + `documents.readonly` scopes).

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Application Routes

| Route | Description |
|-------|-------------|
| `/dashboard` | Stats, recent sync activity, quick actions |
| `/knowledge-base` | Document sync from Google Drive |
| `/connections` | LinkedIn CSV upload and search |
| `/search-company` | Fuzzy company match + semantic project search + email |
| `/prospects` | CRM for target companies, analysis, outreach workflow |
| `/emails` | Generated email history |
| `/settings` | Drive folder ID, Google connection, sync status |

## LinkedIn CSV Format

Expected columns (LinkedIn export):

- First Name, Last Name, Company, Position, Email Address, Profile URL, Connected On

## Project Structure

```
app/             # App Router routes and API handlers
src/
  components/    # UI and layout
  features/      # Page-level feature views
  lib/           # Supabase clients, validators, utilities
  services/      # Business logic (sync, embeddings, email)
  ai/            # Gemini client config
  google/        # OAuth helpers
  types/         # TypeScript database types
  utils/         # Chunking, matching, ranking
supabase/
  migrations/    # PostgreSQL schema + pgvector
```

## Knowledge Base Sync

Manual sync only (no cron). On sync:

- **New** Drive files → ingest, chunk (~500 tokens, 50 overlap), embed, store
- **Modified** files → reprocess chunks
- **Deleted** files → remove from database

Configure folder ID in **Settings**, connect Google Drive, then use **Sync** on Dashboard or Knowledge Base.

## Security Notes

- Service role key is server-side only (`lib/supabase/admin.ts`).
- All API inputs validated with Zod.
- Row Level Security enabled on all user tables.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — production server
- `npm run lint` — ESLint
