"use client"

import { notFound } from "next/navigation"

import { TaskDetailView } from "@/components/tareas/task-detail-view"
import { useTasks } from "@/components/tareas/tasks-provider"

type TaskDetailPageClientProps = {
  id: string
}

export function TaskDetailPageClient({ id }: TaskDetailPageClientProps) {
  const { getTask, getDetail } = useTasks()
  const task = getTask(id)
  const detail = getDetail(id)

  if (!task || !detail) {
    notFound()
  }

  return <TaskDetailView task={task} detail={detail} />
}
