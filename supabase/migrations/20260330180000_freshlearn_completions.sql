create table if not exists freshlearn_completions (
  id            bigserial primary key,
  email         text not null,
  course_id     text not null,
  course_name   text not null,
  progress      integer not null default 100,
  completion_date text,
  enrollment_date text,
  rating        numeric,
  synced_at     timestamptz not null default now(),
  unique (email, course_id)
);

create index if not exists freshlearn_completions_email_idx on freshlearn_completions (email);

-- Allow the service role to read/write (Edge Function uses service role)
alter table freshlearn_completions enable row level security;

create policy "service role full access"
  on freshlearn_completions
  using (true)
  with check (true);
