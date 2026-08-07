import { NextResponse } from "next/server"

import { isDemoPlatformReadOnlyUser } from "@/lib/demo/demo-mode"
import { DEMO_RESTRICTED_DIALOG_MESSAGE } from "@/lib/demo/constants"
import { runWithAuthSyncPerf } from "@/lib/auth/performance/auth-sync-profiler"
import { getSessionUserWithAuthSyncContext } from "@/lib/auth/session"
import { syncEmployeeAuthMetadata } from "@/lib/auth/sync-employee-auth-metadata"

export async function POST() {
  return runWithAuthSyncPerf(async () => {
    // Sprint 30.0 — load employee/role once, then reuse for metadata sync.
    const loaded = await getSessionUserWithAuthSyncContext()

    if (!loaded) {
      return NextResponse.json(
        {
          success: false,
          message: "Debe iniciar sesión para realizar esta acción.",
        },
        { status: 401 }
      )
    }

    if (isDemoPlatformReadOnlyUser(loaded.sessionUser)) {
      return NextResponse.json(
        { success: false, message: DEMO_RESTRICTED_DIALOG_MESSAGE },
        { status: 403 }
      )
    }

    if (!loaded.sessionUser.employeeId?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "No se pudo resolver el empleado de la sesión.",
        },
        { status: 403 }
      )
    }

    const result = await syncEmployeeAuthMetadata(loaded.context)

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  })
}
