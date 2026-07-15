"use client"

import { formatDateOnly } from "@/lib/dates/date-only"
import { useEmployeeReports } from "@/components/reportes/empleado/employee-reports-provider"
import {
  Card,
  CardContent,
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
import { Skeleton } from "@/components/ui/skeleton"

function formatActivityDate(value: string): string {
  if (!value || value === "—") {
    return "—"
  }
  try {
    return formatDateOnly(value)
  } catch {
    return value
  }
}

export function EmployeeReportActivityList() {
  const { filteredActivity, activeKpiKey, isLoading, report } =
    useEmployeeReports()

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Actividad del período</CardTitle>
        <p className="text-sm text-muted-foreground">
          {activeKpiKey
            ? `Filtrado por indicador activo · ${filteredActivity.length} registros`
            : `${filteredActivity.length} registros relacionados con el empleado`}
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : !report ? (
          <p className="text-sm text-muted-foreground">
            Sin empleado seleccionado.
          </p>
        ) : filteredActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay actividad para mostrar con los filtros actuales.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>OT / Ref.</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Tiempo</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Supervisor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredActivity.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatActivityDate(row.date)}
                    </TableCell>
                    <TableCell>{row.customer}</TableCell>
                    <TableCell className="font-medium">{row.reference}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{row.durationLabel}</TableCell>
                    <TableCell>{row.result}</TableCell>
                    <TableCell>{row.supervisor}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
