import { NextResponse } from "next/server"

import { canCreateIspGraph } from "@/lib/isp/integrity"
import { createIspOnboarding } from "@/lib/isp/queries"
import { requireIspWriteContext } from "@/lib/isp/route-context"
import type { IspOnboardingPayload } from "@/lib/isp/types"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const auth = await requireIspWriteContext()
  if (!auth.ok) return auth.response

  let payload: IspOnboardingPayload
  try {
    payload = (await request.json()) as IspOnboardingPayload
  } catch {
    return NextResponse.json(
      { success: false, message: "Cuerpo JSON inválido." },
      { status: 400 }
    )
  }

  const graph = canCreateIspGraph({
    customerId: payload.existingCustomerId,
    createCustomer: !payload.existingCustomerId,
    createService: payload.includeService,
    createConnection: payload.includeConnection,
  })
  if (!graph.allowed) {
    return NextResponse.json(
      { success: false, message: graph.message },
      { status: 400 }
    )
  }

  try {
    const client = await createClient()
    const result = await createIspOnboarding(client, payload)
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo completar el alta ISP.",
      },
      { status: 400 }
    )
  }
}
