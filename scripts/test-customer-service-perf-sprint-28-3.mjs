/**
 * Sprint 28.3 — Smart releaseExpired (not recurrent on mutations/filters).
 * Sprint 34.0 — initial release is fire-and-forget background (still once/mount).
 */
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()

test("Sprint 28.3: releaseExpired only on initial mount + 5m interval, not fast", () => {
  const provider = readFileSync(
    join(ROOT, "components/atencion-cliente/atencion-cliente-provider.tsx"),
    "utf8"
  )

  assert.ok(provider.includes("hasReleasedExpiredThisMountRef"))
  assert.ok(provider.includes("loadSharedInbox:initialMount"))
  assert.ok(provider.includes("provider.interval-5m"))
  assert.ok(provider.includes("5 * 60_000"))
  assert.ok(provider.includes("skip releaseExpired + dashboard bundle"))

  const loadStart = provider.indexOf("const loadSharedInbox = useCallback")
  const loadEnd = provider.indexOf(
    "const refreshMyActiveManagement = useCallback",
    loadStart
  )
  const loadBlock = provider.slice(loadStart, loadEnd)

  // Fast path must not call release.
  assert.ok(loadBlock.includes("if (isFast)"))
  assert.ok(loadBlock.includes("hasReleasedExpiredThisMountRef.current = true"))

  // Interval effect exists; Sprint 34 routes it through background helper.
  assert.ok(provider.includes('mode: "fast"'))
  assert.ok(provider.includes("sharedInboxQueryRef.current"))
  assert.ok(provider.includes("runReleaseExpiredInBackground"))
})

test("Sprint 28.3: mutations still use refreshSharedInbox without forcing full release", () => {
  const provider = readFileSync(
    join(ROOT, "components/atencion-cliente/atencion-cliente-provider.tsx"),
    "utf8"
  )
  const mutationBlock = provider.slice(
    provider.indexOf("const runConsultationManagementMutation"),
    provider.indexOf("const startConsultationManagementHandler")
  )
  assert.ok(mutationBlock.includes("refreshSharedInbox()"))
  assert.equal(mutationBlock.includes("releaseExpired"), false)
})
