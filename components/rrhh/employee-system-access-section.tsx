"use client"

import { useState } from "react"
import {
  Calendar,
  FileText,
  Fingerprint,
  KeyRound,
  Loader2,
  Pencil,
  Shield,
  ShieldCheck,
  User,
  UserPlus,
} from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { EmployeeSystemAccessDialog } from "@/components/rrhh/employee-system-access-dialog"
import { useEmployees } from "@/components/rrhh/employees-provider"
import {
  formatEmployeeDateTime,
  PROVISION_STATUS_LABELS,
  PROVISION_STATUS_STYLES,
  SYSTEM_ROLE_LABELS,
  SYSTEM_ROLE_STYLES,
} from "@/lib/employees/constants"
import {
  canProvisionEmployeeAccess,
  resolveEmployeeProvisionStatus,
} from "@/lib/employees/utils"
import type { Employee, SystemRole, UpdateEmployeeInput } from "@/lib/types/employees"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
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

function ProvisionStatusBadge({
  employee,
}: {
  employee: Pick<Employee, "systemAccess" | "appUserId">
}) {
  const status = resolveEmployeeProvisionStatus(employee)

  return (
    <Badge
      variant="outline"
      className={cn("font-medium", PROVISION_STATUS_STYLES[status])}
    >
      {PROVISION_STATUS_LABELS[status]}
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
  const { sessionUser } = useAuth()
  const { editEmployee, provisionEmployeeAccess } = useEmployees()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isProvisioning, setIsProvisioning] = useState(false)
  const [provisionError, setProvisionError] = useState<string | null>(null)
  const [provisionSuccess, setProvisionSuccess] = useState<string | null>(null)

  const canCreateAccess =
    canProvisionEmployeeAccess(employee) &&
    sessionUser?.systemRole === "administrador"
  const hasNationalId = Boolean(employee.nationalId?.trim())

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

  async function handleProvisionAccess() {
    setProvisionError(null)
    setProvisionSuccess(null)
    setIsProvisioning(true)

    try {
      const result = await provisionEmployeeAccess(employee.id)

      if (!result.success) {
        setProvisionError(
          result.message ?? "No se pudo crear el acceso del empleado."
        )
        return
      }

      setProvisionSuccess("Acceso creado correctamente. El empleado ya puede iniciar sesión.")
    } finally {
      setIsProvisioning(false)
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
            label="Usuario (DNI)"
            value={employee.nationalId?.trim() || "—"}
          />
          <AccessField
            icon={Shield}
            iconClassName="bg-sky-50 text-sky-600"
            label="Estado de provisión"
            value={<ProvisionStatusBadge employee={employee} />}
          />
          <AccessField
            icon={Fingerprint}
            iconClassName="bg-slate-100 text-slate-600"
            label="ID de usuario Auth"
            value={
              employee.appUserId ? (
                <span className="break-all font-mono text-xs">
                  {employee.appUserId}
                </span>
              ) : (
                "—"
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

        {!hasNationalId && employee.systemAccess && (
          <CardContent className="border-t pt-4">
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-800">
              <FileText className="mt-0.5 size-4 shrink-0" />
              <p>
                Registre el DNI del empleado antes de crear el acceso al sistema.
              </p>
            </div>
          </CardContent>
        )}

        {(provisionError || provisionSuccess) && (
          <CardContent className="border-t pt-4">
            {provisionError && (
              <p className="text-sm text-destructive" role="alert">
                {provisionError}
              </p>
            )}
            {provisionSuccess && (
              <p className="text-sm text-emerald-700" role="status">
                {provisionSuccess}
              </p>
            )}
          </CardContent>
        )}

        {canCreateAccess && (
          <CardFooter className="border-t pt-4">
            <Button
              type="button"
              className="gap-1.5"
              onClick={() => void handleProvisionAccess()}
              disabled={isProvisioning || !hasNationalId}
            >
              {isProvisioning ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creando acceso...
                </>
              ) : (
                <>
                  <UserPlus className="size-4" />
                  Crear acceso
                </>
              )}
            </Button>
          </CardFooter>
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
