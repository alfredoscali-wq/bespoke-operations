import { NextResponse } from "next/server"

import {
  ISP_MIGRATION_TEMPLATE_DOWNLOAD_NAME,
  ISP_MIGRATION_TEMPLATE_FILENAME,
} from "@/lib/isp/migration/constants"
import { buildIspMigrationTemplateWorkbook } from "@/lib/isp/migration/template"
import { requireIspMigrationReadContext } from "@/lib/isp/route-context"

export async function GET() {
  const auth = await requireIspMigrationReadContext()
  if (!auth.ok) return auth.response

  const bytes = Buffer.from(buildIspMigrationTemplateWorkbook())
  return new NextResponse(bytes, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${ISP_MIGRATION_TEMPLATE_DOWNLOAD_NAME}"; filename*=UTF-8''${encodeURIComponent(ISP_MIGRATION_TEMPLATE_FILENAME)}`,
      "Cache-Control": "no-store",
    },
  })
}

