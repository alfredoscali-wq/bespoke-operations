"use client"

import { useMemo, useState } from "react"
import { Eye, Wallet } from "lucide-react"
import Link from "next/link"

import { useTreasury } from "@/components/tesoreria/treasury-provider"
import { TreasuryConfirmRenditionDialog } from "@/components/tesoreria/treasury-confirm-rendition-dialog"
import { TreasuryHistoryFilterBanner } from "@/components/tesoreria/treasury-history-filter-banner"
import { formatTreasuryPaymentMethodLabel } from "@/lib/tesoreria/ot-rendition-payment"
import {
  TREASURY_OT_RENDITION_STATUS_LABELS,
} from "@/lib/tesoreria/ot-rendition-status"
import { listPendingOtRenditions } from "@/lib/tesoreria/ot-renditions"
import { formatTreasuryAmount } from "@/lib/tesoreria/summary"
import { formatTaskAdminDisplayCode } from "@/lib/tasks/utils"
import type { TreasuryOtRendition } from "@/lib/types/treasury-ot-renditions"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function TreasuryPendingRenditionsList() {
  const { otRenditions, isReady, canWrite, historyFilter } = useTreasury()
  const [selected, setSelected] = useState<TreasuryOtRendition | null>(null)

  const rows = useMemo(
    () => listPendingOtRenditions(otRenditions),
    [otRenditions]
  )

  if (historyFilter.type !== "pendingRendition") return null

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold">Pendientes de Rendición</h2>
        <p className="text-xs text-muted-foreground">
          Cobros de OT finalizadas que aún no ingresaron a caja. No se pueden
          eliminar desde aquí.
        </p>
      </div>

      <TreasuryHistoryFilterBanner />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>OT</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Cuadrilla</TableHead>
              <TableHead>Importe</TableHead>
              <TableHead>Medio Esperado</TableHead>
              <TableHead>Fecha Cobro</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isReady ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-20 text-center text-sm text-muted-foreground"
                >
                  Cargando pendientes...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-20 text-center text-sm text-muted-foreground"
                >
                  No hay OT pendientes de rendición.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium tabular-nums">
                    {formatTaskAdminDisplayCode(row.taskCode) || row.taskCode}
                  </TableCell>
                  <TableCell className="max-w-[10rem] truncate">
                    {row.customerName || "—"}
                  </TableCell>
                  <TableCell className="max-w-[9rem] truncate">
                    {row.crewName || "Sin cuadrilla"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatTreasuryAmount(row.amount)}
                  </TableCell>
                  <TableCell>
                    {formatTreasuryPaymentMethodLabel(row.paymentMethodExpected)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {row.collectionDate}
                  </TableCell>
                  <TableCell>
                    {TREASURY_OT_RENDITION_STATUS_LABELS[row.status]}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        asChild
                        title="Ver OT"
                      >
                        <Link href={`/tareas/${row.taskId}`}>
                          <Eye className="size-4" />
                          <span className="sr-only">Ver OT</span>
                        </Link>
                      </Button>
                      {canWrite ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => setSelected(row)}
                        >
                          <Wallet className="size-3.5" />
                          Registrar Rendición
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TreasuryConfirmRenditionDialog
        open={Boolean(selected)}
        rendition={selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      />
    </div>
  )
}
