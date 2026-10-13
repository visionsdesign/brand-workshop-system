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

-- ---------------------------------------------------------------------------
-- Step 2: self-serve answers and voice notes. Safe to run again.

alter table portal_workshops add column if not exists answers jsonb not null default '{}'::jsonb;
alter table portal_workshops add column if not exists submitted_at timestamptz;

alter table portal_files add column if not exists slide_id text;
alter table portal_files add column if not exists transcript text;
alter table portal_files add column if not exists seconds numeric;

-- Merge one slide's answer in a single statement, so two quick autosaves
-- (or an autosave and a tap) can't overwrite each other. parts and values
-- merge key by key; other fields replace.
create or replace function portal_merge_answer(p_id uuid, p_slide text, p_val jsonb)
returns jsonb
language sql
as $$
  update portal_workshops
  set answers = jsonb_set(
        coalesce(answers, '{}'::jsonb),
        array[p_slide],
        coalesce(answers -> p_slide, '{}'::jsonb)
          || (p_val - 'parts' - 'values')
          || case when p_val ? 'parts'
               then jsonb_build_object('parts', coalesce(answers -> p_slide -> 'parts', '{}'::jsonb) || (p_val -> 'parts'))
               else '{}'::jsonb end
          || case when p_val ? 'values'
               then jsonb_build_object('values', coalesce(answers -> p_slide -> 'values', '{}'::jsonb) || (p_val -> 'values'))
               else '{}'::jsonb end
      ),
      updated_at = now()
  where id = p_id
  returning answers;
$$;

-- Only the server (service role) may call it
revoke execute on function portal_merge_answer(uuid, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Step 3: online purchase (Stripe) and booking (Cal.com). Safe to run again.

alter table portal_workshops add column if not exists stripe_session_id text;
alter table portal_workshops add column if not exists amount_paid integer;
alter table portal_workshops add column if not exists booking jsonb;
create unique index if not exists portal_workshops_stripe_session
  on portal_workshops (stripe_session_id) where stripe_session_id is not null;

-- ---------------------------------------------------------------------------
-- ViVi chat on the public pages: simple usage counters for rate limiting.
-- Buckets are a hashed visitor + hour, and a per-day total. Safe to run again.

create table if not exists vivi_usage (
  bucket text primary key,
  count integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table vivi_usage enable row level security;

-- Add one to a bucket and return the new count, in a single statement
create or replace function vivi_hit(p_bucket text)
returns integer
language sql
as $$
  insert into vivi_usage (bucket, count) values (p_bucket, 1)
  on conflict (bucket) do update set count = vivi_usage.count + 1, updated_at = now()
  returning count;
$$;
revoke execute on function vivi_hit(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- ViVi conversations, saved for the team area. Safe to run again.

create table if not exists vivi_conversations (
  id uuid primary key,
  visitor text not null,            -- hashed, never the raw IP
  page text not null,               -- 'Landing', 'Buy: Guided', 'Client workshop', ...
  workshop_id uuid references portal_workshops (id) on delete set null,
  turns jsonb not null default '[]'::jsonb,
  message_count integer not null default 0,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vivi_conversations_updated on vivi_conversations (updated_at desc);
alter table vivi_conversations enable row level security;

-- ---------------------------------------------------------------------------
-- Retention: ViVi conversations are deleted 30 days after their last message;
-- old ViVi usage counters after 2 days. Runs nightly at 03:00 UTC via pg_cron.
-- Safe to run again (the job is replaced, not duplicated).

create extension if not exists pg_cron;

create or replace function vivi_prune()
returns void
language sql
as $$
  delete from vivi_conversations where updated_at < now() - interval '30 days';
  delete from vivi_usage where updated_at < now() - interval '2 days';
$$;
revoke execute on function vivi_prune() from public, anon, authenticated;

select cron.unschedule('vivi-prune') where exists (select 1 from cron.job where jobname = 'vivi-prune');
select cron.schedule('vivi-prune', '0 3 * * *', 'select vivi_prune()');
