import Link from "next/link"

import { MovementTypeBadge } from "@/components/materiales/material-badges"
import { formatMaterialDateTime } from "@/lib/materials/constants"
import type { MaterialMovement } from "@/lib/types/materials"
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

type MaterialMovementsTabProps = {
  movements: MaterialMovement[]
}

export function MaterialMovementsTab({
  movements,
}: MaterialMovementsTabProps) {
  if (movements.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Movimientos</CardTitle>
          <CardDescription>
            No hay movimientos registrados para este material.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Movimientos de inventario</CardTitle>
        <CardDescription>
          {movements.length}{" "}
          {movements.length === 1 ? "movimiento" : "movimientos"} registrados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="hidden overflow-hidden rounded-xl border lg:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Cantidad</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Proyecto / Tarea</TableHead>
                <TableHead>Usuario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="text-sm">
                    {formatMaterialDateTime(movement.timestamp)}
                  </TableCell>
                  <TableCell>
                    <MovementTypeBadge type={movement.type} />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {movement.quantity > 0 ? "+" : ""}
                    {movement.quantity.toLocaleString("es-MX")}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {movement.reference ?? "—"}
                  </TableCell>
                  <TableCell>
                    {movement.projectCode ? (
                      <div className="space-y-0.5 text-sm">
                        {movement.projectId && (
                          <Link
                            href={`/obras/${movement.projectId}`}
                            className="font-mono text-xs text-primary hover:underline"
                          >
                            {movement.projectCode}
                          </Link>
                        )}
                        {movement.taskCode && movement.taskId && (
                          <Link
                            href={`/tareas/${movement.taskId}`}
                            className="block text-xs text-muted-foreground hover:text-primary"
                          >
                            {movement.taskCode}
                          </Link>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{movement.user}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-3 lg:hidden">
          {movements.map((movement) => (
            <div
              key={movement.id}
              className="rounded-xl border bg-muted/20 p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <MovementTypeBadge type={movement.type} />
                <span className="text-sm tabular-nums font-medium">
                  {movement.quantity > 0 ? "+" : ""}
                  {movement.quantity.toLocaleString("es-MX")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatMaterialDateTime(movement.timestamp)}
              </p>
              {movement.notes && (
                <p className="text-sm text-muted-foreground">{movement.notes}</p>
              )}
              <p className="text-xs text-muted-foreground">{movement.user}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
