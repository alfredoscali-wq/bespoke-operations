"use client"

import Link from "next/link"
import { Eye } from "lucide-react"

import {
  formatCustomerAtencionChannelLabel,
  formatCustomerAtencionMotivoLabel,
  formatCustomerAtencionResultadoLabel,
} from "@/lib/customer-atenciones/format"
import type { CustomerAtencionListRow } from "@/lib/types/customer-atenciones"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type AtencionesListProps = {
  items: CustomerAtencionListRow[]
}

export function AtencionesList({ items }: AtencionesListProps) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay atenciones registradas.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Canal</TableHead>
          <TableHead>Motivo</TableHead>
          <TableHead>Resultado</TableHead>
          <TableHead className="w-[80px] text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="whitespace-nowrap">
              {new Date(item.createdAt).toLocaleString("es-AR")}
            </TableCell>
            <TableCell>{item.customerName}</TableCell>
            <TableCell>{formatCustomerAtencionChannelLabel(item.channel)}</TableCell>
            <TableCell>{formatCustomerAtencionMotivoLabel(item.motivo)}</TableCell>
            <TableCell>
              {formatCustomerAtencionResultadoLabel(item.resultado)}
            </TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="icon" asChild>
                <Link href={`/atencion-cliente/${item.id}`} aria-label="Ver detalle">
                  <Eye className="size-4" />
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
