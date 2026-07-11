-- User-selectable AI model for b-roll scene generation. Stock footage was
-- ruled out (quality bar too low for the creator's own use case); the
-- generation step itself is not wired up yet, this just persists the choice.

alter table public.projects
  add column broll_model text not null default 'kling'
    check (broll_model in ('kling', 'runway', 'luma', 'veo'));
