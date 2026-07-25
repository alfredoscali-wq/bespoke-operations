---
id: AUDIT-CUSTOMER-SERVICE-PRODUCT
title: Auditoría funcional — Atención al Cliente
version: 0.1.0
status: Draft
owner: Architecture
last_updated: 2026-07-24
depends_on: []
related:
  - BAS-PROJECT-INDEX
---

# Resumen

Auditoría funcional de solo lectura del módulo **Atención al Cliente** de Bespoke Operations. Describe la arquitectura actual, flujos, funcionalidades, automatizaciones, integraciones, modelo de datos, pendientes y oportunidades detectadas.

**Alcance de esta auditoría:** análisis documental. Sin modificaciones de código, sin refactor, sin correcciones.

**Fecha de análisis:** 2026-07-24.

# Objetivo

Documentar el estado real del módulo tal como está implementado, para servir de base a decisiones de producto y arquitectura posteriores.

# Alcance

Incluye:

- Rutas, UI, provider, APIs, dominio (`lib/customer-atenciones` y circuitos relacionados).
- Consultas (`customer_atenciones`), eventos, gestión exclusiva, seguimientos, retenciones, recuperaciones, equipo.
- Integraciones observadas en código.

No incluye:

- Cambios de implementación.
- Validación runtime en producción.
- Auditoría de performance o seguridad exhaustiva.

# Contenido

# 1. Arquitectura actual

## 1.1 Rutas

### Páginas (dashboard)

| Ruta | Archivo | Rol |
|---|---|---|
| `/atencion-cliente` | `app/(dashboard)/atencion-cliente/page.tsx` | Workbench principal (inbox compartido + KPIs + nueva consulta) |
| `/atencion-cliente/[id]` | `app/(dashboard)/atencion-cliente/[id]/page.tsx` | Expediente / detalle de consulta |
| Layout | `app/(dashboard)/atencion-cliente/layout.tsx` | Envuelve el módulo con `AtencionClienteProvider` |

### API (`app/api/atencion-cliente/`)

| Método / ruta | Propósito |
|---|---|
| `POST /api/atencion-cliente/release-expired-managements` | Liberación lazy de locks por inactividad |
| `POST /api/atencion-cliente/[atencionId]/start-management` | Iniciar gestión exclusiva |
| `POST /api/atencion-cliente/[atencionId]/cancel-management` | Cancelar gestión (sin cerrar historial de resolución) |
| `POST /api/atencion-cliente/[atencionId]/touch-management` | Heartbeat de actividad del lock |
| `POST /api/atencion-cliente/[atencionId]/resolve` | Resolver consulta |
| `POST /api/atencion-cliente/[atencionId]/defer` | Diferir / continuar con `next_step` |
| `POST /api/atencion-cliente/[atencionId]/moroso-tracking` | Actualizar tracking de morosos |
| `POST /api/atencion-cliente/[atencionId]/interaction` | Registrar interacción (contacto/nota/etc.) |
| `POST /api/atencion-cliente/[atencionId]/link-ot` | Vincular consulta a OT (`tasks`) |
| `POST /api/atencion-cliente/[atencionId]/permanent-delete` | Hard delete admin |

No existen rutas de página dedicadas a `/recupero`, `/retenciones` o `/seguimientos`; esos circuitos viven como datos + diálogos/secciones del módulo.

### Navegación / módulo

- Nav: `atencionClienteNavItem` → `/atencion-cliente` (`lib/navigation/nav-items.ts`).
- Module key: `atencion_cliente` (`lib/roles/app-modules.ts`), group `operations`.
- Acceso: visibilidad por `module_visibility` + helpers en `lib/customer-atenciones/module-access.ts`.

## 1.2 Componentes

Directorio: `components/atencion-cliente/` (~40 archivos).

### Shell activo

| Componente | Propósito |
|---|---|
| `atencion-cliente-provider.tsx` | Contexto: inbox, datasets personales, mutaciones, flags de permiso, demo read-only |
| `atencion-cliente-module.tsx` | Workbench: KPIs, bandeja, panel de trabajo, toggle Equipo, nueva consulta |
| `atencion-detail-screen.tsx` | Expediente completo (página y panel): acciones, bandejas, timeline |
| `consultation-work-panel.tsx` | Modal de trabajo sobre una consulta desde el inbox |
| `consultation-workbench-header.tsx` | Título, búsqueda, CTA Nueva Consulta |
| `consultation-kpi-strip.tsx` | KPIs estratégicos + filtros de bandejas operativas |
| `consultation-inbox-section.tsx` | Lista compartida + filtros + apertura de fila |
| `active-management-banner.tsx` | Banner si el operador tiene una consulta `en_gestion` |
| `equipo-section.tsx` | Informe individual de equipo (solo administrador) |

