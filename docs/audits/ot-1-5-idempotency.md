# OT 1.5 — Idempotencia en creación de OT

## Estado

- **OT 1.5 (2026-08-26):** auditoría. Confirmó que la creación no era idempotente.
- **OT 1.5.1 (2026-08-26):** implementación del diálogo Nueva OT (manual, Atención, Comercial).

La auditoría original se conserva al final de este archivo.

---

## Diseño OT 1.5.1

### Key elegida

`tasks.idempotency_key uuid NULL`

Unique parcial:

`(company_id, idempotency_key) WHERE idempotency_key IS NOT NULL`

- Históricas, Obra e import quedan `NULL` (varios NULL permitidos).
- El unique **incluye filas soft-deleted**. Una key es una operación única y no puede mintir una segunda OT.
- No se tocó `tasks_execution_order_crew_date_unique`.

Se descartó una tabla aparte de operaciones: la OT es el resultado de la operación y el unique por tenant alcanza. Se descartó unique global (cruzaría empresas).

### Dónde se genera

Al **abrir** el diálogo de creación (`open` pasa a true y no es edición). `crypto.randomUUID()` vía `createWorkOrderIdempotencyKey()`.

No se genera al hacer click en Guardar. Sobrevive validación, loading, timeout y error de red.

Se rota cuando el usuario cancela / cierra y abre una **nueva** creación.

Edición: no genera ni envía la key. Trigger `freeze_task_idempotency_key` impide cambiarla una vez asignada.

### Dónde se persiste

Columna `tasks.idempotency_key`. El RPC `create_work_order_idempotent`:

1. Toma `company_id` de `auth_user_company_id()` (nunca del frontend).
2. Lock advisory `(company, key)`.
3. Si ya existe una OT de esa company+key (incluida eliminada): replay o error documentado.
4. Si hay que crear cliente (`create_customer` y sin `customer_id`): INSERT en la misma transacción.
5. Llama a `create_task_with_execution_order` (OT 1.1: lock de slot, primer hueco, unique).
6. `UPDATE` de `idempotency_key` sobre la fila nueva.
7. Si vienen `atencion_id` / `commercial_solicitud_id`: vínculo en la misma transacción.
8. Devuelve `{ task, task_id, created, idempotent_replay }`.

### Retry

Misma key → `{ created: false, idempotent_replay: true, task: <OT existente> }`.

El frontend trata el replay como éxito: deduplica en la lista, no re-audita.

No se muestra “duplicate key”. Un unique residual del índice se mapea a un conflicto genérico para reintentar.

### Atomicidad

Cliente nuevo + OT + vínculo Atención/Comercial están en **una** transacción. Si el vínculo obligatorio falla, rollback (no queda cliente huérfano ni OT sin link).

Fotos de referencia, audit y operational event siguen fuera de la transacción (best-effort).

### Cliente (OT 1.4.1)

- Con `form.customerId` válido → reutilizar. No hay `create_customer`.
- Sin id + instalación nueva → `createCustomerDraft` en el payload; el RPC crea la ficha.
- Sin matching heurístico por nombre/DNI/teléfono/email.
- Sin unique nuevo de DNI/email/teléfono.

### Atención

La key representa toda la operación: OT + `link_customer_atencion_to_task`.

Retry: no llama al link otra vez (evitar evento duplicado / consulta ya resuelta). El frontend ya no hace el POST `/link-ot` post-create.

### Comercial

Igual: `work_order_id` + `ot_generada` en la misma transacción. Retry no reescribe a otra OT. El frontend ya no llama `linkCommercialSolicitudToWorkOrder` post-create.

### Import

**OT 1.5.2.** El CSV no tiene `import_id` estable por corrida. No se usa el índice global de fila como key.

Infra lista: `insertTask` usa el RPC idempotente cuando hay `idempotencyKey`. El import hoy no la envía y sigue el RPC OT 1.1. Futuro: `uuid` determinístico de `company_id + import_id + row_number`.

### Soft delete

