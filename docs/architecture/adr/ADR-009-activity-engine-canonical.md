---
id: ADR-009
title: Activity Engine canónico — unificación y estrategia de evolución
version: 1.2.0
status: Accepted
owner: Architecture
last_updated: 2026-07-27
depends_on:
  - ADR-001 (Engine First)
  - ADR-004 (Toda acción importante genera Activity)
related:
  - Master Project Context v1.0
  - Auditoría técnica Activity Engine (2026-07-27)
---

# Resumen

Se declara el motor ubicado en `lib/activity-engine` (`activity.record`) como el
**Activity Engine oficial** del sistema.

La capa `lib/activity` (API histórica / OIE) queda como **legacy / compatibilidad**
sobre la misma tabla `activity_events`, con migración gradual y sin big-bang.

# Objetivo

Definir el camino arquitectónico oficial para registrar hechos transversales de
negocio, evitar dobles catálogos divergentes y preparar Activity como fuente
común de Reporting, Automation e IA.

# Alcance

Incluye: API de escritura, catálogo semántico, relación con historiales de módulo,
reglas de integración, criterios de “evento de negocio” y plan por etapas.

No incluye: implementación, migraciones de datos, cambios de UI ni eliminación
inmediata de writers legacy.

# Contenido

## Estado de la decisión

Accepted

## Contexto

La auditoría confirma:

- Una sola tabla física: `public.activity_events`.
- Dos APIs de escritura coexistentes:
  - canónica emergente en `lib/activity-engine` (`activity.record` /
    RPC `record_activity_engine_event`);
  - legacy en `lib/activity` (`recordActivityEvent` /
    RPC `record_activity_event`).
- Dos catálogos de acciones (operativo amplio vs semántico del engine canónico).
- Instrumentación parcial (Atención vía engine canónico; OT/Planning/Obras/Tesorería
  vía legacy).
- Historiales de dominio paralelos (`customer_atencion_events`,
  `commercial_activities`, `system_audit_log`, etc.).
- Consumo de `activity_events` concentrado en Activity Viewer; Dashboard y
  Timelines de expediente no lo usan como fuente.

Sin un canónico claro, la visión Engine First se debilita en cada sprint nuevo.

## Problema

Sin ADR:

1. Nuevos módulos no saben por cuál API escribir.
2. Crece la divergencia semántica (`origin`, actions, category/impact).
3. Reporting / Automation / IA no pueden asumir un contrato estable.
4. Se corre el riesgo de crear un tercer writer o duplicar “activity” por módulo.
5. Se mezclan hechos de negocio con ruido técnico o intenciones futuras.

## Visión arquitectónica

El Activity Engine representa la **memoria histórica de los hechos relevantes del
negocio** y debe permitir **reconstruir la historia operacional de la empresa
independientemente del estado actual de los módulos**.

Las pantallas muestran el presente. Activity conserva el pasado. Reporting,
Automation e IA consumen esa memoria; no la reinventan por módulo.

## Principios fundamentales

### Activity registra hechos, no intenciones

El Activity Engine solo registra hechos que **realmente ocurrieron**.

No registra:

- predicciones;
- reglas;
- tareas futuras;
- sugerencias;
- decisiones o planes de Automation o IA;
- estados deseados o “próximos pasos” como si ya hubieran ocurrido.

Si algo “debería ocurrir” o “se recomienda”, pertenece a otro Engine
(Automation, Planning, IA). Si ya ocurrió y es relevante para el negocio,
pertenece a Activity.

### Regla de oro

Todo evento registrado en Activity debe poder responder claramente:

> **¿Qué hecho relevante ocurrió en el negocio?**

Si no puede responderla de forma nítida, **probablemente no pertenece** al
Activity Engine.

## Eventos de negocio

Activity solo registra **hechos relevantes del negocio**.

**Sí (ejemplos):**

- se creó / cerró un expediente;
- se asignó o reprogramó una OT;
- se inició ejecución en campo;
- se registró una interacción con el cliente;
- se generó una OT desde Atención;
- ocurrió un hecho de presencia con significado operativo (p. ej. ingreso real
  al radio del cliente), cuando se defina como hecho de negocio.

**No (salvo que representen un hecho de negocio explícito):**

- clicks de UI;
- apertura/cierre de modales;
- cambios de pestaña o filtros;
- navegación;
- heartbeats técnicos;
- logs de red, reintentos o telemetría de cliente;
- ruido de sincronización offline sin significado de negocio.

Los heartbeats u otros señales técnicas pueden vivir en stores especializados
(p. ej. Presence). Solo se proyectan a Activity cuando el producto define que
constituyen un **hecho de negocio** (no por defecto).

