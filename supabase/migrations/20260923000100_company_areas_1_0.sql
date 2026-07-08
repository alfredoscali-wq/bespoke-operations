-- Áreas y Accesos 1.0 — fixed company areas on top of company_roles

DO $$
DECLARE
  company record;
  role_admin uuid;
  role_administracion uuid;
  role_atencion uuid;
  role_ventas uuid;
  role_rrhh uuid;
  role_tecnica uuid;
  role_operario uuid;
  role_administrativo_id uuid;
  role_administracion_id uuid;
  role_administrativo_emps integer;
  role_administracion_emps integer;
BEGIN
  FOR company IN SELECT id FROM public.companies LOOP
    UPDATE public.company_roles
    SET
      code = 'tecnica',
      name = 'Técnica',
      is_system = true,
      sort_order = 6
    WHERE company_id = company.id
      AND code = 'supervisor'
      AND is_system = true;

    SELECT id
    INTO role_administrativo_id
    FROM public.company_roles
    WHERE company_id = company.id
      AND code = 'administrativo'
    LIMIT 1;

    SELECT id
    INTO role_administracion_id
    FROM public.company_roles
    WHERE company_id = company.id
      AND code = 'administracion'
    LIMIT 1;

    IF role_administrativo_id IS NOT NULL
      AND role_administracion_id IS NOT NULL
      AND role_administrativo_id IS DISTINCT FROM role_administracion_id THEN
      SELECT COUNT(*)
      INTO role_administrativo_emps
      FROM public.employees e
      WHERE e.company_id = company.id
        AND e.role_id = role_administrativo_id
        AND e.deleted_at IS NULL;

      SELECT COUNT(*)
      INTO role_administracion_emps
      FROM public.employees e
      WHERE e.company_id = company.id
        AND e.role_id = role_administracion_id
        AND e.deleted_at IS NULL;

      IF role_administrativo_emps >= role_administracion_emps THEN
        UPDATE public.company_roles
        SET code = 'legacy_administracion_' || replace(id::text, '-', '')
        WHERE id = role_administracion_id;

        UPDATE public.company_roles
        SET
          code = 'administracion',
          name = 'Administración',
          is_system = true,
          sort_order = 2
        WHERE id = role_administrativo_id;
      ELSE
        UPDATE public.company_roles
        SET code = 'legacy_administrativo_' || replace(id::text, '-', '')
        WHERE id = role_administrativo_id;

        UPDATE public.company_roles
        SET
          code = 'administracion',
          name = 'Administración',
          is_system = true,
          sort_order = 2
        WHERE id = role_administracion_id;
      END IF;
    ELSIF role_administrativo_id IS NOT NULL
      AND role_administracion_id IS NULL THEN
      UPDATE public.company_roles
      SET
        code = 'administracion',
        name = 'Administración',
        is_system = true,
        sort_order = 2
      WHERE id = role_administrativo_id;
    ELSIF role_administrativo_id IS NULL
      AND role_administracion_id IS NOT NULL THEN
      UPDATE public.company_roles
      SET
        name = 'Administración',
        is_system = true,
        sort_order = 2
      WHERE id = role_administracion_id;
    END IF;

    UPDATE public.company_roles
    SET name = 'Administrador', is_system = true, sort_order = 1
    WHERE company_id = company.id AND code = 'administrador';

    UPDATE public.company_roles
    SET name = 'RRHH', is_system = true, sort_order = 5
    WHERE company_id = company.id AND code = 'rrhh';

    UPDATE public.company_roles
    SET
      name = 'Operario',
      is_system = true,
      sort_order = 7,
      module_visibility = '{"dashboard":false,"calendar":false,"projects":false,"work_orders":false,"planificacion":false,"customers":false,"crews":false,"materials":false,"evidence":false,"reports":false,"employees":false,"news":false,"settings":false,"history":false,"users":false,"dispositivos":false,"maintenance":false}'::jsonb
    WHERE company_id = company.id AND code = 'operario';

    INSERT INTO public.company_roles (
      company_id, code, name, is_system, module_visibility, sort_order
    ) VALUES (
      company.id,
      'administrador',
      'Administrador',
      true,
      '{"dashboard":true,"calendar":true,"projects":true,"work_orders":true,"planificacion":true,"customers":true,"crews":true,"materials":true,"evidence":true,"reports":true,"employees":true,"news":true,"settings":true,"history":true,"users":true,"dispositivos":true,"maintenance":true}'::jsonb,
      1
    )
    ON CONFLICT (company_id, code) DO UPDATE
    SET
      name = EXCLUDED.name,
      is_system = true,
      sort_order = EXCLUDED.sort_order
    RETURNING id INTO role_admin;

    IF role_admin IS NULL THEN
      SELECT id INTO role_admin
      FROM public.company_roles
      WHERE company_id = company.id AND code = 'administrador';
    END IF;

    INSERT INTO public.company_roles (
      company_id, code, name, is_system, module_visibility, sort_order
    ) VALUES (
      company.id,
      'administracion',
      'Administración',
      true,
      '{"dashboard":false,"calendar":true,"projects":true,"work_orders":true,"planificacion":false,"customers":true,"crews":false,"materials":false,"evidence":false,"reports":true,"employees":false,"news":false,"settings":false,"history":false,"users":false,"dispositivos":false,"maintenance":false}'::jsonb,
      2
    )
    ON CONFLICT (company_id, code) DO UPDATE
    SET
      name = EXCLUDED.name,
      is_system = true,
      sort_order = EXCLUDED.sort_order
    RETURNING id INTO role_administracion;

    IF role_administracion IS NULL THEN
      SELECT id INTO role_administracion
      FROM public.company_roles
      WHERE company_id = company.id AND code = 'administracion';
    END IF;

    INSERT INTO public.company_roles (
      company_id, code, name, is_system, module_visibility, sort_order
    ) VALUES (
      company.id,
      'atencion_cliente',
      'Atención al Cliente',
      true,
      '{"dashboard":false,"calendar":true,"projects":false,"work_orders":true,"planificacion":false,"customers":true,"crews":false,"materials":false,"evidence":false,"reports":false,"employees":false,"news":false,"settings":false,"history":false,"users":false,"dispositivos":false,"maintenance":false}'::jsonb,
      3
    )
    ON CONFLICT (company_id, code) DO UPDATE
    SET
      name = EXCLUDED.name,
      is_system = true,
      sort_order = EXCLUDED.sort_order
    RETURNING id INTO role_atencion;

    IF role_atencion IS NULL THEN
      SELECT id INTO role_atencion
      FROM public.company_roles
      WHERE company_id = company.id AND code = 'atencion_cliente';
    END IF;

    INSERT INTO public.company_roles (
      company_id, code, name, is_system, module_visibility, sort_order
    ) VALUES (
      company.id,
      'ventas',
      'Ventas',
      true,
      '{"dashboard":false,"calendar":true,"projects":false,"work_orders":true,"planificacion":false,"customers":true,"crews":false,"materials":false,"evidence":false,"reports":true,"employees":false,"news":false,"settings":false,"history":false,"users":false,"dispositivos":false,"maintenance":false}'::jsonb,
      4
    )
    ON CONFLICT (company_id, code) DO UPDATE
    SET
      name = EXCLUDED.name,
      is_system = true,
      sort_order = EXCLUDED.sort_order
    RETURNING id INTO role_ventas;

    IF role_ventas IS NULL THEN
      SELECT id INTO role_ventas
      FROM public.company_roles
      WHERE company_id = company.id AND code = 'ventas';
    END IF;

    INSERT INTO public.company_roles (
      company_id, code, name, is_system, module_visibility, sort_order
    ) VALUES (
      company.id,
      'rrhh',
      'RRHH',
      true,
      '{"dashboard":true,"calendar":false,"projects":false,"work_orders":false,"planificacion":false,"customers":false,"crews":true,"materials":false,"evidence":false,"reports":false,"employees":true,"news":true,"settings":false,"history":false,"users":true,"dispositivos":false,"maintenance":false}'::jsonb,
      5
    )
    ON CONFLICT (company_id, code) DO UPDATE
    SET
      name = EXCLUDED.name,
      is_system = true,
      sort_order = EXCLUDED.sort_order
    RETURNING id INTO role_rrhh;

    IF role_rrhh IS NULL THEN
      SELECT id INTO role_rrhh
      FROM public.company_roles
      WHERE company_id = company.id AND code = 'rrhh';
    END IF;

    INSERT INTO public.company_roles (
      company_id, code, name, is_system, module_visibility, sort_order
    ) VALUES (
      company.id,
      'tecnica',
      'Técnica',
      true,
      '{"dashboard":false,"calendar":true,"projects":true,"work_orders":true,"planificacion":true,"customers":true,"crews":false,"materials":false,"evidence":false,"reports":true,"employees":false,"news":false,"settings":true,"history":false,"users":false,"dispositivos":false,"maintenance":false}'::jsonb,
      6
    )
    ON CONFLICT (company_id, code) DO UPDATE
    SET
      name = EXCLUDED.name,
      is_system = true,
      sort_order = EXCLUDED.sort_order
    RETURNING id INTO role_tecnica;

    IF role_tecnica IS NULL THEN
      SELECT id INTO role_tecnica
      FROM public.company_roles
      WHERE company_id = company.id AND code = 'tecnica';
    END IF;

    INSERT INTO public.company_roles (
      company_id, code, name, is_system, module_visibility, sort_order
    ) VALUES (
      company.id,
      'operario',
      'Operario',
      true,
      '{"dashboard":false,"calendar":false,"projects":false,"work_orders":false,"planificacion":false,"customers":false,"crews":false,"materials":false,"evidence":false,"reports":false,"employees":false,"news":false,"settings":false,"history":false,"users":false,"dispositivos":false,"maintenance":false}'::jsonb,
      7
    )
    ON CONFLICT (company_id, code) DO UPDATE
    SET
      name = EXCLUDED.name,
      is_system = true,
      sort_order = EXCLUDED.sort_order
    RETURNING id INTO role_operario;

    IF role_operario IS NULL THEN
      SELECT id INTO role_operario
      FROM public.company_roles
      WHERE company_id = company.id AND code = 'operario';
    END IF;

    UPDATE public.employees e
    SET
      role_id = cr.id,
      system_role = CASE cr.code
        WHEN 'administrador' THEN 'administrador'::public.system_role
        WHEN 'tecnica' THEN 'supervisor'::public.system_role
        WHEN 'operario' THEN 'operario'::public.system_role
        ELSE 'administrativo'::public.system_role
      END
    FROM public.company_roles cr
    WHERE e.company_id = company.id
      AND e.role_id IS NULL
      AND cr.company_id = company.id
      AND cr.is_system = true
      AND cr.code = CASE e.system_role
        WHEN 'administrador' THEN 'administrador'
        WHEN 'supervisor' THEN 'tecnica'
        WHEN 'operario' THEN 'operario'
        WHEN 'demo' THEN 'administrador'
        WHEN 'administrativo' THEN 'administracion'
        ELSE NULL
      END;
  END LOOP;
END $$;

COMMENT ON TABLE public.company_roles IS
  'Tenant fixed areas (Áreas) controlling module visibility in Bespoke Operations.';