Si la OT de la key está `deleted_at IS NOT NULL`:

**no se crea otra OT.** Se devuelve `IDEMPOTENCY_OPERATION_DELETED` (mensaje para cancelar y abrir una nueva OT, que genera **otra** key).

No se reutiliza la key para “revivir” ni para clonar.

### Multi-tenant

Unique `(company_id, key)`. Lookup y writes filtran `auth_user_company_id()`. Una key de A no puede devolver una OT de B.

### Tests

`npm run test:ot-1-5-idempotency` cubre key lifecycle, unique, RPC wrapper, misma key, concurrencia (Promise.all + lock), retry, cliente existente/nuevo/rollback, Atención, Comercial, manual, soft delete, aislamiento A/B, edición, execution_order, import.

### Limitaciones

- La migración hay que aplicarla en el entorno antes de usar el RPC en vivo.
- Import CSV todavía duplica si se reejecuta el archivo (1.5.2).
- Fotos de referencia en retry pueden cargarse otra vez sobre la misma OT.
- Audit / operational event no son transaccionales; en replay se omiten.
- La key no se persiste en sessionStorage: cerrar el diálogo = nueva operación.
- GPS enrich sigue siendo HTTP previo al RPC; si falla, no hay cliente ni OT.

---

## Auditoría original (OT 1.5)

Fecha: 2026-08-26. Solo diagnóstico en su momento. **Supersedida por OT 1.5.1.**

## Resumen ejecutivo (histórico)

Hoy la creación de OT **no es idempotente**. No hay `idempotency_key`, no hay transacción `createCustomer` + `createTask`, y el botón Guardar se deshabilita **después** de validar.

El resultado más probable de un doble click (o de un retry tras timeout) es:

| Origen | Doble click / retry |
|---|---|
| Instalación nueva **sin** `customerId` | **D)** dos clientes + dos OTs (o 1 cliente + unique de número + 1 OT, y retry crea más) |
| Atención / cliente existente (OT 1.4.1) | **B)** dos OTs sobre C1; la consulta/solicitud vincula como mucho una |
| Import reejecutado | N clientes/OTs nuevos según filas |

Única protección real contra “el mismo insert”: `UNIQUE (company_id, code)` en `tasks`. El `code` se **regenera en cada intento**, así que **no** sirve como clave de retry.

El único precedente de idempotencia en el repo es Presence (`task_presence_events_idempotency_uidx`), no OT.

---

## 1. Flujo actual

Todos los orígenes A–C convergen en el mismo diálogo y en `addTask` → `insertTask` → RPC `create_task_with_execution_order`.

```
UI (task-work-order-dialog)
  → validateBeforeSave          (no muta)
  → setIsSubmitting(true)       (tarde: después del await de validar)
  → resolveCustomerIdForSave    MUTA si action === "create"
  → buildWorkOrderCreatePayload (no muta)
  → onSubmit = addTask
       listOccupiedTaskCodes    (lee)
       enrich GPS               (HTTP; puede TIRAR)
       stripClientExecutionOrder
       insertTask / RPC         MUTA tasks (+ execution_order atómico)
       setTasks / cache         (UI)
       recordTaskCreateAudit    best-effort, void
       recordTaskOperationalEvent  void, no espera
  → fotos de referencia         MUTA attachments (OT ya existe)
  → onTaskCreated
       Atención: linkConsultationOtManagement   MUTA consulta
       Comercial: linkCommercialSolicitud…      MUTA solicitud
  → prepareCustomerSync (solo tipos ≠ instalación nueva)
  → forceClose
```

**Aprobación** (`applyWorkOrderApprovalEffects`) **no corre al crear**. Corre al aprobar en workflow. Fuera de este sprint de creación.

### A) Nueva OT manual

`/tareas` → diálogo vacío → Guardar → `handleCreateWorkOrder` → `addTask`.

Sin `customerId` + instalación nueva: `createCustomer` y luego OT.

