-- OPS 2.2 — crew operational configuration (depot + habitual jornada).
-- Used as defaults by planning; day overrides never write back here.

ALTER TABLE public.crews
  ADD COLUMN IF NOT EXISTS operational_base_name text,
  ADD COLUMN IF NOT EXISTS operational_base_latitude double precision,
  ADD COLUMN IF NOT EXISTS operational_base_longitude double precision,
  ADD COLUMN IF NOT EXISTS habitual_start_time time without time zone,
  ADD COLUMN IF NOT EXISTS habitual_shift_minutes integer;

ALTER TABLE public.crews
  DROP CONSTRAINT IF EXISTS crews_operational_base_coordinates_pair_chk;

ALTER TABLE public.crews
  ADD CONSTRAINT crews_operational_base_coordinates_pair_chk
  CHECK (
    (
      operational_base_latitude IS NULL
      AND operational_base_longitude IS NULL
    )
    OR (
      operational_base_latitude IS NOT NULL
      AND operational_base_longitude IS NOT NULL
      AND operational_base_latitude >= -90
      AND operational_base_latitude <= 90
      AND operational_base_longitude >= -180
      AND operational_base_longitude <= 180
    )
  );

ALTER TABLE public.crews
  DROP CONSTRAINT IF EXISTS crews_habitual_shift_minutes_positive_chk;

ALTER TABLE public.crews
  ADD CONSTRAINT crews_habitual_shift_minutes_positive_chk
  CHECK (
    habitual_shift_minutes IS NULL
    OR habitual_shift_minutes > 0
  );

COMMENT ON COLUMN public.crews.operational_base_name IS
  'OPS 2.2 — display name of the crew operational base / depot.';
COMMENT ON COLUMN public.crews.operational_base_latitude IS
  'OPS 2.2 — latitude of the crew operational base (WGS84).';
COMMENT ON COLUMN public.crews.operational_base_longitude IS
  'OPS 2.2 — longitude of the crew operational base (WGS84).';
COMMENT ON COLUMN public.crews.habitual_start_time IS
  'OPS 2.2 — habitual jornada start time used as planning default.';
COMMENT ON COLUMN public.crews.habitual_shift_minutes IS
  'OPS 2.2 — habitual jornada duration in minutes used as planning available capacity.';
