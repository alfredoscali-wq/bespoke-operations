"use client"

import { CommercialBadge } from "@/components/gestion-comercial/commercial-badge"
import { CommercialEtiquetaBadge } from "@/components/gestion-comercial/commercial-etiqueta-badge"
import { CommercialInfoRow } from "@/components/gestion-comercial/commercial-info-row"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  COMMERCIAL_SOURCE_FIELD_LABEL,
  COMMERCIAL_SOURCE_LABELS,
} from "@/lib/commercial/catalogs"
import {
  formatCommercialDateOnly,
  formatCommercialMoney,
} from "@/lib/commercial/display"
import type { CommercialOpportunity } from "@/lib/types/commercial"
import { cn } from "@/lib/utils"

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

type CommercialOpportunityCardProps = {
  opportunity: CommercialOpportunity
  responsibleName: string
  className?: string
}

export function CommercialOpportunityCard({
  opportunity,
  responsibleName,
  className,
}: CommercialOpportunityCardProps) {
  const amountLabel = formatCommercialMoney(opportunity.estimatedAmount)
  const closeDateLabel = formatCommercialDateOnly(opportunity.expectedCloseDate)
  const showAmount =
    opportunity.estimatedAmount !== null &&
    opportunity.estimatedAmount !== undefined &&
    amountLabel !== "-"
  const showProbability =
    opportunity.probability !== null && opportunity.probability !== undefined
  const showCloseDate = closeDateLabel !== "-"

  return (
    <Card className={cn("overflow-hidden rounded-xl border shadow-sm", className)}>
      <CardHeader className="space-y-0">
        <CardTitle className="text-base">Cliente</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          <CommercialInfoRow label="Código">
            <span className="font-mono font-medium">{opportunity.code}</span>
          </CommercialInfoRow>
          {hasText(opportunity.title) ? (
            <CommercialInfoRow label="Cliente">
              {opportunity.title.trim()}
            </CommercialInfoRow>
          ) : null}
          {opportunity.etiquetaName ? (
            <CommercialInfoRow label="Etiqueta">
              <CommercialEtiquetaBadge
                name={opportunity.etiquetaName}
                color={opportunity.etiquetaColor}
              />
            </CommercialInfoRow>
          ) : null}
          <CommercialInfoRow label="Estado">
            <CommercialBadge kind="status" value={opportunity.status} />
          </CommercialInfoRow>
          <CommercialInfoRow label="Prioridad">
            <CommercialBadge kind="priority" value={opportunity.priority} />
          </CommercialInfoRow>
          {hasText(responsibleName) ? (
            <CommercialInfoRow label="Responsable">
              {responsibleName.trim()}
            </CommercialInfoRow>
          ) : null}
          <CommercialInfoRow label={COMMERCIAL_SOURCE_FIELD_LABEL}>
            {COMMERCIAL_SOURCE_LABELS[opportunity.source]}
          </CommercialInfoRow>
          {showAmount ? (
            <CommercialInfoRow label="Monto estimado">
              {amountLabel}
            </CommercialInfoRow>
          ) : null}
          {showProbability ? (
            <CommercialInfoRow label="Probabilidad">
              {`${opportunity.probability}%`}
            </CommercialInfoRow>
          ) : null}
          {showCloseDate ? (
            <CommercialInfoRow label="Fecha estimada de cierre">
              {closeDateLabel}
            </CommercialInfoRow>
          ) : null}
          {hasText(opportunity.description) ? (
            <CommercialInfoRow label="Descripción">
              {opportunity.description.trim()}
            </CommercialInfoRow>
          ) : null}
          {opportunity.status === "perdida" && hasText(opportunity.lostReason) ? (
            <CommercialInfoRow label="Motivo de pérdida">
              {opportunity.lostReason.trim()}
            </CommercialInfoRow>
          ) : null}
        </dl>
      </CardContent>
    </Card>
  )
}
