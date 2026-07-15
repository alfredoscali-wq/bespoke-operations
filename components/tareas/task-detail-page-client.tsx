"use client"

import { useMemo } from "react"
import { notFound, useRouter } from "next/navigation"

import { TaskAdminDetailView } from "@/components/tareas/task-admin-detail-view"
import { useTasks } from "@/components/tareas/tasks-provider"
import { useAuth } from "@/components/auth/auth-provider"
import { isArchiveWorkOrderStatus } from "@/lib/tasks/task-list-scope"
import { canShowAdminSoftDeleteInArchive } from "@/lib/tasks/work-order-deletion-policy"

type TaskDetailPageClientProps = {
  id: string
  backHref?: string
  requireArchived?: boolean
}

export function TaskDetailPageClient({
  id,
  backHref,
  requireArchived = false,
}: TaskDetailPageClientProps) {
  const router = useRouter()
  const { sessionUser } = useAuth()
  const { getTask, getDetail, detailVersion, removeTaskLocally } = useTasks()

  const task = useMemo(
    () => getTask(id),
    [getTask, id, detailVersion]
  )
  const detail = useMemo(
    () => getDetail(id),
    [getDetail, id, detailVersion]
  )

  if (!task || !detail) {
    notFound()
  }

  if (requireArchived && !isArchiveWorkOrderStatus(task.status)) {
    notFound()
  }

  const showPermanentDelete =
    requireArchived &&
    canShowAdminSoftDeleteInArchive(sessionUser?.systemRole, task.status)

  function handlePermanentDeleteSuccess(_message: string) {
    removeTaskLocally(id)
    router.push(backHref ?? "/operations/archivo-ot")
    router.refresh()
  }

  return (
    <TaskAdminDetailView
      task={task}
      detail={detail}
      showPermanentDelete={showPermanentDelete}
      onPermanentDeleteSuccess={handlePermanentDeleteSuccess}
      timelineRefreshKey={detailVersion}
    />
  )
}
