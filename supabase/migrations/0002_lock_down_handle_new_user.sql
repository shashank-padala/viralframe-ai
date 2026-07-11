-- Supabase advisor flagged handle_new_user() as a SECURITY DEFINER function
-- publicly callable via REST RPC (/rest/v1/rpc/handle_new_user). It's only
-- meant to run via the on_auth_user_created trigger, so revoke direct
-- execute access instead of leaving it open to anon/authenticated callers.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
