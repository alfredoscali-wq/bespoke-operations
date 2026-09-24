import { AUTOMATIC_REPORTS_STORAGE_BUCKET } from "@/lib/reports/automatic/storage/automatic-report-storage"
import {
  PROJECT_WORK_REPORT_SIGNED_URL_TTL_SECONDS,
  PROJECT_WORK_REPORT_TEMP_PREFIX,
  buildProjectWorkReportTempStoragePath,
  isExpiredWorkReportTempObject,
  isWorkReportTempPathOwnedByCompany,
} from "@/lib/projects/work-report/delivery"

export type ProjectWorkReportTempPersistResult = {
  storagePath: string
  signedUrl: string
  expiresInSeconds: number
  bucket: string
}

export type ProjectWorkReportTempStorage = {
  upload: (
    path: string,
    body: Buffer,
    options: { contentType: string; upsert: boolean }
  ) => Promise<{ error: { message: string } | null }>
  createSignedUrl: (
    path: string,
    expiresIn: number,
    options?: { download?: string }
  ) => Promise<{
    data: { signedUrl: string } | null
    error: { message: string } | null
  }>
  list: (
    path: string
  ) => Promise<{
    data: Array<{ name: string }> | null
    error: { message: string } | null
  }>
  remove: (
    paths: string[]
  ) => Promise<{ error: { message: string } | null }>
}

export async function persistProjectWorkReportPdf(input: {
  companyId: string
  projectId: string
  fileName: string
  pdf: Uint8Array
  storage: ProjectWorkReportTempStorage
  generatedAtMs?: number
  uniqueId?: string
  nowMs?: number
}): Promise<ProjectWorkReportTempPersistResult> {
  const companyId = input.companyId.trim()
  const projectId = input.projectId.trim()
  if (!companyId || !projectId) {
    throw new Error("No se pudo aislar el informe por empresa.")
  }

  const generatedAtMs = input.generatedAtMs ?? Date.now()
  const uniqueId = input.uniqueId ?? crypto.randomUUID()
  const storagePath = buildProjectWorkReportTempStoragePath({
    companyId,
    projectId,
    fileName: input.fileName,
    generatedAtMs,
    uniqueId,
  })

  if (!isWorkReportTempPathOwnedByCompany(storagePath, companyId)) {
    throw new Error("La ruta temporal del informe no pertenece a la empresa.")
  }

  const { error: uploadError } = await input.storage.upload(
    storagePath,
    Buffer.from(input.pdf),
    {
      contentType: "application/pdf",
      upsert: false,
    }
  )

  if (uploadError) {
    throw new Error(
      `No se pudo guardar el informe temporal: ${uploadError.message}`
    )
  }

  const expiresInSeconds = PROJECT_WORK_REPORT_SIGNED_URL_TTL_SECONDS
  const signed = await input.storage.createSignedUrl(
    storagePath,
    expiresInSeconds,
    { download: input.fileName }
  )

  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(
      signed.error?.message ?? "No se pudo firmar la descarga del informe."
    )
  }

  await pruneExpiredProjectWorkReportTemps({
    storage: input.storage,
    companyId,
    keepPath: storagePath,
    nowMs: input.nowMs ?? generatedAtMs,
  })

  return {
    storagePath,
    signedUrl: signed.data.signedUrl,
    expiresInSeconds,
    bucket: AUTOMATIC_REPORTS_STORAGE_BUCKET,
  }
}

export async function pruneExpiredProjectWorkReportTemps(input: {
  storage: ProjectWorkReportTempStorage
  companyId: string
  keepPath: string
  nowMs: number
}): Promise<void> {
  const folder = `${PROJECT_WORK_REPORT_TEMP_PREFIX}/${input.companyId.trim()}`
  try {
    const listed = await input.storage.list(folder)
    if (listed.error || !listed.data) {
      return
    }

    const stalePaths = listed.data
      .filter((object) =>
        isExpiredWorkReportTempObject({
          objectName: object.name,
          nowMs: input.nowMs,
        })
      )
      .map((object) => `${folder}/${object.name}`)
      .filter((path) => path !== input.keepPath)

    if (stalePaths.length === 0) {
      return
    }

    await input.storage.remove(stalePaths)
  } catch {
    // Cleanup must not block the download.
  }
}