### Detalle / decisión / historial

| Componente | Propósito |
|---|---|
| `consultation-status-badge.tsx` | Badge de estado |
| `consultation-situation-summary-card.tsx` | Resumen situacional del expediente |
| `consultation-events-timeline.tsx` | Timeline de eventos |
| `consultation-decision-center.tsx` | Acciones de decisión + asistente guiado |
| `consultation-detail-panel-ui.tsx` | Contenedores visuales del panel |
| `consultation-historical-day-summary-card.tsx` | Resumen histórico del día |
| `consultation-contact-activity-block.tsx` | Registro de intentos de contacto |
| `moroso-tracking-block.tsx` | Avance de morosos |
| `ot-link-block.tsx` | Crear/vincular OT |

### Diálogos

| Componente | Propósito |
|---|---|
| `atencion-form-dialog.tsx` | Alta de consulta (+ cliente rápido opcional) |
| `exclusive-management-dialog.tsx` | Bloqueo al intentar una 2.ª gestión activa |
| `locked-consultation-dialog.tsx` | Consulta bloqueada por otro operador |
| `consultation-permanent-delete-dialog.tsx` | Confirmación hard delete |
| `administration-result-dialog.tsx` | Resultado de bandeja Administración |
| `retention-result-dialog.tsx` | Resultado de bandeja Retenciones (consulta) |
| `technical-result-dialog.tsx` | Resultado de bandeja Técnica |
| `seguimiento-work-dialog.tsx` | Completar seguimiento / reprogramar |
| `retencion-work-dialog.tsx` | Trabajar/resolver caso de retención (entidad) |
| `retencion-view-dialog.tsx` | Supervisar retención + listo para retiro |
| `retencion-create-dialog.tsx` | Crear retención (entidad) |
| `recupero-form-dialog.tsx` | Crear recupero |
| `recupero-view-dialog.tsx` | Ver recupero |

### Componentes presentes pero no cableados al shell actual

Sin imports desde `atencion-cliente-module.tsx` (código legado / supersedido por inbox compartido):

- `mi-agenda-section.tsx`
- `mi-jornada-section.tsx`
- `mi-recupero-section.tsx`
- `mis-retenciones-section.tsx`
- `retenciones-asignadas-section.tsx`
- `atencion-cliente-summary.tsx`
- `atenciones-list.tsx`
- `consultation-inbox-summary.tsx`
- `consultation-operational-work-section.tsx`

El provider **sí** sigue cargando datasets personales (agenda, jornada, recuperaciones, retenciones) aunque esas secciones no se rendericen en el módulo actual.

## 1.3 Hooks

| Hook | Uso |
|---|---|
| `useAtencionCliente()` | Único hook de dominio del módulo (provider) |
| `useAuth` | Sesión / empleado / rol |
| `useDemoMode` | Bloqueo de escrituras en demo |
| `useTenantCompanyId` | Tenant |
| `useIsSystemAdministrator` | Gate UI de hard delete |
| `useProtectedFormDialog` / `isFormStateDirty` | Descarte de formularios |
| `useRouter` | Navegación detalle / OT |

No hay carpeta `hooks/` propia bajo `components/atencion-cliente`.

## 1.4 Servicios / capas

```text
UI (components)
  ├─ Browser Supabase (list/create/search) → lib/supabase/customer-*.{browser,queries,mapper}.ts
  └─ Mutaciones de gestión → lib/supabase/customer-atenciones-management.browser.ts
        → app/api/atencion-cliente/**
             → lib/customer-atenciones/consultation-management.server.ts
                  → RPCs SECURITY DEFINER (service_role)
```

### Dominio (`lib/customer-atenciones/`)