## Decisión arquitectónica

### 1. Activity Engine oficial

**Oficial:** el Activity Engine ubicado en **`lib/activity-engine`**.

- Punto público de escritura: **`activity.record(...)`** (server-only).
- Persistencia autorizada: RPC **`record_activity_engine_event`**.
- Store canónico: **`activity_events`**.
- Modelo semántico obligatorio en escrituras nuevas:
  `module`, `entityType`, `entityId`, `action`, `category`, `impact`, `origin`,
  `metadata` (+ `title` / `description` en metadata cuando aplique Timeline).

### 2. Legacy / compatibilidad

Quedan como **legacy compat** (permitidos temporalmente, no ampliables):

| Componente | Rol |
|---|---|
| `lib/activity/*` (service, catalog histórico, validate, client-policy) | Writers y catálogo legacy |
| RPC `record_activity_event` | Escritura legacy |
| Adapters actuales (`tasks-activity`, `planning-activity`, `projects-activity.server`, `treasury-activity`) | Bridges legacy hasta migración |
| `POST /api/activity/events` (contrato legacy) | Entrada client legacy acotada |
| Activity Viewer / stats actuales | Lectura compatible de filas legacy y canónicas |

**No son legacy del Engine** (siguen siendo historiales de dominio válidos):

- `customer_atencion_events`, `commercial_activities`, `project_history`,
  `task_operational_events`, `system_audit_log`.

### 3. Único punto autorizado para registrar eventos

**Regla dura (a partir de la aceptación de este ADR):**

1. Ningún módulo inserta en `activity_events` directamente.
2. Ningún módulo nuevo llama RPC de activity directamente.
3. Escrituras **nuevas** solo vía:
   - `activity.record(...)`, o
   - un **bridge de dominio** thin (ej. `registerCustomerActivity`) que
     termine siempre en `activity.record(...)`.
4. Writers legacy existentes se mantienen solo para código ya instrumentado,
   hasta su migración. **Prohibido** agregar nuevos call sites a
   `recordActivityEvent*` / `recordActivityEventClient` / adapters legacy
   salvo hotfix crítico documentado.
5. Todo evento nuevo debe pasar la regla de oro y el filtro de eventos de negocio.

### 4. Reglas para incorporar nuevos módulos

Antes de instrumentar un módulo:

1. ¿Es un hecho de negocio que ya ocurrió? Si es intención, predicción o UI → no.
2. ¿Responde la regla de oro? Si no → no va a Activity.
3. ¿Existe `action` / `category` / `impact` adecuados en el catálogo de
   `lib/activity-engine`? Si no → extender ese catálogo, sin crear motor paralelo.
4. Crear bridge de dominio (`registerXActivity`) → `activity.record`.
5. Best-effort (`*Safe`) en flujos operativos: fallar el registro no debe
   romper el flujo principal.
6. Mantener, si hace falta, el historial propio del expediente/módulo para UX
   de Timeline local.
7. Mobile/Web consumen la misma semántica vía API server; el cliente no decide
   persistencia.

### 5. Estrategia de migración gradual

Sin big-bang. Sin migración destructiva de filas históricas.

**Etapa A — Congelar legacy**  
No nuevos call sites legacy. Aceptar este ADR.

**Etapa B — Bridges canónicos por dominio**  
Prioridad sugerida: Presence → Comercial → OT/Planning residual → Tesorería →
resto catalogado sin uso.

**Etapa C — Compat lectura**  
Viewer/Reporting leen ambas formas de fila; normalizar en capa de lectura
(`category`/`impact` null en legacy).

**Etapa D — Deprecar writers legacy**  
Eliminar adapters/client POST legacy cuando no queden call sites. La RPC legacy
puede permanecer deprecated hasta ventana segura.

**Etapa E — Unificación de catálogo**  
Mapear actions legacy → semántica del engine canónico (tabla de equivalencias).
No reescribir historia salvo necesidad de Reporting.

### 6. Responsabilidades del Activity Engine

**Sí:**

- Registrar hechos relevantes de negocio (append-only).
- Conservar la memoria histórica operacional transversal.
- Garantizar multiempresa y trazabilidad (quién / qué / cuándo / sobre qué).
- Exponer un contrato estable para consultas transversales.
- Ser fuente de hechos para Reporting, Automation e IA.

**No:**

- Timeline UX exclusivo de un expediente (puede proyectarse desde Activity + dominio).
- Estados operativos actuales (módulo / Planning / Presence state).
- Intenciones, predicciones, sugerencias o reglas.
- Notificaciones, jobs o automatizaciones (Automation / Notification).
- Auditoría técnica infra-only cuando no es hecho de negocio
  (`system_audit_log` puede coexistir).
