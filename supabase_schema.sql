create table if not exists public.films (
  id bigint generated always as identity primary key,
  slug text not null unique,
  title text not null,
  status text,
  score integer default 0,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists films_slug_idx on public.films (slug);
create index if not exists films_title_idx on public.films (title);

alter table public.films enable row level security;

drop policy if exists "Public can read films" on public.films;
create policy "Public can read films"
on public.films
for select
to anon, authenticated
using (true);
