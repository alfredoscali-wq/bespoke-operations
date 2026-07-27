import { NextResponse } from "next/server"

import { getSessionUser } from "@/lib/auth/session"
import type { AtencionClienteRouteContext } from "@/lib/customer-atenciones/consultation-management-route"
import {
  canAccessAtencionClienteModule,
  resolveAtencionClienteActorEmployeeId,
} from "@/lib/customer-atenciones/module-access"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Lookup commercial opportunity linked to an Atención consultation.
 * Uses admin client so Atención operators without gestion_comercial can still
 * see the OP code (opening the dossier still requires commercial module access).
 */
export async function GET(
  _request: Request,
  context: AtencionClienteRouteContext
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json(
      { success: false, message: "Debe iniciar sesión." },
      { status: 401 }
    )
  }

  if (!canAccessAtencionClienteModule(sessionUser)) {
    return NextResponse.json(
      {
        success: false,
        message: "No tiene permiso para operar Atención al Cliente.",
      },
      { status: 403 }
    )
  }

  const companyId = sessionUser.companyId
  if (!companyId) {
    return NextResponse.json(
      { success: false, message: "No se pudo resolver la compañía." },
      { status: 403 }
    )
  }

  // Keep actor resolution for parity with other Atención APIs (tenant binding).
  if (!resolveAtencionClienteActorEmployeeId(sessionUser)) {
    return NextResponse.json(
      {
        success: false,
        message: "No se pudo identificar al empleado autenticado.",
      },
      { status: 403 }
    )
  }

  const { atencionId } = await context.params
  if (!atencionId?.trim()) {
    return NextResponse.json(
      { success: false, message: "Consulta inválida." },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("commercial_opportunities")
    .select("id, code")
    .eq("company_id", companyId)
    .eq("source_atencion_id", atencionId.trim())
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    )
  }

  if (!data) {
    return NextResponse.json({
      success: true,
      opportunity: null,
    })
  }

  return NextResponse.json({
    success: true,
    opportunity: {
      id: data.id,
      code: data.code,
    },
  })
}
