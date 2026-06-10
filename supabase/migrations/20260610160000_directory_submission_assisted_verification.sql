-- P² Local Listings — classificação de diretórios, envio assistido e verificação online.
-- Execute este SQL antes de importar os novos workflows n8n e antes de subir o frontend novo.

alter table public.directory_channels
  add column if not exists form_url text,
  add column if not exists auto_submit_supported boolean not null default false,
  add column if not exists assisted_submit boolean not null default true,
  add column if not exists verification_method text not null default 'manual_or_template',
  add column if not exists verification_url_template text,
  add column if not exists search_url_template text,
  add column if not exists last_submission_mode text;

alter table public.directory_submissions
  add column if not exists sync_id text,
  add column if not exists submission_type text,
  add column if not exists directory_name text,
  add column if not exists submitted_at timestamptz,
  add column if not exists verified_at timestamptz,
  add column if not exists verification_status text not null default 'not_checked',
  add column if not exists verification_message text,
  add column if not exists next_verification_at timestamptz,
  add column if not exists profile_url text,
  add column if not exists form_url text;

create index if not exists idx_directory_submissions_sync_id
on public.directory_submissions(sync_id);

create index if not exists idx_directory_submissions_verification_status
on public.directory_submissions(verification_status);

create index if not exists idx_directory_submissions_next_verification_at
on public.directory_submissions(next_verification_at);

create table if not exists public.directory_submission_verification_logs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.directory_submissions(id) on delete cascade,
  sync_id text,
  channel_code text,
  checked_url text,
  status text not null default 'not_checked',
  status_code int,
  found_name boolean,
  found_phone boolean,
  found_city boolean,
  profile_url text,
  message text,
  raw_response jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_directory_submission_verification_logs_sync_id
on public.directory_submission_verification_logs(sync_id);

create index if not exists idx_directory_submission_verification_logs_submission_id
on public.directory_submission_verification_logs(submission_id);

alter table public.directory_submission_verification_logs enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'directory_submission_verification_logs'
      and policyname = 'Allow authenticated read directory submission verification logs'
  ) then
    create policy "Allow authenticated read directory submission verification logs"
    on public.directory_submission_verification_logs
    for select
    to authenticated
    using (true);
  end if;
end $$;

-- Regras seguras: Google/Facebook continuam somente como provedores/fonte de dados.
update public.directory_channels
set
  is_active = false,
  submission_type = 'manual',
  last_check_status = 'provider_only',
  api_available = false,
  requires_login = true,
  requires_manual_review = true,
  requires_paid_plan = false,
  assisted_submit = false,
  auto_submit_supported = false,
  last_submission_mode = 'provider_only',
  notes = 'Canal usado apenas como fonte de dados/identificação. Não usar para propagação automática para evitar sobrescrever dados otimizados manualmente.',
  updated_at = now()
where code in ('google', 'facebook');

-- Classificação padrão dos diretórios existentes.
update public.directory_channels
set
  last_submission_mode = case
    when submission_type = 'email' and coalesce(email_to, '') <> '' then 'automatic_email'
    when submission_type = 'form' then 'assisted_form'
    when submission_type = 'api' then 'api_pending_connector'
    else 'manual_safe'
  end,
  assisted_submit = case
    when submission_type in ('form', 'manual', 'partner') then true
    else assisted_submit
  end,
  auto_submit_supported = case
    when submission_type = 'email' and coalesce(email_to, '') <> '' then true
    else auto_submit_supported
  end,
  updated_at = now()
where code not in ('google', 'facebook');
