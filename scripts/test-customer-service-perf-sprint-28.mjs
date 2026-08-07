/**
 * Sprint 28.0 — ATC duplicate refresh layer removed.
 * Static wiring checks (no live network).
 */
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()

test("Sprint 28.0 / 28.4: reloadAfterAction does not re-fetch inbox", () => {
  const detail = readFileSync(
    join(ROOT, "components/atencion-cliente/atencion-detail-screen.tsx"),
    "utf8"
  )

  const start = detail.indexOf("const reloadAfterAction = useCallback")
  assert.ok(start >= 0)
  const end = detail.indexOf("function notifyExclusiveManagementBlocked", start)
  assert.ok(end > start)
  const reloadBlock = detail.slice(start, end)

  assert.ok(reloadBlock.includes("await refreshDetailPartial(options)"))
  assert.equal(reloadBlock.includes("onDataChanged"), false)
  assert.ok(detail.includes("Sprint 28.4 — mutations use partial detail refresh"))
})

test("Sprint 28.0: management mutations refresh inbox once (not atencion+inbox)", () => {
  const provider = readFileSync(
    join(ROOT, "components/atencion-cliente/atencion-cliente-provider.tsx"),
    "utf8"
  )

  const mutationBlock = provider.slice(
    provider.indexOf("const runConsultationManagementMutation"),
    provider.indexOf("const startConsultationManagementHandler")
  )

  assert.ok(mutationBlock.includes("refreshSharedInbox()"))
  assert.equal(mutationBlock.includes("refreshAtencionById(atencionId)"), false)

  const interactionBlock = provider.slice(
    provider.indexOf("const registerConsultationInteractionHandler"),
    provider.indexOf("const linkConsultationOtHandler")
  )
  assert.ok(interactionBlock.includes("await refreshSharedInbox()"))
  assert.equal(
    interactionBlock.includes("refreshAtencionById(atencionId)"),
    false
  )
  assert.equal(
    interactionBlock.includes("refreshMyActiveManagement()"),
    false
  )

  const refreshShared = provider.slice(
    provider.indexOf("const refreshSharedInbox = useCallback"),
    provider.indexOf("const refreshDashboard = useCallback")
  )
  assert.ok(refreshShared.includes("await loadSharedInbox(sharedInboxQuery"))
  assert.equal(
    refreshShared.includes("refreshMyActiveManagement()"),
    false
  )
})
