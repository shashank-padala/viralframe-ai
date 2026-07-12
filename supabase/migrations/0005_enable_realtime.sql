-- processing-client.tsx subscribes to postgres_changes on projects to show
-- real pipeline progress; without this the table isn't part of the
-- Realtime publication and no change events are ever sent.
alter publication supabase_realtime add table public.projects;
