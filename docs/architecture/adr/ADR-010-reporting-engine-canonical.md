---
id: ADR-010
title: Reporting Engine — arquitectura canónica (solo lectura analítica)
version: 1.1.0
status: Accepted
owner: Architecture
last_updated: 2026-07-27
depends_on:
  - ADR-001 (Engine First)
  - ADR-002 (Pantallas operativas muestran el presente)
  - ADR-003 (Históricos pertenecen al Reporting Engine)
  - ADR-009 (Activity Engine canónico)
related:
  - Master Project Context v1.0
  - Auditoría Reporting Engine Sprint 0 (2026-07-27)
  - ADR-009-activity-engine-canonical.md
---

# Resumen

**Reporting Engine es la capa oficial de lectura analítica de Bespoke Operations.**

Su responsabilidad es interpretar la información generada por los motores y
dominios del sistema para producir indicadores, métricas, tendencias e informes
históricos.

Reporting:

- **nunca registra hechos**;
- **nunca modifica datos**;
- **nunca escribe información**;
- **únicamente interpreta información existente**.

La implementación canónica vivirá en `lib/reporting-engine` (construcción
progresiva). La capa actual `lib/reports` continúa como **legacy** con
migración gradual e incremental. **No Big Bang.**

# Objetivo

Unificar consultas históricas, KPIs de período, exportaciones y alimentación de
IA / Automation bajo un contrato de solo lectura, alineado a Engine First y a
la separación Operación (presente) vs Análisis (histórico).

# Alcance

Incluye: propósito, principios, fuentes, consumidores, relación con Dashboard,
estrategia de migración y reglas de diseño.

No incluye: implementación de código en este documento, migraciones SQL,
pantallas, refactors ni eliminación inmediata de `lib/reports`.

# Contenido

## Estado de la decisión

Accepted

## Contexto

La auditoría Sprint 0 confirma:

- No existía un Reporting Engine canónico.
- Existe un módulo Reportes (`/reportes`, `lib/reports/**`) con agregaciones
  principalmente client-side sobre providers.
- KPIs y métricas están distribuidos (Dashboard, Atención, Calendario, Tesorería,
  Comercial, OIE/Activity Viewer, etc.).
- Activity Engine se consume en el viewer/OIE, no en Reportes operativos.
- Presence Engine aún no alimenta reportes.
- No hay views/materialized views dedicadas a reporting.

Sin ADR, cada módulo inventa “su” analítica y se contradice ADR-003.

## Problema

1. Históricos y KPIs de período viven fuera de un motor único.
2. Duplicación de cumplimiento OT, vencidas, métricas de obra y “actividad”.
3. Riesgo de contaminar pantallas operativas con análisis histórico.
4. Activity / Presence no tienen un consumidor analítico oficial.
5. IA y Automation no tienen un contrato estable de lectura.

## Propósito

Reporting Engine es la capa oficial de lectura analítica de Bespoke Operations.

Su responsabilidad es interpretar la información generada por los motores y
dominios del sistema para producir indicadores, métricas, tendencias e informes
históricos.

**Queda explícitamente establecido que Reporting:**

- nunca registra hechos;
- nunca modifica datos;
- nunca escribe información;
- únicamente interpreta información existente.

No sustituye el estado operativo del “ahora” (Dashboard / módulos).

## Principios

1. **Reporting solo lee.**
2. **Reporting nunca escribe.**
3. **Reporting nunca modifica.**
4. **Reporting nunca registra eventos** (ni Activity, ni Presence, ni audit).
5. **Reporting centraliza toda la lógica analítica histórica.**
6. **Toda nueva consulta histórica deberá implementarse primero dentro del
   Reporting Engine** (cuando exista el módulo canónico; hasta entonces, no
   crear nuevos helpers analíticos ad hoc fuera de la estrategia de migración).
7. **Las pantallas, APIs, exportaciones, procesos automáticos y futuros
   consumidores (IA / Automation) deberán consumir Reporting Engine** y no
   implementar lógica analítica propia.
8. **No es fuente de verdad del presente** — eso pertenece a módulos operativos
   y al Dashboard.
9. **Independiente de React y de Android** (Engine First).

## Fuentes oficiales

Reporting interpreta conjuntamente estas fuentes. **Ninguna reemplaza a otra.**

| Fuente | Responsabilidad |
|--------|-----------------|
| **Dominios del negocio** (Tasks, Projects, Employees, Customers, Treasury, Customer Service, Commercial, etc.) | Representan el **estado** del negocio. |
| **Activity Engine** | Representa los **hechos ocurridos** (memoria histórica transversal). |
| **Presence Engine** | Representa la **presencia física** y el **tiempo efectivo** (ENTER/EXIT; HEARTBEAT es telemetría, no KPI de negocio por defecto). |

Reporting **solo consume** estas fuentes. **No escribe** en dominios, Activity
ni Presence.

Dominios de lectura previstos (no exhaustivo): Tasks, Projects, Employees/Crews,
Customers, Treasury, Customer Service, Commercial, Incidents, Evidence,
Materials, y futuros dominios con el mismo patrón.

## Consumidores

Reporting será consumido por:

- Dashboard (solo KPI histórico acotado vía API del engine; por defecto el
  Dashboard es “presente”)
- Módulo Reportes (UI)
- Reportes Automáticos
- Exportaciones (PDF / XLSX / futuros formatos)
- Automation Engine (lectura de indicadores — Reporting no ejecuta acciones)
- IA (análisis / predicción / asistentes — Reporting no escribe sugerencias
  como hechos)

