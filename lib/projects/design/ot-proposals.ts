import { hasCoordinates } from "@/lib/gps/coordinates"
import { parseProjectDesignGainMeters } from "@/lib/projects/design/gains"
import { formatProjectDesignKindLabel } from "@/lib/projects/design/labels"
import {
  mergeTaskMetadataWithTemplate,
  normalizeOperationalChecklistTemplate,
} from "@/lib/tasks/operational-checklist-template"
import type { Project, ProjectType } from "@/lib/types/projects"
import { normalizeTendidoSegmentIds } from "@/lib/projects/design/tendido"
import type {
  CreateProjectDesignOtProposalInput,
  ProjectDesignElementSourceMetadata,
  ProjectDesignOtGeneratableWorkType,
  ProjectDesignOtProposal,
  ProjectDesignOtProposalStatus,
  ProjectDesignOtWorkType,
  ProjectDesignSourceMetadata,
  ProjectDesignTaskCreateSnapshot,
  UpdateProjectDesignOtProposalInput,
} from "@/lib/types/project-design-ot"
import {
  PROJECT_DESIGN_OT_GENERATABLE_WORK_TYPES,
  PROJECT_DESIGN_OT_PROPOSAL_STATUSES,
  PROJECT_DESIGN_OT_WORK_TYPES,
  PROJECT_DESIGN_SOURCE_METADATA_KEY,
  PROJECT_DESIGN_WORK_TYPE_METADATA_KEY,
} from "@/lib/types/project-design-ot"
import type { ProjectDesignElement } from "@/lib/types/project-design"
import type { TaskType } from "@/lib/types/tasks"

export {
  PROJECT_DESIGN_SOURCE_METADATA_KEY,
  PROJECT_DESIGN_WORK_TYPE_METADATA_KEY,
} from "@/lib/types/project-design-ot"

const ACTIVE_PROPOSAL_STATUSES: ProjectDesignOtProposalStatus[] = [
  "draft",
  "ready",
  "created",
]

export function isProjectDesignOtWorkType(
  value: unknown
): value is ProjectDesignOtWorkType {
  return (
    typeof value === "string" &&
    (PROJECT_DESIGN_OT_WORK_TYPES as readonly string[]).includes(value)
  )
}

export function isProjectDesignOtGeneratableWorkType(
  value: unknown
): value is ProjectDesignOtGeneratableWorkType {
  return (
    typeof value === "string" &&
    (PROJECT_DESIGN_OT_GENERATABLE_WORK_TYPES as readonly string[]).includes(
      value
    )
  )
}

export function isProjectDesignOtProposalStatus(
  value: unknown
): value is ProjectDesignOtProposalStatus {
  return (
    typeof value === "string" &&
    (PROJECT_DESIGN_OT_PROPOSAL_STATUSES as readonly string[]).includes(value)
  )
}

export function isActiveProjectDesignOtProposalStatus(
  status: ProjectDesignOtProposalStatus
): boolean {
  return ACTIVE_PROPOSAL_STATUSES.includes(status)
}

export function isPendingProjectDesignOtProposalStatus(
  status: ProjectDesignOtProposalStatus
): boolean {
  return status === "draft" || status === "ready"
}

export function buildProjectDesignOtProposalTitle(
  kind: ProjectDesignOtGeneratableWorkType,
  identifier: string
): string {
  const name = identifier.trim() || formatProjectDesignKindLabel(kind)
  if (kind === "nap") {
    return `Instalación NAP ${name}`
  }
  return `Instalación Node ${name}`
}

export function formatProjectDesignOtWorkTypeLabel(
  workType: ProjectDesignOtWorkType
): string {
  if (workType === "nap") return "NAP"
  if (workType === "node") return "Node"
  if (workType === "tendido") return "Tendido"
  if (workType === "drop") return "Drop"
  return "Otro"
}

export function formatProjectDesignOtProposalStatusLabel(
  status: ProjectDesignOtProposalStatus
): string {
  if (status === "ready") return "Lista"
  if (status === "created") return "OT creada"
  if (status === "cancelled") return "Cancelada"
  return "Borrador"
}

export function findActiveProposalForElement(
  proposals: Pick<
    ProjectDesignOtProposal,
    "sourceElementId" | "status"
  >[],
  elementId: string
): Pick<ProjectDesignOtProposal, "sourceElementId" | "status"> | undefined {
  return proposals.find(
    (proposal) =>
      proposal.sourceElementId === elementId &&
      isActiveProjectDesignOtProposalStatus(proposal.status)
  )
}

