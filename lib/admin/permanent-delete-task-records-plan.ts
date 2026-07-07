export type TaskIncidentPhotoStorageRow = {
  storage_path: string | null
  thumbnail_path: string | null
}

export const PERMANENT_DELETE_TASK_RECORDS_SHARED_BY = [
  "permanentDeleteTask",
  "permanentDeleteCustomer",
] as const

export function collectTaskIncidentPhotoStoragePaths(
  photos: TaskIncidentPhotoStorageRow[]
): string[] {
  const paths = new Set<string>()

  for (const photo of photos) {
    for (const rawPath of [photo.storage_path, photo.thumbnail_path]) {
      const path = rawPath?.trim()
      if (path) {
        paths.add(path)
      }
    }
  }

  return [...paths]
}

export type PermanentDeleteTaskRecordStepFlags = {
  hasIncidents: boolean
  hasIncidentPhotoStorage: boolean
  hasEvidences: boolean
  hasTaskPhotos: boolean
}

export function resolvePermanentDeleteTaskRecordStepSequence(
  flags: PermanentDeleteTaskRecordStepFlags
): readonly string[] {
  const steps: string[] = []

  if (flags.hasIncidents) {
    steps.push("select_task_incidents", "select_task_incident_photos")
    if (flags.hasIncidentPhotoStorage) {
      steps.push("remove_task_incident_photos_storage")
    }
    steps.push("delete_task_incidents")
  }

  if (flags.hasEvidences) {
    steps.push("select_evidences", "remove_evidences_storage", "delete_evidences")
  }

  if (flags.hasTaskPhotos) {
    steps.push("select_task_photos", "remove_task_photos_storage", "delete_task_photos")
  }

  steps.push("delete_tasks")
  return steps
}

export function findPermanentDeleteTaskRecordStepIndex(
  steps: readonly string[],
  step: string
): number {
  return steps.indexOf(step)
}
