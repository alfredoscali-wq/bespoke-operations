"use client"

import { useMemo, useState } from "react"
import { Trash2 } from "lucide-react"

import { useTreasury } from "@/components/tesoreria/treasury-provider"
import {
  formatTreasuryCategoryLabel,
  TREASURY_MOVEMENT_TYPES,
  TREASURY_ORIGIN_LABELS,
  TREASURY_STATUS_LABELS,
  TREASURY_STATUSES,
  TREASURY_TYPE_LABELS,
} from "@/lib/tesoreria/categories"
import {
  filterTreasuryMovementsByRange,
  filterTreasuryMovementsBySearch,
  formatTreasuryAmount,
} from "@/lib/tesoreria/summary"
import type { TreasuryHistoryRange, TreasuryMovement } from "@/lib/types/tesoreria"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

const RANGE_OPTIONS: Array<{ value: TreasuryHistoryRange; label: string }> = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "all", label: "Todo" },
]

export function TreasuryMovementsHistory() {
  const {
    movements,
    isReady,
    canWrite,
    canHardDelete,
    cancelMovement,
    hardDeleteMovement,
  } = useTreasury()
  const [range, setRange] = useState<TreasuryHistoryRange>("month")
  const [search, setSearch] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<TreasuryMovement | null>(
    null
  )
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const rows = useMemo(() => {
    const byRange = filterTreasuryMovementsByRange(movements, range)
    return filterTreasuryMovementsBySearch(byRange, search)
  }, [movements, range, search])

  async function handleCancel(id: string) {
    setBusyId(id)
    try {
      await cancelMovement(id)
    } finally {
      setBusyId(null)
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return
    setDeleteError(null)
    setIsDeleting(true)
    try {
      const result = await hardDeleteMovement(pendingDelete.id)
      if (!result.success) {
        setDeleteError(
          result.message ?? "No se pudo eliminar el movimiento."
        )
        return
      }
      setPendingDelete(null)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Historial</h2>
          <p className="text-xs text-muted-foreground">
            Movimientos más recientes primero.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={range === option.value ? "default" : "outline"}
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <Input
        className="h-9 max-w-sm bg-background"
        placeholder="Buscar por categoría, empleado, notas..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Origen</TableHead>
              <TableHead>Empleado</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Registrado por</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isReady ? (
              <TableRow>
                <TableCell colSpan={9} className="h-20 text-center text-sm text-muted-foreground">
                  Cargando movimientos...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-20 text-center text-sm text-muted-foreground">
                  No hay movimientos para los filtros seleccionados.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((movement) => {
                const showCancel =
                  canWrite && movement.status !== TREASURY_STATUSES.CANCELLED
                const showDelete = canHardDelete
                const hasActions = showCancel || showDelete

                return (
                  <TableRow key={movement.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {movement.movementDate}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-sm font-medium",
                        movement.movementType === TREASURY_MOVEMENT_TYPES.INCOME
                          ? "text-emerald-700"
                          : "text-rose-700"
                      )}
                    >
                      {TREASURY_TYPE_LABELS[movement.movementType]}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatTreasuryCategoryLabel(
                        movement.movementType,
                        movement.category
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {TREASURY_ORIGIN_LABELS[movement.origin]}
                    </TableCell>
                    <TableCell className="text-sm">
                      {movement.employeeName ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {formatTreasuryAmount(movement.amount)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {TREASURY_STATUS_LABELS[movement.status]}
                    </TableCell>
                    <TableCell className="text-sm">
                      {movement.registeredByName ?? "—"}
                    </TableCell>
                    <TableCell>
                      {hasActions ? (
                        <div className="flex flex-wrap gap-2">
                          {showCancel ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busyId === movement.id || isDeleting}
                              onClick={() => void handleCancel(movement.id)}
                            >
                              Anular
                            </Button>
                          ) : null}
                          {showDelete ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={busyId === movement.id || isDeleting}
                              onClick={() => {
                                setDeleteError(null)
                                setPendingDelete(movement)
                              }}
                            >
                              <Trash2 className="size-3.5" />
                              Eliminar
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setPendingDelete(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar movimiento</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Esta acción eliminará definitivamente el movimiento de
                  Tesorería.
                </p>
                <p>No podrá recuperarse posteriormente.</p>
                <p>¿Desea continuar?</p>
              </div>
            </DialogDescription>
          </DialogHeader>

          {deleteError ? (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => {
                setPendingDelete(null)
                setDeleteError(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => void handleConfirmDelete()}
            >
              {isDeleting ? "Eliminando…" : "Eliminar definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
