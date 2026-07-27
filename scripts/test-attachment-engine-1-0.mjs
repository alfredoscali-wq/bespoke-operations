/**
 * Attachment Engine 1.0 — path helpers, mime validation, module contracts.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  ATTACHMENT_MODULES,
  isAttachmentAllowedMimeType,
  isAttachmentModule,
} from "../lib/attachments/constants.ts"
import {
  formatAttachmentFileSize,
  resolveAttachmentPreviewKind,
  resolveAttachmentTypeEmoji,
} from "../lib/attachments/format.ts"
import {
  buildAttachmentStoragePath,
  sanitizeAttachmentFileName,
} from "../lib/attachments/path.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, "..")

test("Attachment Engine: modules include customer_attention and future modules", () => {
  assert.ok(ATTACHMENT_MODULES.includes("customer_attention"))
  assert.ok(ATTACHMENT_MODULES.includes("commercial"))
  assert.ok(ATTACHMENT_MODULES.includes("projects"))
  assert.ok(isAttachmentModule("customer_attention"))
  assert.equal(isAttachmentModule("whatsapp"), false)
})

test("Attachment Engine: sanitize and storage path are module-driven", () => {
  assert.equal(sanitizeAttachmentFileName("Foto ONU.jpg"), "Foto_ONU.jpg")
  assert.equal(
    sanitizeAttachmentFileName('a/b\\c?d%e*f:g|h"i<j>k.pdf'),
    "a-b-c-d-e-f-g-h-i-j-k.pdf"
  )

  const path = buildAttachmentStoragePath({
    companyId: "company-1",
    module: "customer_attention",
    recordId: "record-1",
    fileName: "Comprobante.pdf",
  })

  assert.match(
    path,
    /^company-1\/customer_attention\/record-1\/\d+-[a-z0-9]+-Comprobante\.pdf$/
  )
})

test("Attachment Engine: mime and preview helpers", () => {
  assert.equal(isAttachmentAllowedMimeType("image/jpeg"), true)
  assert.equal(isAttachmentAllowedMimeType("application/pdf"), true)
  assert.equal(isAttachmentAllowedMimeType("application/x-msdownload"), false)

  assert.equal(resolveAttachmentPreviewKind("image/png"), "image")
  assert.equal(resolveAttachmentPreviewKind("application/pdf"), "pdf")
  assert.equal(resolveAttachmentTypeEmoji("image/jpeg"), "📷")
  assert.equal(resolveAttachmentTypeEmoji("application/pdf"), "📄")
  assert.equal(formatAttachmentFileSize(1536), "1.5 KB")
})

test("Attachment Engine: reusable API routes exist (no Atención-specific endpoints)", () => {
  const route = readFileSync(join(root, "app/api/attachments/route.ts"), "utf8")
  const deleteRoute = readFileSync(
    join(root, "app/api/attachments/[id]/route.ts"),
    "utf8"
  )
  const migration = readFileSync(
    join(root, "supabase/migrations/20261112000100_attachment_engine_1_0.sql"),
    "utf8"
  )

  assert.match(route, /export async function GET/)
  assert.match(route, /export async function POST/)
  assert.match(deleteRoute, /export async function DELETE/)
  assert.doesNotMatch(route, /atencion-cliente/)
  assert.doesNotMatch(route, /resolveAtencionClienteActorEmployeeId/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.attachments/)
  assert.match(migration, /'attachments'/)
})

test("Attachment Engine: Atención integrates uploader + timeline without engine coupling", () => {
  const detail = readFileSync(
    join(root, "components/atencion-cliente/atencion-detail-screen.tsx"),
    "utf8"
  )
  const timeline = readFileSync(
    join(root, "components/atencion-cliente/consultation-events-timeline.tsx"),
    "utf8"
  )
  const service = readFileSync(
    join(root, "lib/attachments/service.server.ts"),
    "utf8"
  )

  assert.match(detail, /AttachmentUploader/)
  assert.match(detail, /uploadStagedAttachments/)
  assert.match(detail, /attachmentsByEventId/)
  assert.match(timeline, /Adjuntos/)
  assert.match(timeline, /attachmentsByEventId/)
  assert.match(service, /assertAttachmentRecordAccess/)
  assert.doesNotMatch(service, /atencion-cliente/)
})
