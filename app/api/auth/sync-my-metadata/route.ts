import { NextResponse } from "next/server"

import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import { syncEmployeeAuthMetadata } from "@/lib/auth/sync-employee-auth-metadata"

export async function POST() {
  const auth = await requireWritablePlatformSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  const employeeId = auth.sessionUser.employeeId?.trim()

  if (!employeeId) {
    return NextResponse.json(
      {
        success: false,
        message: "No se pudo resolver el empleado de la sesión.",
      },
      { status: 403 }
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
