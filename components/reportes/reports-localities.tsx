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

export function ReportsLocalities() {
  const { localityReport } = useReports()

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Localidades</CardTitle>
        <CardDescription>
          Concentración de órdenes por localidad según los filtros activos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {localityReport.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              Sin datos para mostrar
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajusta el período o los filtros para ver distribución por localidad.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Localidad</TableHead>
                    <TableHead className="text-right">Órdenes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localityReport.map((row) => (
                    <TableRow key={row.locality}>
                      <TableCell className="font-medium">{row.locality}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.count}
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
