# OT Audit 1.0

Auditoría de creación de órdenes de trabajo. Fecha de análisis: 2026-08-26.

**Alcance:** solo lectura. Esta auditoría no modificó lógica de producción, componentes, APIs, migraciones, constraints, RLS ni mensajes de error.

---

## 1. Resumen ejecutivo

Todas las vías de producto que **insertan** una OT convergen en el mismo stack del browser:

`useTasksCreate.addTask` → `createTask` (`lib/supabase/tasks.browser.ts`) → `insertTask` (`lib/supabase/tasks.queries.ts`) → `mapCreatePayloadToInsert` → `from("tasks").insert`.

No existe un `POST /api/...` que cree filas en `public.tasks`. Atención al Cliente y Comercial no insertan: prefills + mismo formulario de Tareas, y después **vinculan** la OT ya creada.

### Execution order

La restricción `tasks_execution_order_crew_date_unique` es real y el mensaje de UI también:

> «Ya existe otra OT con el mismo orden de ejecución para esa cuadrilla y fecha.»

**No es un bug de la constraint.** El orden se asigna en el **cliente**, durante la creación, con `resolveNextPlanningQueuePosition` sobre el array `tasks` en memoria. `insertTask` **no** consulta Postgres para el próximo slot. Existe `fetchNextExecutionOrderForCrewDate` (consulta DB) pero solo se usa en **edición admin**, no en create. No hay retry.

Hay colisión real cuando:

1. Dos inserts concurrentes (o un import en loop) calculan el mismo slot sobre una lista stale.
2. Una OT `vencida` (u otro estado no `programada`) **conserva** `execution_order` y el calculador de ocupación **no lo cuenta**.

### Domicilio

La frase exacta **«El domicilio es obligatorio.»** no está en el flujo de creación de OT. Está en la migración ISP (`lib/isp/migration/integrity.ts`). En OT el usuario ve:

- «La dirección es obligatoria.»
- «La ubicación GPS es obligatoria. Pegue el enlace de Google Maps.»
- Cambio de domicilio: «Indique dirección actual y nueva dirección.»

El domicilio **no se pierde en Postgres**. Falla **antes** del insert, en `validateWorkOrderForm` / `validateWorkOrderSharedLocation`. Causas típicas de “ya está cargado”:

- El buscador muestra localidad cuando `customers.address` está vacío (`formatCustomerAddressLabel`).
- Al elegir cliente **no** se copian `sharedLocation` / lat / lng de la ficha.
- Cambiar el tipo de trabajo **borra** el prefill (Atención / Comercial / cliente ya elegido).

### Logging

Un intento **fallido** no deja Activity ni Historial del Sistema. Solo `console.error("[TASK CREATE]", error)` y, si el observatorio de performance está activo, un summary. No hay `request_id` / `trace_id` persistido. No se puede reconstruir usuario + empresa + payload + hora desde DB.

---

## 2. Flujo de creación

### 2.1 Caminos reales

| # | Vía | ¿Inserta `tasks`? | UI | Prefill / form | Validación | Payload | Persistencia |
|---|-----|-------------------|----|----------------|------------|---------|--------------|
| A | Tareas / OT | Sí | `app/(dashboard)/tareas/page.tsx` → `TasksModule` botón **Nueva Orden de Trabajo** | `TaskWorkOrderDialog` (`components/tareas/task-work-order-dialog.tsx`) | `validateBeforeSave` → `validateWorkOrderForm`, `validateWorkOrderSharedLocation`, `validateCrewAssignment`, ≥1 foto | `buildWorkOrderCreatePayload` | `addTask` |
| B | Atención al Cliente | Sí, vía A | `OtLinkBlock` **Crear Orden de Trabajo** | `buildConsultationOtCreatePrefill` / `storeConsultationOtCreatePrefill` → `/tareas?nuevaOt=1` | Igual que A | Igual que A | Después: `POST /api/atencion-cliente/[atencionId]/link-ot` → RPC `link_customer_atencion_to_task` |
| C | Clientes 360° | **No** | `IspWorkOrderSheet` es lectura | — | — | — | GET `app/api/isp/tasks/[taskId]/route.ts` |
| D | Comercial / solicitudes | Sí, vía A | **Generar OT** en dossier / drawer | `storeSolicitudOtCreatePrefill` → `/tareas?nuevaOt=1&solicitudId=` fuerza `instalacion-nueva` | Igual que A | Igual que A | `linkCommercialSolicitudToWorkOrder` (no crea task) |
| E | Importar Excel | Sí | `WorkOrderImportDialog` | `parseWorkOrderImportFile` | `validateImportRow` (**no** `validateWorkOrderForm`) | `importRowToFormInput` → `buildWorkOrderCreatePayload` → `addTask` | Mismo insert |
| F | Obras | Sí | `ProjectTasksTab` **Nueva OT** | `ProjectTaskDialog` | Inline título/fechas, `validateCrewAssignment`, `validateManualDailyAllocations` | Literal `CreateTaskPayload` (**no** `buildWorkOrderCreatePayload`) | `addTask` (rama obra de `validateObraTaskInsertIntegrity`) |
| G | Mobile | **No** | — | — | — | — | `POST app/api/mobile/v1/tasks/[taskId]` responde 405 |
| H | `TaskFormDialog` | **No en runtime** | Nunca montado | Código de create muerto | `setError("La dirección es obligatoria.")` | — | Solo se reutiliza `taskDefaultChecklist` |

Scripts/SQL de seed (`scripts/seed-demo-company.ts`, `supabase/scripts/seed_operational_test_data.sql`) insertan directo y **no** son producto.

### 2.2 Mapa por etapa (camino A — el canónico)