export function planProjectDesignOtProposals(input: {
  companyId: string
  projectId: string
  elements: Array<
    Pick<
      ProjectDesignElement,
      | "id"
      | "kind"
      | "name"
      | "latitude"
      | "longitude"
      | "color"
      | "icon"
      | "gainM"
    >
  >
  existing: Array<Pick<ProjectDesignOtProposal, "sourceElementId" | "status">>
}): {
  nodeNew: number
  napNew: number
  reused: number
  payloads: CreateProjectDesignOtProposalInput[]
} {
  let nodeNew = 0
  let napNew = 0
  let reused = 0
  const payloads: CreateProjectDesignOtProposalInput[] = []

  for (const element of input.elements) {
    if (!isProjectDesignOtGeneratableWorkType(element.kind)) {
      continue
    }

    if (findActiveProposalForElement(input.existing, element.id)) {
      reused += 1
      continue
    }

    payloads.push(buildProposalFromDesignElement(input.companyId, input.projectId, element))
    if (element.kind === "nap") {
      napNew += 1
    } else {
      nodeNew += 1
    }
  }

  return { nodeNew, napNew, reused, payloads }
}

export function buildProposalFromDesignElement(
  companyId: string,
  projectId: string,
  element: Pick<
    ProjectDesignElement,
    | "id"
    | "kind"
    | "name"
    | "latitude"
    | "longitude"
    | "color"
    | "icon"
    | "gainM"
  >
): CreateProjectDesignOtProposalInput {
  const kind = element.kind as ProjectDesignOtGeneratableWorkType
  return {
    companyId,
    projectId,
    sourceElementId: element.id,
    sourceElementKind: element.kind,
    title: buildProjectDesignOtProposalTitle(kind, element.name),
    workType: kind,
    latitude: element.latitude,
    longitude: element.longitude,
    designName: element.name,
    designColor: element.color,
    designIcon: element.icon,
    designGainM: parseProjectDesignGainMeters(element.gainM ?? 0) ?? 0,
    status: "draft",
    operationalChecklistTemplate: [],
  }
}

export function listProposalCreateMissingFields(
  proposal: Pick<
    ProjectDesignOtProposal,
    "title" | "crewId" | "startDate" | "dueDate" | "status" | "taskId"
  >
): string[] {
  const missing: string[] = []
  if (!proposal.title.trim()) missing.push("título")
  if (!proposal.crewId?.trim()) missing.push("cuadrilla")
  if (!proposal.startDate?.trim()) missing.push("fecha de inicio")
  return missing
}

