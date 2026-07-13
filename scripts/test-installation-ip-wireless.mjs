import assert from "node:assert/strict"
import test from "node:test"

import {
  buildCommercialFormFromTask,
  buildWorkOrderCreatePayload,
  getDefaultWorkOrderForm,
  mergeInstallationCommercialMetadata,
  resolveInstallationIpForDisplay,
  validateWorkOrderForm,
} from "../lib/tasks/work-order.ts"

const baseWirelessForm = {
  ...getDefaultWorkOrderForm(),
  serviceType: "instalacion-nueva",
  customerName: "Cliente Wireless",
  customerPhone: "3515551234",
  address: "Calle 123",
  locality: "Centro",
  technology: "wireless",
  contractedPlan: "20Mb",
  installationIp: "192.168.100.15",
  scheduledDate: "2026-07-10",
  shift: "manana",
  crewId: "crew-1",
  estimatedDurationPreset: "90",
  amountToCollect: "0",
  sharedLocation: "https://maps.google.com/?q=-31.4,-64.2",
}

test("Wireless exige IP de Instalación", () => {
  const result = validateWorkOrderForm({
    ...baseWirelessForm,
    installationIp: "   ",
  })

  assert.equal(result.valid, false)
  assert.equal(result.message, "La IP de Instalación es obligatoria.")
})

test("Fibra no valida ni persiste IP de Instalación", () => {
  const fiberForm = {
    ...baseWirelessForm,
    technology: "fiber",
    contractedPlan: "100Mb",
    installationIp: "192.168.100.15",
    paymentMethod: "transferencia",
  }

  const validation = validateWorkOrderForm(fiberForm)
  assert.equal(validation.valid, true)

  const payload = buildWorkOrderCreatePayload({
    form: fiberForm,
    existingTasks: [],
    checklist: [],
    crew: { id: "crew-1", name: "Cuadrilla 1", supervisor: "Sup" },
  })

  assert.equal(payload.taskMetadata?.installationIp, undefined)
  assert.equal(payload.taskMetadata?.technology, "fiber")
})

test("Wireless persiste installationIp en task_metadata", () => {
  const payload = buildWorkOrderCreatePayload({
    form: baseWirelessForm,
    existingTasks: [],
    checklist: [],
    crew: { id: "crew-1", name: "Cuadrilla 1", supervisor: "Sup" },
  })

  assert.equal(payload.taskMetadata?.technology, "wireless")
  assert.equal(payload.taskMetadata?.installationIp, "192.168.100.15")
})

test("Display omite IP vacía o Fiber (compatibilidad)", () => {
  const wirelessWithoutIp = {
    type: "wireless",
    serviceType: "instalacion-nueva",
    taskMetadata: { technology: "wireless" },
  }

  const fiberWithIp = {
    type: "fiber",
    serviceType: "instalacion-nueva",
    taskMetadata: {
      technology: "fiber",
      installationIp: "10.0.0.1",
    },
  }

  const wirelessWithIp = {
    type: "wireless",
    serviceType: "instalacion-nueva",
    taskMetadata: {
      technology: "wireless",
      installationIp: "192.168.100.15",
    },
  }

  assert.equal(resolveInstallationIpForDisplay(wirelessWithoutIp), null)
  assert.equal(resolveInstallationIpForDisplay(fiberWithIp), null)
  assert.equal(
    resolveInstallationIpForDisplay(wirelessWithIp),
    "192.168.100.15"
  )
})

test("Form comercial y merge al editar limpian IP en Fiber", () => {
  const task = {
    id: "t1",
    type: "wireless",
    serviceType: "instalacion-nueva",
    contractedPlan: "20Mb",
    taskMetadata: {
      technology: "wireless",
      installationIp: "192.168.100.15",
      email: "a@b.com",
    },
  }

  const commercial = buildCommercialFormFromTask(/** @type {any} */ (task))
  assert.equal(commercial.installationIp, "192.168.100.15")

  const switchedToFiber = mergeInstallationCommercialMetadata(
    task.taskMetadata,
    {
      technology: "fiber",
      installationIp: "192.168.100.15",
    }
  )

  assert.equal(switchedToFiber.technology, "fiber")
  assert.equal(switchedToFiber.installationIp, undefined)
  assert.equal(switchedToFiber.email, "a@b.com")
})
