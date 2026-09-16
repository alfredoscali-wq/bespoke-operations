"use client"

import { useEffect, useState } from "react"
import { notFound } from "next/navigation"

import { ProjectDesignWorkspace } from "@/components/obras/design/project-design-workspace"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { createBrowserProjectsClient } from "@/lib/supabase/projects.browser"
import { fetchProjectById } from "@/lib/supabase/projects.queries"
import type { Project } from "@/lib/types/projects"

type ProjectDesignPageClientProps = {
  projectId: string
}

export function ProjectDesignPageClient({
  projectId,
}: ProjectDesignPageClientProps) {
  const { companyId, isAuthReady, isDemoTenant } = useTenantCompanyId()
  const [project, setProject] = useState<Project | null>(null)
  const [missing, setMissing] = useState(false)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthReady || !companyId) {
      return
    }

    let cancelled = false
    void fetchProjectById(
      createBrowserProjectsClient(),
      projectId,
      companyId
    ).then((result) => {
      if (cancelled) {
        return
      }
      if (result.error || !result.data) {
        setMissing(true)
        setProject(null)
      } else {
        setProject(result.data)
        setMissing(false)
      }
      setLoadedKey(`${companyId}:${projectId}`)
    })

    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady, projectId])

  if (!isAuthReady) {
    return (
      <p className="text-sm text-muted-foreground">Cargando diseño de obra…</p>
    )
  }

  if (!companyId) {
    notFound()
  }

  if (loadedKey !== `${companyId}:${projectId}`) {
    return (
      <p className="text-sm text-muted-foreground">Cargando diseño de obra…</p>
    )
  }

  if (missing || !project) {
    notFound()
  }

  return (
    <ProjectDesignWorkspace
      project={project}
      companyId={companyId}
      readOnly={isDemoTenant}
    />
  )
}
