import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  assertDuplicateReport,
  assertReadOnlyInvocation,
  duplicateGroups,
  duplicatesToCsv,
  groupCustomersByAbnetNumber,
  summarize,
} from "./abnet-customer-number-duplicates-audit.mjs"

function ficha(id, code, name, dni = "", status = "active", customerNumber = `CLI-${id}`) {
  return {
    id,
    customer_number: customerNumber,
    name,
    dni,
    status,
    external_customer_code: code,
  }
}

test("el mismo N° con ceros a la izquierda es un solo grupo y cada ficha sale aparte", () => {
  const rows = [
    ficha("a", "00006797", "Marquez Carlos", "20111222"),
    ficha("b", "6797", "Marquez Carlos Fidel", "20111223"),
    ficha("c", "6798", "Toranzo Gabriel", "30111000"),
    ficha("d", "00003058", "Ferrer", "1", "active"),
    ficha("e", "3058", "Ferrer Julieta", "2", "suspended"),
    ficha("f", "3058", "Otra Ferrer", "3", "active"),
    ficha("g", null, "Sin número"),
    ficha("h", "0", "Cero"),
    ficha("i", "ABC", "Texto"),
    ficha("a", "6797", "Marquez Carlos", "20111222"),
  ]
  const grouped = groupCustomersByAbnetNumber(rows)
  const duplicates = duplicateGroups(grouped.groups)
  const summary = summarize(rows.length - 1, { ...grouped, duplicates })

  assert.deepEqual(
    duplicates.map((group) => group.number),
    ["3058", "6797"]
  )
  assert.equal(duplicates[0].count, 3)
  assert.equal(duplicates[0].fichas.length, 3)
  assert.equal(duplicates[1].fichas.length, 2)
  assert.equal(grouped.groups.get("6798").length, 1)
  assert.equal(grouped.groups.has("0"), false)
  assert.equal(summary.analyzed, 9)
  assert.equal(summary.withoutNumber, 3)
  assert.equal(summary.distinctNumbers, 3)
  assert.equal(summary.repeatedNumbers, 2)
  assert.equal(summary.involvedFichas, 5)
  assert.equal(summary.extraFichas, 3)
  assertDuplicateReport(duplicates, summary)

  const csv = duplicatesToCsv(duplicates)
  const body = csv.replace(/^\uFEFF/, "").trim().split(/\r\n/)
  assert.equal(body.length, 6)
  assert.match(body[0], /N° Cliente,Fichas,ID ficha,N° interno,Nombre,DNI,Estado/)
  assert.equal(body.filter((line) => line.startsWith("3058,3,")).length, 3)
  assert.equal(body.filter((line) => line.startsWith("6797,2,")).length, 2)
  assert.doesNotMatch(csv, /6798|Toranzo/)
})

test("un número único no entra al inventario", () => {
  const grouped = groupCustomersByAbnetNumber([ficha("solo", "00001234", "Única")])
  const duplicates = duplicateGroups(grouped.groups)
  const summary = summarize(1, { ...grouped, duplicates })
  assert.equal(duplicates.length, 0)
  assert.equal(summary.distinctNumbers, 1)
  assert.equal(summary.repeatedNumbers, 0)
  assert.equal(summary.involvedFichas, 0)
  assert.equal(summary.extraFichas, 0)
  assertDuplicateReport(duplicates, summary)
})

test("la auditoría rechaza escritura y el script no llama a mutaciones", () => {
  assert.throws(() => assertReadOnlyInvocation(["node", "audit.mjs", "--write"]))
  const source = readFileSync(new URL("./abnet-customer-number-duplicates-audit.mjs", import.meta.url), "utf8")
  assert.match(source, /Auditoría de solo lectura/)
  assert.match(source, /abnetPadronCustomerNumber/)
  assert.doesNotMatch(source, /\.(insert|update|delete|upsert)\s*\(/)
  assert.match(source, /\.select\(/)
})