export function validateProposalForObraTaskCreate(
  proposal: Pick<
    ProjectDesignOtProposal,
    "title" | "crewId" | "startDate" | "dueDate" | "status" | "taskId"
  >
): { ok: true } | { ok: false; message: string; missing: string[] } {
  if (proposal.status === "cancelled") {
    return {
      ok: false,
      message: "Esta preliminar está cancelada.",
      missing: [],
    }
  }

  if (proposal.status === "created" || proposal.taskId) {
    return {
      ok: false,
      message: "Esta preliminar ya tiene una OT creada.",
      missing: [],
    }
  }

  const missing = listProposalCreateMissingFields(proposal)
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Falta completar: ${missing.join(", ")}.`,
      missing,
    }
  }

  const startDate = proposal.startDate?.trim() ?? ""
  const dueDate = proposal.dueDate?.trim() ?? ""
  if (dueDate && startDate && dueDate < startDate) {
    return {
      ok: false,
      message: "La fecha de vencimiento no puede ser anterior a la fecha de inicio.",
      missing: [],
    }
  }

  return { ok: true }
}

export function resolveProposalStatusAfterEdit(
  proposal: Pick<
    ProjectDesignOtProposal,
    "title" | "crewId" | "startDate" | "dueDate" | "status" | "taskId"
  >
): ProjectDesignOtProposalStatus {
  if (proposal.status === "created" || proposal.taskId) {
    return "created"
  }
  if (proposal.status === "cancelled") {
    return "cancelled"
  }
  return listProposalCreateMissingFields(proposal).length === 0 ? "ready" : "draft"
}

export function canCreateObraTaskFromProposal(
  proposal: Pick<
    ProjectDesignOtProposal,
    "title" | "crewId" | "startDate" | "dueDate" | "status" | "taskId"
  >
): boolean {
  return validateProposalForObraTaskCreate(proposal).ok
}

export function canCancelProjectDesignOtProposal(
  proposal: Pick<ProjectDesignOtProposal, "status">
): boolean {
  return proposal.status === "draft" || proposal.status === "ready"
}

export function buildCreatedProposalPatch(
  taskId: string
): UpdateProjectDesignOtProposalInput {
  return {
    status: "created",
    taskId: taskId.trim(),
  }
}

export function buildProjectDesignSourceMetadata(
  proposal: Pick<
    ProjectDesignOtProposal,
    "id" | "sourceElementId" | "sourceElementKind" | "designName" | "designGainM" | "workType"
  >
): ProjectDesignElementSourceMetadata {
  const kind: ProjectDesignOtGeneratableWorkType =
    proposal.sourceElementKind === "nap" || proposal.workType === "nap"
      ? "nap"
      : "node"

  return {
    kind,
    elementId: proposal.sourceElementId,
    proposalId: proposal.id,
    identifier: proposal.designName.trim() || proposal.sourceElementId,
    plannedGainM: parseProjectDesignGainMeters(proposal.designGainM) ?? 0,
  }
}

export function mergeProjectDesignSourceIntoMetadata(
  existing: Record<string, unknown> | undefined,
  proposal: Pick<
    ProjectDesignOtProposal,
    "id" | "sourceElementId" | "sourceElementKind" | "designName" | "designGainM" | "workType"
  >
): Record<string, unknown> {
  const source = buildProjectDesignSourceMetadata(proposal)
  return {
    ...(existing ?? {}),
    [PROJECT_DESIGN_SOURCE_METADATA_KEY]: source,
    [PROJECT_DESIGN_WORK_TYPE_METADATA_KEY]: source.kind,
  }
}

export function readProjectDesignSourceMetadata(
  metadata: Record<string, unknown> | undefined
): ProjectDesignSourceMetadata | null {
  const raw = metadata?.[PROJECT_DESIGN_SOURCE_METADATA_KEY]
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null
  }
  const record = raw as Record<string, unknown>
  if (record.kind === "segments") {
    const segmentIds = normalizeTendidoSegmentIds(
      Array.isArray(record.segmentIds) ? record.segmentIds : []
    )
    if (segmentIds.length === 0) {
      return null
    }
    return { kind: "segments", segmentIds }
  }
  if (!isProjectDesignOtGeneratableWorkType(record.kind)) {
    return null
  }
  const elementId = typeof record.elementId === "string" ? record.elementId : ""
  const proposalId = typeof record.proposalId === "string" ? record.proposalId : ""
  const identifier = typeof record.identifier === "string" ? record.identifier : ""
  const plannedGainM = parseProjectDesignGainMeters(record.plannedGainM) ?? 0
  if (!elementId || !proposalId) {
    return null
  }
  return {
    kind: record.kind,
    elementId,
    proposalId,
    identifier,
    plannedGainM,
  }
}

function projectTypeToTaskType(type: ProjectType): TaskType {
  return type
}

export function buildObraTaskCreatePayloadFromProposal(input: {
  project: Pick<Project, "id" | "code" | "name" | "type" | "status">
  proposal: ProjectDesignOtProposal
  crewName: string
  supervisor: string
}):
  | { ok: true; payload: ProjectDesignTaskCreateSnapshot; status: "programada" }
  | { ok: false; message: string; missing: string[] } {
  const validation = validateProposalForObraTaskCreate(input.proposal)
  if (!validation.ok) {
    return validation
  }

  const hasGps = hasCoordinates(input.proposal.latitude, input.proposal.longitude)
  const template = normalizeOperationalChecklistTemplate(
    input.proposal.operationalChecklistTemplate ?? []
  )

  return {
    ok: true,
    status: "programada",
    payload: {
      projectId: input.project.id,
      projectCode: input.project.code,
      projectName: input.project.name,
      title: input.proposal.title.trim(),
      description: "",
      observationsForCrew: input.proposal.observations.trim(),
      type: projectTypeToTaskType(input.project.type),
      priority: input.proposal.priority ?? "media",
      supervisor: input.supervisor.trim(),
      crewId: input.proposal.crewId!.trim(),
      crew: input.crewName.trim(),
      startDate: input.proposal.startDate!,
      dueDate: input.proposal.dueDate?.trim() || "",
      estimatedDuration: "",
      latitude: hasGps ? (input.proposal.latitude as number) : undefined,
      longitude: hasGps ? (input.proposal.longitude as number) : undefined,
      checklist: [],
      operationalChecklistTemplate: template,
      taskMetadata: mergeTaskMetadataWithTemplate(
        {
          taskMetadata: mergeProjectDesignSourceIntoMetadata({}, input.proposal),
        },
        template
      ),
    },
  }
}

export function buildProposalEditPatch(
  current: Pick<
    ProjectDesignOtProposal,
    | "title"
    | "crewId"
    | "startDate"
    | "dueDate"
    | "status"
    | "taskId"
    | "workType"
    | "priority"
    | "latitude"
    | "longitude"
    | "observations"
  >,
  patch: UpdateProjectDesignOtProposalInput
): UpdateProjectDesignOtProposalInput {
  const merged = {
    title: patch.title ?? current.title,
    crewId: patch.crewId === undefined ? current.crewId : patch.crewId,
    startDate: patch.startDate === undefined ? current.startDate : patch.startDate,
    dueDate: patch.dueDate === undefined ? current.dueDate : patch.dueDate,
    status: current.status,
    taskId: patch.taskId === undefined ? current.taskId : patch.taskId,
  }
  const nextStatus = resolveProposalStatusAfterEdit(merged)

  return {
    ...patch,
    status:
      current.status === "created" || current.status === "cancelled"
        ? current.status
        : nextStatus,
  }
}
