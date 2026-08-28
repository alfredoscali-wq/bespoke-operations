import type { MaterialActiveReservation } from "@/lib/types/materials"
import { getTaskMaterialLineReservationDisplay } from "@/lib/materials/reservation-status"
import { formatUnitLabel } from "@/lib/materials/units"
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

type MaterialAssignmentsTabProps = {
  activeReservations: MaterialActiveReservation[]
}

export function MaterialAssignmentsTab({
  activeReservations,
}: MaterialAssignmentsTabProps) {
  if (activeReservations.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Reservas activas</CardTitle>
          <CardDescription>
            No hay stock reservado para otras órdenes de trabajo.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Reservas activas</CardTitle>
        <CardDescription>
          Stock reservado por OT confirmadas. No descuenta stock físico.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>OT</TableHead>
              <TableHead>Cliente / Obra</TableHead>
              <TableHead>Cantidad</TableHead>
              <TableHead>Depósito</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeReservations.map((reservation) => {
              const status = getTaskMaterialLineReservationDisplay(
                reservation.status
              )
              return (
                <TableRow key={reservation.id}>
                  <TableCell className="font-mono text-sm">
                    {reservation.taskCode}
                  </TableCell>
                  <TableCell>{reservation.customerLabel}</TableCell>
                  <TableCell className="tabular-nums">
                    {reservation.quantity.toLocaleString("es-AR")}{" "}
                    {formatUnitLabel(reservation.unit)}
                  </TableCell>
                  <TableCell>{reservation.warehouseName}</TableCell>
                  <TableCell>
                    <span
                      className={
                        status.tone === "success"
                          ? "text-emerald-600"
                          : "text-muted-foreground"
                      }
                    >
                      {status.label}
                    </span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
