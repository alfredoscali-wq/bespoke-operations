import { NextResponse } from "next/server"

import {
  billingRunPrepareMessage,
  BillingRunConflictError,
  listIspBillingRuns,
  prepareIspBillingRun,
} from "@/lib/isp/billing-run-queries"
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
    const items = await listIspBillingRuns(client, auth.companyId)
    return NextResponse.json({ success: true, items })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las corridas.",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const auth = await requireIspBillingWriteContext()
  if (!auth.ok) return auth.response

  let body: { year?: number; month?: number; companyId?: string }
  try {
    body = (await request.json()) as { year?: number; month?: number; companyId?: string }
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    const detail = await prepareIspBillingRun(client, auth.companyId, {
      year: Number(body.year),
      month: Number(body.month),
      companyId: body.companyId,
      createdBy: auth.sessionUser.authUserId,
    })
    return NextResponse.json({
      success: true,
      message: billingRunPrepareMessage(),
      run: detail.run,
      detail,
    })
  } catch (error) {
    if (error instanceof BillingRunConflictError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          run: error.run,
        },
        { status: 409 }
      )
    }
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo preparar la facturación.",
      },
      { status: 400 }
    )
  }
}