- Almacenar archivos (Attachment Engine).

### 7. Activity vs historiales de módulo

| Pertenece a Activity Engine | Permanece en historial de módulo |
|---|---|
| Hecho transversal reutilizable (“OT iniciada”, “expediente cerrado”, “ingreso al radio del cliente”) | Detalle interno del flujo (pasos UI, borradores, campos efímeros) |
| Correlación entre módulos (Atención → OT, Comercial → Cliente) | Payload completo del evento de dominio |
| Señal para KPIs / alertas / IA | Adjuntos y contenido rico (vía Attachment + referencias) |
| Actor, entidad, action semántica, metadata mínima | Orden/formato exclusivo del Timeline del expediente |

**Regla:** el historial de módulo puede ser más denso; Activity debe ser
**estable, semántico y consultable**. Dual-write dominio + Activity es válido
cuando el Timeline local necesita el evento de dominio.

### 8. Principios para Reporting, Automation e IA

1. **Reporting** consume hechos de Activity (y otros engines) — nunca inventa
   historial en pantallas operativas (ADR-002 / ADR-003).
2. **Automation** reacciona a hechos ya ocurridos (actions/category/impact y
   metadata acordada). Automation **no escribe intenciones** en Activity; si
   ejecuta una acción de negocio real, esa acción sí puede registrarse como hecho.
3. **IA** trata Activity como memoria de hechos; no como source of truth del
   estado actual ni como bitácora de sugerencias.
4. Presence/Attachment/Planning emiten Activity solo cuando el evento es un
   hecho de negocio (regla de oro). Heartbeats técnicos no van a Activity por defecto.
5. Los contratos de `action` se versionan por extensión (agregar), no por
   renombre breaking sin capa de compat.

## Alternativas consideradas

1. **Declarar la capa `lib/activity` como canónica** — rechazada: el facade
   oficial y el bridge de Atención ya apuntan a `lib/activity-engine`.
2. **Dos stores separados** — rechazada: viola Engine único y complica Reporting.
3. **Big-bang rewrite** — rechazada: alto riesgo; contradice migración gradual.
4. **Solo historiales de módulo** — rechazada: rompe ADR-004 y la visión transversal.

## Consecuencias

**Positivas**

- Un contrato claro para sprints futuros.
- Criterio explícito de qué sí / qué no registrar.
- Menos divergencia semántica.
- Base sólida para Reporting / Automation / IA.
- Historiales de módulo preservados.

**Negativas / costos**

- Convivencia temporal de dos writers.
- Viewer debe tolerar filas heterogéneas.
- Esfuerzo de bridges y mapa de equivalencias.
- Disciplina de PR: rechazar nuevos usos legacy y ruido técnico.

**Riesgos**

- Hotfixes que reabran writers legacy.
- Sobrecarga de Activity con telemetría o heartbeats.
- Comercial/Presence si se integran tarde y crean stores paralelos “tipo activity”.

## Documentos relacionados

- Master Project Context v1.0 (Activity Engine, ADR-001..009)
- Auditoría Activity Engine (2026-07-27)
- `docs/03-engines/activity-engine.md`

# Plan de evolución por etapas

| Etapa | Qué | Resultado |
|---|---|---|
| **0** | Aceptar ADR-009 | Canónico oficial documentado |
| **1** | Congelar nuevos call sites legacy + checklist de PR (regla de oro) | Deuda contenida |
| **2** | Presence Backend emite hechos vía `activity.record` (solo hechos relevantes) | Primer módulo nuevo 100% canónico |
| **3** | Bridge Comercial → Activity (sin eliminar `commercial_activities`) | Comercial alimenta motor transversal |
| **4** | Migrar adapters OT/Planning/Obras/Tesorería a bridges canónicos | Writers legacy residuales ↓ |
| **5** | Capa de lectura unificada para Reporting | KPIs sobre Activity |
| **6** | Deprecar API/RPC/adapters legacy | Un solo camino de escritura |

# Próximos pasos

1. ~~Revisar y marcar este ADR como Accepted.~~ Hecho.
2. ~~Anclarlo en Master Project Context (ADR-009).~~ Hecho.
3. En el siguiente sprint de código: solo Etapa 1 (guardrails/docs/checklist),
   sin refactor masivo.

# Historial de cambios

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-07-27 | 1.0.0 | Propuesta inicial post-auditoría |
| 2026-07-27 | 1.1.0 | Revisión final: canónico = `lib/activity-engine`; hechos ≠ intenciones; eventos de negocio; regla de oro; visión de memoria histórica |
| 2026-07-27 | 1.2.0 | Estado Accepted; incorporado al Master Project Context |
