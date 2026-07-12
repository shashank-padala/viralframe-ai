-- Real pipeline state: replaces the fake setTimeout step animation with a real
-- progress signal the frontend can subscribe to via Supabase Realtime, plus
-- storage for the transcript and per-scene b-roll clips the pipeline produces.

alter table public.projects
  add column pipeline_stage text
    check (pipeline_stage in (
      'transcribing', 'writing_hooks', 'generating_broll', 'rendering',
      'generating_cover', 'ready', 'failed'
    )),
  add column error_message text,
  add column transcript jsonb;

create table public.broll_clips (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  scene_index int not null,
  prompt text not null,
  model text not null,
  status text not null default 'pending'
    check (status in ('pending', 'generating', 'ready', 'failed')),
  storage_path text,
  created_at timestamptz not null default now()
);

create index broll_clips_project_id_idx on public.broll_clips (project_id);

alter table public.broll_clips enable row level security;

create policy "broll_clips_select_own"
  on public.broll_clips for select
  to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = broll_clips.project_id
        and projects.user_id = (select auth.uid())
    )
  );

create policy "broll_clips_insert_own"
  on public.broll_clips for insert
  to authenticated
  with check (
    exists (
      select 1 from public.projects
      where projects.id = broll_clips.project_id
        and projects.user_id = (select auth.uid())
    )
  );

create policy "broll_clips_update_own"
  on public.broll_clips for update
  to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = broll_clips.project_id
        and projects.user_id = (select auth.uid())
    )
  );

create policy "broll_clips_delete_own"
  on public.broll_clips for delete
  to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = broll_clips.project_id
        and projects.user_id = (select auth.uid())
    )
  );
