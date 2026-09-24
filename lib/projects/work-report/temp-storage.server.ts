import "server-only"

import { AUTOMATIC_REPORTS_STORAGE_BUCKET } from "@/lib/reports/automatic/storage/automatic-report-storage"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  persistProjectWorkReportPdf,
  type ProjectWorkReportTempStorage,
} from "@/lib/projects/work-report/persist-temp"

function storageFromAdmin(): ProjectWorkReportTempStorage {
  const admin = createAdminClient()
  const bucket = admin.storage.from(AUTOMATIC_REPORTS_STORAGE_BUCKET)

  return {
    upload: (path, body, options) => bucket.upload(path, body, options),
    createSignedUrl: (path, expiresIn, options) =>
      bucket.createSignedUrl(path, expiresIn, options),
    list: (path) => bucket.list(path),
    remove: (paths) => bucket.remove(paths),
  }
}

export async function persistProjectWorkReportPdfForDownload(input: {
  companyId: string
  projectId: string
  fileName: string
  pdf: Uint8Array
}) {
  return persistProjectWorkReportPdf({
    ...input,
    storage: storageFromAdmin(),
  })
}
