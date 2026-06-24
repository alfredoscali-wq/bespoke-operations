"use client"

import { HardHat, ClipboardList, Users } from "lucide-react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { useOperario } from "@/components/operario/operario-provider"
import { getWorkerTasks, resolveWorkerCrewRef } from "@/lib/data/operario"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function OperarioProfileScreen() {
  const { identity, isIdentityReady, crewName } = useOperario()
  const { tasks } = useTasks()
  const { crews } = useCrews()
  const workerCrew = resolveWorkerCrewRef(crewName, crews)
  const assignedCount = getWorkerTasks(tasks, workerCrew).length

  return (
    <div className="space-y-6 px-4 pt-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Perfil
        </h1>
        <p className="text-sm text-muted-foreground">Tu información de campo</p>
      </header>

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
            <p className="font-medium">{crewName}</p>
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
            <p className="font-medium">{assignedCount} tareas activas</p>
          </div>
        </div>
      </section>
    </div>
  )
}
