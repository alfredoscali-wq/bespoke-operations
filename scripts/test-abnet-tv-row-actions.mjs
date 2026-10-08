/**
 * Acciones por fila del padrón TV.
 * La fila no abre diálogos. Cambiar plan no escribe datos.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  ABNET_TV_PLAN_OPTIONS,
  abnetTvJubiladoHalf,
  abnetTvPlanSelectionNotice,
  currentAbnetTvPlanOption,
} from "../lib/subscriptions/abnet-tv-plan-choice.ts"
import { formatAbnetPadronMoney } from "../lib/subscriptions/abnet-tv-padron.ts"
import {
  commitAbnetPadronExclusion,
  excludeAbnetPadronRows,
} from "../lib/subscriptions/abnet-tv-padron-exclusions.ts"

const root = resolve(import.meta.dirname, "..")
const COMPANY = "company-a"
const SOURCE = "conex-internet-tv.xlsx"

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

function uiSlice(startMarker, endMarker) {
  const ui = read("components/subscriptions/subscriptions-module.tsx")
  const start = ui.indexOf(startMarker)
  const end = ui.indexOf(endMarker, start + startMarker.length)
  assert.ok(start >= 0 && end > start)
  return ui.slice(start, end)
}

test("1. la fila del padrón no es clickeable", () => {
  const ui = read("components/subscriptions/subscriptions-module.tsx")
  const rowStart = ui.indexOf("data-padron-row")
  const actions = ui.indexOf("<PadronRowActions", rowStart)
  const rowTag = ui.slice(ui.lastIndexOf("<TableRow", rowStart), actions)
  assert.match(rowTag, /cursor-default/)
  assert.doesNotMatch(rowTag, /onClick/)
  assert.doesNotMatch(rowTag, /cursor-pointer/)
  assert.doesNotMatch(rowTag, /tabIndex/)
  assert.doesNotMatch(ui, /overflow-x-auto/)
})

test("2. no hay ojo ni panel de detalle; LATAM se abre desde la fila", () => {
  const ui = read("components/subscriptions/subscriptions-module.tsx")
  assert.doesNotMatch(ui, /Ver detalle/)
  assert.doesNotMatch(ui, /<Eye /)
  assert.doesNotMatch(ui, /function AbnetPadronContact/)
  assert.doesNotMatch(ui, /setSelectedRow/)
  assert.doesNotMatch(ui, /fetch\(/)
  assert.match(ui, /label="Ver LATAM"/)
  assert.match(ui, /onView=\{\(\) => openLatam\(row, "view"\)\}/)
  assert.match(ui, /label="Cambiar clave"/)
  assert.match(ui, /label="Suspender"/)
  assert.match(ui, /label="Activar"/)
  assert.match(ui, /latamRowIsOperational/)
  assert.match(ui, /openLatam\(row, "password"\)/)
  assert.match(ui, /openLatam\(row, "suspend"\)/)
  assert.match(ui, /openLatam\(row, "activate"\)/)
  assert.match(ui, /openLatam\(row, "plan"\)/)
  const dialog = read("components/subscriptions/latam-tv-row-dialog.tsx")
  assert.match(dialog, /LATAM: Activo/)
  assert.match(dialog, /LATAM: Suspendido/)
  assert.match(dialog, /LATAM: No registrado/)
  assert.match(dialog, /LATAM: No disponible/)
  assert.match(dialog, /Alta LATAM/)
  assert.match(dialog, /Dar de alta en LATAM/)
  assert.match(dialog, /Cerrar/)
  assert.doesNotMatch(dialog, /aria-label="Cambiar clave"/)
  assert.doesNotMatch(dialog, /aria-label="Suspender"/)
  assert.doesNotMatch(dialog, /aria-label="Activar"/)
  assert.doesNotMatch(dialog, /aria-label="Eliminar de LATAM"/)
  assert.doesNotMatch(dialog, /Pendiente de implementación/)
  assert.doesNotMatch(dialog, /\/api\/modify-password/)
  assert.doesNotMatch(dialog, /\/api\/disable-client/)
  assert.doesNotMatch(dialog, /\/api\/enable-client/)
  assert.doesNotMatch(dialog, /\/api\/modify-client/)
  assert.doesNotMatch(dialog, /\/api\/delete-client/)
})

test("3. cambiar plan muestra Básica, Pack y Full sin escribir datos", () => {
  assert.deepEqual(
    ABNET_TV_PLAN_OPTIONS.map((option) => [option.label, option.amount]),
    [
      ["TV Básica", 4500],
      ["TV Básica + Pack Fútbol", 7500],
      ["TV Full", 9900],
    ]
  )
  assert.equal(formatAbnetPadronMoney(4500), "$4.500")
  assert.equal(formatAbnetPadronMoney(7500), "$7.500")
  assert.equal(formatAbnetPadronMoney(9900), "$9.900")
  assert.equal(
    currentAbnetTvPlanOption({
      tvKind: "full",
      tvAmount: 9900,
      jubilado: false,
    }),
    "full"
  )
  const notice = abnetTvPlanSelectionNotice("full")
  assert.equal(notice.headline, "Plan seleccionado: TV Full — $9.900")
  assert.equal(notice.detail, "Este cambio todavía no se aplica en ABNet.")

  const dialog = uiSlice("function ChangePadronDialog", "function RemovePadronDialog")
  assert.match(dialog, /Cambiar plan de TV/)
  assert.match(dialog, /Seleccionar nuevo plan/)
  assert.match(dialog, /Seleccionar plan/)
  assert.match(dialog, /ABNET_TV_PLAN_OPTIONS/)
  assert.match(dialog, /Este cambio todavía no se aplica en ABNet/)
  assert.doesNotMatch(dialog, /fetch\(/)
  assert.doesNotMatch(dialog, /isp_services/)
  assert.doesNotMatch(dialog, /isp_connections/)
  assert.doesNotMatch(dialog, /abnet_tv_padron_rows/)
  const ui = read("components/subscriptions/subscriptions-module.tsx")
  assert.match(ui, /onChangePlan=\{\(\) => setRowToChange\(row\)\}/)
  assert.doesNotMatch(ui, /onChangePlan=\{\(\) => setSelectedRow/)
})

test("4. jubilado muestra el 50% sin modificar el importe del padrón", () => {
  const row = {
    tvKind: "other",
    tvAmount: 2250,
    jubilado: true,
  }
  const snapshot = JSON.stringify(row)
  assert.equal(currentAbnetTvPlanOption(row), "basica")
  assert.equal(abnetTvJubiladoHalf(4500), 2250)
  assert.equal(abnetTvJubiladoHalf(9900), 4950)
  assert.equal(abnetTvJubiladoHalf(7500), 3750)
  assert.equal(formatAbnetPadronMoney(abnetTvJubiladoHalf(4500)), "$2.250")
  assert.equal(formatAbnetPadronMoney(abnetTvJubiladoHalf(9900)), "$4.950")
  assert.equal(formatAbnetPadronMoney(abnetTvJubiladoHalf(7500)), "$3.750")
  assert.equal(JSON.stringify(row), snapshot)
  const dialog = uiSlice("function ChangePadronDialog", "function RemovePadronDialog")
  assert.match(dialog, /Jubilado 50%/)
  assert.match(dialog, /row\.jubilado/)
})

test("5. la papelera abre la baja y no el cambio de plan", () => {
  const ui = read("components/subscriptions/subscriptions-module.tsx")
  assert.match(ui, /label="Eliminar de TV"/)
  assert.match(ui, /onRemove=\{\(\) => setRowToRemove\(row\)\}/)
  assert.match(ui, /stopPropagation\(\)/)
  const removal = uiSlice("function RemovePadronDialog", "export function SubscriptionsModule")
  assert.match(removal, /¿Eliminar este registro del padrón de TV\?/)
  assert.doesNotMatch(removal, /Seleccionar plan/)
  assert.doesNotMatch(removal, /setRowToChange/)
})

test("7. dos filas del mismo N° se eliminan por source_row", () => {
  const rows = [
    {
      source: SOURCE,
      sourceRow: 40,
      abnetCustomerNumber: "5814",
      customerName: "Camaduro Arturo",
      serviceType: "Fibra",
      status: "Pendiente",
    },
    {
      source: SOURCE,
      sourceRow: 41,
      abnetCustomerNumber: "5814",
      customerName: "Camaduro Arturo",
      serviceType: "Wireless",
      status: "Activa",
    },
  ]
  const removed = commitAbnetPadronExclusion([], {
    companyId: COMPANY,
    source: SOURCE,
    sourceRow: 40,
    abnetCustomerNumber: "5814",
    rows,
  })
  const active = excludeAbnetPadronRows(rows, removed.exclusions, COMPANY)
  assert.deepEqual(
    active.map((row) => row.sourceRow),
    [41]
  )
  const provider = read("components/subscriptions/subscriptions-provider.tsx")
  assert.match(provider, /\/api\/subscriptions\/tv-padron\/\$\{row\.sourceRow\}/)
  const ui = read("components/subscriptions/subscriptions-module.tsx")
  assert.match(ui, /\$\{row\.source\}-\$\{row\.sourceRow\}/)
})