```text
UI  TasksModule (Nueva Orden de Trabajo)
 ↓
Formulario  TaskWorkOrderDialog.handleSubmit
 ↓
Validaciones frontend
    validateBeforeSave
    validateWorkOrderForm
    validateWorkOrderSharedLocation
    validateCrewAssignment
    fotos de referencia (>= 1)
    validateReconexionCustomer (si reconexion)
    createCustomer (si instalacion-nueva)
 ↓
Payload  buildWorkOrderCreatePayload  (sin executionOrder)
 ↓
Hook  useTasksCreate.addTask
    getInitialTaskStatus → siempre "programada"
    generateWorkOrderTaskCodeFromCodes
    enrichCreateTaskPayloadWithResolvedLocation
    resolveNextPlanningQueuePosition → executionOrder  ← AQUÍ se asigna el orden
 ↓
Browser  createTask → insertTask
    validateObraTaskInsertIntegrity (solo si projectId)
    mapCreatePayloadToInsert
    supabase.from("tasks").insert
 ↓
PostgreSQL  constraints / unique / RLS / trigger updated_at
 ↓
Respuesta  mapTaskRowToTask | mapSupabaseTaskError
 ↓
Éxito: recordTaskCreateAudit + recordTaskCreateActivity + recordTaskOperationalEvent
Fallo: logOperationError("TASK CREATE") + throw Error(message) → Dialog setError
```

Archivos y funciones reales:

| Etapa | Archivo | Función | Responsabilidad | Errores posibles |
|-------|---------|---------|-----------------|------------------|
| UI | `components/tareas/tasks-module.tsx` | `TasksModule` | Abre diálogo; `addTask(payload)` | — |
| Form | `components/tareas/task-work-order-dialog.tsx` | `handleSubmit`, `performCreate`, `applyCustomerToForm` | Estado del form, prefill, submit | Mensajes de `validateWorkOrderForm`; createCustomer; GPS; fotos |
| Validación form | `lib/tasks/work-order.ts` | `validateWorkOrderForm`, `validateWorkOrderSharedLocation`, `resolvePrimaryAddress` | Campos comerciales/técnicos/GPS | Dirección, GPS, tipo, cuadrilla, turno, duración, plan, FTTH, etc. |
| Cuadrilla | `lib/crews/status-workflow.ts` | `validateCrewAssignment` | Cuadrilla existente y asignable | «Cuadrilla no encontrada.» / inactiva |
| Payload OT | `lib/tasks/work-order.ts` | `buildWorkOrderCreatePayload` | Shape `CreateTaskPayload`; `serviceAddress` desde `resolvePrimaryAddress` | No lanza; puede mandar `serviceAddress: undefined` |
| GPS enrich | `lib/location/client/enrich-task-payload.ts` | `enrichCreateTaskPayloadWithResolvedLocation` | Resuelve Maps → lat/lng | «No se pudo resolver la ubicación GPS…» |
| Código | `lib/tasks/work-order.ts` | `generateWorkOrderTaskCodeFromCodes` | `TSK-OT-…` | Luego unique `tasks_company_code_unique` |
| Orden | `lib/planificacion/planning-dynamic.ts` | `resolveNextPlanningQueuePosition` | Primer slot libre en memoria | Slot duplicado vs DB |
| Gate planificación | `lib/projects/project-start-dispatch.ts` | `shouldApplyPlanningQueueSideEffectsForTask` | OT de servicio sí; Obra (`projectId`) nunca | — |
| Status inicial | `lib/tasks/task-status-workflow.ts` | `getInitialTaskStatus` | Siempre `"programada"` | — |
| Insert | `lib/supabase/tasks.queries.ts` | `insertTask`, `mapSupabaseTaskError` | Insert + map de errores Postgres | `DUPLICATE_EXECUTION_ORDER`, `DUPLICATE_CODE`, `WORKFLOW`, `UNKNOWN` |
| Mapper | `lib/supabase/tasks.mapper.ts` | `mapCreatePayloadToInsert` | camelCase → columnas | `execution_order: payload.executionOrder ?? null`; `service_address` trim o null |
| Integridad obra | `lib/projects/obra-task-insert-integrity.ts` | `validateObraTaskInsertIntegrity` | Tenant/cuadrilla/obra; status borrador vs programada | Mensajes de obra/cuadrilla |
| RLS | `supabase/migrations/20260913000100_multi_tenant_rls_sprint_c1.sql` | `tasks_insert_policy` | `company_id = auth_user_company_id()` y no demo RO | Insert silencioso / error PostgREST |

---

## 3. Execution Order

### 3.1 Constraint real

Migración `supabase/migrations/20260903000100_task_execution_order.sql`:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS tasks_execution_order_crew_date_unique
  ON public.tasks (due_date, crew_id, execution_order)
  WHERE execution_order IS NOT NULL
    AND crew_id IS NOT NULL
    AND deleted_at IS NULL;
