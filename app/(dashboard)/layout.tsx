import { CrewsProvider } from "@/components/cuadrillas/crews-provider"
import { EvidenceProvider } from "@/components/evidencias/evidence-provider"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ProjectsProvider } from "@/components/obras/projects-provider"
import { TasksProvider } from "@/components/tareas/tasks-provider"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ProjectsProvider>
      <TasksProvider>
        <CrewsProvider>
          <EvidenceProvider>
            <DashboardLayout>{children}</DashboardLayout>
          </EvidenceProvider>
        </CrewsProvider>
      </TasksProvider>
    </ProjectsProvider>
  )
}
