-- Sprint Business Rules 1.0 — campos operativos en cliente actualizables por OT aprobada

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS contracted_plan text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS shared_location text,
  ADD COLUMN IF NOT EXISTS nap_box text,
  ADD COLUMN IF NOT EXISTS nap_port text,
  ADD COLUMN IF NOT EXISTS onu_serial text,
  ADD COLUMN IF NOT EXISTS status_reason text;

COMMENT ON COLUMN public.customers.contracted_plan IS
  'Plan contratado vigente (sincronizado al aprobar OT comercial).';

COMMENT ON COLUMN public.customers.latitude IS
  'Latitud GPS del domicilio de servicio (sincronizada desde OT).';

COMMENT ON COLUMN public.customers.longitude IS
  'Longitud GPS del domicilio de servicio (sincronizada desde OT).';

COMMENT ON COLUMN public.customers.shared_location IS
  'Enlace o referencia de ubicación compartida (sincronizado desde OT).';

COMMENT ON COLUMN public.customers.nap_box IS
  'Caja NAP FTTH vigente (sincronizada al aprobar OT con fibra).';

COMMENT ON COLUMN public.customers.nap_port IS
  'Puerto NAP FTTH vigente (sincronizado al aprobar OT con fibra).';

COMMENT ON COLUMN public.customers.onu_serial IS
  'Serial ONU FTTH vigente (sincronizado al aprobar OT con fibra).';

COMMENT ON COLUMN public.customers.status_reason IS
  'Motivo del estado comercial (p. ej. baja por OT).';