```

Campos de la unique: **`due_date` + `crew_id` + `execution_order`**, parcial. **No** incluye `company_id`. El riesgo multi-tenant es bajo porque `crew_id` es UUID de `crews`.

`execution_order` **puede ser NULL**. Si es NULL, el índice no aplica.

Índice hermano (no se asigna en create de OT de servicio): `tasks_dispatch_order_crew_date_unique` en `20260904000100_task_dispatch_order.sql`.

### 3.2 Quién asigna, cuándo

| Pregunta | Respuesta evidenciada |
|----------|----------------------|
| ¿Quién asigna? | `useTasksCreate.addTask` (`components/tareas/tasks-provider/hooks/use-tasks-create.ts`) llama `resolveNextPlanningQueuePosition`. |
| ¿Cuándo? | **Durante la creación**, en el cliente, **después** de enriquecer GPS y **antes** de `createTask`. |
| ¿Se asigna en creación? | **Sí**, si se cumplen todas las condiciones de abajo. |
| ¿Puede quedar NULL? | **Sí**: sin cuadrilla, sin fecha, OT de Obra (`projectId`), o si no es work order. |
| ¿Sin cuadrilla? | No entra al `if`; `executionOrder` no se setea; mapper persiste `null`. Unique no aplica. El form manual **exige** cuadrilla; el import **permite** sin cuadrilla. |
| ¿Sin fecha? | Form manual exige `scheduledDate`. Payload usa `dueDate = scheduledDate`. Sin `dueDate` no asigna orden. |
| ¿Con cuadrilla y fecha? | Si es OT de servicio `programada`, asigna el primer entero libre (1, 2, 3…) según ocupación **en memoria**. |
| ¿Si ya existe el mismo orden? | Postgres `23505` → `mapSupabaseTaskError` → código `DUPLICATE_EXECUTION_ORDER` → mensaje citado arriba. **No hay retry.** |
| ¿El frontend conoce la constraint? | El form **no** valida unique. El mapper de error sí. El cálculo de slot es un *best effort* local, no un lock. |
| ¿El backend genera el orden? | `insertTask` **no**. `fetchNextExecutionOrderForCrewDate` existe y **sí** lee DB, pero solo la usa `lib/tasks/work-order-admin-mutation.server.ts` en **edición admin** al cambiar crew/fecha. |
| ¿Carrera? | **Sí.** Lista en memoria + sin `SELECT … FOR UPDATE` + sin retry. |
| ¿Retry? | **No.** |
| ¿Lógica de planificación en create? | **Sí, y de forma incorrecta para concurrencia:** se reutiliza el motor de slots de Planificación (`collectOccupiedOperationalOrderSlots`) sobre `tasks` del provider, no sobre el universo real de Postgres. |

Condición exacta en `addTask`:

```ts
shouldApplyPlanningQueueSideEffectsForTask(payload) &&  // !projectId
isWorkOrderTask(payload) &&                             // projectCode === "OT" || serviceType
crewId && dueDate &&
(payload.status === "programada" || payload.status == null)
```

`buildWorkOrderCreatePayload` manda `status: "programada"` y `crewId` si hay cuadrilla. `getInitialTaskStatus` también es `"programada"` aunque haya cuadrilla (comentario: «OT recién creada: siempre Programada»).

### 3.3 Cómo se elige el número

`resolveNextPlanningQueuePosition` → `filterOperationalOrderScope` → `collectOccupiedOperationalOrderSlots` → `resolveFirstAvailableOperationalOrderSlot`.

Ocupación:

- OT `programada`: usa `execution_order`.
- OT congeladas (`en-curso`, `incidencia`, `pendiente-cierre`, `en-aprobacion`): usa `dispatch_order`.
- Resto (`asignada`, `vencida`, `cancelada`, …): usa **solo** `dispatch_order`.

**Hueco:** si una OT `vencida` (o `asignada` mal migrada) todavía tiene `execution_order = 1` y `dispatch_order` null, el slot 1 se considera **libre**. Postgres sigue ocupándolo. El insert choca con la unique.

Evidencia de vencida: `lib/supabase/tasks-vencida-sync.server.ts` hace `patchTask(..., { status: "vencida" })` **sin** limpiar `execution_order`. Confirmación de planificación sí pone `executionOrder: null` (`use-tasks-planning.ts`); el pasaje automático a vencida no.

### 3.4 Import Excel — misma sesión

`executeWorkOrderImport` mantiene `workingTasks` local y lo usa **solo** para códigos (`buildWorkOrderCreatePayload`). El orden lo calcula `addTask` con el `tasks` del hook (closure de React). En un `for` con `await addTask`, el estado no se re-renderiza entre filas: **todas las filas de la misma cuadrilla/fecha pueden recibir el mismo `executionOrder`**.

### 3.5 El ejemplo del spec existe

```
DB 23505 + tasks_execution_order_crew_date_unique
 → mapSupabaseTaskError code DUPLICATE_EXECUTION_ORDER
 → addTask throw Error(message)
 → TaskWorkOrderDialog setError
 → "Ya existe otra OT con el mismo orden de ejecución para esa cuadrilla y fecha."