| Área | Archivos representativos |
|---|---|
| Catálogos / create | `consultation.ts`, `format.ts` |
| Inbox / bandejas | `shared-inbox.ts` |
| Gestión exclusiva | `consultation-management.ts`, `consultation-management.server.ts`, `consultation-management-route.ts`, `consultation-management-lock.ts`, `consultation-exclusive-management.ts` |
| Asistente UX | `consultation-management-assistant.ts` |
| Expediente | `consultation-expediente.ts` |
| Flujos por bandeja | `administration-flow.ts`, `technical-flow.ts`, `retention-flow.ts`, `moroso-flow.ts`, `moroso-management.ts` |
| Interacciones | `consultation-interaction.ts`, `consultation-interaction-management.ts` |
| OT | `consultation-ot-create.ts`, `ot-link.ts`, `consultation-follow-up.ts` |
| Hard delete | `consultation-hard-delete.ts` |
| Acceso módulo | `module-access.ts`, `atencion-list.ts` |

### Circuitos relacionados

| Paquete | Rol |
|---|---|
| `lib/customer-seguimientos/**` | Agenda, jornada, KPIs de seguimientos |
| `lib/customer-retenciones/**` | Acceso supervisión, labels, filtros de asignadas |
| `lib/supabase/customer-recuperaciones.*` | Recuperaciones outbound |
| `lib/atencion-cliente-equipo/**` | Informe de equipo |

## 1.5 RPC utilizadas

Invocadas vía admin client (service_role), no tipadas en `database.types.ts` → `Functions`:

| RPC | Función |
|---|---|
| `start_customer_atencion_management` | Toma lock exclusivo; pasa a `en_gestion` |
| `cancel_customer_atencion_management` | Libera lock sin evento de resolución |
| `touch_customer_atencion_management_activity` | Heartbeat |
| `release_expired_customer_atencion_managements` | Libera locks idle (timeout 15 min) |
| `resolve_customer_atencion_consultation` | Cierra como resuelta; follow-up opcional |
| `defer_customer_atencion_consultation` | Continúa gestión con `next_step` |
| `update_customer_atencion_moroso_tracking` | Actualiza `moroso_tracking_status` |
| `register_customer_atencion_interaction` | Registra interacción; puede cerrar gestión activa |
| `link_customer_atencion_to_task` | Vincula OT; limpia `generar_ot`; puede cerrar consulta |
| `hard_delete_customer_atencion_consultation` | Borrado físico admin + eventos |

Helpers SQL internos (no llamados desde TS directamente): `apply_customer_atencion_management_session_end`, `customer_atencion_management_lock_timeout_minutes`, triggers de `updated_at`, integridad tenant, y trigger de evento `consulta_creada` al insertar.

Legacy/alias en SQL: `link_customer_atencion_ot` (ruta histórica de follow-up).

## 1.6 Tablas involucradas

| Tabla | Rol en el módulo |
|---|---|
| `customer_atenciones` | Consulta / atención |
| `customer_atencion_events` | Historial append-only del expediente |
| `customer_seguimientos` | Seguimientos programados (agenda) |
| `customer_retenciones` | Casos de retención (entidad paralela) |
| `customer_recuperaciones` | Intentos de recupero |
| `customers` | Cliente vinculado |
| `employees` | Operador / actor |
| `tasks` | OT vinculada (`linked_task_id`) |
| `companies` | Multiempresa |

## 1.7 Tipos principales

### Consulta (`CustomerAtencion`)

- **channel:** `telefono` · `whatsapp` · `presencial` · `otro`
- **motivo:** `problema_tecnico` · `facturacion` · `cambio_plan_tecnologia` · `consulta_comercial` · `consulta_tv` · `nuevo_servicio` · `baja` · `otro`
- **resultado:** `resuelta` · `requiere_seguimiento` · `ot_creada`
- **status:** ver §1.8
- **next_step:** ver §1.9
- **moroso_tracking_status:** `cupon_pendiente_enviar` · `cupon_enviado` · `esperando_acreditacion` · `pago_acreditado` · `servicio_rehabilitado`
- **follow_up_actions:** hoy solo `generar_ot`
- **decision al crear:** `resolver_ahora` · `continuar_gestion`

### Eventos (`CustomerAtencionEvent.action_type`)

`consulta_creada` · `gestion_iniciada` · `gestion_registrada` · `consulta_pendiente` · `consulta_resuelta` · `proximo_paso_cambiado` · `consulta_ot_vinculada` · `gestion_liberada_por_inactividad` · `interaccion_registrada`

