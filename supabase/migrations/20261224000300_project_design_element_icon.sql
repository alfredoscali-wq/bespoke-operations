-- Obras — Diseño de Obra V1.2: icono de representación para Nodo/NAP.

ALTER TABLE public.project_design_elements
  ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT 'circle';

ALTER TABLE public.project_design_elements
  DROP CONSTRAINT IF EXISTS project_design_elements_icon_allowed;

ALTER TABLE public.project_design_elements
  ADD CONSTRAINT project_design_elements_icon_allowed
    CHECK (icon IN ('square', 'circle', 'marker', 'diamond', 'hexagon'));

UPDATE public.project_design_elements
  SET icon = 'square'
  WHERE kind = 'node'
    AND icon = 'circle';

COMMENT ON COLUMN public.project_design_elements.icon IS
  'Planned map shape: square, circle, marker, diamond or hexagon. Not SVG/HTML.';
