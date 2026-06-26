"use client"

import { EvidenceProvider } from "@/components/evidencias/evidence-provider"
import { ProjectsProvider } from "@/components/obras/projects-provider"
import { TasksProvider } from "@/components/tareas/tasks-provider"

export function EvidenciasModuleProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProjectsProvider>
      <TasksProvider>
        <EvidenceProvider>{children}</EvidenceProvider>
      </TasksProvider>
    </ProjectsProvider>
  )
}