### Interacciones

- **kinds:** `contact` · `note` · `process` · `decision` · `system`
- **contact results:** `no_atiende` · `telefono_apagado` · `linea_ocupada` · `llamar_mas_tarde` · `cliente_ausente` · `dejo_mensaje` · `reprogramar_contacto` · `otro`

### Retención (entidad)

- **status:** `en_gestion` · `pendiente_administracion` · `pendiente_retiro` · `finalizada`
- **resultado:** `retenido` · `persiste_baja` · `no_retenido`
- Motivos de baja catalogados (precio, técnica, atención, proveedor, mudanza, etc.)

### Recuperación

- **channel:** `telefono` · `whatsapp` · `otro`
- **resultado:** `recuperado` · `interesado` · `no_interesado` · `no_responde` · `volver_a_contactar`

## 1.8 Estados (`status`)

| Estado | Significado operativo |
|---|---|
| `nueva` | Estado histórico/volumen; inbox lo trata como disponible |
| `para_resolver` | Acción interna pendiente (`next_step` de trabajo interno) |
| `en_gestion` | Tomada por un operador (lock exclusivo) |
| `pendiente` | Espera externa: solo `esperar_cliente` (y legacy `requiere_seguimiento` en create) |
| `resuelta` | Cerrada |

Reglas clave:

- `next_step` interno → status `para_resolver`.
- `next_step = esperar_cliente` → status `pendiente`.
- Create `resolver_ahora` → `resuelta` inmediato.
- Create `continuar_gestion` → status derivado del `next_step` elegido.

## 1.9 `next_step`

Catálogo actual (acción pendiente, no “área dueña”):

| next_step | Bandeja operativa (si aplica) |
|---|---|
| `realizar_retencion` | Retenciones |
| `resolver_consulta_tecnica` | Técnica |
| `derivar_admin_facturacion` | Administración |
| `derivar_admin_morosos` | Morosos |
| `derivar_admin_gestion` | Administración |
| `contactar_cliente` | Ventas (label UI) |
| `seguimiento_cliente` | Sin bandeja UI dedicada → cae en `por_tomar` / `en_gestion` según status |
| `esperar_cliente` | Espera del Cliente |
| `generar_ot` | Generar OT (conteo KPI; filtro UI no expuesto en bandejas visibles) |

Bandejas UI expuestas (`SHARED_INBOX_UI_WORK_TRAYS`): espera_cliente, retenciones, tecnica, administracion, morosos, ventas.

## 1.10 Seguimiento

Dos conceptos coexisten:

1. **`customer_seguimientos`** — entidad de agenda (fecha/hora, observación, estado `pendiente|completado`, opcional `source_atencion_id`, cadena `previous_seguimiento_id`). Alta posible al crear atención; completar vía `seguimiento-work-dialog` (+ follow-up).
2. **`next_step = seguimiento_cliente`** — consulta pendiente de contacto, sin tabla propia.
3. **Motor de interacciones** (`consultation-interaction.ts`) — intentos de contacto compartidos entre circuitos (morosos, retenciones, futuros); **no cambia** `next_step`/bandeja.

## 1.11 Integraciones (resumen estructural)

Ver sección 5. A nivel arquitectura: Clientes (Fuerte), OT/tasks (Fuerte), Administración/Técnica/Ventas/Morosos/Retenciones como **bandejas lógicas** sobre `next_step` (no módulos de destino con handoff automático), Activity Engine (catálogo preparado, sin adapter emisor), sin GPS/Evidencias/Obras/Tesorería/Facturación externa acoplada.

---

# 2. Flujo funcional

Flujo canónico de una **consulta** (`customer_atenciones`), desde el alta hasta el cierre.

## 2.1 Crear consulta

**Operador decide:**

1. Abrir “Nueva Consulta”.
2. Seleccionar o crear cliente rápido.
3. Canal, motivo, detalle.
4. Decisión:
   - **Resolver ahora** → escribe resolución.
   - **Continuar gestión** → elige `next_step`.

**Sistema ejecuta:**