```

Si PostgREST no incluye el nombre del índice en `message`/`details`/`hint`, el mismo `23505` cae en `DUPLICATE_CODE` («Ya existe una orden de trabajo con ese código.») — mensaje **incorrecto**.

---

## 4. Domicilio

### 4.1 Campos reales

| Rol | Campo form | Campo payload | Columna DB |
|-----|------------|---------------|------------|
| Dirección de la OT | `WorkOrderFormInput.address` (y `currentAddress` / `newAddress` en cambio de domicilio) | `CreateTaskPayload.serviceAddress` | `tasks.service_address` **nullable** |
| Localidad OT | `locality` / `currentLocality` / `newLocality` | `locality` | `tasks.locality` nullable |
| GPS OT | `sharedLocation` / `newSharedLocation` | `sharedLocation`, `latitude`, `longitude` | `tasks.shared_location` **NOT NULL** (default `""`), lat/lng nullable |
| Dirección del cliente | `Customer.address` | no se escribe en create salvo `instalacion-nueva` → `createCustomer` | `customers.address` |
| GPS del cliente | `Customer.sharedLocation`, `latitude`, `longitude` | **no copiados** al form OT | `customers.shared_location` / lat / lng |

No hay columnas `domicilio`, `installation_address` ni `current_address` en `tasks`. En import, headers `domicilio` mapean a `address` (`lib/tasks/work-order-import/columns.ts`).

`resolvePrimaryAddress`:

- `cambio-domicilio` → `newAddress` o fallback `currentAddress`
- resto → `form.address`

### 4.2 Copia desde el cliente

`applyCustomerToForm` en `task-work-order-dialog.tsx` copia:

- `address`, `locality`, `customerId/name/phone/email`, `technology`
- `currentAddress` / `currentLocality` / `currentTechnology` (para cambio de domicilio)

**No copia:** `sharedLocation`, `latitude`, `longitude`, plan, NAP/ONU.

Momento: al seleccionar cliente, o al resolver `fetchCustomerById` del prefill de Atención.

Si `customers.address` es null/"" → `form.address` queda `""`.

### 4.3 Validación frontend vs backend vs DB

| Capa | Dirección calle | GPS |
|------|-----------------|-----|
| Frontend OT | `validateWorkOrderForm`: `input.address.trim()` (o current+new). Mensaje **«La dirección es obligatoria.»** | `validateWorkOrderSharedLocation`. Mensaje **«La ubicación GPS es obligatoria. Pegue el enlace de Google Maps.»** |
| Backend insert | **Ninguna** validación de domicilio | `enrichCreateTaskPayloadWithResolvedLocation` (aún en cliente) exige resolver si hay link |
| Postgres | `service_address` puede ser NULL | `shared_location` string; no CHECK de URL |

`insertTask` no valida dirección. Un payload vacío pasaría a DB (`service_address: null`) si se saltara el form.

### 4.4 Dónde aparece «El domicilio es obligatorio»

Única coincidencia exacta: `lib/isp/migration/integrity.ts` (import de abonados ISP, campo `domicilio`). **Fuera del flujo de creación de OT.**

En ISP 360 el label del campo cliente es **«Domicilio»** (`isp-customer-edit-sheet.tsx`), pero Clientes 360 **no crea** OT.

### 4.5 Por qué parece que “ya está cargado”

1. **Buscador:** `formatCustomerAddressLabel` (`lib/customers/format.ts`) muestra `address - locality`, o **solo locality** si no hay address. El operador ve un “domicilio” en el dropdown; `form.address` sigue vacío.
2. **GPS de la ficha no viaja:** el cliente puede tener Maps/GPS; el form exige pegar de nuevo el enlace. Dirección visible + GPS vacío → error de ubicación, no de calle.
3. **Cambio de tipo:** `handleServiceTypeChange` reemplaza el form por `getDefaultWorkOrderForm()` y pone `customerSelected = false`. Prefill de Atención/Comercial y cliente elegido se **borran**. Secuencia típica Atención: se carga el cliente async → el usuario elige tipo de trabajo → se limpia la dirección.
4. **Cambio de domicilio:** se rellena domicilio **actual**; el **nuevo** sigue vacío. Validación exige ambos.
5. **GPS vs calle:** `WorkOrderAddressLocationBlock` puede mostrar “GPS cargado” o “coordenadas se resolverán al guardar” con `sharedLocation` lleno y `address` vacío (instalación nueva exige ambos).
6. **Cliente reciente:** `createCustomer` en instalación nueva usa `form.address`. Si el cliente previo en padrones tiene solo localidad / GPS ISP, la OT no hereda calle.
7. **Comercial:** prefill `person.address \|\| person.street` y `person.city` como localidad. Sigue faltando GPS obligatorio.
8. **Import:** dirección obligatoria solo para `instalacion-nueva`. Otros tipos pueden importarse sin address; el form manual sí la exige.

`undefined` / `null` / `""` en address: `?? ""` en apply; `.trim()` en validación → todos fallan igual.

---

## 5. Otras validaciones

### Frontend (`validateWorkOrderForm` + dialog)

| Campo | Condición | Mensaje | Dónde |
|-------|-----------|---------|--------|
| serviceType | vacío | Seleccione el tipo de trabajo. | `validateWorkOrderForm` |
| customerName | vacío | El cliente es obligatorio. | idem |
| scheduledDate | vacío | La fecha programada es obligatoria. | idem |
| crewId | vacío | Seleccione la cuadrilla sugerida. | idem |
| shift | vacío | Seleccione el turno. | idem |
| duración | no resoluble | La duración estimada es obligatoria. | idem |
| address | según tipo (ver §4) | La dirección es obligatoria. | idem |
| locality | instalación nueva | La localidad es obligatoria. | idem |
| technology / planes / IP / FTTH / motivos | según tipo | Varios | idem |
| GPS | siempre en form OT | Ubicación GPS obligatoria / Maps inválido | `validateWorkOrderSharedLocation` |
| crew | no encontrada / inactiva | `validateCrewAssignment` | dialog |
| fotos | create, 0 fotos | Debe adjuntar al menos una fotografía… | dialog |
| reconexion | cliente no elegible | `validateReconexionCustomer` | dialog |
| lookup | sin `customerId` | Seleccione un cliente registrado. | `resolveCustomerIdForSave` |

Validaciones sobre datos que el usuario **no acaba de editar** o **desactualizados**:

- Dirección/GPS heredados (o no) del cliente.
- Prefill async de Atención vs reset de tipo.
- Import: no valida turno, GPS ni fotos; sí puede chocar execution_order.

### Backend / insert

| Condición | Código | Mensaje |
|-----------|--------|---------|
| Unique execution_order | `DUPLICATE_EXECUTION_ORDER` | Ya existe otra OT con el mismo orden… |
| Unique código (`tasks_company_code_unique`) u otro 23505 no reconocido | `DUPLICATE_CODE` | Ya existe una orden de trabajo con ese código. |
| Unique dispatch_order | `DUPLICATE_DISPATCH_ORDER` | Ya existe otra OT con el mismo orden de despacho… |
| CHECK / workflow `23514` o `TASK_STATUS_` | `WORKFLOW` | Transición no permitida… |
| Integridad obra | `WORKFLOW` | Cuadrilla/obra tenant |
| GPS no resoluble | throw JS (no código repo) | No se pudo resolver la ubicación GPS… |
| Demo RO | `DemoWriteBlockedError` | Dialog sale sin mensaje de error de OT |
| RLS insert | PostgREST | Suele llegar como `UNKNOWN` + `error.message` crudo |
| `due_date >= start_date` CHECK | `23514` / UNKNOWN | Form OT pone ambas iguales |

Obras (`ProjectTaskDialog`): no usa `validateWorkOrderForm`. GPS opcional; si hay link y no resuelve, falla en el dialog. `execution_order` no se asigna (`shouldApplyPlanningQueueSideEffectsForTask` = false).

---

## 6. Payload

Tipo: `CreateTaskPayload` = `Omit<Task, "id" \| "progress" \| "status">` + `companyId?`, `status?`, etc. (`lib/types/supabase/tasks.ts`).

Shape real que manda `buildWorkOrderCreatePayload` (nombres **camelCase** de app, no snake_case):

```ts
{
  code,                    // placeholder; addTask lo regenera (TSK-OT-)
  title,                   // label del tipo de trabajo
  description,             // observations
  projectId: undefined,
  projectCode: "OT",
  projectName,             // nombre del cliente
  customerName, customerPhone, customerDni?, customerCompany?,
  customerId,
  serviceAddress,          // resolvePrimaryAddress
  sharedLocation, observationsForCrew, workOrderNumber,
  type,                    // fiber | wireless | maintenance…
  status: "programada",
  priority: "media",
  supervisor, crewId, crew,
  startDate, dueDate,      // = scheduledDate
  scheduledTime,           // desde shift; import manda null
  estimatedDuration,
  checklist, operationalSteps,
  serviceType, locality, taskMetadata,
  contractedPlan, serviceCatalogId,
  amountToCollect, paymentMethod?,
  latitude, longitude,
  // executionOrder NO va aquí; lo agrega addTask
}
```

`mapCreatePayloadToInsert` columnas: `company_id`, `code`, `title`, `description`, `project_*`, `customer_*`, `service_address`, `latitude`, `longitude`, `location_resolution_method`, `shared_location`, `observations_for_crew`, `work_order_number`, `type`, `status`, `priority`, `supervisor`, `crew_id`, `crew`, `start_date`, `due_date`, `scheduled_time`, `estimated_duration`, `checklist`, `operational_steps`, `progress`, `service_type`, `locality`, `contracted_plan`, `service_catalog_id`, `installation_cost`, `amount_to_collect`, `payment_method`, `task_metadata`, `execution_order`, `dispatch_order`.

| Tipo | Campos |
|------|--------|
| Obligatorios form OT | tipo, cliente, fecha, cuadrilla, turno, duración, GPS, fotos; dirección según tipo |
| Opcionales form | observaciones, monto, NAP/ONU, DNI (salvo reglas de tipo) |
| Defaults | `priority: "media"`, `status: "programada"`, `projectCode: "OT"`, `checklist` default, `shared_location: ""` en DB |
| Calculados cliente | `code`, `executionOrder`, lat/lng resueltos, `status` inicial |
| Heredados cliente | name, phone, email, address, locality, technology (no GPS) |
| Heredados servicio | no hay `service_id` en create OT; planes van a `taskMetadata` / `contractedPlan` |
| Calculados backend | **ningún** orden ni código; el “backend” de insert es el cliente de Supabase |

Payload de **Obra** (dialog): `projectId`, `projectCode`, `title`, fechas, `crewId`, `sharedLocation`, checklist, status `borrador` o `programada` (`resolveProjectTaskCreateStatus`). Sin `serviceType` de catálogo OT.

Atención prefill **no** incluye address: solo `atencionId`, `customerId`, expediente, motivo, observaciones, historial técnico.

Comercial prefill: `address`, `locality`, nombre, teléfono, producto, observaciones.

---

## 7. Backend

No hay API de creación. El “backend” es el browser + PostgREST.

| Superficie | Método | Función | Notas |
|------------|--------|---------|-------|
| `lib/supabase/tasks.browser.ts` | `createTask` | wrap `insertTask` | Usado en producción |
| `lib/supabase/tasks.repository.ts` | `createTask` | wrap `insertTask` server | **No** hay callers de create en app/api |
| `lib/supabase/tasks.queries.ts` | `insertTask` | insert | Obra integrity + mapper |
| `lib/supabase/tasks.queries.ts` | `mapSupabaseTaskError` | 23505 / 23514 | Ver §9 |
| `lib/supabase/tasks.queries.ts` | `fetchNextExecutionOrderForCrewDate` | slot desde DB | **No usado en create** |
| `app/api/atencion-cliente/[atencionId]/link-ot` | POST | `linkCustomerAtencionToTask` | Link, no insert |
| `app/api/tasks/[taskId]` | PATCH/DELETE | admin | No create |
| `app/api/isp/tasks/[taskId]` | GET | — | Lectura |
| `app/api/mobile/v1/tasks/[taskId]` | POST 405 | — | No create |
| `app/api/tasks/sync-vencida` | POST | pasa a vencida | Deja `execution_order` |

`company_id` lo setea `addTask` desde sesión. El mapper, si faltara, usa `BESPOKE_PRODUCTION_COMPANY_ID`.

---

## 8. Base de datos

Tabla `public.tasks` (origen `20260614000000_create_tasks.sql` + alteraciones).

| Mecanismo | Detalle |
|-----------|---------|
| NOT NULL relevantes | `code`, `title`, `company_id`, `due_date`, `start_date`, `crew` (texto), `shared_location`, `status`, `type`, … |
| Nullable | `service_address`, `crew_id`, `execution_order`, `dispatch_order`, `customer_id`, lat/lng |
| UNIQUE | `tasks_company_code_unique (company_id, code)` (`20260616000000_create_companies.sql`) |
| UNIQUE parcial | `tasks_execution_order_crew_date_unique` |
| UNIQUE parcial | `tasks_dispatch_order_crew_date_unique` |
| CHECK | `due_date >= start_date`; `progress` 0–100; workflow de status en migraciones posteriores (`TASK_STATUS_*`) |
| FK | `company_id`, `crew_id`, `customer_id`, `project_id`, `service_catalog_id` |
| Trigger | `tasks_set_updated_at` |
| RLS | SELECT/INSERT/UPDATE por `company_id = auth_user_company_id()`; demo RO no inserta |
| RPC create | **No** hay RPC que inserte OT. `link_customer_atencion_to_task` solo vincula |

`isp_services` / `connections` **no** participan del insert de OT.

Soft delete: `deleted_at` saca la fila del unique parcial de execution_order.

---

## 9. Manejo de errores

### Cadena execution_order (real)

```
PostgreSQL  23505 unique_violation
            index tasks_execution_order_crew_date_unique
