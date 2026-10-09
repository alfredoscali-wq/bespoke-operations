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
  abnetPadronRowWithTvPlan,
  abnetTvJubiladoHalf,
  abnetTvPlanSelectionNotice,
  currentAbnetTvPlanOption,
} from "../lib/subscriptions/abnet-tv-plan-choice.ts"
import { formatAbnetPadronMoney } from "../lib/subscriptions/abnet-tv-padron.ts"
import {
  commitAbnetPadronExclusion,
  excludeAbnetPadronRows,
} from "../lib/subscriptions/abnet-tv-padron-exclusions.ts"
import {
  LATAM_IDENTITY_CONFLICT,
  LATAM_LINKED_MANY_FICHAS,
  LATAM_LINKED_MISSING_FICHA,
  LATAM_NOT_LINKED,
  LATAM_UNAVAILABLE,
  padronLatamMode,
} from "../lib/subscriptions/padron-latam-mode.ts"

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
  assert.doesNotMatch(ui, /Ver LATAM/)
  assert.doesNotMatch(ui, /label="LATAM"/)
  assert.doesNotMatch(ui, /onView/)
  assert.match(ui, /label="Alta LATAM"/)
  assert.match(ui, /label="Desactivar"/)
  assert.match(ui, /label="Cambiar clave"/)
  assert.match(ui, /label="Cambiar plan"/)
  assert.doesNotMatch(ui, /Cambiar plan de TV/)
  assert.match(ui, /label="Activar"/)
  assert.match(ui, /padronLatamMode\(row, latamByNumber\)/)
  const mode = read("lib/subscriptions/padron-latam-mode.ts")
  assert.match(mode, /LATAM no disponible/)
  assert.match(mode, /Cliente no vinculado con LATAM/)
  assert.match(mode, /No se puede operar por conflicto de identidad/)
  assert.match(mode, /presence\.identifier === number/)
  assert.match(mode, /presence\.phase === "active" \|\| presence\.phase === "suspended"/)
  assert.match(ui, /openLatam\(row, "signup"\)/)
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

  const ui = read("components/subscriptions/subscriptions-module.tsx")
  const actions = uiSlice("function PadronRowActions", "function PadronIconButton")
  assert.equal(actions.match(/label="Cambiar plan"/g)?.length, 1)
  assert.doesNotMatch(actions, /Cambiar plan de TV/)
  assert.match(actions, /disabled=\{Boolean\(locked \|\| busy \|\| !operational\)\}/)
  assert.match(ui, /onPlan=\{\(\) => openLatam\(row, "plan"\)\}/)
  assert.doesNotMatch(ui, /function ChangePadronDialog/)
  assert.doesNotMatch(ui, /setRowToChange/)
  const dialog = read("components/subscriptions/latam-tv-row-dialog.tsx")
  assert.match(dialog, /El cambio se aplicará en LATAM y luego se actualizará el padrón de Bespoke\./)
  assert.match(dialog, /payload\?\.outcome === "updated" && confirmed && selectedPlan/)
  assert.match(dialog, /onPadronPlan\(row, selectedPlan\.kind\)/)
  assert.doesNotMatch(dialog, /isp_services/)
  assert.doesNotMatch(dialog, /isp_connections/)
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
  const mark = uiSlice("function PadronTvMark", "function PadronRowActions")
  assert.match(mark, /Jubilado 50%/)
  assert.match(mark, /row\.jubilado/)
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

