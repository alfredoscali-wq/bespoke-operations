import { TASK_STATUS_LABELS, TASK_TYPE_LABELS } from "@/lib/tasks/constants"
import { readTrabajoRealizadoFromTask } from "@/lib/tasks/trabajo-realizado"
import type { Project } from "@/lib/types/projects"
import type { Task } from "@/lib/types/tasks"

import { buildProjectWorkReportChecklistItems } from "@/lib/projects/work-report/checklist"
import {
  formatProjectWorkReportDate,
  formatProjectWorkReportDateTime,
  formatProjectWorkReportGeneratedAt,
  formatProjectWorkReportIncludedCount,
  formatProjectWorkReportPeriod,
  hexToRgb,
} from "@/lib/projects/work-report/format"
import {
  buildProjectWorkReportFilterNote,
  PROJECT_WORK_REPORT_SECTIONS_V1,
} from "@/lib/projects/work-report/options"
import type { ProjectWorkReportTaskScope } from "@/lib/projects/work-report/options"
import {
  associateProjectWorkReportPhotos,
  type ProjectWorkReportPhotoInput,
} from "@/lib/projects/work-report/photos"
import {
  selectProjectWorkReportTasks,
  summarizeProjectWorkReportTasks,
} from "@/lib/projects/work-report/select-tasks"
import type {
  ProjectWorkReport,
  ProjectWorkReportField,
  ProjectWorkReportRgb,
  ProjectWorkReportWorkOrder,
} from "@/lib/projects/work-report/types"

const DEFAULT_PRIMARY: ProjectWorkReportRgb = { r: 30, g: 77, b: 140 }

/**
 * Documentary mapping only. Missing OT values stay null/omitted.
 * Do not infer, complete, or rewrite operator-recorded text.
 */

export type BuildProjectWorkReportDataInput = {
  companyId: string
  project: Pick<
    Project,
    "id" | "code" | "name" | "client" | "location" | "description" | "startDate" | "endDate"
  >
  tasks: Array<
    Task & {
      companyId?: string | null
      deletedAt?: string | null
    }
  >
  photos?: ProjectWorkReportPhotoInput[]
  taskScope: ProjectWorkReportTaskScope
  selectedTaskIds?: string[]
  generatedAt?: string
  branding?: {
    logoUrl?: string | null
    logoDataUrl?: string | null
    primaryColor?: string | null
    secondaryColor?: string | null
  }
}

