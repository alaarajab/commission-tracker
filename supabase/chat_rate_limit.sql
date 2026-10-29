-- Phase 0: rate limiting for the AI chatbot (/api/chat)
-- Run once in Supabase → SQL Editor.

create table if not exists public.chat_requests (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_requests_ip_time_idx
  on public.chat_requests (ip_hash, created_at desc);

create index if not exists chat_requests_time_idx
  on public.chat_requests (created_at);

-- RLS on with no policies: the public anon key can't read or write this table.
-- Only the server (service role key) can.
alter table public.chat_requests enable row level security;
