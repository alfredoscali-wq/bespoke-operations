-- Hotfix: align customer_atenciones_next_step_check with UI Próximo Paso (Sprint 2.8).
-- Remote DBs that still enforce the Sprint 2.0/2.6 vocabulary reject inserts from the current app.
--
-- Order matters:
--   1) DROP old CHECKs (so remaps are not blocked by the legacy vocabulary)
--   2) UPDATE historical / alias next_step values to canonical UI slugs
--   3) ADD CHECKs with current vocabulary
--
-- Functional UI values (stable slugs — do not confuse with Spanish labels):
--   resolver_consulta_tecnica
--   derivar_admin_facturacion          ("Derivar Administración - Facturación")
--   derivar_admin_morosos              ("Derivar Administración - Morosos")
--   derivar_admin_gestion              ("Derivar Administración - Gestión administrativa")
--   contactar_cliente                  ("Derivar a Ventas")
-- Plus remaining menu steps: realizar_retencion, seguimiento_cliente, esperar_cliente, generar_ot.
--
-- Does not change status lifecycle logic.

-- 1) Drop legacy CHECKs first
ALTER TABLE public.customer_atenciones
  DROP CONSTRAINT IF EXISTS customer_atenciones_next_step_check;

ALTER TABLE public.customer_atenciones
  DROP CONSTRAINT IF EXISTS customer_atenciones_moroso_tracking_next_step_check;

ALTER TABLE public.customer_atencion_events
  DROP CONSTRAINT IF EXISTS customer_atencion_events_previous_next_step_check;

ALTER TABLE public.customer_atencion_events
  DROP CONSTRAINT IF EXISTS customer_atencion_events_new_next_step_check;

-- 2) Remap legacy / alternate spellings to canonical UI slugs
UPDATE public.customer_atenciones
SET next_step = CASE next_step
  -- Sprint 2.0 / 2.6 vocabulary
  WHEN 'resolver_facturacion' THEN 'derivar_admin_facturacion'
  WHEN 'facturacion_morosos' THEN 'derivar_admin_morosos'
  WHEN 'analizar_problema_tecnico' THEN 'resolver_consulta_tecnica'
  WHEN 'esperar_administracion' THEN 'derivar_admin_gestion'
  WHEN 'coordinar_retiro' THEN 'generar_ot'
  -- Long-form aliases (if any were written before canonicalizing)
  WHEN 'derivar_administracion_facturacion' THEN 'derivar_admin_facturacion'
  WHEN 'derivar_administracion_morosos' THEN 'derivar_admin_morosos'
  WHEN 'derivar_administracion_gestion_administrativa' THEN 'derivar_admin_gestion'
  WHEN 'derivar_ventas' THEN 'contactar_cliente'
  ELSE next_step
END
WHERE next_step IN (
  'resolver_facturacion',
  'facturacion_morosos',
  'analizar_problema_tecnico',
  'esperar_administracion',
  'coordinar_retiro',
  'derivar_administracion_facturacion',
  'derivar_administracion_morosos',
  'derivar_administracion_gestion_administrativa',
  'derivar_ventas'
);

UPDATE public.customer_atencion_events
SET previous_next_step = CASE previous_next_step
  WHEN 'resolver_facturacion' THEN 'derivar_admin_facturacion'
  WHEN 'facturacion_morosos' THEN 'derivar_admin_morosos'
  WHEN 'analizar_problema_tecnico' THEN 'resolver_consulta_tecnica'
  WHEN 'esperar_administracion' THEN 'derivar_admin_gestion'
  WHEN 'coordinar_retiro' THEN 'generar_ot'
  WHEN 'derivar_administracion_facturacion' THEN 'derivar_admin_facturacion'
  WHEN 'derivar_administracion_morosos' THEN 'derivar_admin_morosos'
  WHEN 'derivar_administracion_gestion_administrativa' THEN 'derivar_admin_gestion'
  WHEN 'derivar_ventas' THEN 'contactar_cliente'
  ELSE previous_next_step
END
WHERE previous_next_step IN (
  'resolver_facturacion',
  'facturacion_morosos',
  'analizar_problema_tecnico',
  'esperar_administracion',
  'coordinar_retiro',
  'derivar_administracion_facturacion',
  'derivar_administracion_morosos',
  'derivar_administracion_gestion_administrativa',
  'derivar_ventas'
);

UPDATE public.customer_atencion_events
SET new_next_step = CASE new_next_step
  WHEN 'resolver_facturacion' THEN 'derivar_admin_facturacion'
  WHEN 'facturacion_morosos' THEN 'derivar_admin_morosos'
  WHEN 'analizar_problema_tecnico' THEN 'resolver_consulta_tecnica'
  WHEN 'esperar_administracion' THEN 'derivar_admin_gestion'
  WHEN 'coordinar_retiro' THEN 'generar_ot'
  WHEN 'derivar_administracion_facturacion' THEN 'derivar_admin_facturacion'
  WHEN 'derivar_administracion_morosos' THEN 'derivar_admin_morosos'
  WHEN 'derivar_administracion_gestion_administrativa' THEN 'derivar_admin_gestion'
  WHEN 'derivar_ventas' THEN 'contactar_cliente'
  ELSE new_next_step
END
WHERE new_next_step IN (
  'resolver_facturacion',
  'facturacion_morosos',
  'analizar_problema_tecnico',
  'esperar_administracion',
  'coordinar_retiro',
  'derivar_administracion_facturacion',
  'derivar_administracion_morosos',
  'derivar_administracion_gestion_administrativa',
  'derivar_ventas'
);

-- 3) Recreate CHECKs with current UI vocabulary
ALTER TABLE public.customer_atenciones
  ADD CONSTRAINT customer_atenciones_next_step_check CHECK (
    next_step IS NULL
    OR next_step IN (
      'realizar_retencion',
      'resolver_consulta_tecnica',
      'derivar_admin_facturacion',
      'derivar_admin_morosos',
      'derivar_admin_gestion',
      'contactar_cliente',
      'seguimiento_cliente',
      'esperar_cliente',
      'generar_ot'
    )
  );

ALTER TABLE public.customer_atenciones
  ADD CONSTRAINT customer_atenciones_moroso_tracking_next_step_check CHECK (
    moroso_tracking_status IS NULL
    OR next_step = 'derivar_admin_morosos'
  );

ALTER TABLE public.customer_atencion_events
  ADD CONSTRAINT customer_atencion_events_previous_next_step_check CHECK (
    previous_next_step IS NULL
    OR previous_next_step IN (
      'realizar_retencion',
      'resolver_consulta_tecnica',
      'derivar_admin_facturacion',
      'derivar_admin_morosos',
      'derivar_admin_gestion',
      'contactar_cliente',
      'seguimiento_cliente',
      'esperar_cliente',
      'generar_ot'
    )
  );

ALTER TABLE public.customer_atencion_events
  ADD CONSTRAINT customer_atencion_events_new_next_step_check CHECK (
    new_next_step IS NULL
    OR new_next_step IN (
      'realizar_retencion',
      'resolver_consulta_tecnica',
      'derivar_admin_facturacion',
      'derivar_admin_morosos',
      'derivar_admin_gestion',
      'contactar_cliente',
      'seguimiento_cliente',
      'esperar_cliente',
      'generar_ot'
    )
  );
