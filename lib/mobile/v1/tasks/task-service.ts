import "server-only"

import { toLocalDateOnly } from "@/lib/dates/date-only"
import { fetchTodayAgendaTasks } from "@/lib/mobile/v1/agenda/agenda-queries"
import { isFieldAgentAgendaTaskVisible } from "@/lib/mobile/v1/agenda/agenda-task-visibility"
import { sortAgendaTasks } from "@/lib/mobile/v1/agenda/sort-agenda-tasks"
import type { MobileAuthContext } from "@/lib/mobile/v1/auth/mobile-auth-context"
import { fetchOperationalChecklistForServiceType } from "@/lib/mobile/v1/checklist/checklist-queries"
import {
  mergeChecklistWithResponses,
  readOperationalChecklistResponses,
} from "@/lib/mobile/v1/tasks/checklist-execution"
import { MobileApiError } from "@/lib/mobile/v1/errors"
import { resolveMobileTaskHasActiveIncident } from "@/lib/mobile/v1/tasks/task-active-incident.shared"
import {
  resolveTaskHasActiveIncidentRecord,
} from "@/lib/mobile/v1/tasks/task-active-incident-guard"
import { resolveMobileWorkTeam } from "@/lib/mobile/v1/shifts/resolve-work-team"
import type {
  MobileTaskChecklistItem,
  MobileTaskDetailResponse,
  MobileTaskEvidenceRequirement,
  MobileTaskNextWorkItem,
  MobileTaskReferencePhoto,
} from "@/lib/mobile/v1/tasks/types"
import {
  formatContractedPlanLabel,
  getTaskTechnologyLabel,
} from "@/lib/tasks/commercial-plan"
import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import { resolveTaskOperationalTitle } from "@/lib/tasks/work-order"
import { createAdminClient } from "@/lib/supabase/admin"
import { fetchTaskReferencePhotos } from "@/lib/supabase/task-photos.queries"
import { mapTaskRowToTask } from "@/lib/supabase/tasks.mapper"
import type { Task } from "@/lib/types/tasks"
import { fetchActiveWorkTeamShift } from "@/lib/work-team-shifts/work-team-shifts.queries"
import type { SupabaseClient } from "@supabase/supabase-js"

async function fetchTaskForCompany(
  client: SupabaseClient,
  companyId: string,
  taskId: string
): Promise<Task | null> {
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? mapTaskRowToTask(data) : null
}

function resolveCustomerOrAssetName(task: Task): string {
  return task.customerName?.trim() || task.projectName?.trim() || "—"
}

function resolveContactPerson(task: Task): string | null {
  const customerName = task.customerName?.trim()
  const projectName = task.projectName?.trim()

  if (customerName && projectName && customerName !== projectName) {
    return customerName
  }

  return task.customerCompany?.trim() || null
}

function mapEvidenceRequirements(task: Task): MobileTaskEvidenceRequirement[] {
  return (task.operationalSteps ?? []).map((step) => ({
    id: step.id,
    label: step.label,
    stepKind: step.stepKind === "text" ? "text" : "photo",
    required: true,
  }))
}

function mapNextWorkItem(task: Task | undefined): MobileTaskNextWorkItem | null {
  if (!task) {
    return null
  }

  return {
    scheduledTime: task.scheduledTime?.trim() || null,
    workType: resolveTaskOperationalTitle(task),
    customerOrAssetName: resolveCustomerOrAssetName(task),
  }
}

function mapReferencePhotos(photos: Awaited<
  ReturnType<typeof fetchTaskReferencePhotos>
>["data"]): MobileTaskReferencePhoto[] {
  return (photos ?? [])
    .map((photo) => {
      const url = photo.signedUrl?.trim() || photo.fileUrl?.trim()
      if (!url) {
        return null
      }

      return {
        id: photo.id,
        fileName: photo.fileName,
        description: photo.description?.trim() || "",
        url,
      }
    })
    .filter((photo): photo is MobileTaskReferencePhoto => photo !== null)
}

