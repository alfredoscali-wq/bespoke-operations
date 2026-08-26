/**
 * OT 1.5.1 — idempotency of work-order creation.
 *
 * Live concurrent RPC against Postgres is not executed here (would mutate
 * production/dev data). Concurrency is simulated with the same
 * company+key lock the migration implements.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { commercialSolicitudAllowsOtGeneration } from "../lib/commercial/solicitud-catalogs.ts"
import { mapInsertTaskError } from "../lib/supabase/tasks.queries.ts"
import { mapUpdatePayloadToUpdate } from "../lib/supabase/tasks.mapper.ts"
import {
  buildWorkOrderCustomerCreateDraft,
  planWorkOrderCustomerResolution,
} from "../lib/tasks/work-order-customer-resolve.ts"
import {
  buildCreateWorkOrderIdempotentRpcPayload,
  createIdempotentWorkOrderOperationStore,
  createWorkOrderIdempotencyKey,
  parseCreateWorkOrderIdempotentResponse,
  shouldRotateWorkOrderIdempotencyKey,
  WORK_ORDER_IDEMPOTENCY_OPERATION_DELETED_CODE,
  WORK_ORDER_IDEMPOTENCY_PAYLOAD_CONFLICT_CODE,
} from "../lib/tasks/work-order-idempotency.ts"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

const sql = read("supabase/migrations/20261144000100_ot_1_5_1_task_idempotency.sql")
const ot11Sql = read(
  "supabase/migrations/20261142000100_ot_1_1_execution_order_atomic.sql"
)
const dialog = read("components/tareas/task-work-order-dialog.tsx")
const createHook = read(
  "components/tareas/tasks-provider/hooks/use-tasks-create.ts"
)
const insertQueries = read("lib/supabase/tasks.queries.ts")
const mapper = read("lib/supabase/tasks.mapper.ts")
const tasksModule = read("components/tareas/tasks-module.tsx")
const importExecute = read("lib/tasks/work-order-import/execute.ts")
const importDialog = read("components/tareas/work-order-import-dialog.tsx")

const handleSubmit = dialog.slice(
  dialog.indexOf("async function handleSubmit"),
  dialog.indexOf("async function handleConfirmSaveChanges")
)
const performCreate = dialog.slice(
  dialog.indexOf("async function performCreate"),
  dialog.indexOf("async function performEdit")
)
const performEdit = dialog.slice(
  dialog.indexOf("async function performEdit"),
  dialog.indexOf("async function handleSubmit")
)

const companyA = "company-a"
const companyB = "company-b"
const keyX = "11111111-1111-4111-8111-111111111111"
const customerC1 = "cust-c1"

test("key se genera al abrir el diálogo, no al Guardar", () => {
  assert.match(dialog, /createWorkOrderIdempotencyKey/)
  assert.match(dialog, /shouldRotateWorkOrderIdempotencyKey/)
  assert.doesNotMatch(handleSubmit, /createWorkOrderIdempotencyKey/)
  assert.equal(
    shouldRotateWorkOrderIdempotencyKey({
      dialogOpen: true,
      isEditMode: false,
      previousOpen: false,
    }),
    true
  )
  assert.equal(
    shouldRotateWorkOrderIdempotencyKey({
      dialogOpen: true,
      isEditMode: false,
      previousOpen: true,
    }),
    false
  )
  assert.equal(
    shouldRotateWorkOrderIdempotencyKey({
      dialogOpen: false,
      isEditMode: false,
      previousOpen: true,
    }),
    false
  )
  assert.equal(
    shouldRotateWorkOrderIdempotencyKey({
      dialogOpen: true,
      isEditMode: true,
      previousOpen: false,
    }),
    false
  )
  const first = createWorkOrderIdempotencyKey(() => "key-a")
  const second = createWorkOrderIdempotencyKey(() => "key-b")
  assert.equal(first, "key-a")
  assert.notEqual(first, second)
})

test("UX: isSubmitting y submitInFlight antes de validar; Creando OT", () => {
  const submittingIdx = handleSubmit.indexOf("setIsSubmitting(true)")
  const validateIdx = handleSubmit.indexOf("await validateBeforeSave")
  assert.ok(submittingIdx >= 0 && validateIdx > submittingIdx)
  assert.match(handleSubmit, /submitInFlightRef/)
  assert.match(dialog, /disabled=\{isSubmitting \|\| !form\.serviceType\}/)
  assert.match(dialog, /Creando OT\.\.\./)
})

test("persistencia: tasks.idempotency_key unique por company incluyendo soft delete", () => {
  assert.match(sql, /ADD COLUMN IF NOT EXISTS idempotency_key uuid/)
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS tasks_company_idempotency_key_unique/)
  assert.match(sql, /ON public\.tasks \(company_id, idempotency_key\)/)
  const uniqueBlock = sql.slice(
    sql.indexOf("CREATE UNIQUE INDEX IF NOT EXISTS tasks_company_idempotency_key_unique"),
    sql.indexOf("COMMENT ON INDEX public.tasks_company_idempotency_key_unique")
  )
  assert.match(uniqueBlock, /WHERE idempotency_key IS NOT NULL/)
  assert.doesNotMatch(uniqueBlock, /deleted_at/)
})

test("RPC wrapper llama create_task_with_execution_order y no duplica el slot", () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.create_work_order_idempotent/)
  assert.match(sql, /auth_user_company_id\(\)/)
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /hashtext\('ot-idem:' \|\| v_company_id::text\)/)
  assert.match(sql, /public\.create_task_with_execution_order/)
  assert.doesNotMatch(sql, /DROP INDEX[\s\S]*tasks_execution_order_crew_date_unique/)
  assert.doesNotMatch(sql, /generate_series/)
  assert.match(ot11Sql, /CREATE OR REPLACE FUNCTION public\.create_task_with_execution_order/)
})

test("misma key → misma OT; replay no es unique error", () => {
  const created = parseCreateWorkOrderIdempotentResponse({
    task: { id: "task-1", code: "TSK-OT-001" },
    created: true,
    idempotent_replay: false,
  })
  const replay = parseCreateWorkOrderIdempotentResponse({
    task: { id: "task-1", code: "TSK-OT-001" },
    created: false,
    idempotent_replay: true,
  })
  assert.equal(created?.taskId, "task-1")
  assert.equal(created?.created, true)
  assert.equal(created?.idempotentReplay, false)
  assert.equal(replay?.taskId, "task-1")
  assert.equal(replay?.created, false)
  assert.equal(replay?.idempotentReplay, true)

  const mapped = mapInsertTaskError({
    code: "23505",
    message: "duplicate key value violates unique constraint",
    details: "Key already exists.",
    hint: "tasks_company_idempotency_key_unique",
  })
  assert.notEqual(mapped.code, "DUPLICATE_CODE")
  assert.doesNotMatch(mapped.message, /duplicate key/i)
})

test("1 y 3: retry con la misma key reutiliza la OT", async () => {
  const store = createIdempotentWorkOrderOperationStore()
  const first = await store.create({
    companyId: companyA,
    idempotencyKey: keyX,
    customerId: customerC1,
  })
  const retry = await store.create({
    companyId: companyA,
    idempotencyKey: keyX,
    customerId: customerC1,
  })
  assert.equal(first.created, true)
  assert.equal(retry.created, false)
  assert.equal(retry.idempotentReplay, true)
  assert.equal(retry.taskId, first.taskId)
  assert.equal(store.listTasks().length, 1)
})

test("2: dos requests simultáneos con la misma key producen una sola OT", async () => {
  const store = createIdempotentWorkOrderOperationStore()
  const [a, b] = await Promise.all([
    store.create({
      companyId: companyA,
      idempotencyKey: keyX,
      customerId: customerC1,
    }),
    store.create({
      companyId: companyA,
      idempotencyKey: keyX,
      customerId: customerC1,
    }),
  ])
  const ids = new Set([a.taskId, b.taskId])
  assert.equal(ids.size, 1)
  assert.equal(store.listTasks().length, 1)
  assert.equal(
    [a, b].filter((row) => row.created).length,
    1
  )
  assert.equal(
    [a, b].filter((row) => row.idempotentReplay).length,
    1
  )
})

test("4: cliente existente no crea ficha", async () => {
  assert.equal(
    planWorkOrderCustomerResolution({
      serviceType: "instalacion-nueva",
      formCustomerId: customerC1,
      isEditMode: false,
    }).action,
    "reuse"
  )
  const store = createIdempotentWorkOrderOperationStore()
  await store.create({
    companyId: companyA,
    idempotencyKey: keyX,
    customerId: customerC1,
    createCustomer: false,
  })
  assert.equal(store.listCustomers().length, 0)
  assert.equal(store.listTasks()[0].customerId, customerC1)
})

test("5 y 6: cliente nuevo una sola vez; fallo de OT no deja huérfano", async () => {
  assert.equal(
    planWorkOrderCustomerResolution({
      serviceType: "instalacion-nueva",
      formCustomerId: "",
      isEditMode: false,
    }).action,
    "create"
  )
  const draft = buildWorkOrderCustomerCreateDraft({
    customerName: "Ana Pérez",
    customerDni: "123",
    customerPhone: "351",
    address: "Calle 1",
    locality: "Córdoba",
  })
  assert.equal(draft.name, "Ana Pérez")

  const okStore = createIdempotentWorkOrderOperationStore()
  const [first, retry] = await Promise.all([
    okStore.create({
      companyId: companyA,
      idempotencyKey: keyX,
      createCustomer: true,
    }),
    okStore.create({
      companyId: companyA,
      idempotencyKey: keyX,
      createCustomer: true,
    }),
  ])
  assert.equal(okStore.listCustomers().length, 1)
  assert.equal(okStore.listTasks().length, 1)
  assert.equal(first.customerId, retry.customerId)

  const failStore = createIdempotentWorkOrderOperationStore()
  await assert.rejects(
    () =>
      failStore.create({
        companyId: companyA,
        idempotencyKey: keyX,
        createCustomer: true,
        failTaskCreate: true,
      }),
    /TASK_CREATE_FAILED/
  )
  assert.equal(failStore.listCustomers().length, 0)
  assert.equal(failStore.listTasks().length, 0)
  assert.match(sql, /INSERT INTO public\.customers/)
})

test("7 y 8: Atención una OT y un vínculo; retry no duplica el vínculo", async () => {
  const store = createIdempotentWorkOrderOperationStore()
  const first = await store.create({
    companyId: companyA,
    idempotencyKey: keyX,
    customerId: customerC1,
    atencionId: "atencion-1",
  })
  const retry = await store.create({
    companyId: companyA,
    idempotencyKey: keyX,
    customerId: customerC1,
    atencionId: "atencion-1",
  })
  assert.equal(first.atencionLinkedTaskId, first.taskId)
  assert.equal(retry.atencionLinkedTaskId, first.taskId)
  assert.equal(first.atencionLinkCount, 1)
  assert.equal(retry.atencionLinkCount, 1)
  assert.match(sql, /link_customer_atencion_to_task/)
  assert.match(performCreate, /atencionId: consultationPrefill/)
  assert.doesNotMatch(tasksModule, /linkConsultationOtManagement/)
})

test("9 y 10: Comercial una OT; retry misma OT", async () => {
  const store = createIdempotentWorkOrderOperationStore()
  const first = await store.create({
    companyId: companyA,
    idempotencyKey: keyX,
    customerId: customerC1,
    commercialSolicitudId: "sol-1",
  })
  const retry = await store.create({
    companyId: companyA,
    idempotencyKey: keyX,
    customerId: customerC1,
    commercialSolicitudId: "sol-1",
  })
  assert.equal(retry.taskId, first.taskId)
  assert.equal(retry.commercialLinkedTaskId, first.taskId)
  assert.equal(store.listTasks().length, 1)
  assert.match(sql, /commercial_solicitudes/)
  assert.match(performCreate, /commercialSolicitudId: solicitudPrefill/)
  assert.doesNotMatch(tasksModule, /linkCommercialSolicitudToWorkOrderBrowser/)
  assert.equal(commercialSolicitudAllowsOtGeneration("venta_concretada", null), true)
  assert.equal(
    commercialSolicitudAllowsOtGeneration("venta_concretada", "task-1"),
    false
  )
})

test("11: Nueva OT manual una sola OT", async () => {
  const store = createIdempotentWorkOrderOperationStore()
  const [a, b] = await Promise.all([
    store.create({
      companyId: companyA,
      idempotencyKey: keyX,
      customerId: customerC1,
    }),
    store.create({
      companyId: companyA,
      idempotencyKey: keyX,
      customerId: customerC1,
    }),
  ])
  assert.equal(a.taskId, b.taskId)
  assert.match(performCreate, /idempotencyKey/)
  assert.match(insertQueries, /create_work_order_idempotent/)
})

test("12: soft delete + misma key no crea una segunda OT", async () => {
  const store = createIdempotentWorkOrderOperationStore()
  const first = await store.create({
    companyId: companyA,
    idempotencyKey: keyX,
    customerId: customerC1,
  })
  store.softDelete(first.taskId)
  await assert.rejects(
    () =>
      store.create({
        companyId: companyA,
        idempotencyKey: keyX,
        customerId: customerC1,
      }),
    new RegExp(WORK_ORDER_IDEMPOTENCY_OPERATION_DELETED_CODE)
  )
  assert.equal(store.listTasks().length, 1)
  assert.match(sql, /IDEMPOTENCY_OPERATION_DELETED/)
})

test("13: empresa A y B aíslan la misma key", async () => {
  const store = createIdempotentWorkOrderOperationStore()
  const a = await store.create({
    companyId: companyA,
    idempotencyKey: keyX,
    customerId: customerC1,
  })
  const b = await store.create({
    companyId: companyB,
    idempotencyKey: keyX,
    customerId: customerC1,
  })
  assert.notEqual(a.taskId, b.taskId)
  assert.equal(store.listTasks().length, 2)
  await assert.rejects(
    () =>
      store.create({
        companyId: companyA,
        idempotencyKey: keyX,
        customerId: "other-customer",
      }),
    new RegExp(WORK_ORDER_IDEMPOTENCY_PAYLOAD_CONFLICT_CODE)
  )
})

test("14: edición no modifica ni envía idempotency_key", () => {
  assert.doesNotMatch(performEdit, /idempotencyKey/)
  assert.match(sql, /freeze_task_idempotency_key/)
  const update = mapUpdatePayloadToUpdate({
    title: "Cambio",
    taskMetadata: { reusedExistingCustomer: true },
  })
  assert.equal("idempotency_key" in update, false)
  assert.doesNotMatch(
    mapper.slice(mapper.indexOf("export function mapUpdatePayloadToUpdate")),
    /idempotency_key/
  )
})

test("15: execution_order sigue siendo el RPC OT 1.1", () => {
  assert.match(sql, /v_task_json := public\.create_task_with_execution_order/)
  assert.match(insertQueries, /create_task_with_execution_order/)
  assert.match(createHook, /stripClientExecutionOrder/)
})

test("16: import no se rompe y queda fuera de esta clave", () => {
  assert.match(importExecute, /for \(const row of rows\)/)
  assert.doesNotMatch(importExecute, /idempotencyKey|idempotency_key/)
  assert.match(importDialog, /setIsImporting\(true\)/)
  assert.match(importExecute, /createCustomer/)
})

test("payload RPC incluye key, draft y orígenes; company_id lo pisa el server", () => {
  const payload = buildCreateWorkOrderIdempotentRpcPayload(
    { title: "Instalación nueva", company_id: "client-company" },
    {
      title: "Instalación nueva",
      idempotencyKey: keyX,
      createCustomerDraft: { name: "Ana" },
      atencionId: "atencion-1",
      commercialSolicitudId: "sol-1",
    }
  )
  assert.equal(payload.idempotency_key, keyX)
  assert.equal(payload.create_customer.name, "Ana")
  assert.equal(payload.atencion_id, "atencion-1")
  assert.equal(payload.commercial_solicitud_id, "sol-1")
  assert.match(sql, /jsonb_build_object\('company_id', v_company_id\)/)
})
