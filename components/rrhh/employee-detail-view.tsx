"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  FileText,
  Mail,
  Pencil,
  Phone,
  Trash2,
  User,
} from "lucide-react"

import { EmploymentStatusBadge, EmployeeTypeBadge } from "@/components/rrhh/employee-badges"
import { EmployeeSystemAccessSection } from "@/components/rrhh/employee-system-access-section"
import { TelLink } from "@/components/ui/tel-link"
import { EMPLOYEE_TYPE_LABELS } from "@/lib/employees/constants"
import { EmployeeFormDialog } from "@/components/rrhh/employee-form-dialog"
import { useEmployees } from "@/components/rrhh/employees-provider"
import {
  formatEmployeeDate,
  formatEmployeeDateTime,
} from "@/lib/employees/constants"
import {
  getEmployeeDisplayName,
  getEmployeeInitials,
} from "@/lib/employees/utils"
import type { Employee, NewEmployeeInput } from "@/lib/types/employees"
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type EmployeeDetailViewProps = {
  employee: Employee
}

function DetailField({
  icon: Icon,
  iconClassName,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconClassName: string
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex gap-3">
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}
      >
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  )
}

export function EmployeeDetailView({ employee }: EmployeeDetailViewProps) {
  const { editEmployee, removeEmployee } = useEmployees()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const fullName = [employee.firstName, employee.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")

  async function handleEdit(input: NewEmployeeInput) {
    const result = await editEmployee(employee.id, input)
    if (!result.success) {
      throw new Error(result.message ?? "No se pudo actualizar al empleado.")
    }
  }

  async function handleDelete() {
    setDeleteError(null)
    setIsDeleting(true)

    try {
      const result = await removeEmployee(employee.id)
      if (!result.success) {
        setDeleteError(result.message ?? "No se pudo eliminar al empleado.")
        return
      }
      window.location.href = "/rrhh"
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 gap-1.5 text-muted-foreground"
            asChild
          >
            <Link href="/rrhh">
              <ArrowLeft className="size-4" />
              Volver a RRHH
            </Link>
          </Button>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <EmploymentStatusBadge status={employee.employmentStatus} />
              <EmployeeTypeBadge employeeType={employee.employeeType} />
              <span className="font-mono text-xs text-muted-foreground">
                {employee.employeeCode}
              </span>
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {getEmployeeDisplayName(employee)}
            </h2>
            <p className="text-sm text-muted-foreground">
              {employee.jobTitle}
              {employee.department ? ` · ${employee.department}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 self-start">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-4" />
                <span className="sr-only">Editar Empleado</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Editar Empleado</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-8 text-destructive hover:text-destructive"
                onClick={() => {
                  setDeleteError(null)
                  setDeleteOpen(true)
                }}
              >
                <Trash2 className="size-4" />
                <span className="sr-only">Eliminar empleado</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Eliminar empleado</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Información del empleado</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailField
            icon={User}
            iconClassName="bg-primary/8 text-primary"
            label="Nombre completo"
            value={fullName}
          />
          <DetailField
            icon={User}
            iconClassName="bg-sky-50 text-sky-600"
            label="Nombre preferido"
            value={employee.preferredName?.trim() || "—"}
          />
          <DetailField
            icon={FileText}
            iconClassName="bg-violet-50 text-violet-600"
            label="DNI"
            value={employee.nationalId?.trim() || "—"}
          />
          <DetailField
            icon={Calendar}
            iconClassName="bg-amber-50 text-amber-600"
            label="Fecha de nacimiento"
            value={formatEmployeeDate(employee.birthDate)}
          />
          <DetailField
            icon={Mail}
            iconClassName="bg-blue-50 text-blue-600"
            label="Correo electrónico"
            value={employee.email?.trim() || "—"}
          />
          <DetailField
            icon={Phone}
            iconClassName="bg-emerald-50 text-emerald-600"
            label="Teléfono"
            value={
              employee.phone?.trim() ? (
                <TelLink phone={employee.phone} />
              ) : (
                "—"
              )
            }
          />
          <DetailField
            icon={Briefcase}
            iconClassName="bg-orange-50 text-orange-600"
            label="Cargo"
            value={employee.jobTitle || "—"}
          />
          <DetailField
            icon={Building2}
            iconClassName="bg-indigo-50 text-indigo-600"
            label="Departamento"
            value={employee.department || "—"}
          />
          <DetailField
            icon={User}
            iconClassName="bg-indigo-50 text-indigo-600"
            label="Tipo de empleado"
            value={EMPLOYEE_TYPE_LABELS[employee.employeeType]}
          />
          <DetailField
            icon={Calendar}
            iconClassName="bg-teal-50 text-teal-600"
            label="Fecha de ingreso"
            value={formatEmployeeDate(employee.hireDate)}
          />
          <DetailField
            icon={Calendar}
            iconClassName="bg-rose-50 text-rose-600"
            label="Fecha de baja"
            value={formatEmployeeDate(employee.terminationDate)}
          />
        </CardContent>
        {employee.notes && (
          <CardContent className="border-t pt-4">
            <p className="text-xs text-muted-foreground">Notas</p>
            <p className="mt-1 text-sm">{employee.notes}</p>
          </CardContent>
        )}
        {(employee.createdAt || employee.updatedAt) && (
          <CardContent className="border-t pt-4">
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              {employee.createdAt && (
                <p>
                  Creado: {formatEmployeeDateTime(employee.createdAt)}
                </p>
              )}
              {employee.updatedAt && (
                <p>
                  Actualizado: {formatEmployeeDateTime(employee.updatedAt)}
                </p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      <EmployeeSystemAccessSection employee={employee} />

      <div className="flex items-center gap-3 rounded-xl border bg-muted/20 px-4 py-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {getEmployeeInitials(employee)}
        </div>
        <div>
          <p className="text-sm font-medium">{getEmployeeDisplayName(employee)}</p>
          <p className="text-xs text-muted-foreground">
            Código {employee.employeeCode}
          </p>
        </div>
      </div>

      <EmployeeFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        employee={employee}
        onSubmit={handleEdit}
      />

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) setDeleteError(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar empleado</DialogTitle>
            <DialogDescription>
              ¿Desea eliminar este registro? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