1. Inserta `customer_atenciones` (RLS + tenant).
2. Trigger genera evento `consulta_creada`.
3. Deriva `status` / `resultado` / `next_step` según decisión (`buildNewConsultationCreationFields`).
4. Opcionalmente crea `customer_seguimientos` (best-effort; no atómico con la atención).
5. Refresca inbox / KPIs en el provider.

## 2.2 Tomar gestión (si no está resuelta)

**Operador decide:** abrir consulta y “iniciar gestión”.

**Sistema ejecuta:**

1. Valida módulo + empleado autenticado (API).
2. RPC `start_customer_atencion_management`:
   - Impone **una sola gestión activa por operador**.
   - Si otro operador tiene el lock → UI `locked-consultation-dialog`.
   - Si el operador ya gestiona otra → `exclusive-management-dialog`.
3. Status → `en_gestion`; stamps de lock/actividad.
4. Evento de gestión iniciada (vía RPC/historial).
5. Heartbeats (`touch-management`) mientras trabaja.
6. Tras ~**15 minutos** sin actividad: liberación automática (`release_expired_*`) → evento `gestion_liberada_por_inactividad`.

## 2.3 Trabajar la consulta (Decision Center / asistente)

**Operador decide** (según bandeja / opciones guiadas):

- Resolver y cerrar.
- Esperar cliente.
- Requiere contacto / seguimiento.
- Enviar a Técnica / Administración / Morosos / Ventas.
- Iniciar retención (baja).
- Registrar avance de morosos.
- Crear/vincular OT.
- Registrar interacción de contacto/nota (sin cambiar bandeja).

**Sistema ejecuta:**

| Acción operador | Mecanismo | Efecto |
|---|---|---|
| Resolver | RPC `resolve_*` | `status=resuelta`, evento `consulta_resuelta`, libera lock; follow-up `generar_ot` opcional |
| Diferir / derivar | RPC `defer_*` | set `next_step` (+ detalle), status `para_resolver` o `pendiente`, evento `consulta_pendiente` |
| Interacción | RPC `register_*_interaction` | Evento `interaccion_registrada`; no muta bandeja/`next_step`; puede cerrar sesión de gestión |
| Moroso tracking | RPC `update_*_moroso_tracking` | Actualiza `moroso_tracking_status` |
| Link OT | Prefill OT + RPC `link_*_to_task` | `linked_task_*`; limpia `generar_ot`; puede cerrar consulta |
| Cancelar gestión | RPC `cancel_*` | Libera lock, restaura status compartido, sin resolución |

Flujos especializados por bandeja (Administración / Técnica / Retención consulta) usan diálogos de resultado que mapean a resolve/defer con `next_step` concretos (`administration-flow`, `technical-flow`, `retention-flow`).

## 2.4 Cierre

La consulta queda **cerrada** cuando `status = resuelta` (resolve, o link OT según reglas RC de cierre).

**Hard delete (solo Administrador):** elimina fila + eventos; anula `source_atencion_id` en seguimientos. No es el cierre operativo normal.

## 2.5 Circuitos paralelos (no son el mismo flujo)

| Circuito | Relación con la consulta |
|---|---|
| **Seguimientos (tabla)** | Agenda personal; puede originarse desde atención; completar no siempre cierra la consulta |
| **Retenciones (tabla)** | Caso asignable con workflow propio; distinto de `next_step=realizar_retencion` aunque convivan en el producto |
| **Recuperaciones** | Outbound comercial/recuperación; no es el ciclo de vida de la consulta |
| **Equipo** | Reporting agregado; no cambia estados |

---

# 3. Funcionalidades implementadas

Listado exhaustivo observado en código (sin resumir por omisión intencional):

