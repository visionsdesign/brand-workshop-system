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

-- ---------------------------------------------------------------------------
-- Portal: access codes, client workshops, uploaded files.
-- Same rule: RLS on, no policies; only the server's service role key reads or writes.

create table if not exists portal_codes (
  code text primary key,
  tier text not null check (tier in ('guided', 'self_serve')),
  label text,
  max_uses int not null default 1,
  uses int not null default 0,
  expires_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists portal_workshops (
  id uuid primary key,
  token text not null unique,
  code text references portal_codes (code),
  tier text not null check (tier in ('guided', 'self_serve')),
  status text not null default 'intake',
  client_name text not null,
  contact_name text not null,
  contact_email text not null,
  intake jsonb not null default '{}'::jsonb,
  intake_done boolean not null default false,
  drive_folder_url text,
  team_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists portal_files (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references portal_workshops (id) on delete cascade,
  name text not null,
  size bigint not null default 0,
  type text,
  path text not null,
  uploaded_by text not null check (uploaded_by in ('client', 'team')),
  created_at timestamptz not null default now()
);
create index if not exists portal_files_workshop on portal_files (workshop_id, created_at);

alter table portal_codes enable row level security;
alter table portal_workshops enable row level security;
alter table portal_files enable row level security;

-- Private storage bucket for uploads (50 MB per file). Files are only reached
-- through short-lived signed URLs the server creates after checking access.
insert into storage.buckets (id, name, public, file_size_limit)
values ('workshop-files', 'workshop-files', false, 52428800)
on conflict (id) do nothing;
