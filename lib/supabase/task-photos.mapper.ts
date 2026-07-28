import type { TaskPhotoRow } from "@/lib/supabase/database.aliases"
import type { TaskPhoto, TaskPhotoType } from "@/lib/types/task-photos"

export function mapTaskPhotoRowToTaskPhoto(
  row: TaskPhotoRow,
  signedUrl?: string
): TaskPhoto {
  return {
    id: row.id,
    taskId: row.task_id,
    photoType: row.photo_type as TaskPhotoType,
    operationalStepId: row.operational_step_id,
    fileUrl: row.file_url ?? row.storage_path,
    fileName: row.file_name,
    description: row.description?.trim() || row.caption?.trim() || "",
    createdAt: row.created_at,
    createdBy: row.created_by,
    signedUrl,
  }
}