Supabase    { code, message, details, hint }
insertTask  mapSupabaseTaskError → { code: "DUPLICATE_EXECUTION_ORDER", message: "Ya existe otra OT…" }
addTask     logOperationError("TASK CREATE", result.error)
            throw new Error(result.error.message)
UI          TaskWorkOrderDialog.setError(submitError.message)
            Import: executeWorkOrderImport catch → reportRows.error
```

El ejemplo del pedido **existe** (con la salvedad de mapeo a `DUPLICATE_CODE` si no viaja el nombre del índice).

### Cadena dirección (real)

```
validateWorkOrderForm  (no llega a Supabase)
setError("La dirección es obligatoria.")
```

No hay código de error de API. No hay fila. No hay audit.

### Cadena GPS (real)

```
validateWorkOrderSharedLocation  (form)
  o enrichCreateTaskPayloadWithResolvedLocation throw
setError / throw  "La ubicación GPS es obligatoria…" / "No se pudo resolver…"
```

Si falla el enrich, `logOperationError` **no** corre (el throw es anterior al insert). `perf.fail` sí, si el observatorio está enabled.

### Qué se pierde / se transforma

| Origen | Transformación | Riesgo |
|--------|----------------|--------|
| 23505 execution_order | Mensaje de negocio claro **si** el nombre del índice está en el error | Si no, se muestra como duplicado de **código** |
| RLS / FK / NOT NULL | `UNKNOWN` + `error.message` crudo de PostgREST | Técnico en UI |
| Dirección/GPS form | Nunca sale de React | Operador no distingue “no copiado” vs “vacío en cliente” |
| Demo write | swallow `DemoWriteBlockedError` | Sin mensaje de OT |
| Payload completo | no se loguea | no se reconstruye el intento |

---

## 10. Logging actual

| Mecanismo | Qué registra | ¿Fallo de create? | Usuario | Empresa | OT | Timestamp |
|-----------|--------------|-------------------|---------|---------|----|-----------|
| `logOperationError` (`lib/operations/user-messages.ts`) | `console.error("[TASK CREATE]", error)` | Sí, si `insertTask` devolvió error | No | No | No | Solo log de proceso |
| `startPerformanceTrace("CREATE OT")` | console summary si observatorio ON; si OFF igual hay `console.log("[PERF] Observatory disabled", …)` | `perf.fail` con message | No | No | No | Reloj local del summary |
| `recordAuditEventClient` → `/api/audit/events` | Historial del Sistema | **Solo éxito** (`recordTaskCreateAudit`) | Sí (sesión en API audit) | Implícito | `task.id` | Sí |
| Activity Engine | `TASK_CREATE` / `TASK_SCHEDULE` / `TASK_ASSIGN_CREW` | **Solo éxito** | Sí | Sí | Sí | Sí |
| OIE `recordTaskOperationalEvent` | evento created | **Solo éxito** | actor | companyId | task | Sí |
| `console.warn` audit best-effort | fallo al **grabar** audit de un éxito | N/A | parcial | — | entityId | — |

No hay `request_id` / `trace_id` / `correlation_id` en el fallo de create. `planTaskCreateActivityEmissions` genera `correlationId` **después** del insert exitoso.

**Intentos fallidos no quedan en DB.** No hay tabla de “OT create failed”.

---

## 11. Activity Engine

Catálogo: `ACTIVITY_ACTIONS.TASK_CREATE` → «Crear OT» (`lib/activity/catalog.ts`).

Emisión: `recordTaskCreateActivity` → «OT creada.» + opcional «OT programada.» + «Cuadrilla asignada en la creación de la OT.»

**No existe** acción tipo «Intento de crear OT fallido». Un 23505 o una validación de dirección no generan activity, audit ni OIE.

Diferencia evidencia:

| Evento | ¿Se emite? |
|--------|------------|
| OT creada (éxito) | Sí |
| Intento fallido | No |

---

## 12. Supabase logs

Esta auditoría **no** cambió configuración ni leyó el dashboard de un proyecto hosted. Lo observable **en principio**:

| Evento | Postgres / Supabase API logs | App (Next) |
|--------|------------------------------|------------|
| unique_violation 23505 | Sí, con constraint y key `(due_date, crew_id, execution_order)` | `console.error` TASK CREATE + UI mapeada |
| NOT NULL | Sí | `UNKNOWN` + message crudo |
| CHECK 23514 | Sí | `WORKFLOW` o UNKNOWN |
| RLS denied | PostgREST 401/403, a menudo sin detalle de policy | UNKNOWN |
| timeout | 57014 / gateway | fetch error; UI genérica si no es `Error.message` |
| Validación solo frontend | **Nada en Supabase** | Solo UI |

Para ver unique vs NOT NULL hay que mirar logs de Postgres/API del proyecto, no Activity.

---

## 13. Casos reproducidos

**No se ejecutaron inserts reales.** No hay sesión de browser autenticada para el flujo de producto. No se crearon datos de prueba. No se alteró producción.

Evidencia extra en tests existentes: `scripts/test-ot-vencidas-bug-1-1-execution-order.mjs` afirma explícitamente *«vencida is not operational-order reorderable (stale order kept without clear)»* y que el unique se mapea al mensaje de UI. Eso confirma C2 y G7 sin haber tocado código.

`scripts/test-work-order-admin-execution-order-hotfix.mjs` tiene **2 fallos preexistentes** (fixtures sin `projectCode`/`serviceType`, el universo de ruta queda vacío y el primer slot sale `1` en vez de `3`). No se corrigieron: fuera de alcance.

Diagnóstico por código + tests de lectura:

| Test | Resultado esperado por código | ¿Ejecutado live? |
|------|-------------------------------|------------------|
| A OT normal cliente con address+GPS en ficha | Form exige GPS de nuevo; address sí se copia si `customers.address` tiene valor | No (UI) |
| B Segunda OT misma cuadrilla/fecha | Segundo `executionOrder` debería ser N+1 **si** la lista en memoria ya incluye la primera | No |
| C Misma cuadrilla/fecha/orden | 23505 + mensaje unique; import en loop es el escenario más probable | No |
| D Sin cuadrilla | Form bloquea; import permite `execution_order` null | No |
| E Sin fecha | Form bloquea | No |
| F Desde Atención | Prefill sin address; fetch cliente; **cambiar tipo borra** datos | No |
| G Cambio de domicilio | Exige current+new; GPS nuevo obligatorio | No |
| H Instalación FTTH | address+locality+tech+plan; GPS; fotos | No |
| I Cliente recién creado | Depende de si `customers.address` se persistió | No |
| J Servicio existente | No hay `service_id` en payload OT; se usa cliente + tipo | N/A |

Corrido en esta auditoría (solo lectura, sin Supabase):

- `npm run type-check` — OK
- `test:work-order-execution-order-edit-hotfix` — 5/5
- `test:work-order-contact-commercial-hotfix` — 5/5
- `npx tsx --test scripts/test-execution-order-compact-hotfix.mjs` — 23/23
- `npx tsx --test scripts/test-ot-vencidas-bug-1-1-execution-order.mjs` — 4/4
- `test:work-order-admin-execution-order-hotfix` — 6/8 (2 fallos preexistentes; ver arriba)

---

## 14. Problemas encontrados

### Crítico

| ID | Problema |
|----|----------|
| 🔴 C1 | `execution_order` se calcula en el cliente con `tasks` stale; `insertTask` no lee DB; no hay retry. Import en loop y doble click/concurrencia duplican el slot. |
| 🔴 C2 | OT `vencida` (sync solo cambia `status`) conserva `execution_order`; el calculador de slots no lo ocupa → unique al crear la siguiente OT del mismo crew/fecha. |

### Importante

| ID | Problema |
|----|----------|
| 🟠 I1 | `applyCustomerToForm` no copia GPS del cliente; el form exige Maps otra vez. |
| 🟠 I2 | `formatCustomerAddressLabel` muestra localidad como si fuera domicilio cuando `address` está vacío. |
| 🟠 I3 | `handleServiceTypeChange` resetea el form y pierde prefill Atención/Comercial/cliente. |
| 🟠 I4 | La frase «El domicilio es obligatorio» no es del flujo OT; los mensajes reales son dirección/GPS. Diagnóstico operativo fácil de desviar. |
| 🟠 I5 | Fallos de create no quedan en Activity ni Audit; no se reconstruye el intento. |
| 🟠 I6 | Import no valida GPS/turno/fotos y sí dispara asignación de `execution_order`. |
| 🟠 I7 | `23505` sin nombre de índice se muestra como duplicado de **código**. |

### Menor

| ID | Problema |
|----|----------|
| 🟡 M1 | Unique de orden no incluye `company_id` (mitigado por UUID de cuadrilla). |
| 🟡 M2 | `TaskFormDialog` tiene validación de dirección muerta. |
| 🟡 M3 | Mapper default `company_id` a `BESPOKE_PRODUCTION_COMPANY_ID` si el caller olvida sesión. |
| 🟡 M4 | Tipo `baja` no exige calle (sí GPS). |
| 🟡 M5 | Observatorio de performance loguea disabled/enabled en consola. |
| 🟡 M6 | Sin correlation id en el camino de error. |

### Correcto

| ID | Hecho |
|----|-------|
| 🟢 G1 | Un solo stack de insert de producto (`addTask` → `insertTask`). |
| 🟢 G2 | Clientes 360 y mobile no crean OT. |
| 🟢 G3 | Atención/Comercial reutilizan el form y solo linkean después. |
| 🟢 G4 | `execution_order` NULL es válido; unique parcial está bien diseñada para planificación. |
| 🟢 G5 | OT de Obra no entra a la cola de `execution_order` (OPS 2.1B). |
| 🟢 G6 | Create siempre `programada` aunque haya cuadrilla sugerida. |
| 🟢 G7 | Mapper de `DUPLICATE_EXECUTION_ORDER` y mensaje de negocio existen de verdad. |
| 🟢 G8 | Éxito sí deja audit + activity + OIE. |
| 🟢 G9 | RLS insert acotado por `company_id`. |
| 🟢 G10 | `service_address` nullable: Postgres no es quien rechaza el domicilio vacío. |

**Conteo:** 🔴 2 · 🟠 7 · 🟡 6 · 🟢 10

---

## 15. Causa raíz

### Execution order

```
CAUSA
  El slot se genera en el browser (lista local + motor de planificación)
  en lugar de asignarse de forma atómica en Postgres.
  Además, estados que salen de "programada" (vencida) no liberan el valor
  ni lo cuentan como ocupado.

