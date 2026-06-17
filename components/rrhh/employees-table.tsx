"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { EmployeeTypeBadge, EmploymentStatusBadge } from "@/components/rrhh/employee-badges"
import { EmployeeFormDialog } from "@/components/rrhh/employee-form-dialog"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import type { EmployeeListItem, NewEmployeeInput } from "@/lib/types/employees"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  DropdownMenuSeparator,
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

type EmployeesTableProps = {
  employees: EmployeeListItem[]
}

type Feedback = {
  variant: "success" | "error"
  message: string
} | null

export function EmployeesTable({ employees }: EmployeesTableProps) {
  const router = useRouter()
  const { editEmployee, removeEmployee } = useEmployees()
  const [editTarget, setEditTarget] = useState<EmployeeListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EmployeeListItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  async function handleEdit(input: NewEmployeeInput) {
    if (!editTarget) return
    const result = await editEmployee(editTarget.id, input)
    if (!result.success) {
      throw new Error(result.message ?? "No se pudo actualizar al empleado.")
    }
    setFeedback({
      variant: "success",
      message: "Empleado actualizado correctamente.",
    })
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setFeedback(null)
    setIsDeleting(true)

    try {
      const result = await removeEmployee(deleteTarget.id)
      if (!result.success) {
        setFeedback({
          variant: "error",
          message: result.message ?? "No se pudo eliminar al empleado.",
        })
        return
      }
      setDeleteTarget(null)
      setFeedback({
        variant: "success",
        message: `Empleado "${deleteTarget.displayName}" eliminado.`,
      })
    } finally {
      setIsDeleting(false)
    }
  }

  if (employees.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          No hay empleados registrados
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre un empleado para comenzar a gestionar el personal.
        </p>
      </div>
    )
  }

  function renderActions(employee: EmployeeListItem) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Acciones</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => router.push(`/rrhh/${employee.id}`)}
          >
            <Eye className="size-4" />
            Ver detalle
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditTarget(employee)}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteTarget(employee)}
          >
            <Trash2 className="size-4" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <>
      <EntityActionFeedback
        message={feedback?.message ?? null}
        variant={feedback?.variant ?? "success"}
      />

      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-sm lg:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-mono text-sm">
                    <Link
                      href={`/rrhh/${employee.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {employee.employeeCode}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/rrhh/${employee.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {employee.displayName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {[employee.firstName, employee.lastName]
                        .filter(Boolean)
                        .join(" ")}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {employee.jobTitle || "—"}
                  </TableCell>
                  <TableCell>
                    <EmployeeTypeBadge employeeType={employee.employeeType} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {employee.department || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {employee.phone || "—"}
                  </TableCell>
                  <TableCell>
                    <EmploymentStatusBadge status={employee.employmentStatus} />
                  </TableCell>
                  <TableCell>{renderActions(employee)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {employees.map((employee) => (
          <Card key={employee.id} className="h-full shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/rrhh/${employee.id}`}>
                    <CardTitle className="text-base hover:text-primary">
                      {employee.displayName}
                    </CardTitle>
                  </Link>
                  <CardDescription className="font-mono">
                    {employee.employeeCode}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <EmployeeTypeBadge employeeType={employee.employeeType} />
                  <EmploymentStatusBadge status={employee.employmentStatus} />
                  {renderActions(employee)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                <span className="text-muted-foreground">Cargo:</span>{" "}
                {employee.jobTitle || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Departamento:</span>{" "}
                {employee.department || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Teléfono:</span>{" "}
                {employee.phone || "—"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <EmployeeFormDialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null)
        }}
        mode="edit"
        employee={editTarget ?? undefined}
        onSubmit={handleEdit}
      />

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar empleado</DialogTitle>
            <DialogDescription>
              ¿Desea eliminar este registro? Esta acción no se puede deshacer.
              {deleteTarget ? (
                <>
                  {" "}
                  <span className="font-medium text-foreground">
                    {deleteTarget.displayName}
                  </span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
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
