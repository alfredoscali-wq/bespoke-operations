-- RC 3.1.6 — simplify consultation motivos + commercial categories

-- 1) Map legacy motivos before tightening the check constraint
UPDATE public.customer_atenciones
SET
  motivo = CASE motivo
    WHEN 'consulta' THEN 'otro'
    WHEN 'reclamo' THEN 'otro'
    WHEN 'solicitud' THEN 'otro'
    WHEN 'retencion' THEN 'baja'
    ELSE motivo
  END,
  updated_at = updated_at
WHERE motivo IN ('consulta', 'reclamo', 'solicitud', 'retencion');

-- 2) Replace motivo check constraint
ALTER TABLE public.customer_atenciones
  DROP CONSTRAINT IF EXISTS customer_atenciones_motivo_check;

ALTER TABLE public.customer_atenciones
  ADD CONSTRAINT customer_atenciones_motivo_check CHECK (
    motivo IN (
      'problema_tecnico',
      'facturacion',
      'cambio_plan_tecnologia',
      'consulta_comercial',
      'consulta_tv',
      'nuevo_servicio',
      'baja',
      'otro'
    )
  );
