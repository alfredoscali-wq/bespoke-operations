import type { TaskPhotoRow } from "@/lib/supabase/database.types"
import type { TaskPhoto } from "@/lib/types/task-photos"

export function mapTaskPhotoRowToTaskPhoto(
  row: TaskPhotoRow,
  signedUrl?: string
): TaskPhoto {
  return {
    id: row.id,
    taskId: row.task_id,
    photoType: row.photo_type,
    fileUrl: row.file_url ?? row.storage_path,
    fileName: row.file_name,
    description: row.description?.trim() || row.caption?.trim() || "",
    createdAt: row.created_at,
    createdBy: row.created_by,
    signedUrl,
  }
}
