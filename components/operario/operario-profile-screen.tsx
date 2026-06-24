"use client"

import { HardHat, ClipboardList, Users } from "lucide-react"

import { useTasks } from "@/components/tareas/tasks-provider"
import {
  OperarioCrewStatusMessage,
} from "@/components/operario/operario-crew-status-message"
import { useOperario } from "@/components/operario/operario-provider"
import { getWorkerTasks } from "@/lib/data/operario"
import type { OperarioCrewStatus } from "@/lib/operario/crew"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

function resolveCrewDisplayLabel(
  crewStatus: OperarioCrewStatus,
  crewName: string
): string {
  if (crewStatus === "loading") {
    return "—"
  }

  if (crewStatus === "unassigned" || !crewName.trim()) {
    return "Sin cuadrilla asignada"
  }

  return crewName
}

export function OperarioProfileScreen() {
  const {
    identity,
    isIdentityReady,
    workerCrewRef,
    crewStatus,
    assignedCrewNames,
    isCrewReady,
  } = useOperario()
  const { tasks } = useTasks()
  const assignedCount =
    crewStatus === "resolved" || crewStatus === "multiple"
      ? getWorkerTasks(tasks, workerCrewRef).length
      : 0

  return (
    <div className="space-y-6 px-4 pt-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Perfil
        </h1>
        <p className="text-sm text-muted-foreground">Tu información de campo</p>
      </header>

      <OperarioCrewStatusMessage
        crewStatus={crewStatus}
        primaryCrewName={workerCrewRef.name}
        assignedCrewNames={assignedCrewNames}
      />

      <section className="flex flex-col items-center rounded-2xl border bg-card p-6 shadow-sm">
        <Avatar className="size-20">
          <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
            {isIdentityReady ? (
              identity.initials
            ) : (
              <span className="inline-block size-8 animate-pulse rounded bg-muted" />
            )}
          </AvatarFallback>
        </Avatar>
        {isIdentityReady ? (
          <>
            <h2 className="mt-4 text-xl font-bold text-foreground">
              {identity.displayName}
            </h2>
            <p className="text-sm text-muted-foreground">{identity.roleLabel}</p>
          </>
        ) : (
          <div className="mt-4 space-y-2">
            <span className="mx-auto block h-6 w-40 animate-pulse rounded bg-muted" />
            <span className="mx-auto block h-4 w-24 animate-pulse rounded bg-muted" />
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
          <Users className="size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Cuadrilla</p>
            {isCrewReady ? (
              <p className="font-medium">
                {resolveCrewDisplayLabel(crewStatus, workerCrewRef.name)}
              </p>
            ) : (
              <span className="inline-block h-5 w-32 animate-pulse rounded bg-muted" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
          <HardHat className="size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Rol</p>
            <p className="font-medium">
              {isIdentityReady ? identity.roleLabel : "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
          <ClipboardList className="size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Tareas asignadas</p>
            <p className="font-medium">
              {isCrewReady ? `${assignedCount} tareas activas` : "—"}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
