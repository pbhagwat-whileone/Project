create table public.connection_project_cache (
  connection_id uuid primary key references public.connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  retrieval_query text not null,
  matched_projects jsonb not null default '[]'::jsonb,
  generated_at timestamp with time zone not null default now()
);

-- RLS policies
alter table public.connection_project_cache enable row level security;

create policy "Users can view their own connection project caches"
  on public.connection_project_cache for select
  using (auth.uid() = user_id);

create policy "Users can insert their own connection project caches"
  on public.connection_project_cache for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own connection project caches"
  on public.connection_project_cache for update
  using (auth.uid() = user_id);

create policy "Users can delete their own connection project caches"
  on public.connection_project_cache for delete
  using (auth.uid() = user_id);
