import "server-only"

import { NextResponse } from "next/server"

import {
  jsonFromSessionAuthFailure,
  requireLoadedPasswordCompliantSession,
} from "@/lib/auth/require-password-compliant-session"
import { getSessionUser } from "@/lib/auth/session"
import { canAccessObrasModuleForStart } from "@/lib/projects/obra-task-insert-integrity"
import type { SessionUser } from "@/lib/auth/types"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/lib/supabase/database.types"
import type { SupabaseClient } from "@supabase/supabase-js"

export type ObraWorkReportSession = {
  sessionUser: SessionUser
  companyId: string
  projectId: string
  client: SupabaseClient<Database>
}

export async function requireObraWorkReportSession(
  projectIdRaw: string | undefined
): Promise<
  | { ok: true; value: ObraWorkReportSession }
  | { ok: false; response: NextResponse }
> {
  const loaded = requireLoadedPasswordCompliantSession(
    await getSessionUser(),
    "Debe iniciar sesión para operar el informe."
  )
  if (!loaded.ok) {
    return { ok: false, response: loaded.response }
  }

  if (!canAccessObrasModuleForStart(loaded.sessionUser)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          message: "No tiene permiso para operar el módulo Obras.",
        },
        { status: 403 }
      ),
    }
  }

  const companyId = loaded.sessionUser.companyId?.trim() ?? ""
  if (!companyId) {
    return {
      ok: false,
      response: jsonFromSessionAuthFailure({
        status: 403,
        message: "No se pudo resolver la compañía del usuario.",
      }),
    }
  }

  const projectId = projectIdRaw?.trim() ?? ""
  if (!projectId) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Obra no encontrada." },
        { status: 404 }
      ),
    }
  }

  const client = await createClient()
  const projectQuery = await client
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle()

  if (projectQuery.error || !projectQuery.data) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Obra no encontrada." },
        { status: 404 }
      ),
    }
  }

  return {
    ok: true,
    value: {
      sessionUser: loaded.sessionUser,
      companyId,
      projectId,
      client,
    },
  }
}
