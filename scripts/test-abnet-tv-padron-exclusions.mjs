/**
 * Baja lógica de una fila del padrón TV.
 * No borra customers, servicios, conexiones ni el Excel.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  matchesAbnetPadronFilters,
  presentAbnetPadronRow,
  summarizeAbnetTvPadron,
  withAbnetPadronDuplicates,
} from "../lib/subscriptions/abnet-tv-padron.ts"
import {
  ABNET_TV_PADRON_REMOVE_ACTION,
  clampAbnetPadronPage,
  commitAbnetPadronExclusion,
  excludeAbnetPadronRows,
  planAbnetTvPadronRemoval,
} from "../lib/subscriptions/abnet-tv-padron-exclusions.ts"

const root = resolve(import.meta.dirname, "..")
const COMPANY = "company-a"
const OTHER = "company-b"
const SOURCE = "conex-internet-tv.xlsx"

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

function sourceRow(overrides) {
  return {
    source: SOURCE,
    sourceRow: 10,
    abnetCustomerNumber: "6797",
    customerName: "Cliente 6797",
    serviceType: "Residencial",
    node: "N1",
    planName: "TV",
    status: "Activa",
    tvAmount: 4500,
    tvTaxAmount: 90,
    finalAmount: 4590,
    ...overrides,
  }
}

function present(rows) {
  return withAbnetPadronDuplicates(rows).map(presentAbnetPadronRow)
}

function hide(rows, exclusions, companyId = COMPANY) {
  return excludeAbnetPadronRows(rows, exclusions, companyId)
}

test("1. eliminar TV Básica baja el total y el contador", () => {
  const rows = [
    sourceRow({ sourceRow: 10, abnetCustomerNumber: "6797", tvAmount: 4500 }),
    sourceRow({
      sourceRow: 11,
      abnetCustomerNumber: "1000",
      tvAmount: 9900,
      status: "Morosa",
    }),
  ]
  const before = summarizeAbnetTvPadron(present(rows))
  const exclusion = {
    companyId: COMPANY,
    source: SOURCE,
    sourceRow: 10,
    abnetCustomerNumber: "6797",
    deletedAt: null,
  }
  const after = summarizeAbnetTvPadron(present(hide(rows, [exclusion])))
  assert.equal(before.rows, 2)
  assert.equal(before.basicaRows, 1)
  assert.equal(before.statusRows.Activa, 1)
  assert.equal(after.rows, 1)
  assert.equal(after.basicaRows, 0)
  assert.equal(after.basicaAmount, 0)
  assert.equal(after.statusRows.Activa ?? 0, 0)
  assert.equal(after.fullRows, 1)
  assert.equal(after.statusRows.Morosa, 1)
  assert.equal(
    hide(rows, [exclusion]).some((row) => row.abnetCustomerNumber === "6797"),
    false
  )
})

test("2. un N° con dos filas pierde solo la fila eliminada y sigue siendo único", () => {
  const rows = [
    sourceRow({
      sourceRow: 20,
      abnetCustomerNumber: "2205",
      planName: "300MB + TV Básica",
      tvAmount: 4500,
    }),
    sourceRow({
      sourceRow: 21,
      abnetCustomerNumber: "2205",
      planName: "TV Pack Full",
      tvAmount: 9900,
    }),
  ]
  const removed = commitAbnetPadronExclusion([], {
    companyId: COMPANY,
    source: SOURCE,
    sourceRow: 21,
    abnetCustomerNumber: "2205",
    rows,
  })
  const active = present(hide(rows, removed.exclusions))
  assert.equal(removed.created, true)
  assert.deepEqual(
    active.map((row) => row.sourceRow),
    [20]
  )
  assert.equal(summarizeAbnetTvPadron(active).uniqueCustomers, 1)
  assert.equal(active[0].duplicateGroupSize, 1)
})

test("3. sin filas activas el N° deja de contar como cliente único", () => {
  const rows = [
    sourceRow({ sourceRow: 20, abnetCustomerNumber: "2205" }),
    sourceRow({ sourceRow: 21, abnetCustomerNumber: "2205", tvAmount: 9900 }),
    sourceRow({ sourceRow: 30, abnetCustomerNumber: "3000", tvAmount: 9900 }),
  ]
  let exclusions = []
  exclusions = commitAbnetPadronExclusion(exclusions, {
    companyId: COMPANY,
    source: SOURCE,
    sourceRow: 20,
    abnetCustomerNumber: "2205",
    rows,
  }).exclusions
  exclusions = commitAbnetPadronExclusion(exclusions, {
    companyId: COMPANY,
    source: SOURCE,
    sourceRow: 21,
    abnetCustomerNumber: "2205",
    rows,
  }).exclusions
  const summary = summarizeAbnetTvPadron(present(hide(rows, exclusions)))
  assert.equal(summary.rows, 1)
  assert.equal(summary.uniqueCustomers, 1)
  assert.equal(
    hide(rows, exclusions).some((row) => row.abnetCustomerNumber === "2205"),
    false
  )
})

test("4. una exclusión aplicada de nuevo sigue ocultando la fila", () => {
  const rows = [sourceRow({ sourceRow: 10, abnetCustomerNumber: "6797" })]
  const first = commitAbnetPadronExclusion([], {
    companyId: COMPANY,
    source: SOURCE,
    sourceRow: 10,
    abnetCustomerNumber: "6797",
    rows,
  })
  const reloaded = excludeAbnetPadronRows(rows, first.exclusions, COMPANY)
  assert.equal(reloaded.length, 0)
  assert.match(
    read("app/api/subscriptions/abnet-padron/route.ts"),
    /excludeAbnetPadronRows/
  )
  assert.match(
    read("lib/subscriptions/abnet-tv-padron-source.ts"),
    /abnet_tv_padron_exclusions/
  )
  assert.doesNotMatch(
    read("components/subscriptions/subscriptions-provider.tsx"),
    /setPadronRows\(\s*padronRows\.filter/
  )
})

test("5 y 6. la baja no toca clientes, servicios, conexiones ni OTs", () => {
  const route = read("app/api/subscriptions/tv-padron/[sourceRow]/route.ts")
  const migration = read(
    "supabase/migrations/20261231150000_abnet_tv_padron_exclusions.sql"
  )
  for (const source of [route, migration]) {
    assert.doesNotMatch(source, /\.from\("customers"\)/)
    assert.doesNotMatch(source, /\.from\("isp_subscribers"\)/)
    assert.doesNotMatch(source, /\.from\("isp_services"\)/)
    assert.doesNotMatch(source, /\.from\("isp_connections"\)/)
    assert.doesNotMatch(source, /\.from\("tasks"\)/)
    assert.doesNotMatch(source, /\.from\("customer_atenciones"\)/)
    assert.doesNotMatch(source, /DELETE FROM public\.customers/i)
    assert.doesNotMatch(source, /DELETE FROM public\.isp_services/i)
    assert.doesNotMatch(source, /DELETE FROM public\.isp_connections/i)
  }
  assert.match(route, /abnet_tv_padron_exclusions/)
  assert.match(route, /auth\.companyId/)
  assert.doesNotMatch(route, /body\.companyId/)
})

test("7. una fila de otra empresa no se puede eliminar ni ocultar", () => {
  const rows = [sourceRow({ sourceRow: 10, abnetCustomerNumber: "6797" })]
  const foreign = planAbnetTvPadronRemoval({
    companyId: OTHER,
    source: SOURCE,
    sourceRow: 10,
    abnetCustomerNumber: "6797",
    rows: [],
    exclusions: [],
  })
  assert.equal(foreign.outcome, "not_found")
  const visible = hide(
    rows,
    [
      {
        companyId: OTHER,
        source: SOURCE,
        sourceRow: 10,
        abnetCustomerNumber: "6797",
        deletedAt: null,
      },
    ],
    COMPANY
  )
  assert.equal(visible.length, 1)
})

test("8. eliminar de nuevo no crea una segunda exclusión", () => {
  const rows = [sourceRow({ sourceRow: 10, abnetCustomerNumber: "6797" })]
  const input = {
    companyId: COMPANY,
    source: SOURCE,
    sourceRow: 10,
    abnetCustomerNumber: "6797",
    rows,
  }
  const first = commitAbnetPadronExclusion([], input)
  const second = commitAbnetPadronExclusion(first.exclusions, input)
  assert.equal(first.created, true)
  assert.equal(second.created, false)
  assert.equal(second.exclusions.length, 1)
  assert.equal(
    planAbnetTvPadronRemoval({ ...input, exclusions: second.exclusions })
      .outcome,
    "already_removed"
  )
  assert.equal(ABNET_TV_PADRON_REMOVE_ACTION, "remove_from_tv_padron")
  assert.match(
    read("supabase/migrations/20261231150000_abnet_tv_padron_exclusions.sql"),
    /abnet_tv_padron_exclusions_active_row_uidx/
  )
})

test("9. la fila eliminada sale del filtro y los totales bajan", () => {
  const rows = present([
    sourceRow({
      sourceRow: 10,
      abnetCustomerNumber: "6797",
      customerName: "Ana TV",
      status: "Activa",
      tvAmount: 4500,
    }),
    sourceRow({
      sourceRow: 11,
      abnetCustomerNumber: "1000",
      customerName: "Otro",
      status: "Morosa",
      tvAmount: 9900,
    }),
  ])
  const filters = {
    tvKind: "basica",
    jubilado: false,
    status: "Activa",
    duplicatesOnly: false,
    search: "ana",
  }
  assert.equal(rows.filter((row) => matchesAbnetPadronFilters(row, filters)).length, 1)
  const remaining = present(
    hide(
      [
        sourceRow({
          sourceRow: 10,
          abnetCustomerNumber: "6797",
          customerName: "Ana TV",
          status: "Activa",
          tvAmount: 4500,
        }),
        sourceRow({
          sourceRow: 11,
          abnetCustomerNumber: "1000",
          customerName: "Otro",
          status: "Morosa",
          tvAmount: 9900,
        }),
      ],
      [
        {
          companyId: COMPANY,
          source: SOURCE,
          sourceRow: 10,
          abnetCustomerNumber: "6797",
          deletedAt: null,
        },
      ]
    )
  )
  assert.equal(
    remaining.filter((row) => matchesAbnetPadronFilters(row, filters)).length,
    0
  )
  const summary = summarizeAbnetTvPadron(remaining)
  assert.equal(summary.rows, 1)
  assert.equal(summary.basicaRows, 0)
  assert.equal(summary.statusRows.Activa ?? 0, 0)
})

test("10. la exclusión persiste fuera del estado local y no altera el Excel", () => {
  const original = [sourceRow({ sourceRow: 10 })]
  const snapshot = JSON.stringify(original)
  const hidden = hide(original, [
    {
      companyId: COMPANY,
      source: SOURCE,
      sourceRow: 10,
      abnetCustomerNumber: "6797",
      deletedAt: null,
    },
  ])
  assert.equal(JSON.stringify(original), snapshot)
  assert.equal(hidden.length, 0)
  const restored = hide(original, [
    {
      companyId: COMPANY,
      source: SOURCE,
      sourceRow: 10,
      abnetCustomerNumber: "6797",
      deletedAt: "2026-10-07T00:00:00.000Z",
    },
  ])
  assert.equal(restored.length, 1)
  const route = read("app/api/subscriptions/tv-padron/[sourceRow]/route.ts")
  assert.match(route, /alreadyRemoved/)
  assert.doesNotMatch(route, /abnet-tv-padron\.static\.json/)
  assert.doesNotMatch(route, /writeFile/)
  assert.match(
    read("components/subscriptions/subscriptions-provider.tsx"),
    /\/api\/subscriptions\/tv-padron\//
  )
})

test("la página retrocede cuando se elimina la última fila de la página", () => {
  assert.equal(clampAbnetPadronPage(3, 100, 50), 2)
  assert.equal(clampAbnetPadronPage(2, 51, 50), 2)
  assert.equal(clampAbnetPadronPage(1, 0, 50), 1)
})

test("el N° Cliente no identifica la fila: otra fila del mismo N° queda", () => {
  const rows = [
    sourceRow({ sourceRow: 20, abnetCustomerNumber: "2205", tvAmount: 4500 }),
    sourceRow({ sourceRow: 21, abnetCustomerNumber: "2205", tvAmount: 9900 }),
  ]
  const wrongRow = planAbnetTvPadronRemoval({
    companyId: COMPANY,
    source: SOURCE,
    sourceRow: 21,
    abnetCustomerNumber: "9999",
    rows,
    exclusions: [],
  })
  assert.equal(wrongRow.outcome, "not_found")
  const rightRow = planAbnetTvPadronRemoval({
    companyId: COMPANY,
    source: SOURCE,
    sourceRow: 21,
    abnetCustomerNumber: "02205",
    rows,
    exclusions: [],
  })
  assert.equal(rightRow.outcome, "create")
  if (rightRow.outcome === "create") {
    assert.equal(rightRow.sourceRow, 21)
    assert.equal(rightRow.abnetCustomerNumber, "2205")
  }
})

test("la pantalla pide confirmación y no agranda la tabla con CLI o Plan", () => {
  const ui = read("components/subscriptions/subscriptions-module.tsx")
  assert.match(ui, /Eliminar de TV/)
  assert.match(ui, /¿Eliminar este registro del padrón de TV\?/)
  assert.match(ui, /El cliente continuará existiendo en Clientes 360/)
  assert.match(ui, /Cancelar/)
  assert.doesNotMatch(ui, />CLI</)
  assert.doesNotMatch(ui, />Plan</)
  assert.doesNotMatch(ui, /overflow-x-auto/)
})
