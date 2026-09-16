import { resolveMobileTaskCommercialFields } from "@/lib/mobile/v1/tasks/task-commercial-fields"
import { resolveMobileTaskCurrentLocationFields } from "@/lib/mobile/v1/tasks/task-current-location-fields"
import { resolveMobileTaskProjectDesignFields } from "@/lib/mobile/v1/tasks/task-design-fields"
import { resolveMobileTaskProjectGpsFields } from "@/lib/mobile/v1/tasks/task-project-gps-fields"
import type { ProjectGpsSource } from "@/lib/mobile/v1/tasks/task-start-coordinates"
import type {
  MobileTaskChecklistItem,
  MobileTaskDetailResponse,
  MobileTaskEvidenceRequirement,
  MobileTaskNextWorkItem,
  MobileTaskReferencePhoto,
} from "@/lib/mobile/v1/tasks/types"
import {
  resolveServiceTechnicalWorkInfoFromTask,
  resolveTaskOperationalTitle,
} from "@/lib/tasks/work-order"
import type { Task } from "@/lib/types/tasks"

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

export function mapMobileTaskNextWorkItem(
  task: Task | undefined
): MobileTaskNextWorkItem | null {
  if (!task) {
    return null
  }

  return {
    scheduledTime: task.scheduledTime?.trim() || null,
    workType: resolveTaskOperationalTitle(task),
    customerOrAssetName: resolveCustomerOrAssetName(task),
  }
}

export function mapMobileTaskReferencePhotos(
  photos: Array<{
    id: string
    fileName: string
    description?: string | null
    signedUrl?: string | null
    fileUrl?: string | null
  }> | null
): MobileTaskReferencePhoto[] {
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

export function mapMobileTaskDetailResponse(
  task: Task,
  nextWork: MobileTaskNextWorkItem | null,
  checklist: MobileTaskChecklistItem[],
  referencePhotos: MobileTaskReferencePhoto[],
  hasActiveIncident: boolean,
  projectGps: ProjectGpsSource = null
): MobileTaskDetailResponse {
  const commercialFields = resolveMobileTaskCommercialFields(task)
  const workInfo = resolveServiceTechnicalWorkInfoFromTask(task)
  const currentLocation = resolveMobileTaskCurrentLocationFields(task)
  const designFields = resolveMobileTaskProjectDesignFields(task)
  const projectGpsFields = resolveMobileTaskProjectGpsFields({
    projectId: task.projectId,
    project: projectGps,
  })

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
    ...projectGpsFields,
    currentAddress: currentLocation.currentAddress,
    currentLatitude: currentLocation.currentLatitude,
    currentLongitude: currentLocation.currentLongitude,
    observations: task.observationsForCrew?.trim() || null,
    ...commercialFields,
    ...designFields,
    serviceReason: workInfo?.reasonLabel ?? null,
    serviceDetail: workInfo?.detail ?? null,
    checklist,
    evidenceRequirements: mapEvidenceRequirements(task),
    referencePhotos,
    nextWork,
    hasActiveIncident,
  }
}
