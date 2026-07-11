import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  parseStartProjectDispatchRpcResult,
  type StartProjectDispatchResult,
} from "@/lib/projects/project-start-dispatch"
import { logOperationError } from "@/lib/operations/user-messages"

export type StartProjectDispatchServerResult =
  | { ok: true; data: StartProjectDispatchResult }
  | { ok: false; status: number; message: string; code: string }

function mapRpcErrorMessage(message: string): { status: number; code: string } {
  const normalized = message.toLowerCase()

  if (normalized.includes("solo lectura") || normalized.includes("demostración")) {
    return { status: 403, code: "DEMO_READ_ONLY" }
  }

  if (normalized.includes("no encontrada")) {
    return { status: 404, code: "NOT_FOUND" }
  }

  if (
    normalized.includes("planificada") ||
    normalized.includes("no tiene tareas") ||
    normalized.includes("sin cuadrilla") ||
    normalized.includes("sin fecha") ||
    normalized.includes("no hay tareas programadas") ||
    normalized.includes("ubicación gps") ||
    normalized.includes("ubicacion gps")
  ) {
    return { status: 409, code: "VALIDATION" }
  }

  return { status: 400, code: "RPC_FAILED" }
}

export async function startProjectOperationalDispatch(input: {
  companyId: string
  projectId: string
  actorDisplayName: string
}): Promise<StartProjectDispatchServerResult> {
  const admin = createAdminClient()

  const { data, error } = await (
    admin as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    }
  ).rpc("start_project_operational_dispatch", {
    p_company_id: input.companyId,
    p_project_id: input.projectId,
    p_actor_display_name: input.actorDisplayName,
  })

  if (error) {
    logOperationError("PROJECT START DISPATCH", error)
    const mapped = mapRpcErrorMessage(error.message || "")
    return {
      ok: false,
      status: mapped.status,
      message:
        error.message ||
        "No fue posible iniciar la obra. Intente nuevamente.",
      code: mapped.code,
    }
  }

  const parsed = parseStartProjectDispatchRpcResult(data)
  if (!parsed) {
    return {
      ok: false,
      status: 500,
      message: "No fue posible iniciar la obra.",
      code: "RPC_EMPTY",
    }
  }

  return { ok: true, data: parsed }
}
