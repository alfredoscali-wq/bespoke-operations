---
id: BAS-AI-CONTEXT
title: AI Context — Bespoke Architecture System
version: 0.1.0
status: Draft
owner: Architecture
last_updated: 2026-07-24
depends_on:
  - BAS-README
  - BAS-PROJECT-INDEX
related:
  - BAS-WHY
  - BAS-README-CHATGPT
---

# Resumen

Contexto obligatorio para asistentes de IA que trabajen sobre Bespoke Operations. Define qué leer primero y qué reglas de gobernanza aplicar antes de proponer o implementar cambios.

# Objetivo

Evitar que una IA implemente funcionalidades o rediseños sin anclarse en la arquitectura oficial del BAS.

# Alcance

Orientado exclusivamente a asistentes de IA. No sustituye documentos de visión, core ni dominios; indica cómo usarlos.

# Contenido

## Qué es Bespoke

Bespoke Operations es una plataforma de inteligencia operacional. El BAS es su sistema documental oficial de arquitectura.

## Qué representa el Core

El **Core** es el núcleo estructural del sistema. Toda extensión funcional o técnica debe respetarlo. El contenido detallado del Core se documentará en `architecture/core` (pendiente de Architecture Sprints).

## Qué representa un Expediente

Un **Expediente** es una abstracción del dominio que agrupa el historial y el estado operativo relevante de una entidad de negocio a lo largo del tiempo. Su definición formal se completará en el glosario y en el modelo universal. Hasta entonces, no inventar semántica propia: consultar o solicitar la documentación oficial.

## Documentos que deben leerse primero

1. `docs/README.md` — qué es el BAS.
2. `docs/PROJECT_INDEX.md` — mapa y estados.
3. `docs/WHY.md` — propósito del proyecto.
4. `docs/AI_CONTEXT.md` — este documento.
5. Documentos `Approved` o `In Progress` del bloque afectado (visión, core, funcional, técnica, ADR, patrones).

## Regla de implementación

**Nunca debe implementarse una funcionalidad sin revisar previamente la arquitectura correspondiente.**

Si no existe documento arquitectónico para el cambio:

1. No inventar arquitectura en el código.
2. Señalar la ausencia.
3. Solicitar o redactar primero el documento del BAS (AF/AT/ADR según corresponda).
4. Recién entonces implementar.

# Próximos pasos

- Enlazar Core y Expediente a sus documentos oficiales cuando existan.
- Mantener esta guía alineada con `PROJECT_INDEX.md`.

# Historial de cambios

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-07-24 | 0.1.0 | Creación inicial orientada a IA (BAS-001) |