1. Acceso al módulo por visibilidad `atencion_cliente`.
2. Workbench `/atencion-cliente` con inbox compartido.
3. Búsqueda debounced en workbench.
4. Alta de consulta con cliente existente.
5. Alta de consulta con cliente rápido (quick customer).
6. Canales de contacto catalogados.
7. Motivos de consulta catalogados (RC 3.1.6).
8. Decisión al crear: resolver ahora.
9. Decisión al crear: continuar gestión con próximo paso.
10. Validación de resolución obligatoria al resolver en alta.
11. Validación de `next_step` obligatorio al continuar gestión.
12. KPIs de inbox (nuevas, para resolver, pendientes, resueltas hoy, motivos comerciales/TV, etc.).
13. Conteos por categoría operativa.
14. Conteos por bandeja operativa exclusiva.
15. Filtros de bandeja UI (espera, retenciones, técnica, administración, morosos, ventas).
16. Filtros por estado / motivo / canal / fecha / búsqueda.
17. Apertura de consulta en panel modal de trabajo.
18. Navegación a expediente `/atencion-cliente/[id]`.
19. Card de situación / expediente narrativo.
20. Timeline de eventos del historial.
21. Badge de estado.
22. Resumen histórico del día.
23. Banner de gestión activa del operador.
24. Inicio de gestión exclusiva.
25. Cancelación de gestión exclusiva.
26. Heartbeat de actividad de lock.
27. Diálogo de consulta bloqueada por otro operador.
28. Diálogo de exclusividad (una gestión a la vez).
29. Liberación de locks expirados (API + timeout 15 min).
30. Decision Center / asistente guiado de opciones.
31. Mensajes contextuales post-retorno de área (técnica/admin/ventas/retención).
32. Resolver consulta con detalle.
33. Diferir consulta con próximo paso y detalle.
34. Opciones de resultado específicas Administración.
35. Opciones de resultado específicas Técnica.
36. Opciones de resultado específicas Retención (sobre consulta).
37. Registro de interacciones (contacto / nota / process / decision / system).
38. Catálogo compartido de resultados de contacto (motor de seguimientos).
39. Actualización de tracking de morosos.
40. Prefill / deep-link a creación de OT desde consulta.
41. Vinculación de OT existente/creada a la consulta.
42. Follow-up post-resolución `generar_ot` (campo `follow_up_actions`).
43. Hard delete permanente de consulta (Administrador).
44. Bloqueo de escrituras en modo demo.
45. Carga/caché de atenciones, eventos, seguimientos, retenciones, recuperaciones.
46. Listado/paginación legacy de atenciones (código presente).
47. Crear seguimiento asociado al crear atención (cuando aplica).
48. Completar seguimiento.
49. Completar seguimiento con reprogramación / follow-up.
50. Crear retención (entidad) — diálogo + provider.
51. Trabajar / resolver retención.
52. Ver retención y marcar lista para retiro (roles administración/admin).
53. Listados de retenciones propias / asignadas (componentes presentes; no en shell).
54. Crear recupero.
55. Ver recupero.
56. Listado de recuperaciones del operador (componente presente; no en shell).
57. Agenda personal de seguimientos (componente presente; no en shell).
58. Jornada del operador (componente presente; no en shell).
59. Informe Equipo (administrador) con períodos.
60. Integridad multi-tenant en tablas/triggers.
61. Soft-delete column + filtros `deleted_at IS NULL` en lecturas.
62. Labels/formatters centralizados de estados, motivos, next_step, eventos.
63. Helpers de acceso a retenciones asignadas / ready-for-retiro.
64. Catálogo Activity Engine para acciones `ATENCION_*` (definición; ver §5).

---

# 4. Automatizaciones existentes

Acciones que el **sistema** realiza sin decisión explícita del operador en ese momento:

1. **Evento `consulta_creada`** al insertar atención (trigger DB).
2. **Derivación de `status`/`resultado`/`next_step`** al crear según decisión.
3. **Asignación automática a bandeja** (`resolveOperationalWorkTray`) según status + next_step.
4. **Lock exclusivo** y rechazo de segunda gestión / gestión ajena (RPC).
5. **Heartbeat esperado**; sin él, **liberación por inactividad** (~15 min) + evento `gestion_liberada_por_inactividad`.
6. **Restauración de status compartido** al cancelar gestión / liberar sesión (helper SQL).
7. **Timestamps** `updated_at`, stamps de management activity.
8. **Integridad tenant** en triggers de atenciones/eventos.
9. **Al vincular OT:** limpieza de `generar_ot` / follow-up y posible cierre de consulta (RPC).
10. **Hard delete:** cascada de eventos + nullify de `source_atencion_id` en seguimientos.
11. **KPIs / conteos** recalculados en cliente a partir del inbox cargado.
12. **Demo mode:** bloqueo automático de mutaciones.
13. **Seguimiento opcional post-create:** intento automático si el flujo lo solicita (best-effort).

No hay automatizaciones observadas hacia facturación externa, GPS, evidencias, obras, ventas como módulo, ni emisión Activity Engine desde las API de atención.

