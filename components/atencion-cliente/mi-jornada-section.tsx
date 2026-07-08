"use client"

import { useMemo } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import {
  filterJornadaEntries,
  type JornadaFilter,
} from "@/lib/customer-seguimientos/jornada"
import {
  mapDashboardFilterToJornadaFilter,
  type AtencionClienteDashboardFilter,
} from "@/lib/customer-seguimientos/kpis"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"

type MiJornadaSectionProps = {
  dashboardFilter: AtencionClienteDashboardFilter
  highlighted?: boolean
}

function toneForEntry(tone: "green" | "blue" | "neutral"): keyof typeof STATUS_TONE_STYLES {
  if (tone === "green") {
    return "green"
  }

  if (tone === "blue") {
    return "blue"
  }

  return "neutral"
}

export function MiJornadaSection({
  dashboardFilter,
  highlighted = false,
}: MiJornadaSectionProps) {
  const { jornadaEntries, isDashboardLoading } = useAtencionCliente()

  const jornadaFilter: JornadaFilter = useMemo(() => {
    return mapDashboardFilterToJornadaFilter(dashboardFilter)
  }, [dashboardFilter])

  const entries = useMemo(
    () => filterJornadaEntries(jornadaEntries, jornadaFilter),
    [jornadaEntries, jornadaFilter]
  )

  return (
    <Card className={cn(highlighted && "ring-2 ring-primary/20")}>
      <CardHeader>
        <CardTitle>Mi Jornada</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isDashboardLoading ? (
          <p className="text-sm text-muted-foreground">Cargando jornada…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay actividad registrada hoy.
          </p>
        ) : (
          entries.map((entry) => (
            <div
              key={`${entry.kind}-${entry.id}`}
              className="rounded-lg border px-3 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {new Date(entry.occurredAt).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <Badge
                  variant="outline"
                  className={STATUS_TONE_STYLES[toneForEntry(entry.tone)]}
                >
                  {entry.title}
                </Badge>
              </div>
              <p className="mt-2 text-sm font-medium">{entry.subtitle}</p>
              <p className="text-sm text-muted-foreground">{entry.detail}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
