/**
 * Local visual preview of the Obra work report.
 * Read-only. Writes a PDF to the OS temp directory.
 *
 * Usage:
 *   npx tsx scripts/generate-obras-work-report-preview.mjs
 */
import { createClient } from "@supabase/supabase-js"
import { writeFileSync, readFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { buildProjectWorkReportData } from "../lib/projects/work-report/build-report-data.ts"
import { generateProjectWorkReportPdf } from "../lib/projects/work-report/generate-pdf.ts"
import { buildProjectWorkReportFileName } from "../lib/projects/work-report/options.ts"
import { mapProjectRowToProject } from "../lib/supabase/projects.mapper.ts"
import { fetchProjectWorkOrderListTasks } from "../lib/supabase/tasks.queries.ts"
import { fetchLiveTaskPhotosForTaskIds } from "../lib/supabase/task-photos.queries.ts"
import { TASK_PHOTOS_STORAGE_BUCKET } from "../lib/supabase/task-photos.storage.ts"
import { persistProjectWorkReportPdf } from "../lib/projects/work-report/persist-temp.ts"
import { AUTOMATIC_REPORTS_STORAGE_BUCKET } from "../lib/reports/automatic/storage/automatic-report-storage.ts"
import { VERCEL_FUNCTION_RESPONSE_LIMIT_BYTES } from "../lib/projects/work-report/delivery.ts"
import { buildProjectWorkReportShareUrl } from "../lib/projects/work-report/public-origin.ts"

const PROJECT_CODE = "FO-CORT-2026"
const COMPANY_ID = "00000000-0000-4000-8000-000000000002"

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local")
  if (!existsSync(envPath)) {
    throw new Error("Missing .env.local")
  }
  const env = readFileSync(envPath, "utf8")
  const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim()
  const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim()
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  return { url, key }
}

async function urlToDataUrl(url) {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const mime = response.headers.get("content-type") || "image/jpeg"
    const buffer = Buffer.from(await response.arrayBuffer())
    return `data:${mime};base64,${buffer.toString("base64")}`
  } catch {
    return null
  }
}

const { url, key } = loadEnv()
const client = createClient(url, key, { auth: { persistSession: false } })

const { data: projectRow, error: projectError } = await client
  .from("projects")
  .select("*")
  .eq("company_id", COMPANY_ID)
  .eq("code", PROJECT_CODE)
  .is("deleted_at", null)
  .maybeSingle()

if (projectError || !projectRow) {
  throw new Error(projectError?.message ?? "Obra FO-CORT-2026 no encontrada.")
}

const project = mapProjectRowToProject(projectRow)
const tasksResult = await fetchProjectWorkOrderListTasks(
  client,
  COMPANY_ID,
  project.id
)
if (tasksResult.error || !tasksResult.data) {
  throw new Error(tasksResult.error?.message ?? "No se pudieron leer las OT.")
}

const tasks = tasksResult.data.map((task) => ({
  ...task,
  companyId: COMPANY_ID,
  deletedAt: null,
}))
const completedIds = tasks
  .filter((task) => task.status === "finalizada" || task.status === "cerrada")
  .map((task) => task.id)

const photosResult = await fetchLiveTaskPhotosForTaskIds(
  client,
  COMPANY_ID,
  completedIds
)
if (photosResult.error) {
  throw new Error(photosResult.error.message)
}

const photos = []
for (const photo of photosResult.data ?? []) {
  const storagePath =
    photo.fileUrl && !/^https?:\/\//i.test(photo.fileUrl) ? photo.fileUrl : ""
  let imageDataUrl = null
  if (storagePath) {
    const transformed = await client.storage
      .from(TASK_PHOTOS_STORAGE_BUCKET)
      .download(storagePath, {
        transform: {
          width: 1400,
          height: 1400,
          resize: "contain",
          quality: 72,
        },
      })
    if (!transformed.error && transformed.data) {
      const bytes = Buffer.from(await transformed.data.arrayBuffer())
      imageDataUrl = `data:${transformed.data.type || "image/jpeg"};base64,${bytes.toString("base64")}`
    }
  }
  if (!imageDataUrl && photo.signedUrl) {
    imageDataUrl = await urlToDataUrl(photo.signedUrl)
  }
  photos.push({
    taskId: photo.taskId,
    description: photo.description,
    createdAt: photo.createdAt,
    imageDataUrl,
  })
}

