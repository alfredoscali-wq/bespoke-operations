import type { SupabaseClient } from "@supabase/supabase-js"

import { CUSTOMER_DELETE_BLOCKED_MESSAGE } from "@/lib/customers/customer-delete"
import type { Database } from "@/lib/supabase/database.types"

export type CustomerOperationalActivity = {
  taskCount: number
  evidenceCount: number
  photoCount: number
  projectCount: number
  hasActivity: boolean
}

export const CUSTOMER_EXCLUDE_BLOCKED_MESSAGE =
  "No se puede excluir el cliente porque ya posee actividad operativa en Bespoke. Utilice la opción Archivar."

export async function getCustomerOperationalActivity(
  client: SupabaseClient<Database>,
  customerId: string
): Promise<CustomerOperationalActivity> {
  const { data: tasks, error } = await client
    .from("tasks")
    .select("id, project_id")
    .eq("customer_id", customerId)
    .is("deleted_at", null)

  if (error || !tasks || tasks.length === 0) {
    return {
      taskCount: 0,
      evidenceCount: 0,
      photoCount: 0,
      projectCount: 0,
      hasActivity: false,
    }
  }

  const taskIds = tasks.map((task) => task.id)
  const projectCount = new Set(
    tasks
      .map((task) => task.project_id)
      .filter((projectId): projectId is string => Boolean(projectId))
  ).size

  const [evidenceResult, photoResult] = await Promise.all([
    client
      .from("evidences")
      .select("id", { count: "exact", head: true })
      .in("task_id", taskIds)
      .is("deleted_at", null),
    client
      .from("task_photos")
      .select("id", { count: "exact", head: true })
      .in("task_id", taskIds)
      .is("deleted_at", null),
  ])

  const taskCount = tasks.length
  const evidenceCount = evidenceResult.count ?? 0
  const photoCount = photoResult.count ?? 0

  return {
    taskCount,
    evidenceCount,
    photoCount,
    projectCount,
    hasActivity:
      taskCount > 0 ||
      evidenceCount > 0 ||
      photoCount > 0 ||
      projectCount > 0,
  }
}

export function formatCustomerActivitySummary(
  activity: CustomerOperationalActivity
): string {
  const parts: string[] = []

  if (activity.taskCount > 0) {
    parts.push(`${activity.taskCount} orden(es) de trabajo`)
  }
  if (activity.evidenceCount > 0) {
    parts.push(`${activity.evidenceCount} evidencia(s)`)
  }
  if (activity.photoCount > 0) {
    parts.push(`${activity.photoCount} fotografía(s)`)
  }
  if (activity.projectCount > 0) {
    parts.push(`${activity.projectCount} obra(s)`)
  }

  return parts.join(", ")
}

export function canExcludeCustomerFromOperations(
  activity: CustomerOperationalActivity
): { allowed: true } | { allowed: false; message: string } {
  if (activity.hasActivity) {
    return {
      allowed: false,
      message: `${CUSTOMER_EXCLUDE_BLOCKED_MESSAGE} (${formatCustomerActivitySummary(activity)}).`,
    }
  }

  return { allowed: true }
}

export function canDeleteCustomerWithActivity(
  activity: CustomerOperationalActivity
): { allowed: true } | { allowed: false; message: string } {
  if (activity.hasActivity) {
    return {
      allowed: false,
      message: CUSTOMER_DELETE_BLOCKED_MESSAGE,
    }
  }

  return { allowed: true }
}
