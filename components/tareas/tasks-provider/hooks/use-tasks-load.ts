"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  createBrowserTasksClient,
  listActiveWorkOrderTasks,
  listArchivedWorkOrderTasks,
  listCalendarWorkOrderTasks,
  listPlanningWorkOrderTasks,
  listTasks,
} from "@/lib/supabase/tasks.browser"
import {
  ARCHIVE_WORK_ORDER_LIST_PAGE_SIZE,
  type ArchivedWorkOrderListQuery,
} from "@/lib/tasks/archived-work-order-list"
import {
  applyVencidaSyncFromApi,
  mergeVencidaStatusIntoTasks,
} from "@/lib/tasks/vencida-sync.client"
import type { Task } from "@/lib/types/tasks"

import { clearDetailCache } from "../detail-cache"
import type { ArchivedWorkOrderListControls, TaskMutationResult } from "../types"

export type TasksListScope =
  | "all"
  | "activeWorkOrders"
  | "archiveWorkOrders"
  | "planningWorkOrders"
  | "calendarWorkOrders"

type UseTasksLoadParams = {
  companyId: string
  isAuthReady: boolean
  listScope?: TasksListScope
}

const DEFAULT_ARCHIVE_QUERY: ArchivedWorkOrderListQuery = {
  page: 1,
  search: "",
  type: "all",
  workOrderType: "all",
  priority: "all",
  crewId: "all",
  sortField: "dueDate",
  sortDirection: "asc",
}

function archiveQueryKey(query: ArchivedWorkOrderListQuery): string {
  return JSON.stringify({
    page: query.page ?? 1,
    search: query.search?.trim() ?? "",
    type: query.type ?? "all",
    workOrderType: query.workOrderType ?? "all",
    priority: query.priority ?? "all",
    crewId: query.crewId ?? "all",
    crewName: query.crewName ?? "",
    sortField: query.sortField ?? "dueDate",
    sortDirection: query.sortDirection ?? "asc",
  })
}

async function loadTasksForScope(
  companyId: string,
  client: ReturnType<typeof createBrowserTasksClient>,
  listScope: TasksListScope
) {
  if (listScope === "activeWorkOrders") {
    return listActiveWorkOrderTasks(companyId, client)
  }

  if (listScope === "planningWorkOrders") {
    return listPlanningWorkOrderTasks(companyId, client)
  }

  if (listScope === "calendarWorkOrders") {
    return listCalendarWorkOrderTasks(companyId, client)
  }

  return listTasks(companyId, client)
}

