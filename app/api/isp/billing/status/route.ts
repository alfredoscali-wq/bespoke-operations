import { NextResponse } from "next/server"

import { buildBillingConfigurationStatus } from "@/lib/isp/billing-integrity"
import { getIspBillingSettings } from "@/lib/isp/billing-queries"
import { requireIspBillingReadContext } from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const auth = await requireIspBillingReadContext()
  if (!auth.ok) return auth.response

  try {
    const client = await createClient()
    const settings = await getIspBillingSettings(client, auth.companyId)
    return NextResponse.json({
      success: true,
      status: buildBillingConfigurationStatus({ settings }),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo calcular el estado de la configuración fiscal.",
      },
      { status: 500 }
    )
  }
}
