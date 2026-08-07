/**
 * Sprint 28.4 — Incremental detail refresh after ATC mutations.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()

test("Sprint 28.4: refreshDetailPartial skips customer/creator/full employee fan-out", () => {
  const detail = readFileSync(
    join(ROOT, "components/atencion-cliente/atencion-detail-screen.tsx"),
    "utf8"
  )

  assert.ok(detail.includes("const refreshDetailPartial = useCallback"))
  assert.ok(detail.includes("missingEmployeeIds"))
  assert.ok(detail.includes("includeAttachments"))
  assert.ok(detail.includes("[ATC FastRefresh]"))
  assert.ok(detail.includes('"detailPartial"'))
  assert.ok(detail.includes("detailPartial+attachments"))

  // Full load still fetches customer; partial path must not call getCustomerById
  // inside refreshDetailPartial — verify by counting: loadDetail uses it, partial does not
  // appear between refreshDetailPartial and reloadAfterAction.
  const partialStart = detail.indexOf("const refreshDetailPartial = useCallback")
  const partialEnd = detail.indexOf("const reloadAfterAction = useCallback")
  assert.ok(partialStart >= 0 && partialEnd > partialStart)
  const partialBlock = detail.slice(partialStart, partialEnd)
  assert.ok(partialBlock.includes("refreshAtencionById(atencionId)"))
  assert.ok(partialBlock.includes("listCustomerAtencionEventsByAtencionId"))
  assert.equal(partialBlock.includes("getCustomerById"), false)
  assert.equal(partialBlock.includes("attendedByEmployeeId"), false)
})

test("Sprint 28.4: reloadAfterAction uses partial; full loadDetail remains for mount", () => {
  const detail = readFileSync(
    join(ROOT, "components/atencion-cliente/atencion-detail-screen.tsx"),
    "utf8"
  )

  assert.ok(detail.includes("await refreshDetailPartial(options)"))
  assert.ok(detail.includes('reason: "useCustomerAtencionDetail.loadDetail"'))
  assert.ok(detail.includes("void loadDetail()"))
  assert.ok(
    detail.includes(
      "reloadAfterAction({ includeAttachments: uploaded.uploaded })"
    )
  )
})
