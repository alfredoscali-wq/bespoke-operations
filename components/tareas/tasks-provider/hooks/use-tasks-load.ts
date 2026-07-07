"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { createBrowserTasksClient, listTasks } from "@/lib/supabase/tasks.browser"
import {
  applyVencidaSyncFromApi,
  mergeVencidaStatusIntoTasks,
} from "@/lib/tasks/vencida-sync.client"
import type { Task } from "@/lib/types/tasks"

import { clearDetailCache } from "../detail-cache"
import type { TaskMutationResult } from "../types"

type UseTasksLoadParams = {
  companyId: string
  isAuthReady: boolean
}

export function useTasksLoad({ companyId, isAuthReady }: UseTasksLoadParams) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isTasksReady, setIsTasksReady] = useState(false)
  const [usesSupabase, setUsesSupabase] = useState(false)
  const [detailVersion, setDetailVersion] = useState(0)
  const usesSupabaseRef = useRef(false)
  const tasksRef = useRef<Task[]>([])

  useEffect(() => {
    usesSupabaseRef.current = usesSupabase
  }, [usesSupabase])

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  const runVencidaSync = useCallback(async (sourceTasks?: Task[]) => {
    const syncedTasks = await applyVencidaSyncFromApi(
      sourceTasks ?? tasksRef.current
    )
    setTasks((current) => mergeVencidaStatusIntoTasks(current, syncedTasks))
    return syncedTasks
  }, [])

  useEffect(() => {
    if (!isAuthReady) {
      return
    }

    let cancelled = false

    async function loadTasksFromSupabase() {
      try {
        const client = createBrowserTasksClient()
        const result = await listTasks(companyId, client)

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
  }, [companyId, isAuthReady])

  const refreshTasksFromServer = useCallback(async (options?: {
    silent?: boolean
  }): Promise<TaskMutationResult> => {
    try {
      const client = createBrowserTasksClient()
      const result = await listTasks(companyId, client)

      if (result.error || result.data === null) {
        return {
          success: false,
          message:
            result.error?.message ??
            "No se pudieron actualizar las órdenes de trabajo.",
        }
      }

      setTasks(result.data)

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
  }, [companyId])

  useEffect(() => {
    if (!usesSupabase) {
      return
    }

    void runVencidaSync()

    const interval = window.setInterval(() => {
      void runVencidaSync()
    }, 60_000)

    return () => {
      window.clearInterval(interval)
    }
  }, [usesSupabase, runVencidaSync])

  return {
    tasks,
    setTasks,
    isTasksReady,
    usesSupabase,
    usesSupabaseRef,
    detailVersion,
    setDetailVersion,
    refreshTasksFromServer,
  }
}
