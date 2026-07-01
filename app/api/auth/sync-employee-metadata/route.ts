import { NextResponse } from "next/server"

import { syncEmployeeAuthMetadata } from "@/lib/auth/sync-employee-auth-metadata"
import { requireAdministratorSession } from "@/lib/auth/require-administrator"

export async function POST(request: Request) {
  const auth = await requireAdministratorSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  const body = (await request.json()) as { employeeId?: string }
  const employeeId = body.employeeId?.trim()

  if (!employeeId) {
    return NextResponse.json(
      { success: false, message: "employeeId es obligatorio." },
      { status: 400 }
    )
  }

  const result = await syncEmployeeAuthMetadata(employeeId)

  if (!result.success) {
    return NextResponse.json(
      { success: false, message: result.error },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
