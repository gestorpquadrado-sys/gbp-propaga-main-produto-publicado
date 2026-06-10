-- GBP Propaga / P² Local Listings complete base schema
-- Run this file in Supabase SQL Editor before publishing the app.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  company_name text,
  whatsapp text,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null,
  phone text,
  whatsapp text,
  email text,
  website text,
  category text,
  description text,
  address text,
  address_number text,
  address_complement text,
  neighborhood text,
  city text,
  state text,
  postal_code text,
  country text default 'BR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, slug)
);

create table if not exists public.google_locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  google_location_id text not null,
  google_place_id text,
  google_maps_uri text,
  name text not null,
  description text,
  phone_primary text,
  phone_additional text,
  website text,
  address_full text,
  address_city text,
  address_state text,
  address_postal_code text,
  address_country text default 'BR',
  address_neighborhood text,
  category_primary text,
  categories_additional text[] default '{}',
  hours jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, google_location_id)
);

create table if not exists public.directory_channels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  icon text,
  is_active boolean not null default true,
  requires_approval boolean not null default false,
  categories text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.directory_pages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  location_id uuid references public.google_locations(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  public_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, slug)
);

create table if not exists public.directory_submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  location_id uuid references public.google_locations(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_code text not null,
  status text not null default 'pending' check (status in ('pending', 'syncing', 'success', 'sent', 'error')),
  message text,
  status_code int,
  duration_ms int,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, location_id, channel_code)
);

create table if not exists public.propagation_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  location_id uuid references public.google_locations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null default 'info' check (level in ('info', 'warning', 'error')),
  event text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create trigger set_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_companies_updated_at before update on public.companies for each row execute function public.set_updated_at();
create trigger set_google_locations_updated_at before update on public.google_locations for each row execute function public.set_updated_at();
create trigger set_directory_channels_updated_at before update on public.directory_channels for each row execute function public.set_updated_at();
create trigger set_directory_pages_updated_at before update on public.directory_pages for each row execute function public.set_updated_at();
create trigger set_directory_submissions_updated_at before update on public.directory_submissions for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, company_name, whatsapp)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'company_name',
    new.raw_user_meta_data ->> 'whatsapp'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    company_name = excluded.company_name,
    whatsapp = excluded.whatsapp,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.google_locations enable row level security;
alter table public.directory_channels enable row level security;
alter table public.directory_pages enable row level security;
alter table public.directory_submissions enable row level security;
alter table public.propagation_logs enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "companies_all_own" on public.companies for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "google_locations_all_own" on public.google_locations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "directory_pages_all_own" on public.directory_pages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "directory_submissions_all_own" on public.directory_submissions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "propagation_logs_all_own" on public.propagation_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "directory_channels_read_active" on public.directory_channels for select using (is_active = true);

insert into public.directory_channels (code, name, description, icon, requires_approval, categories)
values
  ('google', 'Google Business Profile', 'Atualização e validação do perfil no Google.', '🔍', false, array['all']),
  ('facebook', 'Facebook', 'Padronização da página comercial no Facebook.', '📘', false, array['all']),
  ('instagram', 'Instagram', 'Conferência de presença e consistência comercial.', '📷', false, array['all']),
  ('bing', 'Bing Places', 'Presença local no Bing/Microsoft.', '🅱️', false, array['all']),
  ('apple', 'Apple Business Connect', 'Presença local em mapas e ecossistema Apple.', '🍎', true, array['all']),
  ('apontador', 'Apontador', 'Diretório local brasileiro.', '📍', true, array['all']),
  ('guiamais', 'GuiaMais', 'Diretório nacional de empresas.', '🗺️', true, array['all']),
  ('telelistas', 'TeleListas', 'Diretório telefônico/comercial.', '📞', true, array['all'])
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  requires_approval = excluded.requires_approval,
  categories = excluded.categories,
  updated_at = now();

-- Public read for published directory pages only. This allows /empresa/:slug to work without login.
create policy "directory_pages_public_published" on public.directory_pages
for select using (status = 'published');

create policy "companies_public_if_published" on public.companies
for select using (
  exists (
    select 1 from public.directory_pages dp
    where dp.company_id = companies.id and dp.status = 'published'
  )
);

create policy "google_locations_public_if_published" on public.google_locations
for select using (
  exists (
    select 1 from public.directory_pages dp
    where dp.location_id = google_locations.id and dp.status = 'published'
  )
);
