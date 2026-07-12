-- Lets a project render landscape (16:9) instead of the default vertical
-- (9:16). Default preserves existing behavior for all current rows.
alter table public.projects
  add column output_aspect_ratio text not null default '9:16'
    check (output_aspect_ratio in ('9:16', '16:9'));
