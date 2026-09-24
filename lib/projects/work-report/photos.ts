export type ProjectWorkReportPhotoInput = {
  taskId: string
  description?: string | null
  createdAt?: string | null
  signedUrl?: string | null
  storagePath?: string | null
  imageDataUrl?: string | null
}

export function associateProjectWorkReportPhotos<
  T extends ProjectWorkReportPhotoInput,
>(taskIds: string[], photos: T[]): Map<string, T[]> {
  const allowed = new Set(taskIds)
  const grouped = new Map<string, T[]>()

  for (const taskId of taskIds) {
    grouped.set(taskId, [])
  }

  for (const photo of photos) {
    if (!allowed.has(photo.taskId)) {
      continue
    }

    const list = grouped.get(photo.taskId)
    if (list) {
      list.push(photo)
    }
  }

  for (const list of grouped.values()) {
    list.sort((left, right) =>
      (left.createdAt ?? "").localeCompare(right.createdAt ?? "")
    )
  }

  return grouped
}
