"use client"

import { useEffect, useMemo, useState } from "react"
import { notFound, useRouter } from "next/navigation"

import { TaskAdminDetailView } from "@/components/tareas/task-admin-detail-view"
import { useTasks } from "@/components/tareas/tasks-provider"
import { useAuth } from "@/components/auth/auth-provider"
import { getTaskDetail } from "@/lib/data/tasks"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { getLiveTaskByCompanyAndId, getTaskById } from "@/lib/supabase/tasks.browser"
import {
  resolveTaskDetailPageAccess,
  shouldFetchLiveTaskForDetailPage,
} from "@/lib/tasks/task-direct-access"
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
  const { companyId, isAuthReady } = useTenantCompanyId()
  const { getTask, getDetail, detailVersion, removeTaskLocally, isTasksReady } =
    useTasks()
  const [fetchedTask, setFetchedTask] = useState<Task | null>(null)
  const [archiveFetchState, setArchiveFetchState] = useState<
    "idle" | "loading" | "missing"
  >("idle")
  const [directFetchState, setDirectFetchState] = useState<
    "idle" | "loading" | "missing"
  >("idle")

  const listedTask = useMemo(
    () => getTask(id),
    [getTask, id, detailVersion]
  )

  useEffect(() => {
    if (!requireArchived || listedTask) {
      setArchiveFetchState("idle")
      if (requireArchived) {
        setFetchedTask(null)
      }
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

  useEffect(() => {
    if (
      !shouldFetchLiveTaskForDetailPage({
        listedTask,
        requireArchived,
        isListReady: isTasksReady,
        isAuthReady,
      })
    ) {
      if (listedTask || requireArchived) {
        setDirectFetchState("idle")
        if (!requireArchived) {
          setFetchedTask(null)
        }
      }
      return
    }

    if (!companyId) {
      setFetchedTask(null)
      setDirectFetchState("missing")
      return
    }

    let cancelled = false
    setDirectFetchState("loading")

    void getLiveTaskByCompanyAndId(companyId, id).then((result) => {
      if (cancelled) {
        return
      }

      if (result.data) {
        setFetchedTask(result.data)
        setDirectFetchState("idle")
        return
      }

      setFetchedTask(null)
      setDirectFetchState("missing")
    })

    return () => {
      cancelled = true
    }
  }, [
    companyId,
    id,
    isAuthReady,
    isTasksReady,
    listedTask,
    requireArchived,
  ])

  const access = resolveTaskDetailPageAccess({
    listedTask,
    fetchedTask,
    isListReady: isTasksReady,
    isAuthReady,
    isFetching:
      directFetchState === "loading" ||
      (directFetchState === "idle" && !listedTask && !fetchedTask),
    requireArchived,
    archiveFetchState,
  })

  const task = access.outcome === "show" ? access.task : undefined
  const detail = useMemo(() => {
    if (!task) {
      return undefined
    }

    const cached = getDetail(id)
    if (cached) {
      return cached
    }

    return getTaskDetail(task)
  }, [getDetail, id, task, detailVersion])

  if (access.outcome === "loading") {
    return (
      <p className="text-sm text-muted-foreground">
        Cargando orden de trabajo...
      </p>
    )
  }

  if (access.outcome === "not-found" || !task || !detail) {
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
