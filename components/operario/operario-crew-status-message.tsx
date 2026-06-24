import { AlertCircle, Info } from "lucide-react"

import type { OperarioCrewStatus } from "@/lib/operario/crew"
import { Alert, AlertDescription } from "@/components/ui/alert"

type OperarioCrewStatusMessageProps = {
  crewStatus: OperarioCrewStatus
  primaryCrewName?: string
  assignedCrewNames?: string[]
  className?: string
}

export function OperarioCrewStatusMessage({
  crewStatus,
  primaryCrewName,
  assignedCrewNames = [],
  className,
}: OperarioCrewStatusMessageProps) {
  if (crewStatus === "loading" || crewStatus === "resolved") {
    return null
  }

  if (crewStatus === "unassigned") {
    return (
      <Alert variant="default" className={className}>
        <AlertCircle className="size-4" />
        <AlertDescription>
          No tenés cuadrilla asignada. Contactá a tu supervisor para ser
          asignado a una cuadrilla.
        </AlertDescription>
      </Alert>
    )
  }

  const otherCrews = assignedCrewNames.filter((name) => name !== primaryCrewName)

  return (
    <Alert variant="default" className={className}>
      <Info className="size-4" />
      <AlertDescription>
        Tenés más de una cuadrilla asignada
        {otherCrews.length > 0 ? ` (${assignedCrewNames.join(", ")})` : ""}.
        {primaryCrewName
          ? ` Se muestran las tareas de ${primaryCrewName}.`
          : " Se usa la cuadrilla principal."}
      </AlertDescription>
    </Alert>
  )
}

export function OperarioCrewEmptyState({
  crewStatus,
}: {
  crewStatus: OperarioCrewStatus
}) {
  if (crewStatus === "loading") {
    return (
      <div className="rounded-2xl border border-dashed bg-card/60 px-4 py-12 text-center">
        <span className="mx-auto block h-4 w-56 animate-pulse rounded bg-muted" />
        <span className="mx-auto mt-3 block h-3 w-72 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  if (crewStatus === "unassigned") {
    return (
      <div className="rounded-2xl border border-dashed bg-card/60 px-4 py-12 text-center">
        <p className="text-sm font-medium text-foreground">
          Sin cuadrilla asignada
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cuando te asignen a una cuadrilla, verás tus tareas aquí.
        </p>
      </div>
    )
  }

  return null
}
