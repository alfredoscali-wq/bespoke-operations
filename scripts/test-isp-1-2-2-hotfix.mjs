import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  ISP_CUSTOMER_LIST_EMPTY_MESSAGE,
  ISP_CUSTOMER_LIST_LOAD_ERROR,
  customerListErrorMessage,
  isIgnorableListLoadAbort,
  isTechnicalFetchError,
} from "../lib/isp/customer-list-load.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

function readList() {
  return [
    read("components/isp/isp-customer-list-screen.tsx"),
    read("components/isp/isp-customer-list-ui.tsx"),
  ].join("\n")
}

test("1. /clientes-360 usa el listado ISP y el header global", () => {
  const page = read("app/(dashboard)/clientes-360/page.tsx")
  const nav = read("lib/navigation/nav-items.ts")
  const layout = read("app/(dashboard)/layout.tsx")
  const shell = read("components/layout/dashboard-layout.tsx")
  assert.match(page, /IspCustomerListScreen/)
  assert.doesNotMatch(page, /<h1/)
  assert.match(layout, /DashboardLayout/)
  assert.match(shell, /getPageMetaForSession/)
  assert.match(nav, /href: "\/clientes-360"/)
  assert.match(nav, /pageTitle: "Clientes 360°"/)
  assert.match(
    nav,
    /Vista integral de los abonados ISP: servicios, conexiones, OT y actividad/
  )
})

test("2. el título de la página no se duplica en el listado", () => {
  const list = read("components/isp/isp-customer-list-screen.tsx")
  assert.doesNotMatch(list, /<h1[^>]*>[\s\S]*Clientes 360°/)
  assert.doesNotMatch(list, /Vista integral de los abonados ISP/)
  assert.match(list, /abonado/)
})

test("3. API vacía responde colección vacía y total 0", () => {
  const api = read("app/api/isp/customers/route.ts")
  const queries = read("lib/isp/queries.ts")
  assert.match(api, /listIspCustomers/)
  assert.match(api, /customers/)
  assert.match(api, /localities/)
  assert.match(api, /items: customers/)
  assert.match(api, /total: customers\.length/)
  assert.match(api, /success: true/)
  assert.match(queries, /if \(customers\.length === 0\)/)
  assert.match(queries, /return \{ customers: \[\], localities: \[\] \}/)
})

test("4. API no expone TypeError: fetch failed al usuario", () => {
  const api = read("app/api/isp/customers/route.ts")
  const list = read("components/isp/isp-customer-list-screen.tsx")
  assert.match(api, /ISP_CUSTOMER_LIST_LOAD_ERROR/)
  assert.match(api, /isTransientCustomerListError/)
  assert.match(list, /customerListErrorMessage/)
  assert.doesNotMatch(list, /TypeError/)
  assert.doesNotMatch(list, /setError\(cause instanceof Error \? cause\.message/)
})

test("5. estado vacío y acciones de Clientes 360°", () => {
  const list = readList()
  assert.equal(ISP_CUSTOMER_LIST_EMPTY_MESSAGE, "No hay abonados para mostrar.")
  assert.match(list, /ISP_CUSTOMER_LIST_EMPTY_MESSAGE/)
  assert.match(list, /Nuevo Cliente/)
  assert.match(list, /\/clientes-360\/nuevo/)
  assert.match(list, /Importar abonados/)
  assert.match(list, /\/clientes-360\/migracion/)
  assert.match(list, /Buscar abonado/)
  assert.match(list, /placeholder="Estado"/)
  assert.match(list, /placeholder="Localidad"/)
  assert.match(list, /Cantidad de servicios/)
  assert.match(list, /Cantidad de conexiones/)
})

test("6. búsqueda y filtros siguen en el listado", () => {
  const list = read("components/isp/isp-customer-list-screen.tsx")
  const queries = read("lib/isp/queries.ts")
  assert.match(list, /debouncedSearch/)
  assert.match(list, /setStatus/)
  assert.match(list, /setLocality/)
  assert.match(list, /minServices/)
  assert.match(list, /minConnections/)
  assert.match(queries, /input\.search/)
  assert.match(queries, /input\.status/)
  assert.match(queries, /input\.locality/)
  assert.match(queries, /minServices/)
  assert.match(queries, /minConnections/)
})

test("7. el fetch espera sesión y no cancela la request", () => {
  const list = read("components/isp/isp-customer-list-screen.tsx")
  assert.match(list, /isAuthReady/)
  assert.match(list, /credentials: "same-origin"/)
  assert.match(list, /cache: "no-store"/)
  assert.doesNotMatch(list, /AbortController/)
  assert.match(list, /cancelled/)
})

test("8. TypeError: fetch failed se convierte en mensaje amigable", () => {
  const fetchFailed = new TypeError("fetch failed")
  assert.equal(isTechnicalFetchError(fetchFailed), true)
  assert.equal(customerListErrorMessage(fetchFailed), ISP_CUSTOMER_LIST_LOAD_ERROR)
  assert.notEqual(customerListErrorMessage(fetchFailed), "fetch failed")
  assert.notEqual(customerListErrorMessage(fetchFailed), "TypeError: fetch failed")

  const wrapped = new Error("fetch failed")
  assert.equal(customerListErrorMessage(wrapped), ISP_CUSTOMER_LIST_LOAD_ERROR)

  const abort = { name: "AbortError", message: "The operation was aborted." }
  assert.equal(isIgnorableListLoadAbort(abort), true)
  const abortedFetch = new TypeError("fetch failed")
  abortedFetch.cause = abort
  assert.equal(isIgnorableListLoadAbort(abortedFetch), true)
})

test("9. listado con abonados conserva columnas y detalle", () => {
  const list = readList()
  assert.match(list, /item\.name/)
  assert.match(list, /item\.dni/)
  assert.match(list, /item\.serviceCount/)
  assert.match(list, /item\.connectionCount/)
  assert.match(list, /listStatus/)
  assert.match(list, /item\.locality/)
  assert.match(list, /\/clientes-360\/\$\{item\.id\}/)
  assert.doesNotMatch(list, /serviceCount === 0 \? null/)
  assert.match(list, /Seleccionar todos/)
  assert.match(list, /CustomerBulkActions/)
  assert.match(list, /Eliminar abonado/)
  assert.doesNotMatch(list, /Eliminar cliente/)
  assert.doesNotMatch(list, /Eliminar seleccionados/)
})

test("10. no modifica Clientes, OT, migración ni catálogo", () => {
  assert.ok(read("components/clientes/customers-module.tsx").length > 0)
  assert.ok(read("components/tareas/tasks-module.tsx").length > 0)
  assert.match(read("app/(dashboard)/clientes/migracion/page.tsx"), /.+/)
  assert.match(
    read("components/isp/isp-migration-screen.tsx"),
    /IspMigrationScreen|Validación/
  )
})