Con cliente seleccionado (OT 1.4.1): no crea ficha; sí puede crear **varias** OT sobre el mismo C1.

### B) Atención → Generar OT

`OtLinkBlock` guarda prefill (`atencionId` + `customerId`) y abre `/tareas?nuevaOt=1`.

Tras crear: `link_customer_atencion_to_task`. Si la consulta ya está resuelta sin `generar_ot` pendiente, el **link** falla; la **OT ya está insertada**.

No hay identificador de “esta generación ya se ejecutó” **antes** del insert. `linked_task_id` se escribe **después**.

Si el link funciona, la UI deja de mostrar “Crear Orden de Trabajo”. Si el link falla, el botón **sigue disponible** → otro intento.

### C) Comercial → Generar OT

Prefill de solicitud. Con `sourceCustomerId` (OT 1.4.1) reutiliza C1; si no, puede crear ficha.

Tras crear: `linkCommercialSolicitudToWorkOrder` pone `work_order_id` + status `ot_generada`.

La UI solo ofrece Generar OT si `venta_concretada && !workOrderId`. Eso **bloquea un segundo intento en la UI después de un link exitoso**. No bloquea:

- doble click dentro del diálogo (el link aún no corrió);
- OT creada + link fallido (`workOrderId` sigue null) → se puede volver a Generar OT.

### D) Import CSV

`executeWorkOrderImport`: fila a fila, secuencial, `await` por fila. Sin batch id, sin clave por fila, sin reintento automático de una fila.

`isImporting` se prende **al inicio** de `handleImport` (mejor que el diálogo de OT). Un doble click en Importar es menos probable, pero **reabrir el archivo y volver a importar** recrea todo.

### E) Edición

No es creación. `handleSubmit` abre confirmación; `handleConfirmSaveChanges` hace `PATCH` por `task.id`.

Doble click en “Guardar cambios” puede lanzar dos PATCH al mismo id (último gana). **No** clona la OT. No confundir con create.

---

## 2. Puntos de mutación

| Paso | Dónde | Transacción con el insert de OT |
|---|---|---|
| `customers` INSERT | `createCustomer` / `customers.queries` | **No** |
| `tasks` INSERT + `execution_order` | RPC OT 1.1 | Sí, **solo** ese RPC |
| Fotos | `uploadPendingTaskReferencePhotos` | No (después) |
| Audit | `recordAuditEventClient` | No; `void`; no tira |
| Activity | `recordTaskCreateActivity` | No |
| Operational event | `recordTaskOperationalEvent` | No; `void` |
| Link Atención | RPC `link_customer_atencion_to_task` | No (después) |
| Link Comercial | `updateCommercialSolicitud` | No (después) |
| Aprobación / `pendiente-activacion` | workflow | No aplica en create |

No hay rollback ni cleanup.

---

## 3. Doble click

Protección actual:

- `disabled={isSubmitting || !form.serviceType}`
- texto “Guardando…”
- **no** hay debounce
- **no** hay `submitInFlight` ref síncrono
- **no** hay AbortController

`setIsSubmitting(true)` está **después** de `await validateBeforeSave()`. Durante esa espera el botón sigue habilitado.

```
click 1 → preventDefault → await validateBeforeSave()   // isSubmitting = false
click 2 → preventDefault → await validateBeforeSave()   // paralelo
ambos → setIsSubmitting(true)
ambos → resolveCustomerIdForSave
ambos → addTask / RPC
```

Enter en el form usa el mismo `onSubmit`.

**Resultado conceptual: D o B**, no A.

- Sin `customerId` (alta): dos `createCustomer` + dos RPC → **D** (dos clientes + dos OTs), salvo unique de `customer_number` o `code` que convierta uno en error (**C** parcial).
- Con `customerId` (Atención / selección): **B** dos OTs, mismo C1.
- Import: el flag `isImporting` está al inicio; doble click es más difícil. Reejecutar el archivo sí duplica.

