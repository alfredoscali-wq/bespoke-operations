"use client"

import { useReports } from "@/components/reportes/reports-provider"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatComplianceValue } from "@/lib/reports/report-utils"

const RANKING_MEDALS = ["🥇", "🥈", "🥉"] as const

const RANKING_LABELS = [
  "Primer puesto",
  "Segundo puesto",
  "Tercer puesto",
] as const

export function ReportsCrewRanking() {
  const { crewRanking } = useReports()

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Ranking de cuadrillas
        </CardTitle>
        <CardDescription>
          Top 3 por cumplimiento; en empate, gana quien tenga más completadas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {crewRanking.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              Sin cuadrillas para rankear
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              No hay cuadrillas con datos en el período seleccionado.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {crewRanking.map((row, index) => (
              <div
                key={row.crewId}
                className="rounded-xl border bg-muted/20 px-4 py-4"
              >
                <p className="text-2xl">{RANKING_MEDALS[index]}</p>
                <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {RANKING_LABELS[index]}
                </p>
                <p className="mt-1 text-base font-semibold text-foreground">
                  {row.crewName}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Cumplimiento:{" "}
                  <span className="font-medium text-foreground">
                    {formatComplianceValue(row.compliance)}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Completadas:{" "}
                  <span className="font-medium text-foreground">
                    {row.completed}
                  </span>
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
