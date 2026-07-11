-- ViralFrame AI: core schema
-- profiles (1:1 with auth.users), projects (one per uploaded video), reel_variations
-- (AI-suggested hook variants for a project's results page).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id);

-- auto-create a profile row whenever a new auth user signs up
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- projects ------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'Untitled reel',
  platform text not null default 'reel'
    check (platform in ('reel', 'tiktok', 'shorts')),
  style text not null default 'business',
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'ready', 'failed')),
  layout text not null default 'top'
    check (layout in ('top', 'bottom', 'full')),
  caption_style text not null default 'Hormozi style',
  current_hook text,
  source_video_path text not null,
  cover_image_path text,
  output_video_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_id_idx on public.projects (user_id);

alter table public.projects enable row level security;

create policy "projects_select_own"
  on public.projects for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "projects_insert_own"
  on public.projects for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "projects_update_own"
  on public.projects for update
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "projects_delete_own"
  on public.projects for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- reel_variations -------------------------------------------------------------

create table public.reel_variations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  label text not null,
  hook text not null,
  is_selected boolean not null default false,
  created_at timestamptz not null default now()
);

create index reel_variations_project_id_idx on public.reel_variations (project_id);

alter table public.reel_variations enable row level security;

create policy "reel_variations_select_own"
  on public.reel_variations for select
  to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = reel_variations.project_id
        and projects.user_id = (select auth.uid())
    )
  );

create policy "reel_variations_insert_own"
  on public.reel_variations for insert
  to authenticated
  with check (
    exists (
      select 1 from public.projects
      where projects.id = reel_variations.project_id
        and projects.user_id = (select auth.uid())
    )
  );

create policy "reel_variations_update_own"
  on public.reel_variations for update
  to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = reel_variations.project_id
        and projects.user_id = (select auth.uid())
    )
  );

create policy "reel_variations_delete_own"
  on public.reel_variations for delete
  to authenticated
  using (
    exists (
      select 1 from public.projects
      where projects.id = reel_variations.project_id
        and projects.user_id = (select auth.uid())
    )
  );

-- storage ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values
  ('source-videos', 'source-videos', false),
  ('reel-exports', 'reel-exports', false);

-- Files are stored under `${auth.uid()}/${project_id}/filename`, so the first
-- path segment doubles as the ownership check.

create policy "source_videos_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'source-videos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "source_videos_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'source-videos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "source_videos_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'source-videos'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "reel_exports_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'reel-exports'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "reel_exports_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'reel-exports'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

create policy "reel_exports_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'reel-exports'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
