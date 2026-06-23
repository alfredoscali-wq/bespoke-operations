"use client"

import { TaskPhotosGallery } from "@/components/tareas/task-photos-gallery"

type TaskEvidencePhotosGalleryProps = {
  taskId: string
  title?: string
}

export function TaskEvidencePhotosGallery({
  taskId,
  title = "Evidencias",
}: TaskEvidencePhotosGalleryProps) {
  return (
    <TaskPhotosGallery
      taskId={taskId}
      photoType="evidence"
      title={title}
    />
  )
}
