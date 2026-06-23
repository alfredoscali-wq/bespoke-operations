"use client"

import { useState } from "react"
import {
  Calendar,
  FileText,
  KeyRound,
  Pencil,
  Shield,
  ShieldCheck,
  User,
} from "lucide-react"

import { EmployeeSystemAccessDialog } from "@/components/rrhh/employee-system-access-dialog"
import { useEmployees } from "@/components/rrhh/employees-provider"
import {
  formatEmployeeDateTime,
  SYSTEM_ROLE_LABELS,
  SYSTEM_ROLE_STYLES,
} from "@/lib/employees/constants"
import type { Employee, SystemRole, UpdateEmployeeInput } from "@/lib/types/employees"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function SystemRoleBadge({ role }: { role: SystemRole }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", SYSTEM_ROLE_STYLES[role])}
    >
      {SYSTEM_ROLE_LABELS[role]}
    </Badge>
  )
}

function AccessField({
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

type EmployeeSystemAccessSectionProps = {
  employee: Employee
}

export function EmployeeSystemAccessSection({
  employee,
}: EmployeeSystemAccessSectionProps) {
  const { editEmployee } = useEmployees()
  const [dialogOpen, setDialogOpen] = useState(false)

  async function handleSave(
    input: Pick<
      UpdateEmployeeInput,
      "systemAccess" | "systemRole" | "mustChangePassword"
    >
  ) {
    const result = await editEmployee(employee.id, input)
    if (!result.success) {
      throw new Error(result.message ?? "No se pudo actualizar el acceso.")
    }
  }

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Acceso al Sistema</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setDialogOpen(true)}
          >
            <Pencil className="size-3.5" />
            Editar acceso
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AccessField
            icon={ShieldCheck}
            iconClassName={
              employee.systemAccess
                ? "bg-emerald-50 text-emerald-600"
                : "bg-slate-100 text-slate-500"
            }
            label="Acceso habilitado"
            value={employee.systemAccess ? "Sí" : "No"}
          />
          <AccessField
            icon={Shield}
            iconClassName="bg-violet-50 text-violet-600"
            label="Rol del sistema"
            value={<SystemRoleBadge role={employee.systemRole} />}
          />
          <AccessField
            icon={User}
            iconClassName="bg-violet-50 text-violet-600"
            label="Usuario"
            value={employee.nationalId?.trim() || "—"}
          />
          <AccessField
            icon={Shield}
            iconClassName={
              employee.systemAccess
                ? "bg-emerald-50 text-emerald-600"
                : "bg-rose-50 text-rose-600"
            }
            label="Estado de cuenta"
            value={
              employee.systemAccess ? (
                <Badge
                  variant="outline"
                  className="border-emerald-100 bg-emerald-50 font-medium text-emerald-700"
                >
                  Activo
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-slate-200 bg-slate-100 font-medium text-slate-600"
                >
                  Inactivo
                </Badge>
              )
            }
          />
          <AccessField
            icon={Calendar}
            iconClassName="bg-amber-50 text-amber-600"
            label="Último acceso"
            value={formatEmployeeDateTime(employee.lastLoginAt) || "—"}
          />
          <AccessField
            icon={KeyRound}
            iconClassName="bg-orange-50 text-orange-600"
            label="Debe cambiar contraseña"
            value={employee.mustChangePassword ? "Sí" : "No"}
          />
        </CardContent>
        {!employee.nationalId?.trim() && employee.systemAccess && (
          <CardContent className="border-t pt-4">
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-800">
              <FileText className="mt-0.5 size-4 shrink-0" />
              <p>
                Se recomienda registrar el DNI del empleado antes de habilitar el
                acceso al sistema.
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      <EmployeeSystemAccessDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employee={employee}
        onSubmit={handleSave}
      />
    </>
  )
}