test("6. la página consulta LATAM agrupado y no por fila", () => {
  const ui = read("components/subscriptions/subscriptions-module.tsx")
  const provider = read("components/subscriptions/subscriptions-provider.tsx")
  const route = read("app/api/subscriptions/abnet-padron/route.ts")
  assert.doesNotMatch(ui, /fetch\(/)
  assert.match(ui, /latamByNumber/)
  assert.match(ui, /known=/)
  assert.match(ui, /label="Cambiar plan"/)
  assert.doesNotMatch(ui, /Cambiar plan de TV/)
  assert.match(ui, /label="Eliminar de TV"/)
  assert.match(provider, /latam: missing\.join/)
  assert.match(provider, /\/api\/subscriptions\/abnet-padron\?/)
  assert.match(route, /readLatamClientsByIdentifiers/)
  assert.match(route, /searchParams\.get\("latam"\)/)
  assert.doesNotMatch(route, /getLatamTvClientByIdentifier/)
  assert.doesNotMatch(route, /sync-client/)
  assert.doesNotMatch(route, /enable-client/)
  assert.doesNotMatch(route, /disable-client/)
  assert.doesNotMatch(route, /modify-client/)
  assert.doesNotMatch(route, /delete-client/)
  assert.match(route, /loadAbnetTvPadronSourceRows/)
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

test("8. el plan confirmado cambia solo la fila source_row", () => {
  const shared = {
    tvAmount: 4500,
    tvKind: "basica",
    tvLabel: "TV Básica",
  }
  const fibra = { source: SOURCE, sourceRow: 40, ...shared }
  const wireless = { source: SOURCE, sourceRow: 41, ...shared }
  const updated = [fibra, wireless].map((row) =>
    row.source === SOURCE && row.sourceRow === 40
      ? abnetPadronRowWithTvPlan(row, "pack")
      : row
  )
  assert.equal(updated[0].tvAmount, 7500)
  assert.equal(updated[0].tvKind, "pack")
  assert.equal(updated[1].tvAmount, 4500)
  const route = read("app/api/subscriptions/tv-padron/[sourceRow]/route.ts")
  assert.match(route, /export async function PATCH/)
  assert.match(route, /\.eq\("source_row", sourceRow\)/)
  assert.match(route, /tv_amount: option\.amount/)
  assert.doesNotMatch(route, /\/api\/modify-client/)
  assert.doesNotMatch(route, /\/api\/sync-client/)
  assert.doesNotMatch(route, /isp_services/)
  const provider = read("components/subscriptions/subscriptions-provider.tsx")
  assert.match(provider, /item\.source === row\.source && item\.sourceRow === row\.sourceRow/)
  const dialog = read("components/subscriptions/latam-tv-row-dialog.tsx")
  assert.match(dialog, /outcome === "same_plan"/)
  assert.match(dialog, /onPadronPlan\(row, selectedPlan\.kind\)/)
})

test("el vínculo LATAM no depende de una ficha única y no escribe", () => {
  const linked = {
    phase: "active",
    identifier: "6798",
    iptvId: "29",
    username: null,
    planName: "Plan Basico",
  }
  const suspended = { ...linked, phase: "suspended" }
  const unregistered = { ...linked, phase: "unregistered", identifier: null, iptvId: null, planName: null }
  const unavailable = { ...unregistered, phase: "unavailable" }
  const conflict = { ...linked, identifier: "9999" }
  const one = { abnetCustomerNumber: "6798", bespokeCustomerId: "ficha-1", bespokeLink: "one" }
  const none = { abnetCustomerNumber: "6798", bespokeCustomerId: null, bespokeLink: "none" }
  const many = { abnetCustomerNumber: "6798", bespokeCustomerId: null, bespokeLink: "many" }

  assert.equal(padronLatamMode(one, { 6798: linked }).kind, "active")
  assert.equal(padronLatamMode(one, { 6798: suspended }).kind, "suspended")
  assert.deepEqual(padronLatamMode(none, { 6798: linked }), {
    kind: "blocked",
    reason: LATAM_LINKED_MISSING_FICHA,
  })
  assert.deepEqual(padronLatamMode(many, { 6798: linked }), {
    kind: "blocked",
    reason: LATAM_LINKED_MANY_FICHAS,
  })
  assert.equal(padronLatamMode(one, { 6798: unregistered }).kind, "signup")
  assert.equal(padronLatamMode(none, { 6798: unregistered }).kind, "signup")
  assert.deepEqual(padronLatamMode(one, { 6798: unavailable }), {
    kind: "blocked",
    reason: LATAM_UNAVAILABLE,
  })
  assert.deepEqual(padronLatamMode(one, { 6798: conflict }), {
    kind: "blocked",
    reason: LATAM_IDENTITY_CONFLICT,
  })
  assert.notEqual(padronLatamMode(none, { 6798: linked }).kind, "signup")
  assert.notEqual(padronLatamMode(many, { 6798: linked }).kind, "signup")
  assert.equal(LATAM_NOT_LINKED, "Cliente no vinculado con LATAM")

  const mode = read("lib/subscriptions/padron-latam-mode.ts")
  const actions = uiSlice("function PadronRowActions", "function PadronIconButton")
  const dialog = read("components/subscriptions/latam-tv-row-dialog.tsx")
  const route = read("app/api/subscriptions/abnet-padron/route.ts")
  assert.doesNotMatch(mode, /fetch\(|sync-client|modify-client/)
  assert.match(actions, /mode\.kind !== "signup"/)
  assert.match(route, /bespokeLink: "many"/)
  assert.match(route, /bespokeLink: "one"/)
  assert.match(dialog, /if \(!row\?\.bespokeCustomerId \|\| busy\.current\) return/)
})
