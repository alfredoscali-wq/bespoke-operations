import { NextResponse } from "next/server"

import { CommercialActivityService } from "@/lib/commercial/services"
import { requireGestionComercialReadContext } from "@/lib/commercial/route-context"

export async function GET() {
  const auth = await requireGestionComercialReadContext()
  if (!auth.ok) return auth.response

  const result = await new CommercialActivityService().listTypes()
  if (result.error) {
    return NextResponse.json(
      { success: false, message: result.error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, types: result.data })
}