IMPACTO
  Insert falla con unique. El operador ve un mensaje de “otra OT con el
  mismo orden” sin haber elegido ningún orden. Import masivo es el peor caso.

EVIDENCIA
  use-tasks-create.ts (resolveNextPlanningQueuePosition sobre `tasks`)
  insertTask no llama fetchNextExecutionOrderForCrewDate
  tasks-vencida-sync.server.ts patch solo status
  collectOccupiedOperationalOrderSlots ignora execution_order si no es programada
  20260903000100_task_execution_order.sql unique parcial
  mapSupabaseTaskError DUPLICATE_EXECUTION_ORDER

RECOMENDACIÓN
  No tocar la constraint. Asignar el orden en el insert (DB o insertTask
  con lectura fresca + retry 23505). Incluir execution_order de vencida
  en ocupación o limpiarlo al pasar a vencida.
```

### Domicilio

```
CAUSA
  Tres fuentes distintas se presentan como “el domicilio”:
  (1) customers.address, (2) locality / label del buscador,
  (3) GPS sharedLocation. El form valida (1) y (3); (2) y el GPS
  de la ficha no alimentan (1)/(3). El cambio de tipo borra (1).

IMPACTO
  Bloqueo en frontend con dirección o GPS “obligatorio” aunque el
  operador vea datos en búsqueda, ficha o prefill.

