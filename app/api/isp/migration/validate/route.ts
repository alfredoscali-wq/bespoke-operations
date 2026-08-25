import { createHash } from "node:crypto"
import { NextResponse } from "next/server"

import { ISP_MIGRATION_MAX_FILE_BYTES } from "@/lib/isp/migration/constants"
import { validateIspMigration } from "@/lib/isp/migration/integrity"
import { parseIspMigrationWorkbook } from "@/lib/isp/migration/parse"
import {
  createIspMigrationRun,
  loadIspMigrationExistingState,
  sanitizeMigrationFilename,
} from "@/lib/isp/migration/queries"
import { requireIspMigrationWriteContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const auth = await requireIspMigrationWriteContext()
  if (!auth.ok) return auth.response

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { success: false, message: "Debe enviar un archivo Excel." },
      { status: 400 }
    )
  }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { success: false, message: "Seleccione un archivo Excel." },
      { status: 400 }
    )
  }

  if (file.size > ISP_MIGRATION_MAX_FILE_BYTES) {
    return NextResponse.json(
      { success: false, message: "El archivo supera el límite de 10 MB." },
      { status: 400 }
    )
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const fileSha256 = createHash("sha256").update(buffer).digest("hex")
    const parsed = parseIspMigrationWorkbook(buffer)
    const client = await createClient()
    const existing = await loadIspMigrationExistingState(client, auth.companyId)
    const validation = validateIspMigration(parsed, existing, { fileSha256 })
    const run = await createIspMigrationRun(client, {
      companyId: auth.companyId,
      createdBy: auth.sessionUser.authUserId,
      createdByLabel: auth.sessionUser.displayName,
      filename: sanitizeMigrationFilename(file.name),
      fileSha256,
      validation,
    })

    return NextResponse.json({
      success: true,
      imported: false,
      run,
      counts: validation.counts,
      preview: validation.preview,
      issues: validation.issues,
      canImport: validation.canImport,
      hasRealData: validation.hasRealData,
      duplicateCompletedRun: validation.duplicateCompletedRun,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo validar el archivo."
    return NextResponse.json({ success: false, message }, { status: 400 })
  }
}
