---
id: BAS-README-CHATGPT
title: Flujo oficial de trabajo — ChatGPT / sesiones de arquitectura
version: 0.1.0
status: Draft
owner: Architecture
last_updated: 2026-07-24
depends_on:
  - BAS-README
  - BAS-PROJECT-INDEX
related:
  - BAS-AI-CONTEXT
  - BAS-ROADMAP
  - BAS-CHANGELOG
---

# Resumen

Define el flujo oficial de trabajo entre arquitectura, implementación, pruebas y producción, y las reglas para abrir y cerrar sesiones de documentación.

# Objetivo

Estandarizar cómo se inicia, ejecuta y cierra una conversación o sesión que afecte el BAS o el producto.

# Alcance

Proceso de trabajo. No incluye contenido arquitectónico de dominios.

# Contenido

## Flujo oficial

```text
Arquitectura
    ↓
Cursor
    ↓
Testing
    ↓
Producción
```

1. **Arquitectura** — decidir y documentar en el BAS.
2. **Cursor** — implementar según documentos aprobados o en progreso explícito.
3. **Testing** — validar comportamiento contra la arquitectura y los criterios acordados.
4. **Producción** — publicar solo lo alineado y verificado.

## Cómo iniciar una nueva conversación

1. Leer `docs/PROJECT_INDEX.md` (documento activo y próxima sesión).
2. Leer `docs/AI_CONTEXT.md`.
3. Leer los documentos del bloque a trabajar (si existen).
4. Declarar el objetivo de la sesión y el alcance.
5. No implementar código hasta revisar la arquitectura correspondiente.

## Cómo cerrar una sesión

1. Resumir decisiones y documentos tocados.
2. Actualizar estados en `PROJECT_INDEX.md` si corresponde.
3. Registrar cambios del BAS en `implementation/CHANGELOG.md`.
4. Indicar la próxima sesión en `PROJECT_INDEX.md`.
5. No dejar decisiones solo en el chat: deben quedar en el BAS.

## Cómo registrar cambios arquitectónicos

1. Usar la plantilla adecuada en `/templates`.
2. Crear o actualizar el documento en la carpeta correspondiente.
3. Actualizar `depends_on` / `related` y el índice.
4. Entrar el cambio en `implementation/CHANGELOG.md`.
5. Si implica código, el cambio de implementación ocurre después, en Cursor, siguiendo el flujo oficial.

# Próximos pasos

- Refinar checklists de apertura/cierre cuando existan más documentos `Approved`.
- Vincular este flujo a sprints concretos del roadmap.

# Historial de cambios

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-07-24 | 0.1.0 | Flujo oficial inicial (BAS-001) |
