"use client"

import { HardHat, ClipboardList, Users } from "lucide-react"

import { useTasks } from "@/components/tareas/tasks-provider"
import { useOperario } from "@/components/operario/operario-provider"
import { getWorkerTasks } from "@/lib/data/operario"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export function OperarioProfileScreen() {
  const { worker } = useOperario()
  const { tasks } = useTasks()
  const assignedCount = getWorkerTasks(tasks).length

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
            {worker.initials}
          </AvatarFallback>
        </Avatar>
        <h2 className="mt-4 text-xl font-bold text-foreground">{worker.name}</h2>
        <p className="text-sm text-muted-foreground">{worker.position}</p>
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
          <Users className="size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Cuadrilla</p>
            <p className="font-medium">{worker.crew}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
          <HardHat className="size-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Puesto</p>
            <p className="font-medium">{worker.position}</p>
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
