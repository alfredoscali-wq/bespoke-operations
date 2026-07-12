import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import {
  WORK_ORDER_ADMIN_MUTATION_BLOCKED_MESSAGE,
} from "@/lib/tasks/work-order-admin-mutation"
import { logOperationError } from "@/lib/operations/user-messages"
import type { SessionUser } from "@/lib/auth/session"

export type DeleteTaskReferencePhotoServerResult =
  | { ok: true }
  | { ok: false; status: number; message: string; code: string }

type AdminRpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>
}

function assertWritableAdminRole(sessionUser: SessionUser): void {
  if (sessionUser.systemRole === "operario") {
    throw new Error("OPERARIO_FORBIDDEN")
  }
}

function mapRpcErrorMessage(message: string): {
  status: number
  code: string
  message: string
} {
  const normalized = message.toLowerCase()

  if (normalized.includes("solo lectura") || normalized.includes("demostracion")) {
    return {
      status: 403,
      code: "DEMO_READ_ONLY",
      message,
    }
  }

  if (normalized.includes("no se encontro") || normalized.includes("no encontr")) {
    return {
      status: 404,
      code: "NOT_FOUND",
      message:
        message ||
        "No se encontro la fotografia de referencia o la OT no admite esta accion.",
    }
  }

  if (
    normalized.includes("circuito operativo") ||
    normalized.includes("programada")
  ) {
    return {
      status: 409,
      code: "VALIDATION",
      message: WORK_ORDER_ADMIN_MUTATION_BLOCKED_MESSAGE,
    }
  }

  return {
    status: 400,
    code: "RPC_FAILED",
    message: message || "No se pudo eliminar la fotografia de referencia.",
  }
}

export async function deleteTaskReferencePhotoFromAdmin(input: {
  companyId: string
  taskId: string
  photoId: string
  sessionUser: SessionUser
}): Promise<DeleteTaskReferencePhotoServerResult> {
  try {
    assertWritableAdminRole(input.sessionUser)
  } catch {
    return {
      ok: false,
      status: 403,
      message:
        "Su perfil no puede eliminar fotografias de referencia desde administracion.",
      code: "FORBIDDEN",
    }
  }

  const admin = createAdminClient()

  const { data, error } = await (admin as unknown as AdminRpcClient).rpc(
    "soft_delete_task_reference_photo",
    {
      p_company_id: input.companyId,
      p_task_id: input.taskId,
      p_photo_id: input.photoId,
    }
  )

  if (error) {
    logOperationError("TASK REFERENCE PHOTO DELETE", error)
    const mapped = mapRpcErrorMessage(error.message || "")
    return {
      ok: false,
      status: mapped.status,
      message: mapped.message,
      code: mapped.code,
    }
  }

  if (!data || typeof data !== "object") {
    return {
      ok: false,
      status: 500,
      message: "No se pudo eliminar la fotografia de referencia.",
      code: "RPC_EMPTY",
    }
  }

  return { ok: true }
}
