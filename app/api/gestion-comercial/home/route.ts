import { NextResponse } from "next/server"

import {
  fetchCommercialHomeDesk,
  resolveCommercialGreeting,
} from "@/lib/commercial/home-desk"
import { requireGestionComercialReadContext } from "@/lib/commercial/route-context"

export async function GET() {
  const auth = await requireGestionComercialReadContext()
  if (!auth.ok) return auth.response

  try {
    const desk = await fetchCommercialHomeDesk(auth.companyId, {
      assignedEmployeeId: auth.employeeId,
    })

    return NextResponse.json({
      success: true,
      greeting: resolveCommercialGreeting(),
      displayName: auth.sessionUser.displayName,
      desk,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el inicio comercial.",
      },
      { status: 500 }
    )
  }
}
