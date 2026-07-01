"use client"

import { useEffect, useState } from "react"

import { useTasks } from "@/components/tareas/tasks-provider"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { listProjects } from "@/lib/supabase/projects.browser"
import type { Project } from "@/lib/types/projects"

export function useOperationalData() {
  const { tasks } = useTasks()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    if (!isAuthReady || !companyId) {
      setProjects([])
      return
    }

    let cancelled = false

    void listProjects(companyId).then((result) => {
      if (cancelled) return
      setProjects(result.data ?? [])
    })

    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady])

  return {
    tasks,
    projects,
  }
}
