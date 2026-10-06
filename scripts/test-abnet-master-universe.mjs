import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  ABNET_MASTER_CUSTOMER_STATUS,
  abnetNumberFromExternalCode,
  nextCustomerNumbers,
  packAbnetLocality,
  padAbnetExternalCode,
  planAbnetMasterRow,
  planClientes360Universe,
} from "../lib/isp/abnet-master-universe.ts"
import {
  formatIspCustomerCodeValue,
  formatIspCustomerReference,
  ISP_BESPOKE_ALTA_PENDING_ABNET_LABEL,
} from "../lib/isp/subscriber-list-presentation.ts"
import { assertAbnetMasterWorkbookPath } from "./abnet-master-workbook.mjs"

const root = resolve(import.meta.dirname, "..")

test("el N° ABNet se conserva con ceros y no usa el id interno", () => {
  assert.equal(padAbnetExternalCode("4151"), "00004151")
  assert.equal(abnetNumberFromExternalCode("00004151"), "4151")
  assert.equal(abnetNumberFromExternalCode("CLI-000415"), null)
  assert.equal(ABNET_MASTER_CUSTOMER_STATUS, "pendiente-activacion")
})

test("ciudad y provincia se guardan juntas sin reescribir el texto", () => {
  assert.equal(packAbnetLocality("La Granja", "CÃ³rdoba"), "La Granja · CÃ³rdoba")
  assert.equal(packAbnetLocality("La Granja", null), "La Granja")
  assert.equal(packAbnetLocality("  ", "  "), null)
})

test("un N° ya ligado no crea otro customer", () => {
  const decision = planAbnetMasterRow({
    customerNumber: "4151",
    name: "Cliente existente",
    document: "30111222",
    city: "La Granja",
    province: "Córdoba",
    existingAbnetNumbers: new Set(["4151"]),
    existingDocumentDigits: new Set(["30111222"]),
    existingNames: new Set(["cliente existente"]),
  })
  assert.equal(decision.action, "linked")
})

test("un documento que ya existe con otro N° queda en revisión", () => {
  const decision = planAbnetMasterRow({
    customerNumber: "6797",
    name: "Marquez",
    document: "30111222",
    city: "La Granja",
    province: null,
    existingAbnetNumbers: new Set(["5181"]),
    existingDocumentDigits: new Set(["30111222"]),
    existingNames: new Set(["marquez"]),
  })
  assert.equal(decision.action, "review")
})

test("un faltante sin coincidencia de documento se puede crear", () => {
  const decision = planAbnetMasterRow({
    customerNumber: "7001",
    name: "Cliente nuevo",
    document: "99999999",
    city: "Río Ceballos",
    province: null,
    existingAbnetNumbers: new Set(["4151"]),
    existingDocumentDigits: new Set(["30111222"]),
    existingNames: new Set(["otra persona"]),
  })
  assert.equal(decision.action, "create")
  if (decision.action === "create") {
    assert.equal(decision.externalCode, "00007001")
    assert.equal(decision.locality, "Río Ceballos")
  }
})

test("un nombre ya existente no se duplica", () => {
  const decision = planAbnetMasterRow({
    customerNumber: "6768",
    name: "Moreno Nancy",
    document: null,
    city: null,
    province: null,
    existingAbnetNumbers: new Set(["4151"]),
    existingDocumentDigits: new Set(),
    existingNames: new Set(["moreno nancy"]),
  })
  assert.equal(decision.action, "review")
})

test("las altas recientes sin N° entran y las notas y los históricos no", () => {
  const plan = planClientes360Universe({
    masterNumbers: new Set(["4151"]),
    customers: [
      {
        id: "master",
        createdAt: "2026-06-01T00:00:00.000Z",
        document: "30111222",
        abnetNumber: "4151",
      },
      {
        id: "alta",
        createdAt: "2026-09-30T12:00:00.000Z",
        document: null,
        abnetNumber: null,
      },
      {
        id: "nota",
        createdAt: "2026-10-01T12:00:00.000Z",
        document: null,
        abnetNumber: null,
      },
      {
        id: "historico",
        createdAt: "2026-06-02T00:00:00.000Z",
        document: "28999111",
        abnetNumber: "9999",
      },
      {
        id: "con-numero-y-ot",
        createdAt: "2026-06-02T00:00:00.000Z",
        document: "27111222",
        abnetNumber: "5175",
      },
    ],
    tasks: [
      {
        customerId: "alta",
        createdAt: "2026-09-30T12:00:00.000Z",
        updatedAt: "2026-09-30T12:00:00.000Z",
      },
      {
        customerId: "con-numero-y-ot",
        createdAt: "2026-10-02T12:00:00.000Z",
        updatedAt: "2026-10-02T12:00:00.000Z",
      },
    ],
  })

  assert.deepEqual(plan.masterCustomerIds, ["master"])
  assert.deepEqual(plan.recentAltaCustomerIds, ["alta", "con-numero-y-ot"])
  assert.deepEqual(plan.noteCustomerIds, ["nota"])
  assert.deepEqual(plan.historicalCustomerIds, ["historico"])
})

test("los CLI nuevos continúan la secuencia interna", () => {
  assert.deepEqual(nextCustomerNumbers(["CLI-005819", "CLI-000010"], 2), [
    "CLI-005820",
    "CLI-005821",
  ])
})

test("un alta sin N° se identifica sin inventar un número", () => {
  assert.equal(
    formatIspCustomerReference(null),
    ISP_BESPOKE_ALTA_PENDING_ABNET_LABEL
  )
  assert.equal(formatIspCustomerReference("00004151"), "Abonado #00004151")
  assert.equal(
    formatIspCustomerCodeValue(""),
    ISP_BESPOKE_ALTA_PENDING_ABNET_LABEL
  )
})

test("el importador no abre el excel de conexiones ni actualiza filas", () => {
  const importer = readFileSync(
    resolve(root, "scripts/import-abnet-master-universe.mjs"),
    "utf8"
  )
  const workbook = readFileSync(
    resolve(root, "scripts/abnet-master-workbook.mjs"),
    "utf8"
  )
  const verifier = readFileSync(
    resolve(root, "scripts/verify-abnet-master-universe.mjs"),
    "utf8"
  )
  assert.doesNotMatch(importer, /\.update\(|\.delete\(|legacy_migration_id/)
  assert.doesNotMatch(verifier, /\.insert\(|\.update\(|\.delete\(/)
  assert.throws(() =>
    assertAbnetMasterWorkbookPath("C:\\data\\Conex. Internet + TV.xlsx")
  )
  assert.doesNotMatch(workbook, /sheet_to_json\([\s\S]*Conex/)
  assert.match(importer, /pendiente-activacion|ABNET_MASTER_CUSTOMER_STATUS/)
})
