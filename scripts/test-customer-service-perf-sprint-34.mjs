/**
 * Sprint 34.0 — releaseExpired runs in background; does not block first paint.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()

test("Sprint 34.0: initial load fires releaseExpired in background (no await)", () => {
  const provider = readFileSync(
    join(ROOT, "components/atencion-cliente/atencion-cliente-provider.tsx"),
    "utf8"
  )

  assert.ok(provider.includes("runReleaseExpiredInBackground"))
  assert.ok(provider.includes("[ATC RELEASE BACKGROUND]"))
  assert.ok(provider.includes("releaseExpiredInFlightRef"))

  const loadStart = provider.indexOf("const loadSharedInbox = useCallback")
  const loadEnd = provider.indexOf(
    "loadSharedInboxRef.current = loadSharedInbox",
    loadStart
  )
  const loadBlock = provider.slice(loadStart, loadEnd)

  assert.ok(loadBlock.includes("hasReleasedExpiredThisMountRef.current = true"))
  assert.ok(loadBlock.includes("runReleaseExpiredInBackgroundRef.current"))
  assert.ok(loadBlock.includes("loadSharedInbox:initialMount"))
  // Must not block inbox load on the network release call.
  assert.equal(
    /await releaseExpiredConsultationManagements\(\)/.test(loadBlock),
    false
  )
})

test("Sprint 34.0: background refresh only when releasedCount > 0", () => {
  const provider = readFileSync(
    join(ROOT, "components/atencion-cliente/atencion-cliente-provider.tsx"),
    "utf8"
  )

  const bgStart = provider.indexOf("const runReleaseExpiredInBackground")
  const bgEnd = provider.indexOf(
    "const runReleaseExpiredInBackgroundRef",
    bgStart
  )
  const bgBlock = provider.slice(bgStart, bgEnd)

  assert.ok(bgBlock.includes("result.success && result.releasedCount > 0"))
  assert.ok(bgBlock.includes('mode: "fast"'))
  assert.ok(bgBlock.includes("skip fast refresh (no releases)"))
})

test("Sprint 34.0: interval uses background helper (no unconditional refresh)", () => {
  const provider = readFileSync(
    join(ROOT, "components/atencion-cliente/atencion-cliente-provider.tsx"),
    "utf8"
  )

  assert.ok(provider.includes("provider.interval-5m"))
  assert.ok(
    provider.includes(
      'void runReleaseExpiredInBackgroundRef.current("provider.interval-5m")'
    )
  )

  // Interval effect must not always await loadSharedInbox after release.
  const intervalStart = provider.indexOf(
    "Sprint 28.3 — periodic sweep while ATC provider is mounted"
  )
  const intervalEnd = provider.indexOf(
    "const refreshMyActiveManagement = useCallback",
    intervalStart
  )
  const intervalBlock = provider.slice(intervalStart, intervalEnd)
  assert.equal(
    /await releaseExpiredConsultationManagements\(\)/.test(intervalBlock),
    false
  )
  assert.equal(
    /await loadSharedInbox\(sharedInboxQueryRef/.test(intervalBlock),
    false
  )
})

test("Sprint 34.0: fast path still skips releaseExpired", () => {
  const provider = readFileSync(
    join(ROOT, "components/atencion-cliente/atencion-cliente-provider.tsx"),
    "utf8"
  )
  assert.ok(provider.includes("skip releaseExpired + dashboard bundle"))
})
