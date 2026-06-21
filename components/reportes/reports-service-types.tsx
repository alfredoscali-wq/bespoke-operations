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

export function ReportsServiceTypes() {
  const { serviceTypeReport } = useReports()

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Órdenes por tipo</CardTitle>
        <CardDescription>
          Distribución de órdenes según tipo de trabajo en el período filtrado.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {serviceTypeReport.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              Sin datos para mostrar
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajusta el período o los filtros para ver órdenes por tipo.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Tipo de trabajo</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceTypeReport.map((row) => (
                    <TableRow key={row.serviceType}>
                      <TableCell className="font-medium">{row.label}</TableCell>
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
