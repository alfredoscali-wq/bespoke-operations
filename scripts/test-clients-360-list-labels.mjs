import assert from "node:assert/strict"
import test from "node:test"

import { buildClients360Directory } from "@/lib/isp/clients-360-directory"
import {
  CLIENTS_360_LIST_COLUMNS,
  CLIENTS360_EDIT_FORBIDDEN_MESSAGE,
  clients360AbnetNumberLabel,
  clients360BespokeColumnLabel,
  clients360ClienteLabel,
  clients360ListRowActions,
  presentBespokeListId,
} from "@/lib/isp/subscriber-list-presentation"

function connection(id, number) {
  return {
    abnetConnectionId: id,
    abnetCustomerNumber: number,
    customerName: "Aguirre Hector",
    connectionStatus: "activa",
    gratis: "no",
    planName: "50MB+TV BASICO",
    serviceType: "Fibra",
    nodeName: "Nodo",
  }
}

test("el identificador Bes usa el número real de la ficha y conserva los ceros", () => {
  assert.equal(presentBespokeListId("CLI-001111"), "Bes-001111")
  assert.equal(presentBespokeListId("CLI-000007"), "Bes-000007")
  assert.equal(presentBespokeListId("BES-001111"), "Bes-001111")
  assert.equal(presentBespokeListId(null), null)
  assert.equal(presentBespokeListId(""), null)
  assert.equal(presentBespokeListId("001111"), null)
  assert.equal(presentBespokeListId("222"), null)
  assert.equal(presentBespokeListId("10"), null)
})

test("una ficha vinculada muestra Bes y el número ABNet por separado", () => {
  const [entry] = buildClients360Directory({
    universeCustomers: [
      {
        id: "uuid-1",
        name: "Aguirre Hector",
        externalCode: "00000222",
        locality: null,
        status: "activo",
        inUniverse: true,
        customerNumber: "CLI-001111",
      },
    ],
    liveCustomers: [
      {
        id: "uuid-1",
        name: "Aguirre Hector",
        externalCode: "00000222",
        locality: null,
        status: "activo",
        inUniverse: true,
        customerNumber: "CLI-001111",
      },
    ],
    records: [connection("10", "222"), connection("11", "222")],
  })
  const item = {
    name: entry.name,
    directoryOrigin: entry.origin,
    bespokeCustomerNumber: entry.bespokeCustomerNumber,
    externalCustomerCode: entry.externalCode,
    id: entry.id,
  }
  assert.equal(item.directoryOrigin, "bespoke")
  assert.equal(clients360BespokeColumnLabel(item), "Bes-001111")
  assert.equal(clients360ClienteLabel(item), "Aguirre Hector")
  assert.equal(clients360AbnetNumberLabel(item.externalCustomerCode), "222")
  assert.equal(item.id, "uuid-1")
  assert.doesNotMatch(clients360ClienteLabel(item), /Bes-/)
  assert.notEqual(clients360BespokeColumnLabel(item), "222")
  assert.notEqual(clients360AbnetNumberLabel(item.externalCustomerCode), "10")
  assert.notEqual(clients360AbnetNumberLabel(item.externalCustomerCode), "001111")
})

test("un abonado solo del padrón no recibe un código Bes inventado", () => {
  const [entry] = buildClients360Directory({
    universeCustomers: [],
    liveCustomers: [],
    records: [connection("10", "222")],
  })
  const item = {
    name: entry.name,
    directoryOrigin: entry.origin,
    bespokeCustomerNumber: entry.bespokeCustomerNumber,
    externalCustomerCode: entry.externalCode,
  }
  assert.equal(item.directoryOrigin, "padron")
  assert.equal(item.bespokeCustomerNumber, null)
  assert.equal(clients360BespokeColumnLabel(item), null)
  assert.equal(clients360ClienteLabel(item), "Aguirre Hector")
  assert.equal(clients360AbnetNumberLabel(item.externalCustomerCode), "222")
  assert.doesNotMatch(clients360ClienteLabel(item), /Bes-/)
  assert.equal(entry.note.includes("Registro importado"), true)
})

test("las columnas del listado separan Bespoke, ABNet y el nombre", () => {
  assert.deepEqual(CLIENTS_360_LIST_COLUMNS, [
    "Bespoke",
    "ABNet",
    "Cliente",
    "DNI/CUIT",
    "Plan comercial",
    "Conexiones",
    "Estado",
    "Localidad",
    "Acciones",
  ])
})

test("Ver, Editar y Eliminar se ofrecen en todos los orígenes", () => {
  const permissions = { canEdit: true, canRemove: true }
  const linked = clients360ListRowActions(
    { id: "uuid-1", directoryOrigin: "bespoke" },
    permissions
  )
  const padron = clients360ListRowActions(
    { id: "abnet-222", directoryOrigin: "padron" },
    permissions
  )
  assert.equal(linked.view, true)
  assert.equal(linked.edit, true)
  assert.equal(linked.remove, true)
  assert.equal(linked.editBlockedReason, null)
  assert.equal(linked.removeBlockedReason, null)
  assert.equal(padron.view, true)
  assert.equal(padron.edit, true)
  assert.equal(padron.remove, true)
  assert.equal(padron.ficha, false)
  const withoutPermission = clients360ListRowActions(
    { id: "abnet-222", directoryOrigin: "padron" },
    { canEdit: false, canRemove: false }
  )
  assert.equal(withoutPermission.edit, true)
  assert.equal(withoutPermission.remove, true)
  assert.equal(withoutPermission.editBlockedReason, CLIENTS360_EDIT_FORBIDDEN_MESSAGE)
  assert.match(withoutPermission.removeBlockedReason ?? "", /administrador/i)
})
