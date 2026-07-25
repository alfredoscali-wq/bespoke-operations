---
id: AT-ACTIVITY-ENGINE-1-1A
title: Activity Engine 1.1A — Foundation
version: 0.1.0
status: Draft
owner: Architecture
last_updated: 2026-07-25
depends_on: []
related:
  - BAS-AI-CONTEXT
---

# Resumen

Documentación técnica de la **foundation** del Activity Engine (sprint 1.1A): API única `activity.record()`, catálogo de acciones/categorías e infraestructura de persistencia sobre `activity_events`.

# Objetivo

Proveer un motor reutilizable para registrar actividad operativa desde cualquier módulo, sin acoplarse a Atención al Cliente, OT, RRHH, Ventas u otros dominios.

# Alcance

Incluye:

- Módulo `lib/activity-engine/`
- Extensión aditiva de `public.activity_events`
- RPC `record_activity_engine_event`
- Validaciones y API pública

No incluye:

- Integración de módulos
- Timeline / Dashboard / KPIs / Panel de empleados
- `activity_sessions`
- Sustitución de `customer_atencion_events` u otros historiales de dominio
- Cambios de UI

# Contenido

## 1. Objetivo del motor

Centralizar el registro de hechos operativos (`quién / qué / sobre qué / con qué impacto`) para que Bespoke pueda construir inteligencia operacional de forma transversal.

Todos los módulos deben escribir actividad **solo** mediante:

```ts
import { activity } from "@/lib/activity-engine"

await activity.record({ ... })
```

No deben hacer `insert` directo sobre `activity_events`.

## 2. Arquitectura

```text
Dominio (futuro)
    ↓
activity.record()          ← API pública única (lib/activity-engine)
    ↓
validateActivityRecordInput
    ↓
record_activity_engine_event (SECURITY DEFINER / service_role)
    ↓
public.activity_events     ← store multi-tenant (RLS SELECT por company_id)
```

Características:

- Carpeta `lib/activity-engine/` independiente de dominios.
- Escrituras server-only (service role + RPC).
- Lecturas autenticadas filtradas por `company_id` (RLS existente).
- Convive con el Activity Engine 1.0 / OIE (`lib/activity`, `record_activity_event`) sin reemplazarlo en este sprint.

### Archivos

| Archivo | Rol |
|---|---|
| `index.ts` | Superficie pública |
| `activity-engine.ts` | Facade `activity.record()` |
| `activity-service.ts` | Persistencia |
| `activity-actions.ts` | Catálogo de acciones |
| `activity-types.ts` | Categoría / impacto / origen / tipos |
| `activity-validate.ts` | Validación controlada |

## 3. Tabla `activity_events`

La tabla ya existía (Activity Engine 1.0). El sprint 1.1A **agrega** columnas foundation:

| Columna | Tipo | Notas |
|---|---|---|
| `category` | text null | Obligatorio en API 1.1A; null en filas legacy |
| `impact` | text null | Obligatorio en API 1.1A; null en filas legacy |
| `updated_at` | timestamptz | Default `now()` + trigger en UPDATE |

Campos usados por `activity.record()`:

- `id`, `company_id`, `module`, `entity_type`, `entity_id`, `employee_id`
- `action`, `category`, `impact`, `origin`, `metadata`
- `created_at`, `updated_at`

Columnas legacy (`actor_type`, `detail`, `severity`, …) se completan automáticamente en el RPC 1.1A para mantener compatibilidad de fila.

### RLS

- `SELECT` para `authenticated` cuando `company_id = auth_user_company_id()`
- Sin INSERT/UPDATE/DELETE para clientes; escritura vía RPC `service_role`

## 4. Enumeraciones

### ActivityCategory

`CONTACT` · `FOLLOW_UP` · `TECHNICAL` · `ADMINISTRATIVE` · `SALES` · `OPERATIONAL` · `SYSTEM` · `COMMUNICATION`

### ActivityImpact

`ACTIVITY` · `PRODUCTION` · `RESULT`

### ActivityOrigin

`USER` · `SYSTEM` · `AUTOMATION` · `INTEGRATION`

(Compatible en DB con orígenes legacy 1.0: `web` · `mobile` · `api` · `cron` · `system`.)

### ActivityAction (catálogo inicial)

`CALL_STARTED` · `CALL_COMPLETED` · `CALL_FAILED` · `WHATSAPP_SENT` · `WHATSAPP_RECEIVED` · `FOLLOW_UP_CREATED` · `FOLLOW_UP_UPDATED` · `STATUS_CHANGED` · `NEXT_STEP_CHANGED` · `DERIVATION_CREATED` · `OT_CREATED` · `OT_COMPLETED` · `CUSTOMER_CONFIRMED` · `CUSTOMER_CANCELLED` · `PAYMENT_REGISTERED` · `NOTE_CREATED`

Ampliar agregando claves en `activity-actions.ts` sin remover las existentes.

## 5. API pública

```ts
activity.record({
  companyId,
  module,
  entityType,
  entityId,
  employeeId, // opcional
  action,
  category,
  impact,
  origin,
  metadata, // opcional, default {}
})
```

Retorno controlado:

```ts
{ ok: true, data: ActivityEngineEvent }
{ ok: false, error: { code: "VALIDATION_ERROR" | "PERSISTENCE_ERROR", message, field? } }
```

### Validaciones obligatorias

- `companyId` (UUID)
- `module` (string no vacío)
- `entityType` (string no vacío)
- `entityId` (UUID)
- `action` ∈ catálogo
- `category` ∈ enum
- `impact` ∈ enum
- `origin` ∈ enum

Nunca inserta registros inconsistentes.

## 6. Ejemplo de uso

```ts
import {
  activity,
  ACTIVITY_ACTIONS,
  ACTIVITY_CATEGORIES,
  ACTIVITY_IMPACTS,
  ACTIVITY_ORIGINS,
} from "@/lib/activity-engine"

const result = await activity.record({
  companyId: "...",
  module: "atencion",
  entityType: "customer_atencion",
  entityId: "...",
  employeeId: "...",
  action: ACTIVITY_ACTIONS.NOTE_CREATED,
  category: ACTIVITY_CATEGORIES.COMMUNICATION,
  impact: ACTIVITY_IMPACTS.ACTIVITY,
  origin: ACTIVITY_ORIGINS.USER,
  metadata: { source: "manual-test" },
})

if (!result.ok) {
  console.error(result.error)
}
```

## 7. Cómo integrar un módulo en el futuro

1. No insertar en `activity_events` desde el dominio.
2. Desde código **server** (API route / server action / service), llamar `activity.record()`.
3. Elegir `action` del catálogo (o extender el catálogo primero).
4. Completar `category`, `impact`, `origin`.
5. Usar `entityType` / `entityId` del agregado de dominio.
6. Mantener historiales de dominio (p. ej. `customer_atencion_events`) si el producto los requiere; Activity Engine es transversal, no los reemplaza automáticamente.

Próximo sprint previsto: instrumentar **Atención al Cliente** usando esta API.

# Próximos pasos

- Aplicar migración `20261103000100_activity_engine_1_1a_foundation.sql`.
- Integrar Atención al Cliente (sprint siguiente).
- Evitar dual-write accidental con `lib/activity` hasta definir convivencia formal.

# Historial de cambios

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-07-25 | 0.1.0 | Foundation 1.1A documentada |
