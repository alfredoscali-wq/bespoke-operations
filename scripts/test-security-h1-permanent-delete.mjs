/**
 * H1 — Permanent delete cross-tenant isolation.
 *
 * These tests are source-contract + in-process policy/ISP mocks.
 * They do not hit a live API or database.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  ADMIN_SESSION_COMPANY_UNAVAILABLE_ERROR,
} from "../lib/auth/admin-employee-tenant.ts"
import {
  assertCustomerPermanentDeleteAllowed,
  assertTaskPermanentDeleteAllowed,
  PERMANENT_DELETE_CUSTOMER_BLOCKED_MESSAGE,
  PERMANENT_DELETE_NOT_FOUND_MESSAGE,
  PermanentDeleteNotFoundError,
  resolvePermanentDeleteSessionCompanyId,
} from "../lib/admin/permanent-delete-policy.ts"
import { deleteIspDependentsForCustomer } from "../lib/admin/permanent-delete-isp-customer.ts"
import { WORK_ORDER_PERMANENT_DELETE_ARCHIVED_ONLY_MESSAGE } from "../lib/tasks/work-order-deletion-policy.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const route = read("app/api/admin/permanent-delete/route.ts")
const service = read("lib/admin/permanent-delete.ts")
const policy = read("lib/admin/permanent-delete-policy.ts")
const isp = read("lib/admin/permanent-delete-isp-customer.ts")
const requireAdmin = read("lib/auth/require-administrator.ts")

const COMPANY_A = "company-a"
const COMPANY_B = "company-b"
const TASK_A = "task-a"
const TASK_B = "task-b"
const CUSTOMER_A = "customer-a"
const CUSTOMER_B = "customer-b"
const MISSING_ID = "00000000-0000-0000-0000-000000000000"

function sliceExport(source, name) {
  const start = source.indexOf(`export async function ${name}`)
  assert.notEqual(start, -1, `missing ${name}`)
  const next = source.indexOf("\nexport async function ", start + 1)
  return source.slice(start, next === -1 ? undefined : next)
}

function countFrom(source, table) {
  return [...source.matchAll(new RegExp(`\\.from\\("${table}"\\)`, "g"))].length
}

function countFromWithCompanyId(source, table) {
  return [
    ...source.matchAll(
      new RegExp(
        `\\.from\\("${table}"\\)[\\s\\S]{0,500}?\\.eq\\("company_id", companyId\\)`,
        "g"
      )
    ),
  ].length
}

function assertEveryFromIsTenantScoped(source, table) {
  const fromCount = countFrom(source, table)
  const scopedCount = countFromWithCompanyId(source, table)
  assert.ok(fromCount > 0, `expected .from("${table}")`)
  assert.equal(
    scopedCount,
    fromCount,
    `${table}: ${scopedCount}/${fromCount} queries include company_id`
  )
}

function matchesFilters(row, filters) {
  for (const [key, value] of Object.entries(filters)) {
    if (key.startsWith("is:")) {
      const column = key.slice(3)
      if (value === null && row[column] != null) return false
      continue
    }
    if (row[key] !== value) return false
  }
  return true
}

function createPolicyClient(tables) {
  return {
    from(table) {
      const filters = {}
      const chain = {
        select() {
          return chain
        },
        eq(column, value) {
          filters[column] = value
          return chain
        },
        is(column, value) {
          filters[`is:${column}`] = value
          return chain
        },
        maybeSingle() {
          const rows = (tables[table] ?? []).filter((row) =>
            matchesFilters(row, filters)
          )
          return Promise.resolve({ data: rows[0] ?? null, error: null })
        },
        then(resolvePromise, rejectPromise) {
          const rows = (tables[table] ?? []).filter((row) =>
            matchesFilters(row, filters)
          )
          return Promise.resolve({ data: rows, error: null }).then(
            resolvePromise,
            rejectPromise
          )
        },
      }
      return chain
    },
  }
}

function createIspRecordingClient({
  serviceIds = ["svc-1"],
  connectionIds = ["conn-1"],
} = {}) {
  const calls = []

  function builder(table) {
    let op = "unknown"
    const chain = {
      select() {
        op = "select"
        calls.push({ table, op, eq: [] })
        return chain
      },
      update(payload) {
        op = "update"
        calls.push({ table, op, payload, eq: [] })
        return chain
      },
      delete() {
        op = "delete"
        calls.push({ table, op, eq: [] })
        return chain
      },
      eq(column, value) {
        const last = calls[calls.length - 1]
        if (last) last.eq.push([column, value])
        return chain
      },
      in() {
        return chain
      },
      then(resolvePromise, rejectPromise) {
        if (table === "isp_services" && op === "select") {
          return Promise.resolve({
            data: serviceIds.map((id) => ({ id })),
            error: null,
          }).then(resolvePromise, rejectPromise)
        }
        if (table === "isp_connections" && op === "select") {
          return Promise.resolve({
            data: connectionIds.map((id) => ({ id })),
            error: null,
          }).then(resolvePromise, rejectPromise)
        }
        return Promise.resolve({ data: null, error: null }).then(
          resolvePromise,
          rejectPromise
        )
      },
    }
    return chain
  }

  return {
    calls,
    from(table) {
      return builder(table)
    },
  }
}

test("1. Admin A + task propio archivado → permitido", async () => {
  const client = createPolicyClient({
    tasks: [
      { id: TASK_A, company_id: COMPANY_A, status: "finalizada" },
      { id: TASK_B, company_id: COMPANY_B, status: "finalizada" },
    ],
  })
  const result = await assertTaskPermanentDeleteAllowed(client, TASK_A, COMPANY_A)
  assert.equal(result.status, "finalizada")
})

test("2. Admin A + customer propio sin OT activas → permitido", async () => {
  const client = createPolicyClient({
    customers: [{ id: CUSTOMER_A, company_id: COMPANY_A }],
    tasks: [
      {
        id: TASK_A,
        customer_id: CUSTOMER_A,
        company_id: COMPANY_A,
        status: "cerrada",
        deleted_at: null,
      },
    ],
  })
  await assertCustomerPermanentDeleteAllowed(client, CUSTOMER_A, COMPANY_A)
})

test("3. Admin A + task B → 404", async () => {
  const client = createPolicyClient({
    tasks: [{ id: TASK_B, company_id: COMPANY_B, status: "finalizada" }],
  })
  await assert.rejects(
    () => assertTaskPermanentDeleteAllowed(client, TASK_B, COMPANY_A),
    (error) => {
      assert.equal(error instanceof PermanentDeleteNotFoundError, true)
      assert.equal(error.message, PERMANENT_DELETE_NOT_FOUND_MESSAGE)
      assert.equal(error.status, 404)
      return true
    }
  )
})

test("4. Admin A + customer B → 404", async () => {
  const client = createPolicyClient({
    customers: [{ id: CUSTOMER_B, company_id: COMPANY_B }],
    tasks: [],
  })
  await assert.rejects(
    () => assertCustomerPermanentDeleteAllowed(client, CUSTOMER_B, COMPANY_A),
    (error) => {
      assert.equal(error instanceof PermanentDeleteNotFoundError, true)
      assert.equal(error.message, PERMANENT_DELETE_NOT_FOUND_MESSAGE)
      return true
    }
  )
})

test("5. Admin A + UUID inexistente → mismo 404", async () => {
  const missingTask = createPolicyClient({ tasks: [] })
  const missingCustomer = createPolicyClient({ customers: [], tasks: [] })

  await assert.rejects(
    () => assertTaskPermanentDeleteAllowed(missingTask, MISSING_ID, COMPANY_A),
    (error) => {
      assert.equal(error.message, PERMANENT_DELETE_NOT_FOUND_MESSAGE)
      return true
    }
  )
  await assert.rejects(
    () =>
      assertCustomerPermanentDeleteAllowed(missingCustomer, MISSING_ID, COMPANY_A),
    (error) => {
      assert.equal(error.message, PERMANENT_DELETE_NOT_FOUND_MESSAGE)
      return true
    }
  )
})

test("6. Cross-tenant → cero DELETE", () => {
  const taskFn = sliceExport(service, "permanentDeleteTask")
  const customerFn = sliceExport(service, "permanentDeleteCustomer")
  const notFoundTask = taskFn.indexOf("throw new PermanentDeleteNotFoundError()")
  const deleteTask = taskFn.indexOf("permanentDeleteTaskRecords")
  const notFoundCustomer = customerFn.indexOf(
    "throw new PermanentDeleteNotFoundError()"
  )
  const deleteCustomer = customerFn.indexOf('.from("customers")')
  const deleteCustomersMutation = customerFn.lastIndexOf(".delete()")

  assert.ok(notFoundTask !== -1 && notFoundTask < deleteTask)
  assert.ok(notFoundCustomer !== -1 && notFoundCustomer < deleteCustomersMutation)
  assert.match(taskFn, /\.eq\("company_id", companyId\)/)
  assert.match(customerFn, /\.eq\("company_id", companyId\)/)
  assert.equal(deleteCustomer !== -1, true)
})

test("7. Cross-tenant → cero storage deletion", () => {
  const taskFn = sliceExport(service, "permanentDeleteTask")
  const recordsStart = service.indexOf(
    "async function permanentDeleteTaskRecords"
  )
  const recordsFn = service.slice(
    recordsStart,
    service.indexOf("export async function permanentDeleteTask")
  )

  assert.ok(
    taskFn.indexOf("throw new PermanentDeleteNotFoundError()") <
      taskFn.indexOf("permanentDeleteTaskRecords")
  )
  assert.match(recordsFn, /removeStorageObjects/)
  assert.match(recordsFn, /\.eq\("company_id", companyId\)/)
  assert.doesNotMatch(taskFn, /removeStorageObjects/)
})

test("8. Cross-tenant → no ejecutar permanentDeleteTaskRecords()", () => {
  const taskFn = sliceExport(service, "permanentDeleteTask")
  const customerFn = sliceExport(service, "permanentDeleteCustomer")

  assert.ok(
    taskFn.indexOf("throw new PermanentDeleteNotFoundError()") <
      taskFn.indexOf("await permanentDeleteTaskRecords")
  )
  assert.ok(
    customerFn.indexOf("throw new PermanentDeleteNotFoundError()") <
      customerFn.indexOf("await permanentDeleteTaskRecords")
  )
})

test("9. Cross-tenant → no ejecutar ISP deletion", () => {
  const customerFn = sliceExport(service, "permanentDeleteCustomer")
  assert.ok(
    customerFn.indexOf("throw new PermanentDeleteNotFoundError()") <
      customerFn.indexOf("await deleteIspDependentsForCustomer")
  )
  assert.match(
    customerFn,
    /await deleteIspDependentsForCustomer\(client, input\.customerId, companyId\)/
  )
})

test("10. Body company_id manipulado → ignorado", () => {
  assert.doesNotMatch(route, /body\.companyId/)
  assert.match(route, /companyId: sessionCompanyId/)
  assert.doesNotMatch(route, /resolveTenantCompanyId/)
  assert.doesNotMatch(service, /resolveTenantCompanyId/)
  assert.doesNotMatch(policy, /resolveTenantCompanyId/)
})

test("11. sessionCompanyId ausente → 403 fail closed", () => {
  assert.equal(resolvePermanentDeleteSessionCompanyId({ companyId: "  " }), null)
  assert.equal(resolvePermanentDeleteSessionCompanyId({ companyId: null }), null)
  assert.equal(resolvePermanentDeleteSessionCompanyId({}), null)
  assert.equal(resolvePermanentDeleteSessionCompanyId(null), null)
  assert.equal(
    resolvePermanentDeleteSessionCompanyId({ companyId: COMPANY_A }),
    COMPANY_A
  )

  const gate = route.indexOf("resolvePermanentDeleteSessionCompanyId(auth.sessionUser)")
  const adminClient = route.indexOf("const admin = createAdminClient()")
  const forbidden = route.indexOf("{ status: 403 }")
  assert.ok(gate !== -1 && gate < adminClient)
  assert.ok(forbidden !== -1 && forbidden < adminClient)
  assert.match(route, /ADMIN_SESSION_COMPANY_UNAVAILABLE_ERROR/)
  assert.match(service, /requirePermanentDeleteCompanyId/)
  assert.equal(
    ADMIN_SESSION_COMPANY_UNAVAILABLE_ERROR,
    "Empresa no disponible para la sesión."
  )
})

test("12. RRHH → 403", () => {
  assert.match(route, /requireAdministratorSession/)
  assert.match(requireAdmin, /systemRole !== "administrador"/)
  assert.match(requireAdmin, /status: 403/)
  assert.doesNotMatch(route, /rrhh|recursos humanos/i)
})

test("13. Supervisor → 403", () => {
  assert.match(requireAdmin, /Solo un administrador puede realizar esta acción/)
  assert.equal(requireAdmin.includes('systemRole !== "administrador"'), true)
})

test("14. Operario → 403", () => {
  const authFail = route.indexOf("if (!auth.ok)")
  const adminClient = route.indexOf("const admin = createAdminClient()")
  assert.ok(authFail !== -1 && authFail < adminClient)
  assert.match(route, /status: auth\.status/)
})

test("15. Anónimo → 401", () => {
  assert.match(requireAdmin, /status: 401/)
  assert.match(requireAdmin, /Debe iniciar sesión para realizar esta acción/)
  assert.match(route, /status: auth\.status/)
})

test("16. Admin B puede borrar target de B", () => {
  const executeFn = sliceExport(service, "executePermanentDelete")
  assert.match(executeFn, /companyId/)
  assert.match(
    executeFn,
    /return permanentDeleteTask\(client, \{\s*taskId: input\.entityId,\s*companyId,/
  )
  assert.match(
    executeFn,
    /return permanentDeleteCustomer\(client, \{\s*customerId: input\.entityId,\s*companyId,/
  )
  assert.equal(
    resolvePermanentDeleteSessionCompanyId({ companyId: COMPANY_B }),
    COMPANY_B
  )
})

test("17. Admin A no puede borrar target B aunque conozca UUID", () => {
  const taskFn = sliceExport(service, "permanentDeleteTask")
  const customerFn = sliceExport(service, "permanentDeleteCustomer")
  assert.match(
    taskFn,
    /\.eq\("id", input\.taskId\)\s*\.eq\("company_id", companyId\)/
  )
  assert.match(
    customerFn,
    /\.eq\("id", input\.customerId\)\s*\.eq\("company_id", companyId\)/
  )
  assert.match(policy, /\.eq\("id", taskId\)\s*\.eq\("company_id", companyId\)/)
  assert.match(
    policy,
    /\.eq\("id", customerId\)\s*\.eq\("company_id", companyId\)/
  )
})

test("18. Customer B con atenciones → cero DELETE desde Admin A", () => {
  const customerFn = sliceExport(service, "permanentDeleteCustomer")
  assert.doesNotMatch(service, /customer_atenciones/)
  assert.ok(
    customerFn.indexOf("throw new PermanentDeleteNotFoundError()") <
      customerFn.indexOf(".delete()")
  )
  assert.ok(
    customerFn.indexOf("throw new PermanentDeleteNotFoundError()") <
      customerFn.indexOf("deleteIspDependentsForCustomer")
  )
})

test("19. Error cross-tenant no debe revelar status del target", async () => {
  const archivedForeign = createPolicyClient({
    tasks: [{ id: TASK_B, company_id: COMPANY_B, status: "pendiente" }],
  })
  const activeOwnWouldBlock = createPolicyClient({
    tasks: [{ id: TASK_A, company_id: COMPANY_A, status: "pendiente" }],
  })

  await assert.rejects(
    () => assertTaskPermanentDeleteAllowed(archivedForeign, TASK_B, COMPANY_A),
    (error) => {
      assert.equal(error.message, PERMANENT_DELETE_NOT_FOUND_MESSAGE)
      assert.doesNotMatch(error.message, /archiv/i)
      assert.doesNotMatch(error.message, /pendiente/)
      assert.doesNotMatch(error.message, /empresa/i)
      return true
    }
  )

  await assert.rejects(
    () => assertTaskPermanentDeleteAllowed(activeOwnWouldBlock, TASK_A, COMPANY_A),
    (error) => {
      assert.equal(error.message, WORK_ORDER_PERMANENT_DELETE_ARCHIVED_ONLY_MESSAGE)
      return true
    }
  )

  assert.match(route, /PermanentDeleteNotFoundError/)
  assert.match(route, /jsonError\(error\.message, error\.status\)/)
  assert.equal(PERMANENT_DELETE_NOT_FOUND_MESSAGE, "Registro no encontrado.")
})

test("20. Existing business rules de archived/active siguen funcionando", async () => {
  const activeCustomer = createPolicyClient({
    customers: [{ id: CUSTOMER_A, company_id: COMPANY_A }],
    tasks: [
      {
        id: TASK_A,
        customer_id: CUSTOMER_A,
        company_id: COMPANY_A,
        status: "en_progreso",
        deleted_at: null,
      },
    ],
  })

  await assert.rejects(
    () => assertCustomerPermanentDeleteAllowed(activeCustomer, CUSTOMER_A, COMPANY_A),
    (error) => {
      assert.equal(error.message, PERMANENT_DELETE_CUSTOMER_BLOCKED_MESSAGE)
      return true
    }
  )

  const cancelledOnly = createPolicyClient({
    customers: [{ id: CUSTOMER_A, company_id: COMPANY_A }],
    tasks: [
      {
        id: TASK_A,
        customer_id: CUSTOMER_A,
        company_id: COMPANY_A,
        status: "cancelada",
        deleted_at: null,
      },
    ],
  })
  await assertCustomerPermanentDeleteAllowed(cancelledOnly, CUSTOMER_A, COMPANY_A)
})

test("defensa en profundidad: mutaciones con company_id quedan tenant-scoped", () => {
  for (const table of [
    "tasks",
    "customers",
    "task_incidents",
    "evidences",
    "task_photos",
  ]) {
    assertEveryFromIsTenantScoped(service, table)
  }

  for (const table of [
    "isp_services",
    "isp_connections",
    "isp_connection_equipment",
    "isp_billing_run_items",
    "isp_billing_documents",
    "isp_subscribers",
  ]) {
    assertEveryFromIsTenantScoped(isp, table)
  }

  assert.ok(countFrom(service, "task_incident_photos") > 0)
  assert.equal(countFromWithCompanyId(service, "task_incident_photos"), 0)
  assert.match(service, /\.in\("incident_id", incidentIds\)/)
})

test("ISP deletion respeta company_id y no corre con company vacío", async () => {
  const client = createIspRecordingClient()
  await deleteIspDependentsForCustomer(client, CUSTOMER_A, COMPANY_A)
  assert.ok(client.calls.length > 0)
  for (const call of client.calls) {
    assert.ok(
      call.eq.some(([column, value]) => column === "company_id" && value === COMPANY_A),
      `${call.op}:${call.table}`
    )
  }

  const emptyClient = createIspRecordingClient()
  await assert.rejects(
    () => deleteIspDependentsForCustomer(emptyClient, CUSTOMER_A, "  "),
    (error) => {
      assert.equal(error.message, ADMIN_SESSION_COMPANY_UNAVAILABLE_ERROR)
      return true
    }
  )
  assert.equal(emptyClient.calls.length, 0)
})

test("H1 no introduce demo guard ni RPC nuevo", () => {
  assert.doesNotMatch(route, /auth_is_demo_platform_read_only/)
  assert.doesNotMatch(service, /auth_is_demo_platform_read_only/)
  assert.doesNotMatch(service, /\.rpc\(/)
  assert.doesNotMatch(isp, /\.rpc\(/)
  assert.match(route, /requireAdministratorSession/)
})
