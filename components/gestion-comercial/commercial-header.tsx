"use client"

import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CommercialBadge } from "@/components/gestion-comercial/commercial-badge"
import { CommercialEtiquetaBadge } from "@/components/gestion-comercial/commercial-etiqueta-badge"
import { formatCommercialDateTime } from "@/lib/commercial/display"
import type { CommercialOpportunity } from "@/lib/types/commercial"

type CommercialHeaderProps = {
  opportunity: CommercialOpportunity
  /** Full client name — never the inherited opportunity title. */
  clientName: string
  onBack: () => void
  onEdit: () => void
  /** Admin-only permanent delete control (e.g. PermanentDeleteAction). */
  permanentDeleteAction?: React.ReactNode
}

export function CommercialHeader({
  opportunity,
  clientName,
  onBack,
  onEdit,
  permanentDeleteAction = null,
}: CommercialHeaderProps) {
  return (
    <header className="overflow-hidden rounded-xl border border-blue-100/70 bg-gradient-to-br from-blue-500/[0.06] via-background to-slate-500/[0.03] shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0 space-y-3">
          <CommercialEtiquetaBadge
            name={opportunity.etiquetaName}
            color={opportunity.etiquetaColor}
            className="px-3 py-1 text-sm font-semibold"
          />
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              {clientName}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono font-medium tracking-tight">
                {opportunity.code}
              </span>
              <CommercialBadge
                kind="status"
                value={opportunity.status}
                className="font-normal opacity-80"
              />
              <span>
                Actualizado{" "}
                <span className="text-foreground">
                  {formatCommercialDateTime(opportunity.updatedAt)}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={onBack}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Volver
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            onClick={onEdit}
          >
            Editar
          </Button>
          {permanentDeleteAction}
        </div>
      </div>
    </header>
  )
}
