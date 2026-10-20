import { NextResponse } from "next/server"

import {
  loadAbnetConnectionRegistry,
  loadLiveAbnetCustomers,
} from "@/lib/isp/abnet-connection-registry-read"
import { padronExportTables } from "@/lib/isp/clients-360-directory"
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
    const registry = await loadAbnetConnectionRegistry(client, auth.companyId)
    const live = registry.records.length
      ? await loadLiveAbnetCustomers(client, auth.companyId)
      : { customers: [], error: null }
    const padron =
      registry.records.length > 0 && !live.error
        ? padronExportTables({
            records: registry.records,
            liveCustomers: live.customers.map((customer) => ({
              ...customer,
              inUniverse: false,
            })),
          })
        : null
    const buffer = await buildIspCustomer360ExportWorkbook(rows, padron)
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
