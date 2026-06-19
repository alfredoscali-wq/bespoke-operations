import { CustomersProvider } from "@/components/clientes/customers-provider"
import { CrewsProvider } from "@/components/cuadrillas/crews-provider"
import { AvailabilityProvider } from "@/components/disponibilidad/availability-provider"
import { EvidenceProvider } from "@/components/evidencias/evidence-provider"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ProjectsProvider } from "@/components/obras/projects-provider"
import { EmployeesProvider } from "@/components/rrhh/employees-provider"
import { TasksProvider } from "@/components/tareas/tasks-provider"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <ProjectsProvider>
      <CustomersProvider>
        <TasksProvider>
          <EmployeesProvider>
            <AvailabilityProvider>
              <CrewsProvider>
                <EvidenceProvider>
                  <DashboardLayout>{children}</DashboardLayout>
                </EvidenceProvider>
              </CrewsProvider>
            </AvailabilityProvider>
          </EmployeesProvider>
        </TasksProvider>
      </CustomersProvider>
    </ProjectsProvider>
  )
}
