-- Phase 4: public demo accounts + nightly reset
-- Run once in Supabase → SQL Editor, AFTER the Phase 3 SQL.
-- Then create the two demo logins (see the steps at the end of this file).

-- 1. The two demo agents (each will get a login)
insert into public.agents (name, email, role)
values
  ('Demo Admin', 'demo-admin@example.com', 'admin'),
  ('Demo Agent', 'demo-agent@example.com', 'agent')
on conflict (email) do nothing;

-- 2. Sample sales for Demo Agent, so the agent view isn't empty (only added once)
do $$
declare
  demo_agent uuid := (select id from public.agents where email = 'demo-agent@example.com');
  s1 uuid; s2 uuid; s3 uuid;
begin
  if not exists (select 1 from public.sales where agent_id = demo_agent) then
    insert into public.sales (property_address, sale_amount, sale_date, status, agent_id)
      values ('12 Demo Lane', 650000, current_date - 40, 'paid', demo_agent) returning id into s1;
    insert into public.sales (property_address, sale_amount, sale_date, status, agent_id)
      values ('48 Sample Ave', 420000, current_date - 15, 'approved', demo_agent) returning id into s2;
    insert into public.sales (property_address, sale_amount, sale_date, status, agent_id)
      values ('7 Preview Ct', 515000, current_date - 3, 'pending', demo_agent) returning id into s3;

    insert into public.commissions (sale_id, agent_id, amount, paid_at) values
      (s1, demo_agent, 650000 * 0.03, now() - interval '30 days'),
      (s2, demo_agent, 420000 * 0.03, null),
      (s3, demo_agent, 515000 * 0.03, null);
  end if;
end $$;

-- 3. Which logins are demo logins (used by the lock rule below)
create table if not exists public.demo_accounts (
  email text primary key
);
alter table public.demo_accounts enable row level security; -- no policies: server/database only
insert into public.demo_accounts (email)
values ('demo-admin@example.com'), ('demo-agent@example.com')
on conflict do nothing;

-- 4. Lock the demo logins: nobody can change their password or email
--    (otherwise one visitor could lock every other visitor out)
create or replace function public.lock_demo_accounts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.demo_accounts where lower(email) = lower(old.email))
     and (
       new.encrypted_password is distinct from old.encrypted_password
       or new.email is distinct from old.email
       or coalesce(new.email_change, '') <> coalesce(old.email_change, '')
     )
  then
    raise exception 'DEMO_LOCKED: demo accounts cannot change their password or email';
  end if;
  return new;
end;
$$;

drop trigger if exists lock_demo_accounts on auth.users;
create trigger lock_demo_accounts
  before update on auth.users
  for each row execute function public.lock_demo_accounts();

-- 5. Snapshot of the "clean" data that the nightly reset restores
create table if not exists public.demo_seed_agents (like public.agents);
create table if not exists public.demo_seed_sales (like public.sales);
create table if not exists public.demo_seed_commissions (like public.commissions);
alter table public.demo_seed_agents enable row level security;
alter table public.demo_seed_sales enable row level security;
alter table public.demo_seed_commissions enable row level security;

-- Save the current data as the clean version.
-- Run `select public.save_demo_seed();` again any time you change the data on purpose.
create or replace function public.save_demo_seed()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  truncate public.demo_seed_agents, public.demo_seed_sales, public.demo_seed_commissions;
  insert into public.demo_seed_agents select * from public.agents;
  insert into public.demo_seed_sales select * from public.sales;
  insert into public.demo_seed_commissions select * from public.commissions;
end;
$$;

-- Put the data back to the snapshot
create or replace function public.reset_demo_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sales and commissions: back to exactly the snapshot
  delete from public.commissions where true;
  delete from public.sales where true;

  -- Agents: remove ones visitors added, restore names/emails/roles.
  -- Logins (user_id) are kept, so real and demo users stay linked.
  delete from public.agents a
  where not exists (select 1 from public.demo_seed_agents s where s.id = a.id);

  update public.agents a
  set name = s.name, email = s.email, role = s.role
  from public.demo_seed_agents s
  where s.id = a.id
    and (a.name, a.email, a.role) is distinct from (s.name, s.email, s.role);

  insert into public.sales select * from public.demo_seed_sales;
  insert into public.commissions select * from public.demo_seed_commissions;

  -- Tidy up old chat rate-limit rows
  delete from public.chat_requests where created_at < now() - interval '2 days';
end;
$$;

-- These are for the database itself, not for the public API
revoke execute on function public.save_demo_seed() from public, anon, authenticated;
revoke execute on function public.reset_demo_data() from public, anon, authenticated;
revoke execute on function public.lock_demo_accounts() from public, anon, authenticated;

-- Take the first snapshot now (includes the demo agents and their sales)
select public.save_demo_seed();

-- 6. Reset every night at 08:00 UTC (3 AM Chicago in summer, 2 AM in winter)
create extension if not exists pg_cron;
select cron.schedule('reset-demo-data', '0 8 * * *', 'select public.reset_demo_data()');

-- ---------------------------------------------------------------------------
-- AFTER RUNNING THIS: create the two demo logins in the dashboard
--   Authentication → Users → Add user → Create new user
--     Email: demo-admin@example.com   Password: (your demo password)   ✔ Auto Confirm User
--     Email: demo-agent@example.com   Password: (same demo password)   ✔ Auto Confirm User
-- The Phase 3 trigger links each login to its agent row automatically.
-- ---------------------------------------------------------------------------
