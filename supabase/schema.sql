-- Brand DNA Workshop: live session storage.
-- Run once in the Supabase SQL editor. RLS is on with no policies, so only the
-- server (service role key) can read or write. Browsers only use Realtime
-- broadcast with the anon key, which never touches these tables.

create table if not exists workshop_sessions (
  slug text primary key,
  current_slide text,
  overrides jsonb not null default '{}'::jsonb,
  recording_started_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists workshop_answers (
  slug text not null,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (slug, key)
);

create table if not exists workshop_events (
  id bigserial primary key,
  slug text not null,
  kind text not null check (kind in ('slide', 'marker', 'recording')),
  slide_id text,
  note text,
  at timestamptz not null default now()
);
create index if not exists workshop_events_slug_at on workshop_events (slug, at);

alter table workshop_sessions enable row level security;
alter table workshop_answers enable row level security;
alter table workshop_events enable row level security;
