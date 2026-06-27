"use client"

import { DemoPlatformBanner } from "@/components/demo/demo-platform-banner"
import { useDemoMode } from "@/components/demo/demo-mode-provider"
import { CrewsProvider } from "@/components/cuadrillas/crews-provider"
import { EvidenceProvider } from "@/components/evidencias/evidence-provider"
import { OperarioBottomNav } from "@/components/operario/operario-bottom-nav"
import { OperarioHeader } from "@/components/operario/operario-header"
import { OperarioProvider } from "@/components/operario/operario-provider"
import { EmployeesProvider } from "@/components/rrhh/employees-provider"
import { TasksProvider } from "@/components/tareas/tasks-provider"

export function OperarioShell({ children }: { children: React.ReactNode }) {
  const { showBanner } = useDemoMode()

  return (
    <EvidenceProvider>
      <TasksProvider>
        <EmployeesProvider>
          <CrewsProvider>
            <OperarioProvider>
              <div className="min-h-dvh bg-[#f4f6f9]">
                {showBanner ? <DemoPlatformBanner /> : null}
                <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
                  <OperarioHeader />
                  <main className="flex-1 pb-24">{children}</main>
                  <OperarioBottomNav />
                </div>
              </div>
            </OperarioProvider>
          </CrewsProvider>
        </EmployeesProvider>
      </TasksProvider>
    </EvidenceProvider>
  )
}
