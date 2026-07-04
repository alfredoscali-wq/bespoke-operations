# Bespoke Operations — Product Overview (BASELINE 1.0)

## Objetivo del producto

**Bespoke Operations** es la plataforma operativa multi-tenant de Bespoke para gestionar el ciclo completo de trabajo de campo en telecomunicaciones e infraestructura: clientes, empleados, cuadrillas, órdenes de trabajo (OT), planificación, evidencias y reportes.

Centraliza la coordinación entre backoffice, supervisores y operarios de campo. La lógica de negocio vive en esta aplicación; los clientes de ejecución (Portal Operario y Bespoke Field Agent) consumen APIs y flujos publicados desde aquí.

---

## Público objetivo

| Perfil | Uso principal |
|--------|----------------|
| **Administrador** | Configuración completa, usuarios, roles, mantenimiento y visión ejecutiva |
| **Supervisor** | Planificación, calendario, cierre de OT, incidencias y supervisión diaria |
| **Administración operativa / Ventas** | Calendario, clientes, OT comerciales e instalaciones |
| **RRHH** | Empleados, cuadrillas, disponibilidad y novedades |
| **Operario** | Ejecución de OT del día (Portal Operario o Field Agent) |
| **Demo** | Recorrido comercial en modo consulta |

Cada empresa (`company`) opera en aislamiento lógico. Los usuarios acceden según su rol de sistema o según los módulos configurados en roles personalizados de empresa.

---

## Conceptos principales

### Orden de Trabajo (OT)

Unidad operativa de ejecución. Puede ser de **obra** (vinculada a un proyecto) o de **servicio** (vinculada a un cliente). Toda OT nueva nace en estado **Programada**.

### Cuadrilla

Equipo de campo con integrantes de RRHH. Las OT se asignan a cuadrillas para ejecución y planificación de ruta.

### Planificación operativa

Proceso diario de ordenar OT por cuadrilla antes y durante la jornada. Usa dos conceptos de orden: `execution_order` (carril de planificación) y `dispatch_order` (carril operativo).

### Archivo OT

Vista de solo lectura del histórico de OT **Finalizadas**. No es un estado adicional del workflow.

### Cliente operativo

Registro comercial/técnico del abonado. Su estado (`activo`, `pendiente-activacion`, `inactivo`) evoluciona según reglas de negocio al aprobar ciertos tipos de OT, o mediante acciones manuales en la ficha del cliente.

### Evidencias

Registro fotográfico y documental asociado a OT u obras, con trazabilidad de carga y estado.

---

## Arquitectura general

```
┌─────────────────────────────────────────────────────────────┐
│                    Bespoke Operations                        │
│  (Next.js — Backoffice + Portal Operario + Mobile API)      │
├─────────────────────────────────────────────────────────────┤
│  Backoffice Web          Cookie session (Supabase SSR)       │
│  Portal Operario         /operario — cookie session          │
│  Mobile API              /api/mobile/v1 — Bearer token       │
├─────────────────────────────────────────────────────────────┤
│  Supabase — Postgres + Auth + Storage + RLS                  │
└─────────────────────────────────────────────────────────────┘
         ▲                              ▲
         │                              │
   Navegador backoffice            Bespoke Field Agent (Android)
   Navegador operario
```

La aplicación no duplica lógica entre superficies: dominio compartido en `lib/`, acceso a datos en `lib/supabase/`, y capa Mobile API en `lib/mobile/v1/`.

---

## Módulos

### Operaciones

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| Dashboard Operativo | `/` | Resumen del día (administrador / demo) |
| Calendario Operativo | `/operations/calendar` | Vista semanal de OT, cuadrillas y ausencias |
| Planificación Operativa | `/operations/planificacion` | Ordenamiento y confirmación de ruta diaria |
| Obras | `/obras` | Proyectos de infraestructura en curso |
| Órdenes de Trabajo | `/tareas` | OT activas (programada → pendiente de cierre) |
| Archivo OT | `/operations/archivo-ot` | Histórico de OT finalizadas (solo lectura) |
| Evidencias | `/evidencias` | Registro documental de campo |
| Materiales | `/materiales` | Inventario y movimientos |
| Clientes | `/clientes` | Directorio operativo de abonados |
| Cuadrillas | `/cuadrillas` | Equipos e integrantes |

### Análisis

| Módulo | Ruta |
|--------|------|
| Reportes | `/reportes` |

### RRHH

| Módulo | Ruta |
|--------|------|
| Empleados | `/rrhh` |
| Novedades | `/novedades` |
| Disponibilidad | `/operations/availability` |

### Sistema

| Módulo | Ruta |
|--------|------|
| Configuración | `/configuracion` |
| Log del Sistema | `/historial` |
| Usuarios | `/usuarios` |
| Dispositivos | `/dispositivos` |

### Campo

| Superficie | Ruta / API |
|------------|------------|
| Portal Operario | `/operario` |
| Field Agent | `/api/mobile/v1/` |

---

## Documentación relacionada

| Documento | Contenido |
|-----------|-----------|
| [02 - OPERATIONAL_WORKFLOW.md](./02%20-%20OPERATIONAL_WORKFLOW.md) | Workflow de OT |
| [03 - CLIENT_LIFECYCLE.md](./03%20-%20CLIENT_LIFECYCLE.md) | Ciclo de vida del cliente |
| [04 - PLANNING.md](./04%20-%20PLANNING.md) | Planificación operativa |
| [05 - PERMISSIONS.md](./05%20-%20PERMISSIONS.md) | Perfiles y permisos |
| [06 - FIELD_AGENT.md](./06%20-%20FIELD_AGENT.md) | Field Agent y Portal Operario |
| [07 - ARCHITECTURE.md](./07%20-%20ARCHITECTURE.md) | Arquitectura técnica |
| [08 - DATABASE.md](./08%20-%20DATABASE.md) | Modelo de datos |
| [09 - CHANGELOG_BASELINE.md](./09%20-%20CHANGELOG_BASELINE.md) | Historial del baseline |
| [10 - KNOWN_LIMITATIONS.md](./10%20-%20KNOWN_LIMITATIONS.md) | Limitaciones conocidas |
