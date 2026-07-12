-- Real pipeline calls now cost real money per upload. The dashboard already
-- showed a "3 free videos/month" counter but never enforced it -- this
-- closes that gap server-side (can't be bypassed by calling the client SDK
-- directly), independent of whatever client-side pre-check the UI adds.
create function public.enforce_free_tier_upload_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_plan text;
  monthly_count int;
begin
  select plan into user_plan from public.profiles where id = new.user_id;

  if user_plan is distinct from 'free' then
    return new;
  end if;

  select count(*) into monthly_count
  from public.projects
  where user_id = new.user_id
    and created_at >= date_trunc('month', now());

  if monthly_count >= 3 then
    raise exception 'Free plan is limited to 3 videos per month. Upgrade to continue.';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_free_tier_upload_limit() from public, anon, authenticated;

create trigger projects_enforce_free_tier_limit
  before insert on public.projects
  for each row execute function public.enforce_free_tier_upload_limit();
