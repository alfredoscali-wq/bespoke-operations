"use client"

import { TaskPhotosGallery } from "@/components/tareas/task-photos-gallery"

type TaskEvidencePhotosGalleryProps = {
  taskId: string
}

export function TaskEvidencePhotosGallery({
  taskId,
}: TaskEvidencePhotosGalleryProps) {
  return (
    <TaskPhotosGallery
      taskId={taskId}
      photoType="evidence"
      title="Evidencias"
    />
  )
}