function textOrNull(value?: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function pushField(
  fields: ProjectWorkReportField[],
  label: string,
  value?: string | null
) {
  const normalized = textOrNull(value)
  if (!normalized) {
    return
  }
  fields.push({ label, value: normalized })
}

function recordedLocation(task: Task): string | null {
  return textOrNull(
    task.serviceAddress || task.locality || task.sharedLocation
  )
}

function buildTaskFields(task: Task): ProjectWorkReportField[] {
  const fields: ProjectWorkReportField[] = []
  pushField(fields, "Código OT", task.code)
  pushField(fields, "Trabajo", task.title)
  pushField(fields, "Estado", TASK_STATUS_LABELS[task.status] ?? task.status)
  pushField(fields, "Fecha", formatProjectWorkReportDate(task.dueDate))
  pushField(fields, "Inicio", formatProjectWorkReportDate(task.startDate))
  pushField(
    fields,
    "Fin",
    formatProjectWorkReportDate(task.completedAt) ??
      formatProjectWorkReportDateTime(task.completedAt)
  )
  pushField(fields, "Cuadrilla", task.crew)
  pushField(fields, "Supervisor", task.supervisor)
  pushField(fields, "Tipo de trabajo", TASK_TYPE_LABELS[task.type])
  pushField(fields, "Descripción", task.description)
  pushField(fields, "Observaciones", task.observationsForCrew)
  pushField(fields, "Trabajo realizado", readTrabajoRealizadoFromTask(task))
  pushField(fields, "Ubicación", recordedLocation(task))
  return fields
}

export function buildProjectWorkReportData(
  input: BuildProjectWorkReportDataInput
): ProjectWorkReport {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const selected = selectProjectWorkReportTasks(
    input.tasks,
    input.companyId,
    input.project.id,
    input.taskScope,
    input.selectedTaskIds
  )
  const summary = summarizeProjectWorkReportTasks(selected)
  const photosByTask = associateProjectWorkReportPhotos(
    selected.map((task) => task.id),
    input.photos ?? []
  )
  const period = formatProjectWorkReportPeriod(
    input.project.startDate,
    input.project.endDate
  )
  const generatedAtLabel = formatProjectWorkReportGeneratedAt(generatedAt)
  const includedCountLabel = formatProjectWorkReportIncludedCount(
    summary.includedCount
  )
  const filterNote = buildProjectWorkReportFilterNote(input.taskScope)
  const projectName = input.project.name.trim()
  const projectCode = input.project.code.trim()
  const client = textOrNull(input.project.client)
  const location = textOrNull(input.project.location)
  const description = textOrNull(input.project.description)

  const workOrders: ProjectWorkReportWorkOrder[] = selected.map((task) => {
    const photos = (photosByTask.get(task.id) ?? []).map((photo) => {
      const imageDataUrl = photo.imageDataUrl ?? null
      const url = textOrNull(photo.signedUrl) ?? imageDataUrl
      return {
        description: textOrNull(photo.description),
        capturedAt: formatProjectWorkReportDateTime(photo.createdAt),
        url,
        imageDataUrl,
      }
    })

    return {
      code: task.code,
      title: textOrNull(task.title),
      status: TASK_STATUS_LABELS[task.status] ?? task.status,
      date: formatProjectWorkReportDate(task.dueDate),
      startDate: formatProjectWorkReportDate(task.startDate),
      endDate:
        formatProjectWorkReportDate(task.completedAt) ??
        formatProjectWorkReportDateTime(task.completedAt),
      crew: textOrNull(task.crew),
      supervisor: textOrNull(task.supervisor),
      technicians: null,
      workType: TASK_TYPE_LABELS[task.type] ?? null,
      description: textOrNull(task.description),
      observations: textOrNull(task.observationsForCrew),
      trabajoRealizado: readTrabajoRealizadoFromTask(task),
      location: recordedLocation(task),
      fields: buildTaskFields(task),
      checklist: buildProjectWorkReportChecklistItems(task),
      photos,
    }
  })

  const cover = {
    title: "INFORME DE TRABAJOS REALIZADOS",
    projectName,
    projectCode,
    client,
    location,
    period,
    generatedAtLabel,
    includedCountLabel,
  }

  const summaryBlock = {
    filterNote,
    description,
    includedCount: summary.includedCount,
    completedCount: summary.completedCount,
    activeCount: summary.activeCount,
    pendingClosureCount: summary.pendingClosureCount,
    period,
    crews: summary.crews,
  }

  return {
    kind: "project-work-report",
    version: 1,
    metadata: {
      generatedAt,
      generatedAtLabel,
      taskScope: input.taskScope,
      includedCount: summary.includedCount,
      includedCountLabel,
      filterNote,
    },
    branding: {
      logoUrl: input.branding?.logoUrl ?? input.branding?.logoDataUrl ?? null,
      logoDataUrl: input.branding?.logoDataUrl ?? null,
      primaryRgb: hexToRgb(input.branding?.primaryColor) ?? DEFAULT_PRIMARY,
      secondaryRgb: hexToRgb(input.branding?.secondaryColor),
    },
    project: {
      name: projectName,
      code: projectCode,
      client,
      location,
      period,
      description,
    },
    summary: summaryBlock,
    workOrders,
    generatedAt,
    taskScope: input.taskScope,
    sections: PROJECT_WORK_REPORT_SECTIONS_V1,
    cover,
    tasks: workOrders,
  }
}
