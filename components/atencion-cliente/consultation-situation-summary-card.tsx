"use client"

import { CircleDot } from "lucide-react"

import { PanelSectionCard } from "@/components/atencion-cliente/consultation-detail-panel-ui"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type {
  ConsultationSituationNarrative,
  ConsultationSituationSummary,
} from "@/lib/customer-atenciones/consultation-expediente"
import type { CustomerAtencionStatus } from "@/lib/types/customer-atenciones"

type ConsultationSituationSummaryCardProps = {
  summary: ConsultationSituationSummary
  status: CustomerAtencionStatus
  narrative: ConsultationSituationNarrative
  lastActorName: string
  presentation?: "page" | "panel"
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

function SituationNarrativeBody({
  narrative,
}: {
  narrative: ConsultationSituationNarrative
}) {
  return (
    <div className="space-y-2 rounded-md border border-emerald-200/70 bg-emerald-500/[0.06] px-2.5 py-2.5 text-[13px] leading-relaxed text-foreground">
      <p>
        La consulta se encuentra{" "}
        <strong className="font-semibold">{narrative.statusEmphasis}</strong>.
      </p>

      {narrative.handoff?.kind === "derivation" ? (
        <p>
          Fue derivada a{" "}
          <strong className="font-semibold">
            {narrative.handoff.areaLabel}
          </strong>{" "}
          por{" "}
          <strong className="font-semibold">
            {narrative.handoff.actorName}
          </strong>{" "}
          el{" "}
          <strong className="font-semibold">
            {narrative.handoff.dateTime}
          </strong>
          .
        </p>
      ) : null}

      {narrative.handoff?.kind === "atencion" ? (
        <p>{narrative.handoff.description}</p>
      ) : null}

      {narrative.managementTypeLabel ? (
        <p>
          <span className="text-muted-foreground">Gestión:</span>{" "}
          <span className="font-medium">{narrative.managementTypeLabel}</span>
        </p>
      ) : null}

      {narrative.closingNote ? (
        <p className="whitespace-pre-wrap text-muted-foreground">
          {narrative.closingNote}
        </p>
      ) : null}
    </div>
  )
}

export function ConsultationSituationSummaryCard({
  summary,
  narrative,
  lastActorName,
  presentation = "page",
}: ConsultationSituationSummaryCardProps) {
  if (presentation === "panel") {
    return (
      <PanelSectionCard
        title="Situación Actual"
        icon={CircleDot}
        tone="green"
        contentClassName="px-3 py-2"
      >
        <SituationNarrativeBody narrative={narrative} />
      </PanelSectionCard>
    )
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardHeader>
        <CardTitle>Situación actual</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <SituationNarrativeBody narrative={narrative} />
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
      </CardContent>
    </Card>
  )
}
