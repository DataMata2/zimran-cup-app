-- Schema for the app. Run in the Supabase SQL editor.
-- The server talks to Supabase with the service role key only, so RLS is on
-- with no policies: anon/authenticated clients cannot read or write anything.

create table if not exists public.guests (
  id uuid primary key,
  created_at timestamptz not null default now(),
  plan text not null default 'free',
  pro_since timestamptz,
  stripe_customer_id text,
  stripe_session_id text unique
);

alter table public.guests enable row level security;

-- Used by /api/health to test a write + read round trip.
create table if not exists public.health_checks (
  id bigserial primary key,
  at timestamptz not null default now()
);

alter table public.health_checks enable row level security;
