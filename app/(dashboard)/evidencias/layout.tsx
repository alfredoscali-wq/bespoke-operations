import { ProjectsProvider } from "@/components/obras/projects-provider"
import { TasksProvider } from "@/components/tareas/tasks-provider"

export default function EvidenciasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProjectsProvider>
      <TasksProvider>{children}</TasksProvider>
    </ProjectsProvider>
  )
}
