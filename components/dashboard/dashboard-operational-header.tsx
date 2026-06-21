import Link from "next/link"
import { CalendarDays, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"

export function DashboardOperationalHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Dashboard Operativo
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Visión general de la operación en tiempo real.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 self-start">
        <Button size="sm" className="gap-1.5" asChild>
          <Link href="/obras">
            <Plus className="size-4" />
            Nueva Obra
          </Link>
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" asChild>
          <Link href="/tareas">
            <Plus className="size-4" />
            Nueva Tarea
          </Link>
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" asChild>
          <Link href="/operations/calendar">
            <CalendarDays className="size-4" />
            Ver Calendario
          </Link>
        </Button>
      </div>
    </div>
  )
}
