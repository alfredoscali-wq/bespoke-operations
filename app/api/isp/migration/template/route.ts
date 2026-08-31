import { NextResponse } from "next/server"

import {
  ISP_MIGRATION_TEMPLATE_DOWNLOAD_NAME,
  ISP_MIGRATION_TEMPLATE_FILENAME,
} from "@/lib/isp/migration/constants"
import { loadIspMigrationExistingState } from "@/lib/isp/migration/queries"
import { buildIspMigrationTemplateWorkbook } from "@/lib/isp/migration/template"
import { commercialServiceNamesForMigrationTemplate } from "@/lib/isp/migration/tv-component"
import { requireIspMigrationReadContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const auth = await requireIspMigrationReadContext()
  if (!auth.ok) return auth.response

  let commercialServiceNames: string[] = []
  try {
    const client = await createClient()
    const existing = await loadIspMigrationExistingState(client, auth.companyId)
    commercialServiceNames = commercialServiceNamesForMigrationTemplate(
      existing.catalog
    )
  } catch {
    commercialServiceNames = []
  }

  const bytes = Buffer.from(
    buildIspMigrationTemplateWorkbook({ commercialServiceNames })
  )
  return new NextResponse(bytes, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${ISP_MIGRATION_TEMPLATE_DOWNLOAD_NAME}"; filename*=UTF-8''${encodeURIComponent(ISP_MIGRATION_TEMPLATE_FILENAME)}`,
      "Cache-Control": "no-store",
    },
  })
}
