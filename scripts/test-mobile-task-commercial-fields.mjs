import assert from "node:assert/strict"
import test from "node:test"

import { resolveMobileTaskCommercialFields } from "../lib/mobile/v1/tasks/task-commercial-fields.ts"

const wirelessTask = {
  id: "task-1",
  code: "TSK-OT-115",
  type: "wireless",
  serviceType: "instalacion-nueva",
  contractedPlan: "20Mb",
  amountToCollect: 15000,
  taskMetadata: {
    technology: "wireless",
    installationIp: "192.168.1.1",
  },
}

test("mobile commercial fields expose installation IP for wireless OTs", () => {
  const fields = resolveMobileTaskCommercialFields(/** @type {any} */ (wirelessTask))

  assert.equal(fields.technology, "Wireless")
  assert.equal(fields.contractedPlan, "20 Mb")
  assert.equal(fields.installationIp, "192.168.1.1")
  assert.equal(fields.installation_ip, "192.168.1.1")
  assert.equal(fields.amountToCollect, 15000)
})

test("mobile commercial fields omit IP for fiber OTs", () => {
  const fields = resolveMobileTaskCommercialFields(
    /** @type {any} */ ({
      ...wirelessTask,
      type: "fiber",
      taskMetadata: {
        technology: "fiber",
        installationIp: "192.168.1.1",
      },
    })
  )

  assert.equal(fields.technology, "Fibra")
  assert.equal(fields.installationIp, null)
  assert.equal(fields.installation_ip, null)
})
