-- Automatic Reports 1.2 — configuración, historial y bucket de PDFs.

drop table if exists public.automatic_report_status;

create table if not exists public.automatic_report_settings (
  id uuid primary key default gen_random_uuid(),
  report_type text not null unique,
  enabled boolean not null default true,
  company_name text not null default 'Bespoke Operations',
  recipient_email text not null default '',
  send_day smallint not null default 1 check (send_day between 1 and 7),
  send_time time not null default '07:30:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.automatic_report_settings is
  'Configuración funcional de reportes automáticos (una fila por report_type).';

comment on column public.automatic_report_settings.send_day is
  '1 = lunes … 7 = domingo (America/Argentina/Buenos_Aires).';

insert into public.automatic_report_settings (
  report_type,
  enabled,
  company_name,
  recipient_email,
  send_day,
  send_time
)
values (
  'bespoke-weekly-executive',
  true,
  'Bespoke Operations',
  '',
  1,
  '07:30:00'
)
on conflict (report_type) do nothing;

create table if not exists public.automatic_report_history (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  generated_at timestamptz not null default now(),
  generated_by text not null,
  recipient text not null,
  status text not null,
  pdf_storage_path text,
  pdf_file_name text,
  week_number smallint,
  error_message text,
  execution_time_ms integer,
  email_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists automatic_report_history_report_type_generated_at_idx
  on public.automatic_report_history (report_type, generated_at desc);

comment on table public.automatic_report_history is
  'Historial append-only de ejecuciones de reportes automáticos.';

alter table public.automatic_report_settings enable row level security;
alter table public.automatic_report_history enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'automatic-reports',
  'automatic-reports',
  false,
  52428800,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
