"use client"

import { useMemo } from "react"
import { notFound } from "next/navigation"

import { TaskAdminDetailView } from "@/components/tareas/task-admin-detail-view"
import { useTasks } from "@/components/tareas/tasks-provider"
import { ARCHIVE_WORK_ORDER_STATUS } from "@/lib/tasks/task-list-scope"

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
  const { getTask, getDetail, detailVersion } = useTasks()

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

  if (requireArchived && task.status !== ARCHIVE_WORK_ORDER_STATUS) {
    notFound()
  }

  return <TaskAdminDetailView task={task} detail={detail} backHref={backHref} />
}