function mapTaskToDetailResponse(
  task: Task,
  nextWork: MobileTaskNextWorkItem | null,
  checklist: MobileTaskChecklistItem[],
  referencePhotos: MobileTaskReferencePhoto[],
  hasActiveIncident: boolean
): MobileTaskDetailResponse {
  const technology = getTaskTechnologyLabel(task)
  const contractedPlan = formatContractedPlanLabel(task.contractedPlan)

  return {
    id: task.id,
    workOrderNumber: task.workOrderNumber?.trim() || task.code?.trim() || null,
    workType: resolveTaskOperationalTitle(task),
    serviceType: task.serviceType?.trim() || null,
    status: task.status,
    priority: task.priority,
    scheduledTime: task.scheduledTime?.trim() || null,
    customerOrAssetName: resolveCustomerOrAssetName(task),
    contactPerson: resolveContactPerson(task),
    phone: task.customerPhone?.trim() || null,
    address: task.serviceAddress?.trim() || "—",
    locality: task.locality?.trim() || null,
    latitude: task.latitude ?? null,
    longitude: task.longitude ?? null,
    observations: task.observationsForCrew?.trim() || null,
    amountToCollect:
      task.amountToCollect == null ? null : Number(task.amountToCollect),
    technology,
    contractedPlan,
    checklist,
    evidenceRequirements: mapEvidenceRequirements(task),
    referencePhotos,
    nextWork,
    hasActiveIncident,
  }
}

export async function getMobileTaskDetail(
  auth: MobileAuthContext,
  taskId: string,
  deviceId: string
): Promise<MobileTaskDetailResponse> {
  const admin = createAdminClient()
  const resolved = await resolveMobileWorkTeam(admin, auth, deviceId)

  const activeShift = await fetchActiveWorkTeamShift(
    admin,
    auth.companyId,
    resolved.workTeamId
  )

  if (!activeShift) {
    throw new MobileApiError(
      "SHIFT_NOT_ACTIVE",
      "No hay jornada activa.",
      409
    )
  }

  const task = await fetchTaskForCompany(admin, auth.companyId, taskId)

  if (!task) {
    throw new MobileApiError(
      "TASK_NOT_FOUND",
      "Orden de trabajo no encontrada.",
      404
    )
  }

  const crewRef = {
    id: resolved.workTeamId,
    name: resolved.workTeamName,
  }

  if (!taskMatchesCrewId(task, crewRef)) {
    throw new MobileApiError(
      "TASK_NOT_FOUND",
      "Orden de trabajo no encontrada.",
      404
    )
  }

  const today = toLocalDateOnly()

  if (!isFieldAgentAgendaTaskVisible(task, today)) {
    throw new MobileApiError(
      "TASK_NOT_FOUND",
      "Orden de trabajo no encontrada.",
      404
    )
  }

  const agendaTasks = sortAgendaTasks(
    await fetchTodayAgendaTasks(
      admin,
      auth.companyId,
      resolved.workTeamId,
      resolved.workTeamName,
      today
    )
  )

  const currentIndex = agendaTasks.findIndex((item) => item.id === task.id)
  const nextTask =
    currentIndex >= 0 ? agendaTasks[currentIndex + 1] : undefined

  const operationalChecklistTemplate = await fetchOperationalChecklistForServiceType(
    admin,
    auth.companyId,
    task.serviceType?.trim() || ""
  )

  const checklist =
    task.status === "en-curso"
      ? mergeChecklistWithResponses(
          operationalChecklistTemplate,
          readOperationalChecklistResponses(task)
        )
      : []

  const referencePhotosResult = await fetchTaskReferencePhotos(admin, task.id)
  const referencePhotos = referencePhotosResult.error
    ? []
    : mapReferencePhotos(referencePhotosResult.data)

  const hasActiveIncidentRecord = await resolveTaskHasActiveIncidentRecord(
    admin,
    task.id
  )
  const hasActiveIncident = resolveMobileTaskHasActiveIncident({
    taskStatus: task.status,
    hasActiveIncidentRecord,
  })

  return mapTaskToDetailResponse(
    task,
    mapNextWorkItem(nextTask),
    checklist,
    referencePhotos,
    hasActiveIncident
  )
}

export function validateMobileTaskDetailRequest(
  taskId: string,
  deviceId: string | null
): { taskId: string; deviceId: string } {
  if (!taskId.trim()) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Identificador de trabajo inválido.",
      400
    )
  }

  if (!deviceId?.trim()) {
    throw new MobileApiError(
      "INVALID_REQUEST",
      "Parámetro requerido: deviceId.",
      400
    )
  }

  return {
    taskId: taskId.trim(),
    deviceId: deviceId.trim(),
  }
}
