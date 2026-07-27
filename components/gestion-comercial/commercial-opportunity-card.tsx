"use client"

import { CommercialBadge } from "@/components/gestion-comercial/commercial-badge"
import { CommercialInfoRow } from "@/components/gestion-comercial/commercial-info-row"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { COMMERCIAL_SOURCE_LABELS } from "@/lib/commercial/catalogs"
import {
  displayCommercialValue,
  formatCommercialDateOnly,
  formatCommercialMoney,
} from "@/lib/commercial/display"
import type { CommercialOpportunity } from "@/lib/types/commercial"
import { cn } from "@/lib/utils"

type CommercialOpportunityCardProps = {
  opportunity: CommercialOpportunity
  responsibleName: string
  onEdit: () => void
  className?: string
}

export function CommercialOpportunityCard({
  opportunity,
  responsibleName,
  onEdit,
  className,
}: CommercialOpportunityCardProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Oportunidad</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          Editar Oportunidad
        </Button>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          <CommercialInfoRow label="Código OP">
            <span className="font-mono font-medium">{opportunity.code}</span>
          </CommercialInfoRow>
          <CommercialInfoRow label="Título">
            {displayCommercialValue(opportunity.title)}
          </CommercialInfoRow>
          <CommercialInfoRow label="Estado">
            <CommercialBadge kind="status" value={opportunity.status} />
          </CommercialInfoRow>
          <CommercialInfoRow label="Prioridad">
            <CommercialBadge kind="priority" value={opportunity.priority} />
          </CommercialInfoRow>
          <CommercialInfoRow label="Responsable">
            {displayCommercialValue(responsibleName)}
          </CommercialInfoRow>
          <CommercialInfoRow label="Origen">
            {COMMERCIAL_SOURCE_LABELS[opportunity.source]}
          </CommercialInfoRow>
          <CommercialInfoRow label="Monto estimado">
            {formatCommercialMoney(opportunity.estimatedAmount)}
          </CommercialInfoRow>
          <CommercialInfoRow label="Probabilidad">
            {opportunity.probability === null ||
            opportunity.probability === undefined
              ? "-"
              : `${opportunity.probability}%`}
          </CommercialInfoRow>
          <CommercialInfoRow label="Fecha estimada de cierre">
            {formatCommercialDateOnly(opportunity.expectedCloseDate)}
          </CommercialInfoRow>
          <CommercialInfoRow label="Descripción">
            {displayCommercialValue(opportunity.description)}
          </CommercialInfoRow>
          {opportunity.status === "perdida" ? (
            <CommercialInfoRow label="Motivo de pérdida">
              {displayCommercialValue(opportunity.lostReason)}
            </CommercialInfoRow>
          ) : null}
        </dl>
      </CardContent>
    </Card>
  )
}
