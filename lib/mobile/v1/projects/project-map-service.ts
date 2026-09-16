import "server-only"

import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { mapMobileProjectDesignMap } from "@/lib/mobile/v1/projects/map-project-design"
import {
  resolveMobileProjectMapBinding,
  throwMobileProjectMapNotFound,
} from "@/lib/mobile/v1/projects/project-map-access"
import type { MobileProjectDesignMapDto } from "@/lib/mobile/v1/projects/types"
import { assertMobileTaskExecutionAccess } from "@/lib/mobile/v1/tasks/task-execution-access"
import { fetchProjectDesignSnapshot } from "@/lib/supabase/project-design.queries"
import type { SupabaseClient } from "@supabase/supabase-js"

async function fetchProjectNameForCompany(
  client: SupabaseClient,
  companyId: string,
  projectId: string
): Promise<string | null> {
  const { data, error } = await client
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data?.id) {
    return null
  }

  return typeof data.name === "string" ? data.name.trim() : ""
}

export async function getMobileProjectMap(
  auth: MobileAuthContext,
  projectId: string,
  taskId: string,
  deviceId: string
): Promise<MobileProjectDesignMapDto> {
  const context = await assertMobileTaskExecutionAccess(auth, taskId, deviceId)
  const binding = resolveMobileProjectMapBinding({
    taskProjectId: context.task.projectId,
    pathProjectId: projectId,
  })
  if (!binding.ok) {
    throwMobileProjectMapNotFound()
  }

  const projectName = await fetchProjectNameForCompany(
    context.admin,
    context.auth.companyId,
    binding.projectId
  )
  if (projectName == null) {
    throwMobileProjectMapNotFound()
  }

  const snapshot = await fetchProjectDesignSnapshot(
    context.admin,
    context.auth.companyId,
    binding.projectId
  )
  if (snapshot.error || !snapshot.data) {
    if (snapshot.error?.code === "NOT_FOUND") {
      throwMobileProjectMapNotFound()
    }
    throw new MobileApiError(
      "INTERNAL_ERROR",
      "No se pudo obtener el diseño de la obra.",
      500
    )
  }

  return mapMobileProjectDesignMap({
    projectId: binding.projectId,
    projectName: projectName || context.task.projectName?.trim() || "Obra",
    snapshot: snapshot.data,
  })
}
