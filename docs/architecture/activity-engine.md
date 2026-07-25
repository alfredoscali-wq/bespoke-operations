---
id: AT-ACTIVITY-ENGINE-1-1A
title: Activity Engine — Foundation & Customer Service Integration
version: 0.2.0
status: Draft
owner: Architecture
last_updated: 2026-07-25
depends_on: []
related:
  - BAS-AI-CONTEXT
---

# Resumen

Documentación técnica del Activity Engine: foundation (`activity.record()`), integración con **Atención al Cliente** (1.1B) y registro unificado de interacciones con el cliente (1.1C).

# Objetivo

Proveer un motor reutilizable para registrar actividad operativa desde cualquier módulo, y registrar automáticamente las acciones importantes de expedientes de Atención al Cliente sin cambiar la UX.

# Alcance

Incluye:

- Módulo `lib/activity-engine/`
- Extensión aditiva de `public.activity_events`
- RPC `record_activity_engine_event`
- Validaciones y API pública (`title` / `description` opcionales)
- Integración Customer Service vía `registerCustomerActivity` → `activity.record()`

No incluye:

- Timeline / Dashboard / KPIs / Panel de empleados
- `activity_sessions`
- Sustitución de `customer_atencion_events`
- Cambios de UI / permisos / RLS / workflows

# Contenido

## 1. Objetivo del motor

Centralizar el registro de hechos operativos para construir el historial operativo real de cada empleado.

Todos los módulos deben escribir actividad **solo** mediante `activity.record()`. No deben insertar en `activity_events` ni invocar la RPC.

## 2. Arquitectura

```text
Customer Service (u otro dominio)
    ↓
registerCustomerActivity()   ← helper de dominio (prepara payload)
    ↓
activity.record()            ← API pública única
    ↓
record_activity_engine_event (SECURITY DEFINER / service_role)
    ↓
public.activity_events
```

Reglas:

- Atención al Cliente **nunca** accede a `activity_events` ni a la RPC.
- La persistencia pertenece al Activity Engine.
- `customer_atencion_events` sigue siendo el historial de dominio del expediente.

## 3. Tabla `activity_events`

Store multi-tenant (Activity Engine 1.0 + columnas 1.1A). RLS: SELECT por `company_id`; escrituras vía RPC service_role.

`title` / `description` se guardan dentro de `metadata` (listos para Timeline futuro).

## 4. Enumeraciones y acciones

Category / Impact / Origin: sin cambios respecto a 1.1A.

Acciones ampliadas: incluye `CASE_CREATED` y `CASE_CLOSED`.

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
  metadata, // opcional
  title, // opcional — Timeline
  description, // opcional — Timeline
})
```

Si `title` / `description` no se envían, el motor funciona igual.

## 6. Integración con Customer Service (1.1B)

### Helper

```ts
import { registerCustomerActivity } from "@/lib/customer-atenciones/register-customer-activity"

await registerCustomerActivity({
  companyId,
  entityId: atencionId,
  employeeId,
  action: ACTIVITY_ACTIONS.CASE_CREATED,
  category: ACTIVITY_CATEGORIES.FOLLOW_UP,
  impact: ACTIVITY_IMPACTS.ACTIVITY,
  title: "Expediente creado",
  metadata: { customer_id, motivo, canal, estado_inicial },
})
```

Siempre termina en `activity.record()` con `module: "customer_service"` y `entityType: "customer_atencion"`.

### Eventos implementados

| Evento | Cuándo |
|---|---|
| `CASE_CREATED` | Alta de expediente |
| `CASE_CLOSED` | Resolución / cierre (alta ya resuelta o OT que cierra) |
| `CUSTOMER_INTERACTION` | Contacto con el cliente (acción «Registrar interacción») |
| `FOLLOW_UP_CREATED` | Seguimiento de proceso (p. ej. tracking Morosos) |
| `NOTE_CREATED` | Interacción tipo nota (longitud; sin texto) |
| `STATUS_CHANGED` | Cambio de status (start / defer / resolve) |
| `NEXT_STEP_CHANGED` | Cambio de next_step |
| `DERIVATION_CREATED` | Defer a next_step de derivación (`from_area` / `to_area` = códigos) |
| `OT_CREATED` | Vinculación de OT |

### Interacciones con el cliente (1.1C)

- UI: única acción **Registrar interacción** → modal (medio, resultado, observaciones opcionales, next_step opcional).
- Historial de dominio: `register_customer_atencion_interaction` (`interaccion_registrada`).
- Activity Engine: `CUSTOMER_INTERACTION` vía `activity.record()` (`category: CONTACT`, `impact: ACTIVITY`).
- Metadata mínima: `medio`, `resultado`, `next_step`, `expediente`, `customer_id`.
- No muta status ni bandeja; el next_step opcional se registra en historial/metadata sin defer.

### Buenas prácticas

1. Usar builders en `customer-activity-events.ts`.
2. Emitir best-effort (`registerCustomerActivitySafe`) — no romper el flujo de negocio.
3. No guardar el texto completo de notas.
4. No hardcodear nombres de área: usar códigos de `next_step`.
5. Mantener `customer_atencion_events` como timeline de dominio.

## 7. Cómo integrar otro módulo

1. Helper de dominio → solo `activity.record()`.
2. Extender catálogo de acciones si hace falta.
3. Instrumentar mutaciones server-side (o puente API si el alta es browser).
4. No tocar `activity_events` desde el dominio.

# Próximos pasos

- Timeline / lectura de `title` + `description` desde metadata.
- Convivencia formal con `lib/activity` (OIE 1.0).

# Historial de cambios

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-07-25 | 0.1.0 | Foundation 1.1A documentada |
| 2026-07-25 | 0.2.0 | Integración Customer Service 1.1B |
| 2026-07-25 | 0.3.0 | Registro de interacciones con el cliente 1.1C |