El unique `(company_id, code)` puede hacer que **uno** de dos inserts simultáneos falle si ambos eligieron el mismo `TSK-OT-00N`. Eso no es idempotencia: el usuario ve error y reintenta → tercera OT o la que faltaba.

---

## 4. Timeout / respuesta perdida

1. Request llega (browser Supabase).
2. Cliente (si aplica) y OT se insertan.
3. El HTTP de vuelta no llega / se corta.
4. `catch` muestra “No se pudo crear…”.
5. El form **sigue abierto** (`forceClose` no corrió). `form.customerId` **no** se actualiza con el id del cliente recién creado.
6. Guardar otra vez = **nueva** operación.

No hay detección de “esto ya ocurrió”.

- Alta nueva: otro cliente + otra OT.
- Atención/C1: otra OT sobre C1; el segundo link puede fallar (`CONSULTATION_ALREADY_RESOLVED`) si el primero sí vinculó.

`code` cambia entre retries (`listOccupiedTaskCodes` + max+1). No colisiona a propósito con la OT invisible.

---

## 5. Cliente creado + OT falla

Secuencia:

```
createCustomer OK   → fila en customers (visible, CLI-…)
enrich GPS throw    → no hay task
o RPC error / unique code
```

Queda **cliente huérfano**. Sin rollback. Sin cleanup. El diálogo muestra error. Retry llama otra vez a `createCustomer` porque el form no guardó el id.

`createCustomer` numera con “último `customer_number`” (lectura, no secuencia). Dos altas concurrentes pueden chocar en `UNIQUE (company_id, customer_number)`: una falla, la otra queda.

---

## 6. OT creada + paso posterior falla

La OT **ya es válida** tras el RPC.

| Side effect | Si falla | ¿Invalida la OT? |
|---|---|---|
| Fotos | OT sin / con fotos parciales; feedback | No |
| Audit / activity | best-effort | No |
| Operational event | `void` | No |
| Link Atención | OT huérfana de la consulta; se puede Generar OT de nuevo | No |
| Link Comercial | igual, `workOrderId` vacío | No |
| Sync de ficha | no corre en instalación nueva | No |
| Aprobación | no es create | — |

Obligatorio para “OT existe”: solo el RPC. El resto es posterior y no atómico.

---

## 7. Import

- Fila por fila, secuencial.
- Una fila en error: `failed++`, **sigue** con la siguiente. Lo ya importado **no** se revierte.
- Sin identificador idempotente por fila ni por archivo.
- Reejecutar el CSV: nuevas OT (y nuevos clientes si instalación sin `customer_id`).
- Con `customer_id` (OT 1.4.1): reutiliza ficha, **igual crea otra OT**.
- Matching por nombre/teléfono (tipos con lookup, sin id): heurística; no es clave de retry.

Doble click en “Importar”: `setIsImporting(true)` es lo primero del handler (mejor que Guardar OT). Sigue siendo inseguro re-correr el mismo archivo.

---

## 8. Atención

No hay “operation id” de generación.

Claves relacionadas, **insuficientes**:

- `atencion.id` — identifica la consulta, no el intento de create.
- `linked_task_id` — se setea **después** del insert; índice no unique.
- El RPC de link **no** impide un segundo insert; solo puede rechazar el segundo **vínculo**.

Retry desde Atención: si el primero no vinculó, el usuario vuelve a “Crear Orden de Trabajo”.

---

## 9. Comercial

Tras OT 1.4.1: `sourceCustomerId` evita ficha duplicada **si** está presente. No evita OT duplicada.

`commercialSolicitudAllowsOtGeneration`: `venta_concretada && !workOrderId`. Protección **UI post-link**, no de concurrencia ni de OT huérfana.

`work_order_id` tiene índice, **no** UNIQUE.

---

## 10. Identificadores existentes