const { data: branding } = await client
  .from("company_branding")
  .select("logo_url, primary_color, secondary_color")
  .eq("company_id", COMPANY_ID)
  .maybeSingle()

const logoDataUrl = branding?.logo_url
  ? await urlToDataUrl(branding.logo_url)
  : null

const report = buildProjectWorkReportData({
  companyId: COMPANY_ID,
  project,
  tasks,
  photos,
  taskScope: "completed",
  branding: {
    logoDataUrl,
    primaryColor: branding?.primary_color,
    secondaryColor: branding?.secondary_color,
  },
})

const pdf = await generateProjectWorkReportPdf(report)
const pdfBuffer = Buffer.from(pdf)
const pageCount = (pdfBuffer.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length
const outPath = join(tmpdir(), buildProjectWorkReportFileName(project.code))
writeFileSync(outPath, pdfBuffer)

const bucket = client.storage.from(AUTOMATIC_REPORTS_STORAGE_BUCKET)
const stored = await persistProjectWorkReportPdf({
  companyId: COMPANY_ID,
  projectId: project.id,
  fileName: buildProjectWorkReportFileName(project.code),
  pdf: pdfBuffer,
  storage: {
    upload: (path, body, options) => bucket.upload(path, body, options),
    createSignedUrl: (path, expiresIn, options) =>
      bucket.createSignedUrl(path, expiresIn, options),
    list: (path) => bucket.list(path),
    remove: (paths) => bucket.remove(paths),
  },
})

const downloaded = await fetch(stored.signedUrl)
const downloadedBytes = Buffer.from(await downloaded.arrayBuffer())
const downloadedHeader = downloadedBytes.subarray(0, 5).toString("latin1")

await bucket.remove([stored.storagePath])

console.log(
  JSON.stringify(
    {
      path: outPath,
      project: {
        name: project.name,
        code: project.code,
        client: project.client,
        location: project.location,
        startDate: project.startDate,
        endDate: project.endDate,
      },
      includedCount: report.summary.includedCount,
      workOrders: report.workOrders.length,
      completedCount: report.summary.completedCount,
      activeCount: report.summary.activeCount,
      pendingClosureCount: report.summary.pendingClosureCount,
      photosResolved: photos.filter((photo) => photo.imageDataUrl).length,
      photosTotal: photos.length,
      workOrderPhotos: report.workOrders.reduce(
        (sum, order) => sum + order.photos.length,
        0
      ),
      webRoute: `/obras/${project.id}/informe`,
      publicShareOrigin: buildProjectWorkReportShareUrl("<token>"),
      pages: pageCount,
      bytes: pdfBuffer.byteLength,
      delivery: {
        bucket: stored.bucket,
        storagePath: stored.storagePath,
        expiresInSeconds: stored.expiresInSeconds,
        overFunctionLimit:
          pdfBuffer.byteLength > VERCEL_FUNCTION_RESPONSE_LIMIT_BYTES,
        downloadedOk: downloaded.ok && downloadedHeader === "%PDF-",
        downloadedBytes: downloadedBytes.byteLength,
        jsonPayloadBytes: Buffer.byteLength(
          JSON.stringify({
            success: true,
            signedUrl: stored.signedUrl,
            fileName: buildProjectWorkReportFileName(project.code),
            byteSize: pdfBuffer.byteLength,
            expiresInSeconds: stored.expiresInSeconds,
            includedCount: report.summary.includedCount,
          }),
          "utf8"
        ),
      },
    },
    null,
    2
  )
)