EVIDENCIA
  validateWorkOrderForm address.trim()
  validateWorkOrderSharedLocation
  applyCustomerToForm sin sharedLocation/lat/lng
  formatCustomerAddressLabel address || locality
  handleServiceTypeChange → getDefaultWorkOrderForm()
  "El domicilio es obligatorio." solo en isp/migration/integrity.ts
  tasks.service_address nullable

RECOMENDACIÓN
  No hay pérdida en Postgres. Alinear copia de ficha (calle + GPS),
  no resetear prefill al elegir tipo, y unificar copy (dirección vs GPS
  vs domicilio ISP).
```

---

## 16. Recomendaciones

### Corrección inmediata (siguiente sprint; **no hecha aquí**)

1. Asignar `execution_order` en `insertTask` (o RPC) con el mismo criterio que `fetchNextExecutionOrderForCrewDate`, no con el array React.
2. Retry limitado en `23505` de ese índice.
3. Al pasar a `vencida`, o bien `execution_order = NULL`, o bien contar ese valor en `collectOccupiedOperationalOrderSlots`.
4. Copiar `sharedLocation` / coordenadas del cliente en `applyCustomerToForm`.
5. No destruir cliente+dirección al cambiar `serviceType` (preservar prefill).
6. Distinguir en UI dirección de calle vs GPS (el operador dice “domicilio” para ambos).

### Mejora estructural

1. Crear OT por API server (un solo writer, lock por `company_id + due_date + crew_id`).
2. Persistir intentos fallidos (activity `result: error` o audit) con payload sanitizado, usuario, empresa, código de error.
3. Import: reutilizar `validateWorkOrderForm` o no asignar orden hasta planificar.
4. Hacer que `mapSupabaseTaskError` detecte unique por columnas `due_date, crew_id, execution_order` aunque falte el nombre del índice.

### Mejora futura

1. Orden solo en Planificación (create sin `execution_order`); la unique seguiría protegiendo.
2. Correlation id de punta a punta.
3. Domicilio de servicio ISP (`isp_services` / conexiones) como fuente al crear OT desde 360, si ese producto se habilita.
4. Quitar o reactivar `TaskFormDialog` muerto.

---

## 17. Tests recomendados

Existentes (lectura, útiles para no regresar lógica de **edición** de orden):

- `scripts/test-work-order-execution-order-edit-hotfix.mjs`
- `scripts/test-work-order-admin-execution-order-hotfix.mjs`
- `scripts/test-execution-order-compact-hotfix.mjs`
- `scripts/test-ot-vencidas-bug-1-1-execution-order.mjs` (ya documenta orden stale en vencida)

**Faltan** (no implementar en este sprint):

1. Dos `insertTask` paralelos misma company/crew/due_date → no 23505 (o retry).
2. Import 3 filas misma cuadrilla/fecha → execution_order 1,2,3.
3. OT programada que pasa a vencida conserva o libera orden; la siguiente create no choca.
4. Cliente con `address=""` y `locality` set → form no debería creer que hay calle.
5. Cliente con `sharedLocation` → form OT nace con GPS.
6. Atención: elegir tipo **después** del prefill no borra address.
7. `validateWorkOrderForm` con GPS lleno y address vacío → mensaje de **dirección**, no de domicilio ISP.
8. `mapSupabaseTaskError` con details `Key (due_date, crew_id, execution_order)=` y sin nombre de índice → sigue `DUPLICATE_EXECUTION_ORDER`.
9. Create fallido **no** emite `TASK_CREATE` (hoy es así; test de no-regresión de logging cuando se agregue).
10. Obra create no setea `execution_order`.

---

## 18. No modificar todavía

Esta auditoría **no cambió producción**.

No se hizo:

- hotfix
- migración
- cambio de constraint `tasks_execution_order_crew_date_unique`
- cambio de API / UI / validaciones
- commit ni push

El único artefacto nuevo es este informe: `docs/audits/ot-audit-1-0.md`.
