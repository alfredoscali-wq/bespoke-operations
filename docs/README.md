---
id: BAS-README
title: Bespoke Architecture System
version: 0.1.0
status: Draft
owner: Architecture
last_updated: 2026-07-24
depends_on: []
related:
  - BAS-PROJECT-INDEX
  - BAS-AI-CONTEXT
  - BAS-WHY
  - BAS-README-CHATGPT
---

# Resumen

El **Bespoke Architecture System (BAS)** es la estructura documental oficial de Bespoke Operations. Define cómo se describe, decide y gobierna la arquitectura del producto.

# Objetivo

Establecer una fuente única y autoritativa de verdad arquitectónica para el proyecto, independiente del código de aplicación y de la base de datos.

# Alcance

Este documento explica qué es el BAS, qué tipos de documentos lo componen y cómo se relacionan entre sí.

No define decisiones de producto ni de implementación.

# Contenido

## Qué es el BAS

El BAS es el sistema documental que organiza la visión, los principios, el modelo universal, las arquitecturas funcionales y técnicas, las decisiones (ADR) y los patrones reutilizables de Bespoke Operations.

## Objetivo del sistema

- Gobernar el diseño del producto antes de implementarlo.
- Mantener coherencia entre dominios y sprints.
- Dar contexto estable a personas y a asistentes de IA.
- Separar claramente arquitectura, implementación y operación.

## Tipos de documentos

| Tipo | Ubicación | Rol |
|---|---|---|
| Visión | `architecture/vision` | Propósito y dirección del producto |
| Core Architecture | `architecture/core` | Núcleo estructural del sistema |
| Principios | `architecture/principles` | Reglas de diseño no negociables |
| Glosario | `architecture/glossary` | Lenguaje común del dominio |
| Modelo Universal | `architecture/universal` | Abstracciones transversales |
| Arquitecturas Funcionales | `architecture/functional` | Comportamiento por dominio |
| Arquitecturas Técnicas | `architecture/technical` | Realización técnica |
| ADR | `architecture/adr` | Decisiones registradas |
| Patrones | `architecture/patterns` | Soluciones reutilizables |
| Implementación | `implementation` | Roadmap y changelog del BAS |
| Plantillas | `/templates` | Formatos oficiales de autoría |

## Cómo se relacionan

1. La **visión** orienta el resto.
2. El **core**, los **principios** y el **glosario** estabilizan el lenguaje y las reglas.
3. El **modelo universal** define abstracciones compartidas.
4. Las **arquitecturas funcionales y técnicas** aplican ese marco a dominios concretos.
5. Los **ADR** congelan decisiones relevantes.
6. Los **patrones** capturan recurrencias aprobadas.
7. El **roadmap** y el **changelog** siguen la evolución del propio BAS.

## Fuente oficial

**La arquitectura documentada en el BAS es la fuente oficial del proyecto.**

El código, las migraciones y los componentes deben alinearse a esta documentación. Si hay divergencia, se actualiza primero la arquitectura correspondiente y después la implementación.

# Próximos pasos

- Completar el índice activo en `PROJECT_INDEX.md`.
- Redactar los documentos fundacionales en futuros Architecture Sprints.
- Usar las plantillas de `/templates` para nuevos documentos.

# Historial de cambios

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-07-24 | 0.1.0 | Creación inicial del BAS (BAS-001) |
