create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('greenhouse', 'lever', 'workable', 'wellfound')),
  title text not null,
  company text not null,
  company_logo text,
  location text,
  salary text,
  job_type text,
  experience_level text,
  description text,
  tags jsonb default '[]'::jsonb,
  match_score integer default 0,
  job_url text not null,
  source_url text,
  applied_status boolean default false,
  saved_status boolean default false,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_jobs_user_id on jobs(user_id);
create index if not exists idx_jobs_platform on jobs(platform);
create index if not exists idx_jobs_fetched_at on jobs(fetched_at);
create index if not exists idx_jobs_saved_status on jobs(user_id, saved_status);
create index if not exists idx_jobs_applied_status on jobs(user_id, applied_status);
