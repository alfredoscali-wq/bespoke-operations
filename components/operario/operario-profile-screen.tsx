"use client"

import { useMemo } from "react"
import {
  Briefcase,
  CreditCard,
  LogOut,
  Mail,
  Phone,
  User,
  Users,
} from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import {
  OperarioCrewStatusMessage,
} from "@/components/operario/operario-crew-status-message"
import { useOperario } from "@/components/operario/operario-provider"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { parseDniFromAuthEmail } from "@/lib/auth/auth-identity"
import type { OperarioCrewStatus } from "@/lib/operario/crew"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

function resolveCrewDisplayLabel(
  crewStatus: OperarioCrewStatus,
  crewName: string
): string {
  if (crewStatus === "loading") {
    return "—"
  }

  if (crewStatus === "unassigned" || !crewName.trim()) {
    return "Sin cuadrilla asignada"
  }

  return crewName
}

function resolveProfileEmail(
  employeeEmail: string | undefined,
  sessionEmail: string | undefined
): string | null {
  const fromEmployee = employeeEmail?.trim()
  if (fromEmployee) {
    return fromEmployee
  }

  const fromSession = sessionEmail?.trim()
  if (!fromSession || parseDniFromAuthEmail(fromSession)) {
    return null
  }

  return fromSession
}

function ProfileField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-muted/30 p-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

export function OperarioProfileScreen() {
  const { sessionUser, isAuthReady, signOut } = useAuth()
  const { getEmployee } = useEmployees()
  const {
    identity,
    isIdentityReady,
    workerCrewRef,
    crewStatus,
    assignedCrewNames,
    isCrewReady,
  } = useOperario()

  const employee = useMemo(
    () =>
      sessionUser?.employeeId
        ? getEmployee(sessionUser.employeeId)
        : undefined,
    [getEmployee, sessionUser?.employeeId]
  )

  const profileEmail = useMemo(
    () => resolveProfileEmail(employee?.email, sessionUser?.email),
    [employee?.email, sessionUser?.email]
  )

  const dni =
    sessionUser?.nationalId?.trim() ||
    employee?.nationalId?.trim() ||
    "—"
  const cargo =
    employee?.jobTitle?.trim() || identity.roleLabel || "—"
  const phone = employee?.phone?.trim() || "—"
  const crewLabel = resolveCrewDisplayLabel(crewStatus, workerCrewRef.name)

  return (
    <div className="space-y-6 px-4 pt-6 pb-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Perfil
        </h1>
        <p className="text-sm text-muted-foreground">Tu información de campo</p>
      </header>

      <OperarioCrewStatusMessage
        crewStatus={crewStatus}
        primaryCrewName={workerCrewRef.name}
        assignedCrewNames={assignedCrewNames}
      />

      <section className="flex flex-col items-center rounded-2xl border bg-card p-6 shadow-sm">
        <Avatar className="size-20">
          <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
            {isIdentityReady ? (
              identity.initials
            ) : (
              <span className="inline-block size-8 animate-pulse rounded bg-muted" />
            )}
          </AvatarFallback>
        </Avatar>
        {isIdentityReady ? (
          <h2 className="mt-4 text-xl font-bold text-foreground">
            {identity.displayName}
          </h2>
        ) : (
          <span className="mt-4 inline-block h-6 w-40 animate-pulse rounded bg-muted" />
        )}
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
        <ProfileField
          icon={User}
          label="Nombre"
          value={isIdentityReady ? identity.displayName : "—"}
        />
        <ProfileField icon={CreditCard} label="DNI" value={dni} />
        <ProfileField icon={Briefcase} label="Cargo" value={cargo} />
        <ProfileField
          icon={Users}
          label="Cuadrilla"
          value={isCrewReady ? crewLabel : "—"}
        />
        <ProfileField icon={Phone} label="Teléfono" value={phone} />
        {profileEmail ? (
          <ProfileField icon={Mail} label="Email" value={profileEmail} />
        ) : null}
      </section>

      <Button
        type="button"
        variant="outline"
        className="h-11 w-full gap-2"
        onClick={() => void signOut()}
        disabled={!isAuthReady}
      >
        <LogOut className="size-4" />
        Cerrar sesión
      </Button>
    </div>
  )
}
