/**
 * OPS 2.2 — supervised edit of Obra OTs (project_id set) without planning/route side-effects.
 */

import {
  buildAuditFieldChanges,
  normalizeAuditValue,
  type AuditFieldChange,
} from "@/lib/audit/metadata-changes"
import { readMaterialsNeededFromTask } from "@/lib/tasks/work-order"
import {
  normalizeOperationalChecklistTemplate,
  readOperationalChecklistTemplate,
} from "@/lib/tasks/operational-checklist-template"
import type { UpdateTaskPayload } from "@/lib/types/supabase/tasks"
import type { Task, TaskStatus } from "@/lib/types/tasks"

/** Statuses editable from Obras > Órdenes de Trabajo (OPS 2.2). */
export const OBRAS_SUPERVISED_EDIT_STATUSES: readonly TaskStatus[] = [
  "borrador",
  "programada",
  "asignada",
  "en-curso",
] as const

const FIELD_LABELS: Partial<Record<keyof UpdateTaskPayload, string>> & {
  materialsNeeded: string
  checklist: string
} = {
  title: "título",
  description: "descripción",
  observationsForCrew: "observaciones para cuadrilla",
  priority: "prioridad",
  estimatedDuration: "duración estimada",
  startDate: "fecha inicio",
  dueDate: "fecha fin",
  latitude: "GPS latitud",
  longitude: "GPS longitud",
  sharedLocation: "GPS OT",
  crewId: "cuadrilla",
  crew: "cuadrilla (nombre)",
  supervisor: "supervisor",
  materialsNeeded: "materiales necesarios",
  checklist: "checklist",
}

export function buildProjectTaskSupervisedEditFieldChanges(
  before: Task,
  payload: UpdateTaskPayload,
  materialsNeeded?: string
): AuditFieldChange[] {
  const scalarFields: (keyof UpdateTaskPayload)[] = [
    "title",
    "description",
    "observationsForCrew",
    "priority",
    "estimatedDuration",
    "startDate",
    "dueDate",
    "latitude",
    "longitude",
    "sharedLocation",
    "crewId",
    "crew",
    "supervisor",
  ]

  const changes = buildAuditFieldChanges({
    before,
    updates: payload,
    fields: scalarFields.filter((field) => payload[field] !== undefined),
    labels: FIELD_LABELS,
  })

  if (materialsNeeded !== undefined) {
    const previous = normalizeAuditValue(readMaterialsNeededFromTask(before))
    const next = normalizeAuditValue(materialsNeeded.trim())
    if (previous !== next) {
      changes.push({
        campo: FIELD_LABELS.materialsNeeded,
        valor_anterior: previous,
        valor_nuevo: next,
      })
    }
  }

  if (payload.taskMetadata !== undefined) {
    const beforeChecklist = JSON.stringify(
      normalizeOperationalChecklistTemplate(
        readOperationalChecklistTemplate(before)
      )
    )
    const afterChecklist = JSON.stringify(
      normalizeOperationalChecklistTemplate(
        readOperationalChecklistTemplate({
          taskMetadata: payload.taskMetadata,
        } as Task)
      )
    )
    if (beforeChecklist !== afterChecklist) {
      changes.push({
        campo: FIELD_LABELS.checklist,
        valor_anterior: beforeChecklist === "[]" ? null : "definido",
        valor_nuevo: afterChecklist === "[]" ? null : "actualizado",
      })
    }
  }

  return changes
}

export function formatProjectTaskSupervisedEditHistoryNote(
  changes: AuditFieldChange[],
  options?: { actor?: string; at?: string }
): string | null {
  if (changes.length === 0) {
    return null
  }

  const actor = options?.actor?.trim() || "Usuario"
  const at = options?.at?.trim() || new Date().toISOString()
  const lines = changes.map(
    (change) =>
      `${change.campo}: "${change.valor_anterior ?? "—"}" → "${change.valor_nuevo ?? "—"}"`
  )

  return `Edición supervisada OT de Obra (${actor}, ${at}).\n${lines.join("\n")}`
}

/** Payload must not mutate identity, status, or route order fields. */
export function assertProjectTaskSupervisedEditPayloadSafe(
  payload: UpdateTaskPayload
): boolean {
  if (payload.status !== undefined) return false
  if (payload.projectId !== undefined) return false
  if (payload.customerId !== undefined) return false
  if (payload.type !== undefined) return false
  if (payload.executionOrder !== undefined) return false
  if (payload.dispatchOrder !== undefined) return false
  return true
}
