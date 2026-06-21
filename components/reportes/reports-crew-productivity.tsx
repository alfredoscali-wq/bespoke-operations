"use client"

import { useReports } from "@/components/reportes/reports-provider"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatComplianceValue } from "@/lib/reports/report-utils"

export function ReportsCrewProductivity() {
  const { crewProductivity } = useReports()

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Productividad por cuadrilla
        </CardTitle>
        <CardDescription>
          Métricas por cuadrilla según los filtros activos del reporte.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {crewProductivity.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              Sin datos para mostrar
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajusta el período o los filtros para ver productividad por cuadrilla.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Cuadrilla</TableHead>
                    <TableHead className="text-right">Programadas</TableHead>
                    <TableHead className="text-right">Completadas</TableHead>
                    <TableHead className="text-right">Canceladas</TableHead>
                    <TableHead className="text-right">Cumplimiento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {crewProductivity.map((row) => (
                    <TableRow key={row.crewId}>
                      <TableCell className="font-medium">{row.crewName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.programmed}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.completed}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.cancelled}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatComplianceValue(row.compliance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
