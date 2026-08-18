"use client"

import { useMemo, useState } from "react"

import { useTreasury } from "@/components/tesoreria/treasury-provider"
import { buildTreasuryCategorySummary } from "@/lib/tesoreria/history-filter"
import {
  formatTreasuryAmount,
  formatTreasurySignedAmount,
} from "@/lib/tesoreria/summary"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type TreasuryCategorySummaryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TreasuryCategorySummaryDialog({
  open,
  onOpenChange,
}: TreasuryCategorySummaryDialogProps) {
  const { movements, historyRange, selectHistoryFilter } = useTreasury()
  const [now] = useState(() => new Date())
  const rows = useMemo(
    () => buildTreasuryCategorySummary(movements, historyRange, now),
    [movements, historyRange, now]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Resumen por Categoría</DialogTitle>
          <DialogDescription>
            Movimientos del período seleccionado
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
                <TableHead className="text-right">Egresos</TableHead>
                <TableHead className="text-right">Neto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-20 text-center text-sm text-muted-foreground"
                  >
                    No hay movimientos confirmados en el período.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow
                    key={row.category}
                    className="cursor-pointer hover:bg-muted/60"
                    onClick={() => {
                      selectHistoryFilter({
                        type: "category",
                        category: row.category,
                      })
                      onOpenChange(false)
                    }}
                  >
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTreasuryAmount(row.income)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatTreasuryAmount(row.expense)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        row.net > 0
                          ? "text-emerald-700"
                          : row.net < 0
                            ? "text-rose-700"
                            : "text-muted-foreground"
                      )}
                    >
                      {formatTreasurySignedAmount(row.net)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
