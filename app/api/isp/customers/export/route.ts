import { NextResponse } from "next/server"

import { listActiveIspCustomersForExcelExport } from "@/lib/isp/customer-360-export-queries"
import { ispCustomer360ExportFileName } from "@/lib/isp/customer-360-export"
import { buildIspCustomer360ExportWorkbook } from "@/lib/isp/customer-360-export-xlsx"
import { requireIspReadContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireIspReadContext()
  if (!auth.ok) return auth.response

  try {
    const client = await createClient()
    const rows = await listActiveIspCustomersForExcelExport(
      client,
      auth.companyId
    )
    const buffer = await buildIspCustomer360ExportWorkbook(rows)
    const filename = ispCustomer360ExportFileName()

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo exportar el Excel de Clientes 360.",
      },
      { status: 500 }
    )
  }
}
