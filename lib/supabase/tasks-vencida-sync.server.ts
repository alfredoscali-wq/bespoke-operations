import "server-only"

import { buildAuditDescription } from "@/lib/audit/build-audit-description"
import { writeAuditLog } from "@/lib/audit/audit-service"
import {
  buildTaskVencidaAuditMetadata,
  resolveTaskEntityLabel,
} from "@/lib/audit/tasks-audit-shared"
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
} from "@/lib/audit/types"
import { SYSTEM_AUDIT_ACTOR } from "@/lib/audit/system-actor"
import { patchTask } from "@/lib/supabase/tasks.queries"
import type { SupabaseTasksClient } from "@/lib/supabase/tasks.queries"
import { shouldAutoTransitionToVencida } from "@/lib/tasks/vencida-status"
import type { Task } from "@/lib/types/tasks"

export async function syncVencidaTasksWithAudit(
  client: SupabaseTasksClient,
  tasks: Task[]
): Promise<{ updatedTaskIds: string[]; tasks: Task[] }> {
  const candidates = tasks.filter(shouldAutoTransitionToVencida)

  if (candidates.length === 0) {
    return { updatedTaskIds: [], tasks }
  }

  const updatedById = new Map(tasks.map((task) => [task.id, task]))
  const updatedTaskIds: string[] = []

  for (const task of candidates) {
    const result = await patchTask(client, task.id, { status: "vencida" })

    if (result.error) {
      throw new Error(result.error.message)
    }

    const nextTask = result.data ?? { ...task, status: "vencida" as const }
    updatedById.set(task.id, nextTask)
    updatedTaskIds.push(task.id)

    const entityLabel = resolveTaskEntityLabel(task)

    try {
      await writeAuditLog(client, {
        module: AUDIT_MODULES.TAREAS,
        action: AUDIT_ACTIONS.TASK_STATUS_VENCIDA,
        entityType: AUDIT_ENTITY_TYPES.TASK,
        entityId: task.id,
        entityLabel,
        description: buildAuditDescription({
          action: AUDIT_ACTIONS.TASK_STATUS_VENCIDA,
          entityLabel,
        }),
        performedBy: SYSTEM_AUDIT_ACTOR,
        metadata: {
          ...buildTaskVencidaAuditMetadata(task),
          workflowAction: "auto-vencida",
        },
      })
    } catch (auditError) {
      console.error(
        "[TASK VENCIDA SYNC AUDIT]",
        auditError instanceof Error ? auditError.message : auditError
      )
    }
  }

  return {
    updatedTaskIds,
    tasks: [...updatedById.values()],
  }
}
