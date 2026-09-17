"use client"

import { DemoPlatformBanner } from "@/components/demo/demo-platform-banner"
import { useDemoMode } from "@/components/demo/demo-mode-provider"
import { OperarioBottomNav } from "@/components/operario/operario-bottom-nav"
import { OperarioHeader } from "@/components/operario/operario-header"
import { OperarioProvider, useOperario } from "@/components/operario/operario-provider"
import {
  OperarioSessionDayTasksSync,
  OperarioSessionProvider,
} from "@/components/operario/operario-session-provider"
import { TasksProvider } from "@/components/tareas/tasks-provider"

function OperarioTodayTasksProvider({ children }: { children: React.ReactNode }) {
  const { workerCrewRef, isCrewReady } = useOperario()

  return (
    <TasksProvider
      listScope="operarioToday"
      operarioCrew={workerCrewRef}
      isOperarioCrewReady={isCrewReady}
    >
      <OperarioSessionDayTasksSync />
      {children}
    </TasksProvider>
  )
}

export function OperarioShell({ children }: { children: React.ReactNode }) {
  const { showBanner } = useDemoMode()

  return (
    <OperarioSessionProvider>
      <OperarioProvider>
        <OperarioTodayTasksProvider>
          <div className="min-h-dvh bg-[#f4f6f9]">
            {showBanner ? <DemoPlatformBanner /> : null}
            <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
              <OperarioHeader />
              <main className="flex-1 pb-24">{children}</main>
              <OperarioBottomNav />
            </div>
          </div>
        </OperarioTodayTasksProvider>
      </OperarioProvider>
    </OperarioSessionProvider>
  )
}
