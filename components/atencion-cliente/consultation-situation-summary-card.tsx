"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { ConsultationSituationSummary } from "@/lib/customer-atenciones/consultation-expediente"

type ConsultationSituationSummaryCardProps = {
  summary: ConsultationSituationSummary
  lastActorName: string
}

function SituationField({
  label,
  value,
  preserveWhitespace = false,
}: {
  label: string
  value: React.ReactNode
  preserveWhitespace?: boolean
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div
        className={
          preserveWhitespace
            ? "whitespace-pre-wrap text-sm font-medium text-foreground"
            : "text-sm font-medium text-foreground"
        }
      >
        {value}
      </div>
    </div>
  )
}

export function ConsultationSituationSummaryCard({
  summary,
  lastActorName,
}: ConsultationSituationSummaryCardProps) {
  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardHeader>
        <CardTitle>Situación actual</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <SituationField label="Estado" value={summary.statusLabel} />
        <SituationField
          label="Área responsable"
          value={summary.responsibleAreaLabel}
        />
        <SituationField label="Próximo paso" value={summary.nextStepLabel} />
        <SituationField
          label="Última intervención"
          value={summary.lastInterventionAreaLabel}
        />
        <SituationField
          label="Última actualización"
          value={new Date(summary.lastUpdatedAt).toLocaleString("es-AR")}
        />
        <SituationField label="Usuario" value={lastActorName} />
        <div className="sm:col-span-2">
          <SituationField
            label="Último comentario"
            value={summary.lastComment ?? "—"}
            preserveWhitespace
          />
        </div>
      </CardContent>
    </Card>
  )
}
