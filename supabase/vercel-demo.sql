-- Database-backed guest demo for Vercel. Not production marketplace accounts.
-- Execute once in Supabase's SQL editor. Schema is inaccessible to client roles.
create table if not exists public.waka_demo_workspaces (
  owner_id text primary key,
  payload jsonb not null,
  version bigint not null default 0 check (version >= 0)
);
alter table public.waka_demo_workspaces enable row level security;
revoke all on table public.waka_demo_workspaces from public, anon, authenticated;
grant select, insert, update on table public.waka_demo_workspaces to service_role;
