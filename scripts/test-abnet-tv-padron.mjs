/**
 * Padrón ABNet de TV & Suscripciones.
 * Las cantidades salen de Conex. Internet + TV.xlsx, no de isp_services.
 */
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  ABNET_TV_PADRON_XLSX_PATH,
  readAbnetTvPadronWorkbook,
} from "../lib/subscriptions/abnet-tv-padron-file.ts"
import {
  abnetPadronTvRowLabel,
  classifyAbnetPadronTv,
  isAbnetJubiladoPlan,
  matchesAbnetPadronFilters,
  presentAbnetPadronRow,
  readAbnetTvPadronMatrix,
  summarizeAbnetTvPadron,
  withAbnetPadronDuplicates,
} from "../lib/subscriptions/abnet-tv-padron.ts"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

function sourceRow(overrides) {
  return {
    source: "conex-internet-tv.xlsx",
    sourceRow: 3,
    abnetCustomerNumber: "1234",
    customerName: "Juan Pérez",
    serviceType: "Residencial",
    node: "N1",
    planName: "TV",
    status: "Activa",
    tvAmount: 4500,
    tvTaxAmount: 90,
    finalAmount: 4590,
    duplicateGroupSize: 1,
    ...overrides,
  }
}

test("TV Básica y TV Full salen solo del importe de la columna TV", () => {
  assert.deepEqual(classifyAbnetPadronTv(4500), {
    kind: "basica",
    label: "TV Básica",
  })
  assert.deepEqual(classifyAbnetPadronTv(9900), {
    kind: "full",
    label: "TV Full",
  })
  assert.deepEqual(classifyAbnetPadronTv(2250), { kind: "other", label: "2250" })
  assert.deepEqual(classifyAbnetPadronTv(0), { kind: "other", label: "0" })
  assert.deepEqual(classifyAbnetPadronTv(null), { kind: "other", label: "—" })
  assert.equal(isAbnetJubiladoPlan("Internet + TV Jubilado"), true)
  assert.equal(isAbnetJubiladoPlan("TV Básica"), false)

  const namedFull = presentAbnetPadronRow(
    sourceRow({ planName: "PLAN FULL HOGAR", tvAmount: 4500 })
  )
  assert.equal(namedFull.tvKind, "basica")
  assert.equal(namedFull.tvLabel, "TV Básica")
  assert.equal(namedFull.jubilado, false)

  const jubiladoBasica = presentAbnetPadronRow(
    sourceRow({ planName: "TV Jubilado", tvAmount: 4500 })
  )
  assert.equal(jubiladoBasica.tvKind, "basica")
  assert.equal(jubiladoBasica.jubilado, true)

  const jubiladoHalf = presentAbnetPadronRow(
    sourceRow({ planName: "TV Jubilado", tvAmount: 2250 })
  )
  assert.equal(jubiladoHalf.tvKind, "other")
  assert.equal(jubiladoHalf.tvLabel, "2250")
  assert.equal(jubiladoHalf.jubilado, true)

  const halfWithoutWord = presentAbnetPadronRow(
    sourceRow({ planName: "TV Básica", tvAmount: 2250 })
  )
  assert.equal(halfWithoutWord.jubilado, false)
  assert.equal(halfWithoutWord.tvLabel, "2250")
  assert.equal(abnetPadronTvRowLabel(halfWithoutWord), "TV $2.250")
  assert.equal(
    abnetPadronTvRowLabel(jubiladoHalf),
    "TV $2.250 + Jubilado 50%"
  )
  assert.equal(
    abnetPadronTvRowLabel(jubiladoBasica),
    "TV Básica + Jubilado 50%"
  )
  assert.equal(classifyAbnetPadronTv(7500).kind, "pack")
})

test("un N° con varias filas no se fusiona y el resumen ignora Bespoke", () => {
  const rows = withAbnetPadronDuplicates([
    sourceRow({ sourceRow: 3, planName: "Internet" }),
    sourceRow({ sourceRow: 4, planName: "TV", tvAmount: 9900 }),
  ]).map(presentAbnetPadronRow)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].duplicateGroupSize, 2)
  assert.equal(rows[1].tvKind, "full")

  const withoutCustomer = presentAbnetPadronRow(sourceRow({}))
  assert.equal(withoutCustomer.bespokeCustomerId, null)
  assert.equal(withoutCustomer.packFutbolActive, false)
  const summary = summarizeAbnetTvPadron([
    withoutCustomer,
    { ...rows[1], packFutbolActive: true, bespokeCustomerId: "cli-1" },
  ])
  assert.equal(summary.rows, 2)
  assert.equal(summary.uniqueCustomers, 1)
  assert.equal(summary.basicaRows, 1)
  assert.equal(summary.basicaAmount, 4500)
  assert.equal(summary.fullRows, 1)
  assert.equal(summary.fullAmount, 9900)
  assert.equal(summary.basicaPackRows, 0)
  assert.equal(
    matchesAbnetPadronFilters(withoutCustomer, {
      tvKind: "all",
      jubilado: false,
      status: "all",
      duplicatesOnly: false,
      search: "",
    }),
    true
  )
})

