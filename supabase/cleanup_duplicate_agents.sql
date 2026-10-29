-- Data cleanup, 2026-10-27 (already applied in Supabase — record only, do not re-run)
--
-- Problem: duplicate agent rows made the chatbot's agent lookup
-- (.ilike(...).single()) fail, so it answered "no agent named Zain".
-- Found with:
--   select email, count(*) from agents group by email having count(*) > 1;

-- 1. Remove the duplicate "Zain" agent and its duplicate sale + commission
--    (same address, amount and date as the kept Zain's sale)
begin;
delete from commissions where agent_id = '1824bb20-2c79-40f8-a3b1-ce49d29e62c6';
delete from sales       where agent_id = '1824bb20-2c79-40f8-a3b1-ce49d29e62c6';
delete from agents      where id       = '1824bb20-2c79-40f8-a3b1-ce49d29e62c6';
commit;

-- 2. Remove two test agents that reused existing emails (no sales, no commissions),
--    then stop duplicate emails at the database level
begin;
delete from agents
where id in (
  '33893775-5632-42ea-9e45-a5aee0bb9b6c',  -- ffff  (reused Moh's email)
  '7bb02c5c-8a0b-4f22-b60a-0ba1f08c4d85'   -- onyy  (reused Zain's email)
)
and not exists (select 1 from sales s where s.agent_id = agents.id);

alter table agents
add constraint agents_email_unique unique (email);
commit;
