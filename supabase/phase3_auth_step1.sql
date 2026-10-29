-- Phase 3, step 1: logins linked to agents (invite-only)
-- Safe to run while the old app is live: it only ADDS things; nothing is locked yet.
-- (The old "anyone can read" rules are removed later, in step 2.)
-- Run once in Supabase → SQL Editor.

-- 1. Each agent row can be linked to one Supabase login
alter table public.agents
  add column if not exists user_id uuid unique references auth.users (id) on delete set null;

-- 2. Helpers used by the security rules (RLS) in step 2.
--    "security definer" lets them read agents even when RLS would hide the row.
create or replace function public.current_agent_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.agents where user_id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.agents where user_id = auth.uid() and role = 'admin'
  )
$$;

-- 3. Invite-only: refuse sign-ups whose email isn't an existing, unclaimed agent
create or replace function public.check_invited_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.agents
    where lower(email) = lower(new.email) and user_id is null
  ) then
    raise exception 'NOT_INVITED: % is not an invited agent email', new.email;
  end if;
  return new;
end;
$$;

drop trigger if exists check_invited_email on auth.users;
create trigger check_invited_email
  before insert on auth.users
  for each row execute function public.check_invited_email();

-- 4. Link the login to the agent row only once the email is confirmed
--    (so nobody can claim an agent's account with an email they don't own)
create or replace function public.link_agent_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null then
    update public.agents
    set user_id = new.id
    where lower(email) = lower(new.email) and user_id is null;
  end if;
  return new;
end;
$$;

drop trigger if exists link_agent_on_confirm on auth.users;
create trigger link_agent_on_confirm
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.link_agent_on_confirm();

-- 5. Read rules for logged-in users (added NEXT TO the old rules for now).
--    Admins see everything; agents see only their own rows.
alter table public.agents enable row level security;
alter table public.sales enable row level security;
alter table public.commissions enable row level security;

drop policy if exists "agents: read own row, admins read all" on public.agents;
create policy "agents: read own row, admins read all"
  on public.agents for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "sales: read own, admins read all" on public.sales;
create policy "sales: read own, admins read all"
  on public.sales for select to authenticated
  using (agent_id = public.current_agent_id() or public.is_admin());

drop policy if exists "commissions: read own, admins read all" on public.commissions;
create policy "commissions: read own, admins read all"
  on public.commissions for select to authenticated
  using (agent_id = public.current_agent_id() or public.is_admin());
