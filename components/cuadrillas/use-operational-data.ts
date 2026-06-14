"use client"

import { useEvidenceOptional } from "@/components/evidencias/evidence-provider"
import { useProjects } from "@/components/obras/projects-provider"
import { useTasks } from "@/components/tareas/tasks-provider"

export function useOperationalData() {
  const { tasks } = useTasks()
  const { projects } = useProjects()
  const evidenceContext = useEvidenceOptional()

  return {
    tasks,
    projects,
    evidence: evidenceContext?.evidence ?? [],
  }
}
