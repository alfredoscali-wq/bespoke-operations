"use client"

import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CommercialBadge } from "@/components/gestion-comercial/commercial-badge"
import {
  displayCommercialValue,
  formatCommercialDateTime,
} from "@/lib/commercial/display"
import type { CommercialOpportunity } from "@/lib/types/commercial"

type CommercialHeaderProps = {
  opportunity: CommercialOpportunity
  responsibleName: string
  onBack: () => void
  onEditPerson: () => void
  onEditOpportunity: () => void
  onDelete: () => void
}

export function CommercialHeader({
  opportunity,
  responsibleName,
  onBack,
  onEditPerson,
  onEditOpportunity,
  onDelete,
}: CommercialHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-sm font-semibold tracking-tight text-muted-foreground">
            {opportunity.code}
          </p>
          <CommercialBadge kind="status" value={opportunity.status} />
          <CommercialBadge kind="priority" value={opportunity.priority} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {opportunity.title}
        </h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>
            Responsable:{" "}
            <span className="text-foreground">
              {displayCommercialValue(responsibleName)}
            </span>
          </span>
          <span>
            Creada:{" "}
            <span className="text-foreground">
              {formatCommercialDateTime(opportunity.createdAt)}
            </span>
          </span>
          <span>
            Actualizada:{" "}
            <span className="text-foreground">
              {formatCommercialDateTime(opportunity.updatedAt)}
            </span>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden />
          Volver
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onEditPerson}>
          Editar Persona
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onEditOpportunity}
        >
          Editar Oportunidad
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={onDelete}>
          Eliminar
        </Button>
      </div>
    </div>
  )
}
