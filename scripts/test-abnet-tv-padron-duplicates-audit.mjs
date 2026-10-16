import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { ABNET_TV_PADRON_SOURCE } from "../lib/subscriptions/abnet-tv-padron.ts"
import {
  assertDuplicateReport,
  assertReadOnlyInvocation,
  auditTvPadronDuplicates,
  duplicatesToCsv,
} from "./abnet-tv-padron-duplicates-audit.mjs"

const COMPANY = "00000000-0000-4000-8000-000000000002"

function row(sourceRow, number, name, extra = {}) {
  return {
    source: extra.source ?? ABNET_TV_PADRON_SOURCE,
    sourceRow,
    abnetCustomerNumber: number,
    customerName: name,
    serviceType: extra.serviceType ?? "Wireless",
    node: extra.node ?? "Nodo X",
    planName: extra.planName ?? "Plan Básico",
    status: extra.status ?? "Activa",
    tvAmount: extra.tvAmount ?? 4500,
    tvTaxAmount: 90,
    finalAmount: 4590,
  }
}

function exclusion(sourceRow, number, deletedAt = null) {
  return {
    companyId: COMPANY,
    source: ABNET_TV_PADRON_SOURCE,
    sourceRow,
    abnetCustomerNumber: number,
    deletedAt,
  }
}

test("agrupa el padrón TV por N° normalizado y deja afuera exclusiones y únicos", () => {
  const rows = [
    row(123, "00001390", "Miguel Matias Fauda"),
    row(456, "1390", "Otro registro", { serviceType: "Fibra", node: "Nodo Y", status: "Morosa" }),
    row(789, "1390", "Fila excluida"),
    row(20, "2000", "Única"),
    row(30, "3000", "Primera"),
    row(31, "03000", "Segunda", { source: "otra-fuente.xlsx" }),
    row(40, "4000", "Sigue visible"),
  ]
  const result = auditTvPadronDuplicates(
    rows,
    [exclusion(789, "1390"), exclusion(40, "4000", "2026-01-01T00:00:00Z")],
    COMPANY
  )

  assert.deepEqual(
    result.duplicates.map((group) => group.number),
    ["1390", "3000"]
  )
  assert.equal(result.duplicates[0].count, 2)
  assert.deepEqual(
    result.duplicates[0].rows.map((item) => item.sourceRow),
    [123, 456]
  )
  assert.equal(result.duplicates[1].rows[0].source, ABNET_TV_PADRON_SOURCE)
  assert.equal(result.duplicates[1].rows[1].source, "otra-fuente.xlsx")
  assert.equal(result.summary.analyzed, 6)
  assert.equal(result.summary.distinctNumbers, 4)
  assert.equal(result.summary.repeatedNumbers, 2)
  assert.equal(result.summary.involvedRows, 4)
  assert.equal(result.summary.extraRows, 2)
  assertDuplicateReport(result.duplicates, result.summary)

  const csv = duplicatesToCsv(result.duplicates).replace(/^\uFEFF/, "").trim()
  const lines = csv.split(/\r\n/)
  assert.equal(lines.length, 5)
  assert.match(lines[0], /N° Cliente,Filas,source,source_row,Cliente,Tipo,Nodo,Plan,Estado,TV/)
  assert.match(lines[1], /^1390,2,.*123,Miguel Matias Fauda/)
  assert.match(lines[2], /^1390,2,.*456,Otro registro/)
  assert.match(lines[3], /^3000,2,conex-internet-tv\.xlsx,30,/)
  assert.match(lines[4], /^3000,2,otra-fuente\.xlsx,31,/)
  assert.doesNotMatch(csv, /Fila excluida|Única|Sigue visible|2000|4000/)
})

test("un N° con una sola fila visible no entra al CSV", () => {
  const result = auditTvPadronDuplicates(
    [row(1, "1390", "Visible"), row(2, "1390", "Excluida")],
    [exclusion(2, "1390")],
    COMPANY
  )
  assert.equal(result.duplicates.length, 0)
  assert.equal(result.summary.analyzed, 1)
  assert.equal(result.summary.distinctNumbers, 1)
  const csv = duplicatesToCsv(result.duplicates).replace(/^\uFEFF/, "").trim()
  assert.equal(csv.split(/\r\n/).length, 1)
  assert.doesNotMatch(csv, /1390/)
})

test("el script solo lee el padrón TV y sus exclusiones", () => {
  assert.throws(() => assertReadOnlyInvocation(["node", "audit.mjs", "--apply"]))
  const source = readFileSync(
    new URL("./abnet-tv-padron-duplicates-audit.mjs", import.meta.url),
    "utf8"
  )
  assert.match(source, /abnet_tv_padron_rows/)
  assert.match(source, /abnet_tv_padron_exclusions/)
  assert.match(source, /excludeAbnetPadronRows/)
  assert.match(source, /abnetPadronCustomerNumber/)
  assert.doesNotMatch(source, /from\("customers"\)|sync-client|clients-360|clientes-360/)
  assert.doesNotMatch(source, /\.(insert|update|delete|upsert)\s*\(/)
})
