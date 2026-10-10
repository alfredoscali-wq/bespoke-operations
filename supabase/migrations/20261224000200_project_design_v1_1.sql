-- Obras — Diseño de Obra V1.1: color de NAP y propiedades visuales del tramo.

ALTER TABLE public.project_design_elements
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#2563eb';

ALTER TABLE public.project_design_elements
  DROP CONSTRAINT IF EXISTS project_design_elements_color_hex;

ALTER TABLE public.project_design_elements
  ADD CONSTRAINT project_design_elements_color_hex
    CHECK (color ~ '^#[0-9A-Fa-f]{6}$');

COMMENT ON COLUMN public.project_design_elements.color IS
  'Visual marker color (#RRGGBB). Used for NAP; stored for all elements.';

ALTER TABLE public.project_design_segments
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'tendido';

ALTER TABLE public.project_design_segments
  DROP CONSTRAINT IF EXISTS project_design_segments_type_allowed;

ALTER TABLE public.project_design_segments
  ADD CONSTRAINT project_design_segments_type_allowed
    CHECK (type IN ('tendido', 'drop', 'otro'));

ALTER TABLE public.project_design_segments
  ADD COLUMN IF NOT EXISTS cable_reference text NOT NULL DEFAULT '';

ALTER TABLE public.project_design_segments
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#ea580c';

ALTER TABLE public.project_design_segments
  DROP CONSTRAINT IF EXISTS project_design_segments_color_hex;

ALTER TABLE public.project_design_segments
  ADD CONSTRAINT project_design_segments_color_hex
    CHECK (color ~ '^#[0-9A-Fa-f]{6}$');

COMMENT ON COLUMN public.project_design_segments.type IS
  'Planned span kind: tendido, drop or otro. Not a materials catalog.';

COMMENT ON COLUMN public.project_design_segments.cable_reference IS
  'Free-text planned cable label (e.g. 12 pelos). Future catalog hook.';

COMMENT ON COLUMN public.project_design_segments.color IS
  'Visual polyline color (#RRGGBB). User-chosen, no automatic meaning.';