export function useTasksLoad({
  companyId,
  isAuthReady,
  listScope = "all",
}: UseTasksLoadParams) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isTasksReady, setIsTasksReady] = useState(false)
  const [usesSupabase, setUsesSupabase] = useState(false)
  const [detailVersion, setDetailVersion] = useState(0)
  const [archiveQuery, setArchiveQuery] = useState<ArchivedWorkOrderListQuery>(
    DEFAULT_ARCHIVE_QUERY
  )
  const [archiveTotal, setArchiveTotal] = useState(0)
  const [isArchiveListLoading, setIsArchiveListLoading] = useState(false)
  const usesSupabaseRef = useRef(false)
  const tasksRef = useRef<Task[]>([])
  const archiveQueryRef = useRef(archiveQuery)

  useEffect(() => {
    usesSupabaseRef.current = usesSupabase
  }, [usesSupabase])

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  useEffect(() => {
    archiveQueryRef.current = archiveQuery
  }, [archiveQuery])

  const runVencidaSync = useCallback(async (sourceTasks?: Task[]) => {
    const syncedTasks = await applyVencidaSyncFromApi(
      sourceTasks ?? tasksRef.current
    )
    setTasks((current) => mergeVencidaStatusIntoTasks(current, syncedTasks))
    return syncedTasks
  }, [])

  useEffect(() => {
    if (!isAuthReady || listScope === "archiveWorkOrders") {
      return
    }

    let cancelled = false

    async function loadTasksFromSupabase() {
      try {
        const client = createBrowserTasksClient()
        const result = await loadTasksForScope(companyId, client, listScope)

        if (cancelled) return

        if (result.error || result.data === null) {
          console.error("[TASKS LOAD]", result.error)
          setTasks([])
          setUsesSupabase(false)
          return
        }

        setTasks(result.data)
        setUsesSupabase(true)
      } catch (error) {
        if (!cancelled) {
          console.error("[TASKS LOAD]", error)
          setTasks([])
          setUsesSupabase(false)
        }
      } finally {
        if (!cancelled) {
          setIsTasksReady(true)
        }
      }
    }

    void loadTasksFromSupabase()

    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady, listScope])

  const serializedArchiveQuery = archiveQueryKey(archiveQuery)

  useEffect(() => {
    if (!isAuthReady || listScope !== "archiveWorkOrders") {
      return
    }

    let cancelled = false

    async function loadArchivedPage() {
      setIsArchiveListLoading(true)
      try {
        const client = createBrowserTasksClient()
        const result = await listArchivedWorkOrderTasks(
          companyId,
          archiveQueryRef.current,
          client
        )

        if (cancelled) return

        if (result.error || result.data === null) {
          console.error("[TASKS ARCHIVE LOAD]", result.error)
          setTasks([])
          setArchiveTotal(0)
          setUsesSupabase(false)
          return
        }

        setTasks(result.data.items)
        setArchiveTotal(result.data.total)
        setUsesSupabase(true)
      } catch (error) {
        if (!cancelled) {
          console.error("[TASKS ARCHIVE LOAD]", error)
          setTasks([])
          setArchiveTotal(0)
          setUsesSupabase(false)
        }
      } finally {
        if (!cancelled) {
          setIsArchiveListLoading(false)
          setIsTasksReady(true)
        }
      }
    }

    void loadArchivedPage()

    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady, listScope, serializedArchiveQuery])

  const refreshTasksFromServer = useCallback(async (options?: {
    silent?: boolean
  }): Promise<TaskMutationResult> => {
    try {
      const client = createBrowserTasksClient()

      if (listScope === "archiveWorkOrders") {
        const result = await listArchivedWorkOrderTasks(
          companyId,
          archiveQueryRef.current,
          client
        )

        if (result.error || result.data === null) {
          return {
            success: false,
            message:
              result.error?.message ??
              "No se pudieron actualizar las órdenes de trabajo.",
          }
        }

        setTasks(result.data.items)
        setArchiveTotal(result.data.total)
      } else {
        const result = await loadTasksForScope(companyId, client, listScope)

        if (result.error || result.data === null) {
          return {
            success: false,
            message:
              result.error?.message ??
              "No se pudieron actualizar las órdenes de trabajo.",
          }
        }

        setTasks(result.data)
      }

      if (!options?.silent) {
        clearDetailCache()
        setDetailVersion((version) => version + 1)
      }

      return { success: true }
    } catch (error) {
      console.error("[TASKS REFRESH]", error)
      return {
        success: false,
        message: "No se pudieron actualizar las órdenes de trabajo.",
      }
    }
  }, [companyId, listScope])

  const setArchivePage = useCallback((page: number) => {
    setArchiveQuery((current) => {
      const nextPage = Math.max(1, page)
      if ((current.page ?? 1) === nextPage) {
        return current
      }
      return { ...current, page: nextPage }
    })
  }, [])

  const setArchiveFilters = useCallback(
    (filters: Omit<ArchivedWorkOrderListQuery, "page" | "pageSize">) => {
      setArchiveQuery((current) => {
        const next: ArchivedWorkOrderListQuery = {
          ...current,
          ...filters,
        }
        const currentFiltersKey = archiveQueryKey({ ...current, page: 1 })
        const nextFiltersKey = archiveQueryKey({ ...next, page: 1 })
        if (currentFiltersKey === nextFiltersKey) {
          return current
        }
        return { ...next, page: 1 }
      })
    },
    []
  )

  const archiveList = useMemo<ArchivedWorkOrderListControls | null>(() => {
    if (listScope !== "archiveWorkOrders") {
      return null
    }

    return {
      total: archiveTotal,
      page: archiveQuery.page ?? 1,
      pageSize: ARCHIVE_WORK_ORDER_LIST_PAGE_SIZE,
      isLoading: isArchiveListLoading,
      setPage: setArchivePage,
      setFilters: setArchiveFilters,
    }
  }, [
    archiveQuery.page,
    archiveTotal,
    isArchiveListLoading,
    listScope,
    setArchiveFilters,
    setArchivePage,
  ])

  useEffect(() => {
    if (!usesSupabase || listScope === "archiveWorkOrders") {
      return
    }

    void runVencidaSync()

    const interval = window.setInterval(() => {
      void runVencidaSync()
    }, 60_000)

    return () => {
      window.clearInterval(interval)
    }
  }, [usesSupabase, runVencidaSync, listScope])

  return {
    tasks,
    setTasks,
    isTasksReady,
    usesSupabase,
    usesSupabaseRef,
    detailVersion,
    setDetailVersion,
    refreshTasksFromServer,
    archiveList,
  }
}
