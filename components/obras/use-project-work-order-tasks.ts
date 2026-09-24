"use client"

import { useCallback, useEffect, useState } from "react"

import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { compareDateOnly } from "@/lib/dates/date-only"
import { listProjectWorkOrderTasks } from "@/lib/supabase/tasks.browser"
import type { Task } from "@/lib/types/tasks"

export type ProjectWorkOrderTasksLoadStatus = "loading" | "ready" | "error"

const LOAD_ERROR_MESSAGE =
  "No se pudieron cargar las órdenes de trabajo de la obra."

export function useProjectWorkOrderTasks(projectId: string) {
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [projectTasks, setProjectTasks] = useState<Task[]>([])
  const [status, setStatus] = useState<ProjectWorkOrderTasksLoadStatus>(
    "loading"
  )
  const [error, setError] = useState<string | null>(null)

  const loadProjectTasks = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!isAuthReady || !companyId) {
        setProjectTasks([])
        if (isAuthReady) {
          setStatus("ready")
        }
        return
      }

      if (!options?.silent) {
        setStatus("loading")
        setError(null)
      }

      const result = await listProjectWorkOrderTasks(companyId, projectId)
      if (result.error || !result.data) {
        if (!options?.silent) {
          setError(result.error?.message ?? LOAD_ERROR_MESSAGE)
          setStatus("error")
        }
        return
      }

      setProjectTasks(
        [...result.data].sort((a, b) => compareDateOnly(a.dueDate, b.dueDate))
      )
      setError(null)
      setStatus("ready")
    },
    [companyId, isAuthReady, projectId]
  )

  useEffect(() => {
    void loadProjectTasks()
  }, [loadProjectTasks])

  return {
    projectTasks,
    setProjectTasks,
    loadProjectTasks,
    status,
    error,
  }
}
