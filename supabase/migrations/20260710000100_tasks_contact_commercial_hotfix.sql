-- OT hotfix — customer_dni and payment_method on tasks

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS customer_dni text,
  ADD COLUMN IF NOT EXISTS payment_method text;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_payment_method_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_payment_method_check CHECK (
    payment_method IS NULL
    OR payment_method IN (
      'efectivo',
      'transferencia',
      'mercadopago',
      'tarjeta',
      'otro'
    )
  );

COMMENT ON COLUMN public.tasks.customer_dni IS
  'DNI or CUIT captured on the work order (snapshot, independent of customers).';

COMMENT ON COLUMN public.tasks.payment_method IS
  'Payment method informed when creating the work order.';
