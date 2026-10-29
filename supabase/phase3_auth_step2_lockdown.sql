-- Phase 3, step 2: remove the old "anyone can read" rules
-- Run ONLY AFTER the login version of the app is deployed and you can sign in as admin.
-- After this, logged-out visitors can't read anything; agents only see their own data.
-- (The new logged-in read rules were already added in step 1.)

do $$
declare
  p record;
begin
  for p in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('agents', 'sales', 'commissions')
      and policyname not in (
        'agents: read own row, admins read all',
        'sales: read own, admins read all',
        'commissions: read own, admins read all'
      )
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    raise notice 'Removed old policy "%" on %', p.policyname, p.tablename;
  end loop;
end $$;

-- Writes have no policies, so only the server (service role key) can write,
-- and the API routes check that the caller is an admin.

-- Check: should list only the three "read own" policies
select tablename, policyname, roles from pg_policies
where schemaname = 'public' and tablename in ('agents', 'sales', 'commissions');
