import "server-only"

import {
  AUTOMATIC_REPORTS_STORAGE_BUCKET,
  buildWeeklyReportStoragePath,
} from "@/lib/reports/automatic/storage/automatic-report-storage"
import { createAdminClient } from "@/lib/supabase/admin"

const SIGNED_URL_TTL_SECONDS = 3600

export async function uploadWeeklyReportPdf(input: {
  pdfBytes: Uint8Array
  generatedAt: string
  weekNumber: number
}): Promise<{ storagePath: string }> {
  const client = createAdminClient()
  const storagePath = buildWeeklyReportStoragePath(input)

  const { error } = await client.storage
    .from(AUTOMATIC_REPORTS_STORAGE_BUCKET)
    .upload(storagePath, Buffer.from(input.pdfBytes), {
      contentType: "application/pdf",
      upsert: true,
    })

  if (error) {
    throw new Error(`No se pudo guardar el PDF en Storage: ${error.message}`)
  }

  return { storagePath }
}

export async function downloadWeeklyReportPdf(
  storagePath: string
): Promise<Uint8Array> {
  const client = createAdminClient()

  const { data, error } = await client.storage
    .from(AUTOMATIC_REPORTS_STORAGE_BUCKET)
    .download(storagePath)

  if (error || !data) {
    throw new Error(
      error?.message ?? "No se pudo descargar el PDF almacenado."
    )
  }

  const buffer = Buffer.from(await data.arrayBuffer())
  return new Uint8Array(buffer)
}

export async function createWeeklyReportSignedUrl(
  storagePath: string
): Promise<string> {
  const client = createAdminClient()

  const { data, error } = await client.storage
    .from(AUTOMATIC_REPORTS_STORAGE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)

  if (error || !data?.signedUrl) {
    throw new Error(
      error?.message ?? "No se pudo generar la URL del PDF almacenado."
    )
  }

  return data.signedUrl
}
