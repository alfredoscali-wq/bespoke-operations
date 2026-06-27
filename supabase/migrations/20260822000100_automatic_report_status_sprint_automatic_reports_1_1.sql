-- Automatic Reports 1.1 — último estado por reporte (no historial completo).

create table if not exists public.automatic_report_status (
  report_id text primary key,
  last_generated_at timestamptz,
  last_sent_at timestamptz,
  status text not null default 'never_run',
  message text,
  triggered_by text,
  updated_at timestamptz not null default now()
);

alter table public.automatic_report_status enable row level security;

comment on table public.automatic_report_status is
  'Última ejecución de reportes automáticos (una fila por report_id).';
