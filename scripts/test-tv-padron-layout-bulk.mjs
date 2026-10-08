/**
 * TV & Suscripciones: compact padron layout and bulk row removal.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  padronRowSelectionKey,
  retainVisiblePadronSelection,
  selectVisiblePadronRows,
  summarizePadronBulkRemoval,
  togglePadronRowSelection,
  visiblePadronSelectionState,
} from "../lib/subscriptions/abnet-tv-padron-selection.ts"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

const ui = read("components/subscriptions/subscriptions-module.tsx")
const overview = read("components/subscriptions/subscriptions-tv-overview.tsx")
const provider = read("components/subscriptions/subscriptions-provider.tsx")
const bulk = ui.slice(
  ui.indexOf("function RemovePadronRowsDialog"),
  ui.indexOf("export function SubscriptionsModule")
)
const rowActions = ui.slice(
  ui.indexOf("function PadronRowActions"),
  ui.indexOf("function PadronIconButton")
)

const sameNumber = [
  { source: "conex-internet-tv.xlsx", sourceRow: 10, abnetCustomerNumber: "1976" },
  { source: "conex-internet-tv.xlsx", sourceRow: 11, abnetCustomerNumber: "1976" },
  { source: "conex-internet-tv.xlsx", sourceRow: 12, abnetCustomerNumber: "1976" },
]

test("la cabecera deja solo el resumen general", () => {
  assert.doesNotMatch(overview, /Padrón ABNet/)
  assert.doesNotMatch(overview, /Total filas de TV/)
  assert.doesNotMatch(overview, /Clientes únicos/)
  assert.doesNotMatch(overview, /TV del padrón/)
  assert.doesNotMatch(overview, /TV = 4\.500/)
  assert.match(overview, /TV Básica/)
  assert.match(overview, /TV Básica \+ Pack Fútbol/)
  assert.match(overview, /TV Full/)
  assert.match(overview, /Clientes con TV/)
  assert.match(overview, /basicaCustomers/)
  assert.match(overview, /basicaPackCustomers/)
  assert.match(overview, /fullCustomers/)
  assert.match(overview, /tvPlanCustomers/)
  assert.doesNotMatch(overview, /Jubilados/)
  assert.doesNotMatch(overview, /Morosa/)
  assert.doesNotMatch(overview, /Activa/)
  assert.doesNotMatch(overview, /Pendiente/)
  assert.doesNotMatch(overview, /Inactiva/)
  assert.doesNotMatch(ui, /SubscriptionsSummaryCards/)
})

test("la tabla no muestra importes y conserva las columnas operativas", () => {
  assert.doesNotMatch(ui, /2% IMP\. TV/)
  assert.doesNotMatch(ui, /FINAL/)
  assert.doesNotMatch(ui, /tvTaxAmount/)
  assert.doesNotMatch(ui, /finalAmount/)
  for (const column of ["N° Cliente", "Cliente", "Tipo", "Nodo", "Estado", "TV", "Acciones"]) {
    assert.match(ui, new RegExp(column.replace("°", "°")))
  }
  assert.match(ui, /text-sm/)
  assert.match(ui, /py-2\.5/)
  assert.match(ui, /Seleccionar filas visibles/)
  assert.match(ui, /Seleccionar fila \$\{row\.sourceRow\}/)
  assert.match(ui, /Eliminar seleccionadas/)
  assert.match(ui, /filas seleccionadas/)
})

test("la selección es por fila visible y no por N° Cliente", () => {
  const first = padronRowSelectionKey(sameNumber[0])
  const second = padronRowSelectionKey(sameNumber[1])
  const third = padronRowSelectionKey(sameNumber[2])
  assert.notEqual(first, second)
  assert.equal(first.includes("1976"), false)
  assert.equal(first, "conex-internet-tv.xlsx:10")

  let selected = togglePadronRowSelection(new Set(), second)
  assert.deepEqual([...selected], [second])
  selected = togglePadronRowSelection(selected, first)
  selected = togglePadronRowSelection(selected, third)
  assert.deepEqual([...selected].sort(), [first, second, third].sort())
  selected = togglePadronRowSelection(selected, second)
  assert.equal(selected.has(second), false)
  assert.equal(selected.has(first), true)

  const visible = [first, second]
  const allVisible = selectVisiblePadronRows(new Set([third]), visible, true)
  assert.equal(allVisible.has(first), true)
  assert.equal(allVisible.has(second), true)
  assert.equal(allVisible.has(third), true)
  assert.equal(visiblePadronSelectionState(allVisible, visible), "all")
  const cleared = selectVisiblePadronRows(allVisible, visible, false)
  assert.equal(cleared.has(first), false)
  assert.equal(cleared.has(second), false)
  assert.equal(cleared.has(third), true)
  assert.deepEqual(
    [...retainVisiblePadronSelection(allVisible, visible)].sort(),
    [first, second].sort()
  )
})

test("la baja múltiple reutiliza la eliminación de cada fila", () => {
  assert.match(bulk, /Eliminar filas del padrón/)
  assert.match(bulk, /no elimina clientes, servicios, conexiones ni OTs/)
  assert.match(bulk, /Cancelar/)
  assert.match(bulk, /Eliminar \{count\}/)
  assert.match(bulk, /await onConfirm\(row\)/)
  assert.match(bulk, /padronRowSelectionKey\(row\)/)
  assert.match(provider, /\/api\/subscriptions\/tv-padron\/\$\{row\.sourceRow\}/)
  assert.match(provider, /\/api\/subscriptions\/abnet-padron/)
  assert.doesNotMatch(bulk, /\/api\/isp\/customers/)
  assert.doesNotMatch(bulk, /\/api\/delete-client/)
  assert.doesNotMatch(bulk, /\/api\/modify-client/)
  assert.doesNotMatch(bulk, /isp_services/)
  assert.doesNotMatch(bulk, /isp_connections/)
  assert.match(rowActions, /label="Eliminar de TV"/)
  assert.match(rowActions, /onView/)
  assert.match(rowActions, /onChangePlan/)
  assert.match(ui, /LatamTvRowDialog/)
})

test("un error parcial no informa que se eliminaron todas", () => {
  const partial = summarizePadronBulkRemoval([
    { key: "conex-internet-tv.xlsx:10", error: null },
    { key: "conex-internet-tv.xlsx:11", error: "No se pudo eliminar la fila del padrón de TV." },
    { key: "conex-internet-tv.xlsx:12", error: null },
  ])
  assert.equal(partial.removed, 2)
  assert.equal(partial.failed, 1)
  assert.deepEqual(partial.failedKeys, ["conex-internet-tv.xlsx:11"])
  assert.equal(
    partial.message,
    "2 filas eliminadas correctamente. 1 fila no pudo eliminarse."
  )
  const nine = summarizePadronBulkRemoval([
    ...Array.from({ length: 9 }, (_, index) => ({
      key: `conex-internet-tv.xlsx:${index + 1}`,
      error: null,
    })),
    { key: "conex-internet-tv.xlsx:90", error: "falló" },
  ])
  assert.equal(
    nine.message,
    "9 filas eliminadas correctamente. 1 fila no pudo eliminarse."
  )
  const none = summarizePadronBulkRemoval([
    { key: "conex-internet-tv.xlsx:10", error: "No disponible" },
  ])
  assert.equal(none.removed, 0)
  assert.equal(none.message, "No disponible")
  const allOk = summarizePadronBulkRemoval([
    { key: "conex-internet-tv.xlsx:10", error: null },
  ])
  assert.equal(allOk.removed, 1)
  assert.equal(allOk.failed, 0)
  assert.equal(allOk.message, null)
})
