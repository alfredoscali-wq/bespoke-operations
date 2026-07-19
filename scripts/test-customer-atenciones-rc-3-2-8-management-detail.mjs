/**
 * RC 3.2.8 — unified "Detalle de la gestión" for every assistant action.
 * Run: npx tsx --test scripts/test-customer-atenciones-rc-3-2-8-management-detail.mjs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

import {
  getManagementAssistantDetailPlaceholder,
  managementAssistantOptionRequiresDetail,
  managementAssistantOptionShowsFollowUp,
  MANAGEMENT_ASSISTANT_INITIAL_OPTIONS,
} from "../lib/customer-atenciones/consultation-management-assistant.ts"

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const detailSource = fs.readFileSync(
  path.join(root, "components/atencion-cliente/atencion-detail-screen.tsx"),
  "utf8"
)
const deferRouteSource = fs.readFileSync(
  path.join(root, "app/api/atencion-cliente/[atencionId]/defer/route.ts"),
  "utf8"
)

test("every initial assistant option requires written detail", () => {
  for (const id of MANAGEMENT_ASSISTANT_INITIAL_OPTIONS) {
    assert.equal(
      managementAssistantOptionRequiresDetail(id),
      true,
      `${id} must require detail`
    )
    assert.ok(
      getManagementAssistantDetailPlaceholder(id).trim().length > 0,
      `${id} must have a placeholder`
    )
  }
})

test("follow-up section only for resolve", () => {
  assert.equal(managementAssistantOptionShowsFollowUp("resolve"), true)
  for (const id of MANAGEMENT_ASSISTANT_INITIAL_OPTIONS) {
    if (id === "resolve") continue
    assert.equal(
      managementAssistantOptionShowsFollowUp(id),
      false,
      `${id} must not show follow-up`
    )
  }
})

test("detail screen wires unified form and disables confirm until text", () => {
  assert.match(detailSource, /Detalle de la gestión/)
  assert.match(detailSource, /managementDetailForm/)
  assert.match(detailSource, /assistantDetailReady/)
  assert.match(detailSource, /!resolution\.trim\(\)/)
  assert.match(detailSource, /getManagementAssistantDetailPlaceholder/)
  assert.match(detailSource, /managementAssistantOptionShowsFollowUp/)
})

test("defer route rejects empty detail", () => {
  assert.match(deferRouteSource, /Completá el detalle de la gestión/)
  assert.match(deferRouteSource, /CONSULTATION_INVALID_PARAMETERS/)
})
