/**
 * Diagnóstico del identificador operativo LATAM. No llama a la API real.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { latamApiIdentifier } from "../lib/integrations/latam-tv/identity.ts"
import { readLatamOperationalIdentifier } from "../lib/integrations/latam-tv/operational-identifier.ts"

const ABNET = "00006798"

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8")
}

test("el N° ABNet 6798 no se convierte en identificador LATAM", () => {
  const reading = readLatamOperationalIdentifier(
    {
      id_iptv: 29,
      id_crm: null,
      dni: "35226272",
      usuario: "ggerardotoranzo@hotmail.com.ar",
      estado: 1,
      plan_nombre: "Plan Basico",
      plan_id: 2,
    },
    ABNET
  )
  assert.equal(reading.case, "missing_from_catalog")
  assert.equal(reading.requestField, "identificador")
  assert.equal(reading.value, null)
  assert.equal(reading.abnetNumber, "6798")
  assert.notEqual(reading.value, reading.abnetNumber)
  assert.notEqual(reading.value, "29")
  assert.equal(latamApiIdentifier({ id_iptv: 29, id_crm: null }), null)
})

test("id_crm presente no se adopta como identificador operativo", () => {
  const reading = readLatamOperationalIdentifier(
    { id_crm: "CRM-8841", id_iptv: 29, identificador: null },
    ABNET
  )
  assert.equal(reading.case, "undetermined")
  assert.equal(reading.value, null)
  assert.equal(reading.idCrm, "CRM-8841")
  assert.notEqual(reading.value, "6798")
})

test("id_crm vacío deja el identificador ausente aunque id_iptv exista", () => {
  const reading = readLatamOperationalIdentifier({ id_crm: "", id_iptv: 29 }, "6798")
  assert.equal(reading.case, "missing_from_catalog")
  assert.equal(reading.idIptv, "29")
  assert.equal(reading.value, null)
})

test("un identificador explícito queda confirmado y es independiente del N° ABNet", () => {
  const reading = readLatamOperationalIdentifier(
    { identificador: "4412", id_crm: null, id_iptv: 29 },
    ABNET
  )
  assert.equal(reading.case, "confirmed")
  assert.equal(reading.value, "4412")
  assert.notEqual(reading.value, "6798")
  assert.notEqual(reading.value, "29")
})

test("cliente no encontrado y respuesta incompleta no inventan un identificador", () => {
  const missing = readLatamOperationalIdentifier(null, ABNET)
  assert.equal(missing.case, "undetermined")
  assert.equal(missing.value, null)
  const incomplete = readLatamOperationalIdentifier({ dni: "35226272" }, ABNET)
  assert.equal(incomplete.case, "missing_from_catalog")
  assert.equal(incomplete.value, null)
  assert.notEqual(incomplete.value, "6798")
})

test("el diagnóstico no escribe en LATAM ni persiste el vínculo", () => {
  const source = read("lib/integrations/latam-tv/operational-identifier.ts")
  const route = read("app/api/integrations/latam-tv/customers/[customerId]/route.ts")
  assert.match(route, /linkedIdentifier: null/)
  assert.doesNotMatch(source, /fetch\(|httpsRequest|method:\s*["'](?:POST|PUT|DELETE)["']/)
  assert.doesNotMatch(source, /\.(insert|update|delete)\(/)
  assert.doesNotMatch(source, /LATAM_TV_API_TOKEN/)
})
