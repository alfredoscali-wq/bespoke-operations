import assert from "node:assert/strict"
import test from "node:test"

import { resolveMobileTaskCurrentLocationFields } from "../lib/mobile/v1/tasks/task-current-location-fields.ts"

const cambioDomicilioTask = {
  id: "task-cd-1",
  code: "TSK-OT-200",
  type: "fiber",
  serviceType: "cambio-domicilio",
  serviceAddress: "Av. Destino 500",
  locality: "Destino",
  latitude: -34.6,
  longitude: -58.4,
  taskMetadata: {
    currentAddress: "Calle Origen 100",
    currentLocality: "Origen",
    currentLatitude: -34.5,
    currentLongitude: -58.3,
    newAddress: "Av. Destino 500",
    newLocality: "Destino",
    newLatitude: -34.6,
    newLongitude: -58.4,
  },
}

test("cambio-domicilio exposes current (origin) location fields", () => {
  const fields = resolveMobileTaskCurrentLocationFields(
    /** @type {any} */ (cambioDomicilioTask)
  )

  assert.equal(fields.currentAddress, "Calle Origen 100")
  assert.equal(fields.currentLatitude, -34.5)
  assert.equal(fields.currentLongitude, -58.3)
})

test("non cambio-domicilio OTs return null current location fields", () => {
  const fields = resolveMobileTaskCurrentLocationFields(
    /** @type {any} */ ({
      ...cambioDomicilioTask,
      serviceType: "instalacion-nueva",
    })
  )

  assert.equal(fields.currentAddress, null)
  assert.equal(fields.currentLatitude, null)
  assert.equal(fields.currentLongitude, null)
})

test("existing task address/GPS remain the new domicile (not remapped)", () => {
  assert.equal(cambioDomicilioTask.serviceAddress, "Av. Destino 500")
  assert.equal(cambioDomicilioTask.latitude, -34.6)
  assert.equal(cambioDomicilioTask.longitude, -58.4)
})
