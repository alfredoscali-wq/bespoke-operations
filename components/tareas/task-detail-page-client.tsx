"use client"

import { useEffect, useMemo, useState } from "react"
import { notFound, useRouter } from "next/navigation"

import { TaskAdminDetailView } from "@/components/tareas/task-admin-detail-view"
import { useTasks } from "@/components/tareas/tasks-provider"
import { useAuth } from "@/components/auth/auth-provider"
import { getTaskDetail } from "@/lib/data/tasks"
import { getTaskById } from "@/lib/supabase/tasks.browser"
import { matchesArchivedWorkOrderListQuery } from "@/lib/tasks/task-list-scope"
import { canShowAdminSoftDeleteInArchive } from "@/lib/tasks/work-order-deletion-policy"
import type { Task } from "@/lib/types/tasks"

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
  const [fetchedTask, setFetchedTask] = useState<Task | null>(null)
  const [archiveFetchState, setArchiveFetchState] = useState<
    "idle" | "loading" | "missing"
  >("idle")

  const listedTask = useMemo(
    () => getTask(id),
    [getTask, id, detailVersion]
  )

  useEffect(() => {
    if (!requireArchived || listedTask) {
      setFetchedTask(null)
      setArchiveFetchState("idle")
      return
    }

    let cancelled = false
    setArchiveFetchState("loading")

    void getTaskById(id).then((result) => {
      if (cancelled) {
        return
      }

      if (
        result.data &&
        matchesArchivedWorkOrderListQuery(result.data)
      ) {
        setFetchedTask(result.data)
        setArchiveFetchState("idle")
        return
      }

      setFetchedTask(null)
      setArchiveFetchState("missing")
    })

    return () => {
      cancelled = true
    }
  }, [id, listedTask, requireArchived])

  const task = listedTask ?? fetchedTask ?? undefined
  const detail = useMemo(() => {
    const cached = getDetail(id)
    if (cached) {
      return cached
    }

    if (!task) {
      return undefined
    }

    return getTaskDetail(task)
  }, [getDetail, id, task, detailVersion])

  if (requireArchived && archiveFetchState === "loading" && !task) {
    return (
      <p className="text-sm text-muted-foreground">
        Cargando orden de trabajo...
      </p>
    )
  }

  if (!task || !detail || archiveFetchState === "missing") {
    notFound()
  }

  if (requireArchived && !matchesArchivedWorkOrderListQuery(task)) {
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
