"use client"

import { formatDateOnly } from "@/lib/dates/date-only"
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

export function ReportsOldestPending() {
  const { oldestPendingTasks } = useReports()

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Pendientes más antiguas
        </CardTitle>
        <CardDescription>
          Hasta 10 órdenes abiertas con mayor antigüedad desde la fecha programada.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {oldestPendingTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              Sin pendientes en el período
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              No hay órdenes abiertas que coincidan con los filtros seleccionados.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fecha programada</TableHead>
                    <TableHead className="text-right">Días pendientes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {oldestPendingTasks.map((row) => (
                    <TableRow key={row.taskId}>
                      <TableCell className="font-medium">{row.customer}</TableCell>
                      <TableCell>{row.serviceTypeLabel}</TableCell>
                      <TableCell>
                        {formatDateOnly(row.scheduledDate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.pendingDays}
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
