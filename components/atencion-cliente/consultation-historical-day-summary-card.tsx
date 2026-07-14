"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { SharedInboxHistoricalDaySummary } from "@/lib/customer-atenciones/shared-inbox"

type ConsultationHistoricalDaySummaryCardProps = {
  summary: SharedInboxHistoricalDaySummary
}

export function ConsultationHistoricalDaySummaryCard({
  summary,
}: ConsultationHistoricalDaySummaryCardProps) {
  const dateLabel = new Date(
    `${summary.createdDate}T12:00:00`
  ).toLocaleDateString("es-AR")

  return (
    <Card className="border-dashed bg-muted/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Resumen del día · {dateLabel}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">
              Consultas ingresadas
            </dt>
            <dd className="text-lg font-semibold tabular-nums">
              {summary.ingresadas.toLocaleString("es-AR")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Consultas resueltas
            </dt>
            <dd className="text-lg font-semibold tabular-nums">
              {summary.resueltas.toLocaleString("es-AR")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              Consultas pendientes
            </dt>
            <dd className="text-lg font-semibold tabular-nums">
              {summary.pendientes.toLocaleString("es-AR")}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
