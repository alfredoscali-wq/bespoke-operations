import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  parseFinalizeProjectRpcResult,
  type FinalizeProjectResult,
} from "@/lib/projects/project-finalize"
import { logOperationError } from "@/lib/operations/user-messages"

export type FinalizeProjectServerResult =
  | { ok: true; data: FinalizeProjectResult }
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
    normalized.includes("órdenes de trabajo abiertas") ||
    normalized.includes("ordenes de trabajo abiertas") ||
    normalized.includes("activa o pausada")
  ) {
    return { status: 409, code: "VALIDATION" }
  }

  return { status: 400, code: "RPC_FAILED" }
}

export async function finalizeProjectOperational(input: {
  companyId: string
  projectId: string
  actorDisplayName: string
}): Promise<FinalizeProjectServerResult> {
  const admin = createAdminClient()

  const { data, error } = await (
    admin as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>
    }
  ).rpc("finalize_project_operational", {
    p_company_id: input.companyId,
    p_project_id: input.projectId,
    p_actor_display_name: input.actorDisplayName,
  })

  if (error) {
    logOperationError("PROJECT FINALIZE", error)
    const mapped = mapRpcErrorMessage(error.message || "")
    return {
      ok: false,
      status: mapped.status,
      message:
        error.message ||
        "No fue posible finalizar la obra. Intente nuevamente.",
      code: mapped.code,
    }
  }

  const parsed = parseFinalizeProjectRpcResult(data)
  if (!parsed) {
    return {
      ok: false,
      status: 500,
      message: "No fue posible finalizar la obra.",
      code: "RPC_EMPTY",
    }
  }

  return { ok: true, data: parsed }
}
