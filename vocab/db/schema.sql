-- Schema for the vocabulary app. Run once on a new Postgres database (Neon, Supabase or any other):
--   psql "$DATABASE_URL" -f db/schema.sql
-- The server also runs it on start-up when the tables are missing (every statement is idempotent).

create table if not exists parents (
  id            uuid primary key,
  email         text not null unique,
  pass_hash     text not null,
  name          text not null default '',
  family_token  text not null unique,
  created_at    timestamptz not null default now()
);

create table if not exists kids (
  id          uuid primary key,
  parent_id   uuid not null references parents(id) on delete cascade,
  name        text not null,
  grade       int  not null check (grade between 4 and 7),
  emoji       text not null default '🦊',
  link_token  text not null unique,
  created_at  timestamptz not null default now()
);
create index if not exists kids_parent on kids(parent_id);

-- One JSON document per kid (items + sessions), merged per item on the device, like the family app.
-- version is bumped on every write, so two devices never overwrite each other blindly.
create table if not exists progress (
  kid_id      uuid primary key references kids(id) on delete cascade,
  data        jsonb not null,
  version     int  not null default 1,
  updated_at  timestamptz not null default now()
);

-- A test the kid prepares for: a closed list of words until the test date.
create table if not exists tests (
  id          uuid primary key,
  kid_id      uuid not null references kids(id) on delete cascade,
  title       text not null,
  test_date   date not null,
  words       jsonb not null,
  created_at  timestamptz not null default now()
);
create index if not exists tests_kid on tests(kid_id);