| Campo | ¿Sirve de idempotency key? |
|---|---|
| `tasks.id` | UUID de DB **después** del insert |
| `tasks.code` | Unique por company; **se regenera** cada intento |
| `work_order_number` | Opcional, editable, **sin unique** |
| `task_metadata` | Puede guardar flags (p.ej. reuse); no hay key de request |
| `customers.id` / `customer_number` | Unique de ficha, no de operación de OT |
| `external_customer_code` | Padrón, no create OT |
| `clientOrderNumber` → `work_order_number` | Usuario; no unique |
| `request_id` / `idempotency_key` / `operation_id` | **No existen** en `tasks` ni en el RPC OT 1.1 |
| Presence `created_at+device_id+…` | Otro dominio |

OT 1.1 ya documentó: *“no create-time idempotency key exists yet”*.

---

## 11. Constraints

**tasks**

- `UNIQUE (company_id, code)` — `tasks_company_code_unique`
- `UNIQUE (crew_id, due_date, execution_order)` parcial — evita el **mismo slot**, no la misma OT de negocio
- `work_order_number` — sin unique
- `customer_id` — FK, no unique

**customers**

- `UNIQUE (company_id, customer_number)`
- DNI/email/teléfono — **no** unique

**atenciones / solicitudes**

- `linked_task_id` / `work_order_id` — índice, no unique, no “un intento”

Ninguna constraint dice “este click / este request ya se aplicó”.

---

## 12. Atomicidad

`createCustomer` y `createTask` son **dos round-trips** desde el browser. No comparten `BEGIN`.

El RPC OT 1.1 es atómico **solo** para insert de task + asignación de `execution_order`.

GPS enrich corre **entre** cliente y insert: si tira, hay cliente y no hay OT.

---

## 13. Alternativas (no implementadas)

| | Seguridad | Tenant | Concurrencia | Retry | UX | Complejidad | Encaje |
|---|---|---|---|---|---|---|---|
| **A** key persistida `(company_id, idempotency_key)` | Alta | Sí si el unique incluye company | Alta | Alta | Transparente | Media | Encaja con unique actual |
| **B** UUID en el cliente antes del submit | Media sola | Hay que persistir | Media | Alta si se reusa el mismo UUID | Hay que no rotar el UUID al reintentar | Baja–media | Estado del diálogo + sessionStorage Atención/Comercial |
| **C** RPC transaccional cliente+task | Alta para huérfanos | Ya hay company en RPC | Alta | No basta sin key | Invisible | Alta (toca RPC) | Choca con “no tocar OT 1.1” hasta un sprint de RPC |
| **D** endpoint server-side | Alta | Fácil | Alta | Con key | Igual | Alta | Nuevo superficie auth |
| **E = A+C** | La más sólida | Sí | Sí | Sí | Mejor | Alta | Recomendada a mediano plazo |
| **F** import: batch_id + row_number | Específica | Sí | Por fila | Re-run controlado | Informe | Media | No resuelve el diálogo |

**A sola** (key en `tasks`, RPC actual): cubre OT duplicada; **no** cubre cliente huérfano (el insert de customer sigue afuera).

**C sola** (transacción sin key): cubre huérfano en un request; **no** cubre doble click (dos transacciones).

**B sola** sin unique en DB: el segundo request no tiene cómo encontrar el primero.

Descarte: usar `code`, DNI, o (cliente + tipo + fecha) como key — falsos positivos o se regenera.

---

## 14. Recomendación

1. **Corto plazo (UX, no suficiente):** `setIsSubmitting(true)` **síncrono** al entrar a `handleSubmit`, antes de `await`. Reduce doble click; **no** arregla timeout.
2. **Idempotencia real de OT:** UUID de operación generado al **abrir** el diálogo (y copiado en el prefill Atención/Comercial). Persistirlo en `tasks` (o tabla de operaciones) con `UNIQUE (company_id, idempotency_key)`. El RPC, si ya existe la fila de esa company+key, **devuelve la OT existente** (mismo tenant).
3. **Huérfanos:** o bien el RPC crea el cliente cuando no hay `customer_id`, o bien el retry reutiliza el id creado (escribirlo en el form / key de operación). Sin esto, A no cierra el agujero de ficha.
4. **Atención/Comercial:** vincular **en el mismo RPC** o chequear `linked_task_id` / `work_order_id` **antes** de insertar. Hoy el link es too-late.
5. **Import (F):** `import_batch_id` + `row_number` scoped por `company_id`. Reejecutar el mismo batch no duplica; un archivo nuevo es otro batch.
6. **No** usar `tasks.code` ni `work_order_number` como key.
7. **Multi-tenant:** toda unique de key = `(company_id, idempotency_key)`. Nunca global.

