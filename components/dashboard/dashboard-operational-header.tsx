import Link from "next/link"
import { CalendarDays, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"

export function DashboardOperationalHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
      <div className="flex flex-wrap gap-2 self-start sm:ml-auto">
        <Button size="sm" className="gap-1.5" asChild>
          <Link href="/obras">
            <Plus className="size-4" />
            Nueva Obra
          </Link>
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" asChild>
          <Link href="/tareas">
            <Plus className="size-4" />
            Nueva Orden de Trabajo
          </Link>
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5" asChild>
          <Link href="/operations/calendar">
            <CalendarDays className="size-4" />
            Ver Calendario Operativo
          </Link>
        </Button>
      </div>
    </div>
  )
}
