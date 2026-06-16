"use client"

import { useState } from "react"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { AvailabilityBadge } from "@/components/disponibilidad/availability-badge"
import { AvailabilityFormDialog } from "@/components/disponibilidad/availability-form-dialog"
import { AvailabilityPeriodStatusBadge } from "@/components/disponibilidad/availability-period-status-badge"
import { useAvailability } from "@/components/disponibilidad/availability-provider"
import { formatAvailabilityDate } from "@/lib/availability/constants"
import type {
  CreateEmployeeAvailabilityInput,
  EmployeeAvailabilityListItem,
} from "@/lib/types/availability"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type AvailabilityTableProps = {
  items: EmployeeAvailabilityListItem[]
}

export function AvailabilityTable({ items }: AvailabilityTableProps) {
  const { editRecord, removeRecord } = useAvailability()
  const [editTarget, setEditTarget] =
    useState<EmployeeAvailabilityListItem | null>(null)
  const [deleteTarget, setDeleteTarget] =
    useState<EmployeeAvailabilityListItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleEdit(input: CreateEmployeeAvailabilityInput) {
    if (!editTarget) return
    const result = await editRecord(editTarget.id, input)
    if (!result.success) {
      throw new Error(result.message ?? "No se pudo actualizar el registro.")
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleteError(null)
    setIsDeleting(true)

    try {
      const result = await removeRecord(deleteTarget.id)
      if (!result.success) {
        setDeleteError(result.message ?? "No se pudo eliminar el registro.")
        return
      }
      setDeleteTarget(null)
    } finally {
      setIsDeleting(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          No hay novedades registradas
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cree una novedad para gestionar vacaciones, licencias y ausencias del
          personal.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Empleado</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead>Hasta</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[70px]">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="font-medium">{item.employeeName}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {item.employeeCode}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <AvailabilityBadge type={item.availabilityType} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatAvailabilityDate(item.startDate)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatAvailabilityDate(item.endDate)}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-muted-foreground">
                    {item.reason || "—"}
                  </TableCell>
                  <TableCell>
                    <AvailabilityPeriodStatusBadge status={item.periodStatus} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                          <span className="sr-only">Acciones</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditTarget(item)}>
                          <Pencil className="size-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 className="size-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <AvailabilityFormDialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null)
        }}
        mode="edit"
        record={editTarget ?? undefined}
        onSubmit={handleEdit}
      />

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar novedad</DialogTitle>
            <DialogDescription>
              ¿Confirma eliminar la novedad de{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.employeeName}
              </span>
              ?
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