Presencia ya muestra el patrón: unique compuesta que incluye `company_id`.

---

## 15. Riesgos

- Doble click → 2 OT (y 2 clientes si alta).
- Timeout → usuario duplica sin saberlo.
- Cliente huérfano visible en padrones.
- Atención: 2 OT, 1 vínculo (o 2 vínculos en carrera: last write wins en `linked_task_id`).
- Comercial: 2 OT si el link no llegó.
- Unique de `code` / `customer_number`: un error opaco, no un “ya estaba creado”.
- Dos usuarios distintos, misma consulta, dos OT (no hay lock de generación).
- Import: re-run = duplicar cartera operativa.

Edición: riesgo de doble PATCH, no de clon.

---

## 16. Comportamiento esperado a definir (futuro sprint)

| Caso | Hoy | Esperado (propuesta) |
|---|---|---|
| 1 Doble click | 2 OT (± 2 clientes) | 1 OT |
| 2 Retry tras timeout | 2 OT | 1 OT (misma key) |
| 3 Cliente OK + OT fail | huérfano; retry otro cliente | rollback o reutilizar el mismo id |
| 4 OT OK + audit fail | OT ok (audit best-effort) | igual: audit no debe invalidar |
| 5 Retry Atención | otra OT si no hay link | 1 OT; UI “ya generada” |
| 6 Retry Comercial | otra OT si `workOrderId` null | 1 OT |
| 7 Retry import | duplica filas | mismo batch no duplica |
| 8 Mismo usuario | duplica | key del diálogo |
| 9 Usuarios distintos | 2 OT | definir: ¿una OT por consulta o dos operaciones? |
| 10 Dos requests simultáneos | 2 OT o 1 OT + unique code | 1 OT vía unique de key |

El caso 9 es de producto: dos operadores en la misma Atención.

---

## Tests actuales vs hueco

Cubren create, reuse de cliente, GPS, execution_order. **Ninguno** dispara dos submits ni simula timeout.

Reproducción de lectura (no muta DB): `npm run test:ot-1-5-idempotency`.

Tests que harán falta **cuando** se implemente:

- doble submit → un `insertTask`
- misma key → segundo RPC devuelve la misma `tasks.id`
- key distinta → dos OT
- company A no choca con company B
- createCustomer no se llama dos veces con key de alta (o queda en el mismo RPC)
- Atención: segundo intento no inserta
- Import: mismo batch+row no inserta

---

## Archivos involucrados (lectura)

- `components/tareas/task-work-order-dialog.tsx`
- `components/tareas/tasks-provider/hooks/use-tasks-create.ts`
- `lib/supabase/tasks.queries.ts` (`insertTask` / RPC)
- `lib/supabase/customers.queries.ts`
- `lib/tasks/work-order.ts` (código TSK-OT-)
- `lib/tasks/work-order-import/execute.ts`
- `components/tareas/work-order-import-dialog.tsx`
- `components/tareas/tasks-module.tsx` (link post-create)
- `lib/customer-atenciones/consultation-ot-create.ts`
- `lib/commercial/solicitud-ot-create.ts` / `solicitud-catalogs.ts`
- `supabase/migrations/20261142000100_ot_1_1_execution_order_atomic.sql`
- `supabase/migrations/20260616000000_create_companies.sql` (`tasks_company_code_unique`)
- `supabase/migrations/20261113000100_presence_engine_1_0.sql` (precedente)

No se modificó producción OT 1.1–1.4.1, Planning ni Facturación.