---

# 5. Integraciones

| Área | Estado observado | Detalle |
|---|---|---|
| **Clientes** | Integrada | FK `customer_id`; búsqueda; quick customer; campos de identidad en inbox |
| **OT** | Integrada | Prefill OT, `linked_task_id` / code, RPC link, follow-up `generar_ot`, bandeja/KPI generar OT |
| **Obras** | No integrada | Sin referencias de dominio a projects/obras en capas de atención |
| **Administración** | Lógica de bandeja | `next_step` de derivación admin; no hay handoff a un módulo Administración separado |
| **Ventas** | Lógica de bandeja | Label “Ventas” sobre `contactar_cliente`; no escritura al módulo Ventas/leads |
| **RRHH** | Parcial / actor | Empleados como operadores, locks, informe equipo; no gestión RRHH |
| **Facturación** | Solo motivo / next_step | Motivo `facturacion` y `derivar_admin_facturacion`; sin sistema de facturación |
| **GPS** | No integrada | Sin stubs en libs de atención |
| **Evidencias** | No integrada | Sin stubs en libs de atención |
| **Dashboard** | Indirecta | KPIs propios del módulo; OIE/employee activity filtran acciones `ATENCION_*` si existieran eventos AE |
| **Activity Engine** | Preparada, no cableada | Acciones en `types`/`catalog`/`client-policy`; **no** hay `lib/activity/adapters/*atencion*`; APIs de atención **no** llaman `recordActivityEvent`. Auditoría operativa = `customer_atencion_events` |
| **Tesorería** | No integrada | Sin origen automático desde atención |
| **Tasks Activity** | Lateral | Caso `"return-to-atencion"` en activity de tasks (handoff OT → atención), no adapter de atención |

---

# 6. Modelo de datos

## 6.1 `customer_atenciones`

Tabla central de **consultas**.

Campos relevantes: identidad (`id`, `company_id`, `customer_id`, `attended_by_employee_id`), contenido (`channel`, `motivo`, `detail`, `resolution`, `resultado`), ciclo (`status`, `next_step`, `follow_up_actions`, `resolved_at`, `resolved_by_employee_id`), morosos (`moroso_tracking_status`), OT (`linked_task_id`, `linked_task_code`, `ot_linked_at`, `ot_linked_by_employee_id`), lock (`active_management_employee_id`, `active_management_started_at`, `active_management_last_activity_at`), auditoría temporal (`created_at`, `updated_at`, `deleted_at`).

## 6.2 `customer_atencion_events`

Historial **append-only** del expediente: tipos de acción, deltas de status/next_step, datos de interacción (`interaction_kind`, `interaction_result`, `next_action_at`). Sin soft delete; se borran con hard delete de la consulta.

## 6.3 `customer_seguimientos`

Agenda de contactos programados. Puede referenciar `source_atencion_id`. Encadenamiento `previous_seguimiento_id`. Estados `pendiente` / `completado`. Soft-delete column.

## 6.4 `customer_retenciones`

Casos de retención comerciales/operativos con workflow propio (`en_gestion` → administración / retiro / finalizada). Soft-delete. Paralelo al `next_step=realizar_retencion` de consultas.

## 6.5 `customer_recuperaciones`

Intentos de recupero (cliente existente o datos manuales nombre/zona/teléfono). Soft-delete.

## 6.6 Relaciones

```text
customers 1──N customer_atenciones 1──N customer_atencion_events
                     │
                     ├── optional → tasks (OT)
                     └── optional → customer_seguimientos (source)

customer_retenciones     (circuito paralelo Atención al Cliente)
customer_recuperaciones  (circuito paralelo Atención al Cliente)
employees                (actores / locks / informe equipo)
```

## 6.7 Soft delete vs hard delete

- Columnas `deleted_at` + filtros en SELECT: patrón multi-tenant estándar.
- En queries de atención **no** se observa soft-delete de escritura como operación de producto.
- Eliminación de consulta operativa de mantenimiento = **hard delete** admin vía RPC.

---

# 7. Pendientes actuales

## 7.1 Parcialmente implementado / divergente UI↔datos