Todos deben consumir el engine; **no** reimplementar lógica analítica propia.

## Relación con Dashboard

| | Dashboard | Reporting Engine |
|---|---|---|
| Pregunta | **¿Qué está pasando ahora?** | **¿Qué ocurrió durante un período?** |
| Tiempo | Presente operativo | Histórico / rangos |
| Fuente típica | Estado actual de módulos | Agregaciones + Activity + Presence + dominio |
| Escritura | No vía Reporting | Nunca |

**Dashboard no reemplaza Reporting.**  
**Reporting no reemplaza Dashboard.**

Las pantallas operativas no deben convertirse en reportes históricos
(ADR-002 / ADR-003).

## Ubicación canónica

**Construcción progresiva (sprints de código futuros):**

- `lib/reporting-engine/` — API pública de lectura (queries, métricas, períodos,
  adapters de datos para exportación).

Este ADR fija el contrato. La implementación queda pendiente.

## Legacy / compatibilidad

| Componente | Rol |
|---|---|
| `lib/reports/**` | **Legacy.** Continúa funcionando. Migración incremental. |
| `lib/reporting-engine/` | **Canónico.** Se construye progresivamente. |
| UI `/reportes` | Consumidora; migrará a llamar al engine. |
| `lib/data/dashboard.ts` | Presente del Dashboard; no es Reporting Engine. |
| OIE / Activity Viewer | Lectura de Activity; podrá reutilizar métricas del engine. |

## Migración gradual

1. **No Big Bang.**
2. `lib/reports` continuará funcionando como capa legacy.
3. `lib/reporting-engine` será construido progresivamente.
4. Las migraciones deberán ser **incrementales**.
5. Toda nueva consulta histórica se implementa primero en el Reporting Engine.
6. Builders actuales (`management-report`, `crew-productivity`, `weekly-metrics`,
   etc.) podrán envolverse o reubicarse como adapters internos.
7. Reportes Automáticos migran cuando el engine ofrezca métricas equivalentes.
8. Unificar duplicaciones (cumplimiento OT, vencidas, métricas de obra) solo
   vía el engine, sin romper pantallas.

## Reglas de diseño

1. Si una pantalla necesita “qué pasó en un período”, pregunta al Reporting
   Engine — no recalcula ad hoc en el componente.
2. Si un dato es un hecho nuevo, pertenece a Activity (ADR-009) o al dominio;
   Reporting solo lo interpreta después.
3. Presence HEARTBEAT es telemetría; KPIs de presencia de negocio se basan en
   ENTER/EXIT (y agregaciones derivadas documentadas).
4. Exportaciones obtienen datasets del engine; el formateo PDF/XLSX puede vivir
   en adapters, sin lógica analítica en la UI.
5. Evitar dependencias circulares: Reporting lee Activity/Presence/dominio;
   Activity/Presence **no** dependen de Reporting.

## Alternativas consideradas

1. **Declarar `lib/reports` como el engine canónico sin cambio de contrato** —
   rechazada: no impone solo-lectura ni fuentes Activity/Presence, y no escala
   a Automation/IA.
2. **Todo histórico en SQL views desde el día 1** — pospuesta: optimización
   futura; el ADR primero fija el contrato de aplicación.
3. **Fusionar Dashboard y Reporting** — rechazada: contradice ADR-002/003.

## Consecuencias

**Positivas**

- Contrato oficial Accepted de solo lectura.
- Camino oficial Activity + Presence → analítica.
- Separación presente / histórico reforzada.
- Fuente única para reportes históricos (arquitectura).

**Costos**

- Convivencia `lib/reports` + `lib/reporting-engine`.
- Disciplina de PR: rechazar analítica nueva fuera del engine.

**Riesgos**

- Migración incompleta con dos “verdades” de KPI.
- Tentación de escribir desde Reporting (prohibido).

## Documentos relacionados

- Master Project Context v1.0 — Reporting Engine
- Auditoría Reporting Sprint 0 (2026-07-27)
- ADR-009 Activity Engine canónico
- `docs/03-engines/` (actualizar en el primer sprint de implementación)

# Plan de evolución por etapas

| Etapa | Qué | Resultado |
|---|---|---|
| **0** | Aceptar ADR-010 | Contrato oficial — **hecho** |
| **1** | Crear `lib/reporting-engine` (API lectura mínima + métricas piloto) | Canónico nace |
| **2** | Envolver cumplimiento OT / productividad cuadrilla | Duplicación ↓ |
| **3** | Conectar Activity (hechos de período) | Memoria transversal en Reportes |
| **4** | Conectar Presence (tiempo efectivo ENTER/EXIT) | KPI presencia |
| **5** | Migrar Reportes Automáticos al engine | Un solo contrato |
| **6** | Deprecar helpers legacy no usados | Capa única |

# Próximos pasos

1. ~~Marcar ADR como Accepted y anclarlo en Master Project Context.~~ Hecho.
2. Primer sprint de código: scaffold `lib/reporting-engine` sin romper
   `lib/reports` ni UI.

# Historial de cambios

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-07-27 | 1.0.0 | Propuesta inicial post-auditoría Reporting Sprint 0 |
| 2026-07-27 | 1.1.0 | Accepted: definición oficial, principios ampliados, fuentes diferenciadas, migración explícita |
