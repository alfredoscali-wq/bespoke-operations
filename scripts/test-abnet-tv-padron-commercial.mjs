/**
 * Corrección comercial del padrón TV. No llama a LATAM.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  planAbnetTvPadronCommercialCorrections,
  TV_PADRON_BASICA_AMOUNT,
} from "../lib/subscriptions/abnet-tv-padron-commercial.ts"
import { classifyAbnetPadronTv } from "../lib/subscriptions/abnet-tv-padron.ts"

const rows = [
  {
    sourceRow: 10,
    abnetCustomerNumber: "5814",
    serviceType: "Fibra",
    status: "Pendiente",
  },
  {
    sourceRow: 1345,
    abnetCustomerNumber: "5814",
    serviceType: "Wireless",
    status: "Activa",
  },
  {
    sourceRow: 20,
    abnetCustomerNumber: "100",
    serviceType: "Fibra",
    status: "Morosa",
  },
  {
    sourceRow: 21,
    abnetCustomerNumber: "101",
    serviceType: "Wireless",
    status: "Inactiva",
  },
  {
    sourceRow: 30,
    abnetCustomerNumber: "200",
    serviceType: "Fibra",
    status: "Pendiente",
  },
  {
    sourceRow: 31,
    abnetCustomerNumber: "201",
    serviceType: "Wireless",
    status: "Pendiente",
  },
  {
    sourceRow: 32,
    abnetCustomerNumber: "202",
    serviceType: "Fibra",
    status: "Pendiente",
  },
]

test("5814 Fibra pendiente se corrige y Wireless activa no entra", () => {
  const plan = planAbnetTvPadronCommercialCorrections({
    rows,
    customerIdsByNumber: new Map([
      ["5814", ["customer-5814"]],
      ["200", ["customer-200", "customer-200b"]],
      ["201", ["customer-201"]],
      ["202", ["customer-202"]],
    ]),
    basicaServicesByCustomer: new Map([
      ["customer-5814", [{ technology: "ftth" }, { technology: "wireless" }]],
      ["customer-201", [{ technology: "wireless" }, { technology: "wireless" }]],
      ["customer-202", [{ technology: "wireless" }]],
    ]),
  })
  assert.deepEqual(plan.sourceRows, [10])
  assert.equal(plan.sourceRows.includes(1345), false)
  assert.equal(plan.sourceRows.includes(20), false)
  assert.equal(plan.sourceRows.includes(21), false)
  assert.equal(classifyAbnetPadronTv(TV_PADRON_BASICA_AMOUNT).label, "TV Básica")
  const cli = planAbnetTvPadronCommercialCorrections({
    rows: [
      {
        sourceRow: 1,
        abnetCustomerNumber: "CLI-005788",
        serviceType: "Fibra",
        status: "Pendiente",
      },
    ],
    customerIdsByNumber: new Map([["5788", ["hidalgo"]]]),
    basicaServicesByCustomer: new Map([["hidalgo", [{ technology: "ftth" }]]]),
  })
  assert.deepEqual(cli.sourceRows, [])
  assert.equal(cli.omitted[0].reason, "sin N° Cliente")
  assert.equal(cli.omitted[0].abnetCustomerNumber, null)
  assert.deepEqual(
    plan.omitted.map((item) => [item.sourceRow, item.reason]),
    [
      [30, "más de un cliente con el mismo N°"],
      [31, "más de un servicio con TV Básica para ese tipo"],
      [32, "sin servicio de Internet con TV Básica para ese tipo"],
    ]
  )
})
