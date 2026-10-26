create table if not exists freshlearn_members (
  id            bigserial primary key,
  email         text not null unique,
  full_name     text,
  first_name    text,
  last_name     text,
  phone         text,
  city          text,
  country       text,
  fl_member_id  bigint,
  uid_number    text,
  joined_date   text,
  synced_at     timestamptz not null default now()
);

create index if not exists freshlearn_members_email_idx on freshlearn_members (email);

alter table freshlearn_members enable row level security;

create policy "service role full access"
  on freshlearn_members
  using (true)
  with check (true);
