import { NextResponse } from "next/server"

import { requireWritablePlatformSession } from "@/lib/auth/require-writable-platform-session"
import {
  canAccessAtencionClienteModule,
  resolveAtencionClienteActorEmployeeId,
} from "@/lib/customer-atenciones/module-access"
import type { ConsultationManagementServerResult } from "@/lib/customer-atenciones/consultation-management.server"

export type AtencionClienteRouteContext = {
  params: Promise<{ atencionId: string }>
}

export async function requireAtencionClienteMutationContext(): Promise<
  | {
      ok: true
      companyId: string
      employeeId: string
    }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireWritablePlatformSession()

  if (!auth.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: auth.message },
        { status: auth.status }
      ),
    }
  }

  if (!canAccessAtencionClienteModule(auth.sessionUser)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "No tiene permiso para operar Atención al Cliente.",
        },
        { status: 403 }
      ),
    }
  }

  const companyId = auth.sessionUser.companyId
  if (!companyId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "No se pudo resolver la compañía del usuario.",
        },
        { status: 403 }
      ),
    }
  }

  const employeeId = resolveAtencionClienteActorEmployeeId(auth.sessionUser)
  if (!employeeId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "No se pudo identificar al empleado autenticado.",
        },
        { status: 403 }
      ),
    }
  }

  return { ok: true, companyId, employeeId }
}

/** Admin-only mutation context for permanent consultation delete. */
export async function requireAtencionClienteAdminMutationContext(): Promise<
  | {
      ok: true
      companyId: string
      employeeId: string
    }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireWritablePlatformSession()

  if (!auth.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: auth.message },
        { status: auth.status }
      ),
    }
  }

  if (auth.sessionUser.systemRole !== "administrador") {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "Solo un Administrador puede eliminar consultas.",
          code: "CONSULTATION_DELETE_ADMIN_REQUIRED",
        },
        { status: 403 }
      ),
    }
  }

  if (!canAccessAtencionClienteModule(auth.sessionUser)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "No tiene permiso para operar Atención al Cliente.",
        },
        { status: 403 }
      ),
    }
  }

  const companyId = auth.sessionUser.companyId
  if (!companyId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "No se pudo resolver la compañía del usuario.",
        },
        { status: 403 }
      ),
    }
  }

  const employeeId = resolveAtencionClienteActorEmployeeId(auth.sessionUser)
  if (!employeeId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "No se pudo identificar al empleado autenticado.",
        },
        { status: 403 }
      ),
    }
  }

  return { ok: true, companyId, employeeId }
}

export function consultationManagementResultToResponse(
  result: ConsultationManagementServerResult
) {
  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        message: result.message,
        code: result.code,
      },
      { status: result.status }
    )
  }

  return NextResponse.json({
    success: true,
    atencionId: result.data.atencionId,
    previousStatus: result.data.previousStatus,
    newStatus: result.data.newStatus,
    previousNextStep: result.data.previousNextStep,
    newNextStep: result.data.newNextStep,
    idempotent: result.data.idempotent ?? false,
  })
}
