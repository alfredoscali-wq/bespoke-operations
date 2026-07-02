"use client"

import { useMemo } from "react"
import { notFound } from "next/navigation"

import { TaskAdminDetailView } from "@/components/tareas/task-admin-detail-view"
import { useTasks } from "@/components/tareas/tasks-provider"

type TaskDetailPageClientProps = {
  id: string
}

export function TaskDetailPageClient({ id }: TaskDetailPageClientProps) {
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

  return <TaskAdminDetailView task={task} detail={detail} />
}
