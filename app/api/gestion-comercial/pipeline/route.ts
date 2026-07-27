import { NextResponse } from "next/server"

import { fetchCommercialPipelineCards } from "@/lib/commercial/pipeline-data"
import { requireGestionComercialReadContext } from "@/lib/commercial/route-context"

export async function GET() {
  const auth = await requireGestionComercialReadContext()
  if (!auth.ok) return auth.response

  try {
    const cards = await fetchCommercialPipelineCards(auth.companyId)
    return NextResponse.json({ success: true, cards })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el pipeline.",
      },
      { status: 500 }
    )
  }
}
