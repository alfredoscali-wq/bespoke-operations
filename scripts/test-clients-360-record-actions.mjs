import assert from "node:assert/strict"
import test from "node:test"

import {
  CLIENTS360_SHARED_FICHA_MESSAGE,
  planClients360FichaRemoval,
  planClients360FichaSave,
} from "@/lib/isp/clients-360-record-actions"

test("editar un abonado solo de ABNet crea una ficha y no elige entre varias", () => {
  assert.deepEqual(planClients360FichaSave([]), { ok: true, action: "create" })
  assert.deepEqual(planClients360FichaSave([{ id: "uuid-1" }]), {
    ok: true,
    action: "update",
    customerId: "uuid-1",
  })
  const shared = planClients360FichaSave([{ id: "uuid-1" }, { id: "uuid-2" }])
  assert.equal(shared.ok, false)
  if (!shared.ok) assert.equal(shared.message, CLIENTS360_SHARED_FICHA_MESSAGE)
})

test("eliminar un abonado de ABNet usa la membresía Bespoke y no inventa un código Bes", () => {
  assert.deepEqual(planClients360FichaRemoval([]), { ok: true, action: "remove_new" })
  assert.deepEqual(planClients360FichaRemoval([{ id: "uuid-1" }]), {
    ok: true,
    action: "remove",
    customerId: "uuid-1",
  })
  const shared = planClients360FichaRemoval([{ id: "uuid-1" }, { id: "uuid-2" }])
  assert.equal(shared.ok, false)
  if (!shared.ok) assert.match(shared.message, /padrón importado/)
})
