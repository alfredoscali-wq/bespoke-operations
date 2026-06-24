"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import {
  EmploymentStatusBadge,
  SystemAccessBadge,
} from "@/components/rrhh/employee-badges"
import { EmployeeFormDialog } from "@/components/rrhh/employee-form-dialog"
import { useEmployees } from "@/components/rrhh/employees-provider"
import {
  cycleEmployeeSort,
  formatEmployeeTableFullName,
  getEmployeeFullName,
  sortEmployees,
} from "@/lib/employees/utils"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import type {
  EmployeeListItem,
  EmployeeSortColumn,
  EmployeeSortState,
  NewEmployeeInput,
} from "@/lib/types/employees"
import { WhatsAppLink } from "@/components/ui/whatsapp-link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
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
import { cn } from "@/lib/utils"

type EmployeesTableProps = {
  employees: EmployeeListItem[]
}

type Feedback = {
  variant: "success" | "error"
  message: string
} | null

const SORTABLE_COLUMNS: {
  key: EmployeeSortColumn
  label: string
  className?: string
}[] = [
  { key: "displayName", label: "Nombre completo", className: "min-w-[200px]" },
  { key: "nationalId", label: "DNI", className: "w-[100px]" },
  { key: "jobTitle", label: "Cargo", className: "min-w-[140px]" },
  { key: "email", label: "Email", className: "min-w-[160px]" },
  { key: "systemAccess", label: "Acceso al sistema", className: "w-[130px]" },
  { key: "employmentStatus", label: "Estado", className: "w-[120px]" },
]

function SortableTableHead({
  label,
  column,
  sort,
  onSort,
  className,
}: {
  label: string
  column: EmployeeSortColumn
  sort: EmployeeSortState
  onSort: (column: EmployeeSortColumn) => void
  className?: string
}) {
  const isActive = sort?.column === column

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-1 text-left font-medium transition-colors hover:text-foreground",
          isActive ? "text-foreground" : "text-muted-foreground"
        )}
      >
        <span>{label}</span>
        {isActive && sort.direction === "asc" ? (
          <ArrowUp className="size-3.5 shrink-0" aria-hidden />
        ) : null}
        {isActive && sort.direction === "desc" ? (
          <ArrowDown className="size-3.5 shrink-0" aria-hidden />
        ) : null}
      </button>
    </TableHead>
  )
}

export function EmployeesTable({ employees }: EmployeesTableProps) {
  const router = useRouter()
  const { editEmployee, removeEmployee } = useEmployees()
  const [sort, setSort] = useState<EmployeeSortState>(null)
  const [editTarget, setEditTarget] = useState<EmployeeListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<EmployeeListItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  const sortedEmployees = useMemo(
    () => sortEmployees(employees, sort),
    [employees, sort]
  )

  function handleSort(column: EmployeeSortColumn) {
    setSort((current) => cycleEmployeeSort(current, column))
  }

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
        message: `Empleado "${getEmployeeFullName(deleteTarget)}" eliminado.`,
      })
    } finally {
      setIsDeleting(false)
    }
  }

  if (employees.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          No hay empleados que coincidan con los filtros
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajuste la búsqueda o limpie los filtros para ver más resultados.
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
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {SORTABLE_COLUMNS.slice(0, 4).map((column) => (
                  <SortableTableHead
                    key={column.key}
                    label={column.label}
                    column={column.key}
                    sort={sort}
                    onSort={handleSort}
                    className={column.className}
                  />
                ))}
                <TableHead className="w-[120px] text-muted-foreground">
                  Teléfono
                </TableHead>
                {SORTABLE_COLUMNS.slice(4).map((column) => (
                  <SortableTableHead
                    key={column.key}
                    label={column.label}
                    column={column.key}
                    sort={sort}
                    onSort={handleSort}
                    className={column.className}
                  />
                ))}
                <TableHead className="sticky right-0 w-[60px] bg-card" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedEmployees.map((employee) => {
                const fullName = formatEmployeeTableFullName(employee)

                return (
                  <TableRow key={employee.id}>
                    <TableCell className="max-w-[240px]">
                      <Link
                        href={`/rrhh/${employee.id}`}
                        className="font-medium uppercase hover:text-primary"
                        title={fullName}
                      >
                        <span className="line-clamp-2">{fullName}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {employee.nationalId?.trim() || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <span className="line-clamp-2">
                        {employee.jobTitle || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] text-sm text-muted-foreground">
                      {employee.email?.trim() ? (
                        <a
                          href={`mailto:${employee.email.trim()}`}
                          className="block truncate hover:text-primary"
                          title={employee.email.trim()}
                        >
                          {employee.email.trim()}
                        </a>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {employee.phone ? (
                        <WhatsAppLink phone={employee.phone} />
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <SystemAccessBadge systemAccess={employee.systemAccess} />
                    </TableCell>
                    <TableCell>
                      <EmploymentStatusBadge status={employee.employmentStatus} />
                    </TableCell>
                    <TableCell className="sticky right-0 bg-card">
                      {renderActions(employee)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {sortedEmployees.map((employee) => {
          const fullName = formatEmployeeTableFullName(employee)

          return (
            <Card key={employee.id} className="h-full shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {employee.nationalId?.trim() ? (
                      <p className="font-mono text-[11px] text-muted-foreground">
                        DNI {employee.nationalId.trim()}
                      </p>
                    ) : null}
                    <Link href={`/rrhh/${employee.id}`}>
                      <CardTitle className="text-base uppercase hover:text-primary">
                        {fullName}
                      </CardTitle>
                    </Link>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {renderActions(employee)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="text-muted-foreground">Cargo:</span>{" "}
                  {employee.jobTitle || "—"}
                </p>
                <p className="truncate">
                  <span className="text-muted-foreground">Email:</span>{" "}
                  {employee.email?.trim() ? (
                    <a
                      href={`mailto:${employee.email.trim()}`}
                      className="hover:text-primary"
                    >
                      {employee.email.trim()}
                    </a>
                  ) : (
                    "—"
                  )}
                </p>
                <p>
                  <span className="text-muted-foreground">Teléfono:</span>{" "}
                  {employee.phone ? (
                    <WhatsAppLink phone={employee.phone} />
                  ) : (
                    "—"
                  )}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <SystemAccessBadge systemAccess={employee.systemAccess} />
                  <EmploymentStatusBadge status={employee.employmentStatus} />
                </div>
              </CardContent>
            </Card>
          )
        })}
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
                    {formatEmployeeTableFullName(deleteTarget)}
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