test("el Excel conserva filas, N° distintos, TV, jubilados y estados", () => {
  assert.equal(existsSync(ABNET_TV_PADRON_XLSX_PATH), true)
  const presented = withAbnetPadronDuplicates(
    readAbnetTvPadronWorkbook(ABNET_TV_PADRON_XLSX_PATH)
  ).map(presentAbnetPadronRow)
  const summary = summarizeAbnetTvPadron(presented)
  assert.equal(summary.rows, 4764)
  assert.equal(summary.uniqueCustomers, 4377)
  assert.equal(summary.basicaRows, 4249)
  assert.equal(summary.fullRows, 139)
  assert.equal(summary.jubiladoRows, 16)
  assert.equal(summary.jubiladoRowsAt2250, 12)
  assert.equal(summary.jubiladoRowsAt4500, 4)
  assert.equal(summary.jubiladoAmount, 12 * 2_250 + 4 * 4_500)
  assert.equal(summary.basicaAmount, 4_249 * 4_500)
  assert.equal(summary.fullAmount, 139 * 9_900)
  assert.equal(summary.basicaPackRows, 0)
  assert.equal(summary.basicaPackAmount, 0)
  assert.equal(summary.statusRows.Activa, 4435)
  assert.equal(summary.statusRows.Morosa, 189)
  assert.equal(summary.statusRows.Pendiente, 136)
  assert.equal(summary.statusRows.Inactiva, 4)
  assert.equal(
    presented.filter((row) => row.tvAmount === 4500 && row.tvKind === "basica")
      .length,
    4249
  )
  assert.equal(
    presented.filter((row) => row.tvAmount === 9900 && row.tvKind === "full")
      .length,
    139
  )
  const repeated = presented.filter((row) => row.duplicateGroupSize > 1)
  assert.ok(repeated.length > presented.length - summary.uniqueCustomers)
  assert.equal(
    new Set(presented.map((row) => row.abnetCustomerNumber)).size,
    4377
  )
})

test("la matriz no descarta una segunda fila del mismo N°", () => {
  const rows = readAbnetTvPadronMatrix([
    ["SIRO"],
    [
      "N° Cliente",
      "Cliente",
      "Tipo",
      "Nodo",
      "Plan",
      "Estado",
      "TV",
      "2% IMP. TV",
      "FINAL",
    ],
    [1234, "Juan Pérez", "Residencial", "N1", "Internet", "Activa", 0, 0, 100],
    [1234, "Juan Pérez", "Residencial", "N1", "TV", "Activa", 4500, 90, 4590],
  ])
  assert.equal(rows.length, 2)
  assert.equal(rows[0].abnetCustomerNumber, "1234")
  assert.equal(rows[1].sourceRow, 4)
})

test("la pantalla y la API no reconstruyen el padrón con servicios ni conexiones", () => {
  const ui = read("components/subscriptions/subscriptions-module.tsx")
  const provider = read("components/subscriptions/subscriptions-provider.tsx")
  const cards = read("components/subscriptions/subscriptions-summary-cards.tsx")
  const overview = read("components/subscriptions/subscriptions-tv-overview.tsx")
  const offer = read("components/subscriptions/abnet-tv-offer.tsx")
  const route = read("app/api/subscriptions/abnet-padron/route.ts")
  const loader = read("scripts/import-abnet-tv-padron.mjs")
  const padron = read("lib/subscriptions/abnet-tv-padron.ts")

  for (const source of [ui, provider, cards, overview, offer, padron]) {
    assert.doesNotMatch(source, /isp_connections/)
    assert.doesNotMatch(source, /isp_services/)
    assert.doesNotMatch(source, /listTvCommercialDesk/)
  }
  assert.match(provider, /\/api\/subscriptions\/abnet-padron/)
  assert.match(provider, /summarizeAbnetTvPadron/)
  assert.match(cards, /TV = 4\.500/)
  assert.match(cards, /TV = 9\.900/)
  assert.match(ui, /Ofrecer TV Full/)
  assert.match(ui, /Ofrecer Pack Fútbol/)
  assert.match(ui, /no cambia el plan de ABNet/)
  assert.doesNotMatch(ui, /overflow-x-auto/)
  assert.doesNotMatch(ui, />CLI</)
  assert.doesNotMatch(ui, />Plan</)
  assert.doesNotMatch(ui, /monthly_fee/)
  assert.doesNotMatch(cards, /monthly_fee/)
  assert.doesNotMatch(padron, /monthly_fee/)
  assert.match(cards, /formatAbnetPadronMoney/)
  assert.doesNotMatch(offer, /fetch\(/)
  assert.doesNotMatch(offer, /assignComponent/)
  assert.doesNotMatch(route, /isp_connections/)
  assert.doesNotMatch(route, /abnet\.com|api\.abnet/i)
  assert.doesNotMatch(loader, /\.from\("customers"\)/)
  assert.doesNotMatch(loader, /\.from\("isp_services"\)/)
  assert.doesNotMatch(loader, /\.from\("isp_connections"\)/)
  assert.match(loader, /abnet_tv_padron_rows/)
  assert.match(route, /summarizeAbnetTvPadron\(presented\)/)
  assert.match(route, /BESPOKE_PRODUCTION_COMPANY_ID/)
})
