import { NextResponse } from "next/server"

import { ISP_BILLING_SAVED_MESSAGE } from "@/lib/isp/billing-constants"
import { emptyBillingDraft, settingsToDraft } from "@/lib/isp/billing-integrity"
import {
  getIspBillingSettings,
  upsertIspBillingSettings,
} from "@/lib/isp/billing-queries"
import type { IspBillingCompanySettingsDraft } from "@/lib/isp/billing-types"
import {
  requireIspBillingReadContext,
  requireIspBillingWriteContext,
} from "@/lib/isp/route-context"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const auth = await requireIspBillingReadContext()
  if (!auth.ok) return auth.response

  try {
    const client = await createClient()
    const settings = await getIspBillingSettings(client, auth.companyId)
    return NextResponse.json({
      success: true,
      settings,
      draft: settingsToDraft(settings),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar la configuración fiscal.",
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  return saveSettings(request)
}

export async function POST(request: Request) {
  return saveSettings(request)
}

async function saveSettings(request: Request) {
  const auth = await requireIspBillingWriteContext()
  if (!auth.ok) return auth.response

  let body: IspBillingCompanySettingsDraft & { companyId?: string }
  try {
    body = (await request.json()) as IspBillingCompanySettingsDraft & {
      companyId?: string
    }
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const draft: IspBillingCompanySettingsDraft = {
    ...emptyBillingDraft(),
    ...body,
    templateSettings:
      body.templateSettings ?? emptyBillingDraft().templateSettings,
    pointOfSale: {
      ...emptyBillingDraft().pointOfSale,
      ...body.pointOfSale,
    },
    sequences: body.sequences?.length
      ? body.sequences
      : emptyBillingDraft().sequences,
  }

  try {
    const client = await createClient()
    const settings = await upsertIspBillingSettings(
      client,
      auth.companyId,
      draft,
      body.companyId
    )
    return NextResponse.json({
      success: true,
      message: ISP_BILLING_SAVED_MESSAGE,
      settings,
      draft: settingsToDraft(settings),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la configuración fiscal.",
      },
      { status: 400 }
    )
  }
}