1. **Secciones personales** (agenda, jornada, mis retenciones, recupero, retenciones asignadas): provider carga datos; UI del shell no las monta.
2. **Diálogos create recupero/retención:** existen + mutaciones; no hay CTA en el módulo actual.
3. **Listas/KPI legacy** (`AtencionesList`, summaries antiguos): huérfanas respecto al workbench RC 3.x.
4. **Bandejas `por_tomar` / `en_gestion` / `generar_ot`:** calculadas; filtros UI no las exponen (solo “Todas” + bandejas especializadas; OT vía KPI).
5. **`seguimiento_cliente`:** next_step válido sin bandeja UI dedicada.
6. **Create atención + seguimiento:** no transaccional (partial success posible).
7. **Activity Engine Atención:** catálogo completo sin emitters/adapters en rutas.
8. **RPCs de atención:** ausentes del tipado generado `database.types.ts` → `Functions`.
9. **Soft-delete:** schema listo; producto usa hard delete para consultas.
10. **Dos modelos de “retención”:** next_step de consulta vs entidad `customer_retenciones` — convivencia sin unificación documental en código.

## 7.2 TODO / FIXME en código

No se encontraron marcadores `TODO` / `FIXME` / `HACK` en:

- `components/atencion-cliente/**`
- `app/(dashboard)/atencion-cliente/**`
- `app/api/atencion-cliente/**`
- `lib/customer-atenciones/**`, `lib/customer-retenciones/**`, `lib/customer-seguimientos/**`

## 7.3 Preparación para futuras integraciones (comentarios / extensiones)

1. Comentario explícito en `consultation-interaction.ts`: motor compartido para Morosos, Retenciones **y future trays**; interacciones no cambian bandeja.
2. `CONSULTATION_FOLLOW_UP_ACTION_VALUES` diseñado como catálogo extensible (hoy solo `generar_ot`).
3. Flag documentado `SHARED_INBOX_NUEVAS_KPI_CREATED_TODAY` — KPI “Nuevas” puede redefinirse/eliminarse.
4. `CONTINUAR_GESTION_MENU_REVIEW_PLANNED = false` — reestructura de menú marcada como entregada.
5. Activity actions `ATENCION_*` + bloqueo cliente de `ATENCION_DELETE_PERMANENT`.
6. OIE / employee activity ya contemplan prefijos/acciones de atención **si** hubiera eventos AE.
7. Alias deprecados de contacto moroso → catálogo unificado de contactos.
8. Sin stubs de GPS, evidencias, obras, facturación externa, ventas CRM o tesorería dentro del dominio.

---

# 8. Oportunidades detectadas

Hallazgos de mejora **sin implementar**:

1. **Unificar o documentar** la dualidad retención-consulta vs entidad `customer_retenciones`.
2. **Decidir destino del UI personal** (agenda/jornada/recupero): reincorporar al shell o retirar carga muerta del provider.
3. **Cablear Activity Engine** (adapter + emisiones en API) o declarar formalmente que `customer_atencion_events` es la única auditoría.
4. **Hacer atómicas** alta de atención + seguimiento.
5. **Exponer o eliminar** bandejas calculadas no filtrables (`por_tomar`, `en_gestion`, `generar_ot`, `seguimiento_cliente`).
6. **Tipar RPCs** en `database.types.ts` para alinear con el resto del stack.
7. **Integración real con Ventas / Administración / Facturación** si las bandejas deben ser handoffs y no solo etiquetas.
8. **Integración Obras / Evidencias / GPS** solo si el expediente de atención debe enriquecer campo.
9. **Limpieza de componentes huérfanos** para reducir deuda cognitiva (post-decisión de producto).
10. **Contrato único de cierre** (resolve vs link-OT vs follow-up) documentado para operadores.
11. **Política soft vs hard delete** alineada al resto de módulos (hoy hard delete admin).
12. **Basar futuros sprints** en este inventario + BAS (AF/AT) antes de extender el módulo.

# Próximos pasos

- Revisar hallazgos con producto/arquitectura.
- Priorizar qué circuitos (seguimientos / retenciones / recupero / Activity) entran a Architecture Sprints.
- No implementar cambios hasta decidir sobre las oportunidades 1–5 (mayor impacto estructural).

# Historial de cambios

| Fecha | Versión | Cambio |
|---|---|---|
| 2026-07-24 | 0.1.0 | Auditoría funcional inicial (solo lectura) |
