import type {
  ProjectDesignOtProposalRow,
  ProjectDesignOtProposalInsert,
  ProjectDesignOtProposalUpdate,
} from "@/lib/supabase/database.aliases"
import { parseProjectDesignGainMeters } from "@/lib/projects/design/gains"
import {
  isProjectDesignOtProposalStatus,
  isProjectDesignOtWorkType,
} from "@/lib/projects/design/ot-proposals"
import {
  normalizeOperationalChecklistTemplate,
  readOperationalChecklistTemplate,
} from "@/lib/tasks/operational-checklist-template"
import type {
  CreateProjectDesignOtProposalInput,
  ProjectDesignOtProposal,
  UpdateProjectDesignOtProposalInput,
} from "@/lib/types/project-design-ot"
import type { ProjectDesignElementKind } from "@/lib/types/project-design"
import type { TaskPriority } from "@/lib/types/tasks"

function mapNumeric(value: number | string | null): number | null {
  if (value == null) return null
  const parsed = typeof value === "number" ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isElementKind(value: string): value is ProjectDesignElementKind {
  return value === "node" || value === "nap"
}

function isPriority(value: string | null): value is TaskPriority {
  return value === "alta" || value === "media" || value === "baja"
}

export function mapProjectDesignOtProposalRow(
  row: ProjectDesignOtProposalRow
): ProjectDesignOtProposal {
  if (!isElementKind(row.source_element_kind)) {
    throw new Error("PROJECT_DESIGN_OT_SOURCE_KIND_INVALID")
  }
  if (!isProjectDesignOtWorkType(row.work_type)) {
    throw new Error("PROJECT_DESIGN_OT_WORK_TYPE_INVALID")
  }
  if (!isProjectDesignOtProposalStatus(row.status)) {
    throw new Error("PROJECT_DESIGN_OT_STATUS_INVALID")
  }

  return {
    id: row.id,
    companyId: row.company_id,
    projectId: row.project_id,
    sourceElementId: row.source_element_id,
    sourceElementKind: row.source_element_kind,
    status: row.status,
    title: row.title,
    workType: row.work_type,
    priority: isPriority(row.priority) ? row.priority : null,
    crewId: row.crew_id,
    startDate: row.start_date,
    dueDate: row.due_date,
    latitude: mapNumeric(row.latitude),
    longitude: mapNumeric(row.longitude),
    observations: row.observations?.trim() ?? "",
    designName: row.design_name?.trim() ?? "",
    designColor: row.design_color?.trim() ?? "",
    designIcon: row.design_icon?.trim() ?? "",
    designGainM: parseProjectDesignGainMeters(row.design_gain_m ?? 0) ?? 0,
    operationalChecklistTemplate: readOperationalChecklistTemplate({
      taskMetadata: {
        operationalChecklistTemplate: row.operational_checklist_template,
      },
    }),
    taskId: row.task_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapCreateProposalToInsert(
  input: CreateProjectDesignOtProposalInput
): ProjectDesignOtProposalInsert {
  return {
    company_id: input.companyId,
    project_id: input.projectId,
    source_element_id: input.sourceElementId,
    source_element_kind: input.sourceElementKind,
    status: input.status ?? "draft",
    title: input.title.trim(),
    work_type: input.workType,
    priority: input.priority ?? null,
    crew_id: input.crewId?.trim() || null,
    start_date: input.startDate?.trim() || null,
    due_date: input.dueDate?.trim() || null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    observations: input.observations?.trim() || null,
    design_name: input.designName?.trim() || null,
    design_color: input.designColor?.trim() || null,
    design_icon: input.designIcon?.trim() || null,
    design_gain_m: parseProjectDesignGainMeters(input.designGainM ?? 0) ?? 0,
    operational_checklist_template: normalizeOperationalChecklistTemplate(
      input.operationalChecklistTemplate ?? []
    ),
  }
}

export function mapUpdateProposalToUpdate(
  input: UpdateProjectDesignOtProposalInput
): ProjectDesignOtProposalUpdate {
  const update: ProjectDesignOtProposalUpdate = {}
  if (input.title !== undefined) update.title = input.title.trim()
  if (input.workType !== undefined) update.work_type = input.workType
  if (input.priority !== undefined) update.priority = input.priority
  if (input.crewId !== undefined) update.crew_id = input.crewId?.trim() || null
  if (input.startDate !== undefined) {
    update.start_date = input.startDate?.trim() || null
  }
  if (input.dueDate !== undefined) {
    update.due_date = input.dueDate?.trim() || null
  }
  if (input.latitude !== undefined) update.latitude = input.latitude
  if (input.longitude !== undefined) update.longitude = input.longitude
  if (input.observations !== undefined) {
    update.observations = input.observations.trim() || null
  }
  if (input.status !== undefined) update.status = input.status
  if (input.taskId !== undefined) update.task_id = input.taskId
  if (input.operationalChecklistTemplate !== undefined) {
    update.operational_checklist_template =
      normalizeOperationalChecklistTemplate(input.operationalChecklistTemplate)
  }
  return update
}
