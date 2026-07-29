"use client"

import Link from "next/link"
import {
  CircleDot,
  Clock3,
  ExternalLink,
  MessageSquareText,
  UserRound,
} from "lucide-react"

import { PanelSectionCard } from "@/components/atencion-cliente/consultation-detail-panel-ui"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { CommercialOpportunityLink } from "@/lib/customer-atenciones/commercial-handoff"
import {
  formatConsultationEstadoActualBadge,
  formatConsultationEstadoActualSummary,
  formatConsultationIngressDateTime,
  isRedundantEstadoActualDerivation,
  type ConsultationSituationNarrative,
  type ConsultationSituationSummary,
} from "@/lib/customer-atenciones/consultation-expediente"
import type {
  CustomerAtencionNextStep,
  CustomerAtencionStatus,
} from "@/lib/types/customer-atenciones"
import { cn } from "@/lib/utils"

type ConsultationSituationSummaryCardProps = {
  summary: ConsultationSituationSummary
  status: CustomerAtencionStatus
  nextStep?: CustomerAtencionNextStep | null
  /** RC 3.2.7 — when set, Estado actual reflects Atención closed via OT. */
  linkedTaskId?: string | null
  resolution?: string | null
  narrative: ConsultationSituationNarrative
  lastActorName: string
  /** Creation detail written when the consultation was opened. */
  initialObservations?: string | null
  /** Person currently responsible when the consultation is in management. */
  responsiblePersonName?: string
  /** Linked Gestión Comercial opportunity after sales handoff. */
  commercialOpportunity?: CommercialOpportunityLink | null
  presentation?: "page" | "panel"
}

function SituationField({
  label,
  value,
  preserveWhitespace = false,
  className,
}: {
  label: string
  value: React.ReactNode
  preserveWhitespace?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <p className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <div
        className={
          preserveWhitespace
            ? "mt-0.5 whitespace-pre-wrap text-[12px] font-medium leading-snug text-slate-800"
            : "mt-0.5 text-[12px] font-medium leading-snug text-slate-800"
        }
      >
        {value}
      </div>
    </div>
  )
}

function SituationNarrativeBody({
  narrative,
  commercialOpportunity,
}: {
  narrative: ConsultationSituationNarrative
  commercialOpportunity?: CommercialOpportunityLink | null
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

      {narrative.handoff?.kind === "derivation" &&
      narrative.handoff.areaLabel === "Ventas" ? (
        <p>
          <span className="text-muted-foreground">Destino:</span>{" "}
          <span className="font-medium">Ventas</span>
        </p>
      ) : null}

      {commercialOpportunity ? (
        <p>
          <span className="text-muted-foreground">Cliente:</span>{" "}
          {commercialOpportunity.id ? (
            <Link
              href={`/gestion-comercial/${commercialOpportunity.id}`}
              className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
            >
              {commercialOpportunity.code}
              <ExternalLink className="size-3" aria-hidden />
            </Link>
          ) : (
            <span className="font-semibold">{commercialOpportunity.code}</span>
          )}
        </p>
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

function formatSituationDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function CompactMetaColumn({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: typeof UserRound
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center gap-1.5">
        <Icon className="size-3 shrink-0 text-slate-400" aria-hidden />
        <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
          {label}
        </p>
      </div>
      <div className="mt-1 text-[12px] leading-snug text-slate-800">
        {children}
      </div>
    </div>
  )
}

export function ConsultationSituationSummaryCard({
  summary,
  status,
  nextStep = null,
  linkedTaskId = null,
  resolution = null,
  narrative,
  lastActorName,
  initialObservations,
  commercialOpportunity = null,
  presentation = "page",
}: ConsultationSituationSummaryCardProps) {
  if (presentation === "panel") {
    const derivation =
      narrative.handoff?.kind === "derivation" ? narrative.handoff : null
    const rawDerivedBy = derivation?.fromAreaLabel?.trim() || null
    const derivedBy =
      rawDerivedBy &&
      !isRedundantEstadoActualDerivation({ status, nextStep }, rawDerivedBy)
        ? rawDerivedBy
        : null
    const badgeLabel = formatConsultationEstadoActualBadge({
      status,
      nextStep,
      linkedTaskId,
      resolution,
    })
    const summarySentence = formatConsultationEstadoActualSummary({
      status,
      nextStep,
      linkedTaskId,
      resolution,
    })
    const observations = initialObservations?.trim() || null
    const lastInterventionUser =
      lastActorName !== "—" ? lastActorName : summary.lastInterventionAreaLabel
    const lastInterventionWhen = formatConsultationIngressDateTime(
      summary.lastUpdatedAt
    )
    const destinationLabel =
      derivation?.areaLabel === "Ventas"
        ? "Ventas"
        : summary.responsibleAreaLabel !== "—"
          ? summary.responsibleAreaLabel
          : null

    return (
      <PanelSectionCard
        title="Estado actual"
        icon={CircleDot}
        tone="green"
        className="w-full"
        contentClassName="space-y-2.5 px-3 py-2.5"
        headerEnd={
          <Badge
            variant="secondary"
            className="h-auto max-w-[14rem] whitespace-normal px-2 py-0.5 text-left text-[10px] font-semibold leading-tight"
          >
            {badgeLabel}
          </Badge>
        }
      >
        <p className="text-[13px] leading-snug font-medium text-slate-900">
          {summarySentence}
        </p>

        {destinationLabel || commercialOpportunity ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-slate-200/80 bg-slate-50/80 px-2.5 py-2 text-[12px]">
            {destinationLabel ? (
              <p>
                <span className="text-slate-500">Destino:</span>{" "}
                <span className="font-semibold text-slate-900">
                  {destinationLabel}
                </span>
              </p>
            ) : null}
            {commercialOpportunity ? (
              <p className="inline-flex items-center gap-1">
                <span className="text-slate-500">Cliente:</span>{" "}
                {commercialOpportunity.id ? (
                  <Link
                    href={`/gestion-comercial/${commercialOpportunity.id}`}
                    className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {commercialOpportunity.code}
                    <ExternalLink className="size-3" aria-hidden />
                  </Link>
                ) : (
                  <span className="font-semibold text-slate-900">
                    {commercialOpportunity.code}
                  </span>
                )}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-2.5 border-t border-slate-200/70 pt-2.5 sm:grid-cols-3 sm:gap-0">
          <CompactMetaColumn
            icon={UserRound}
            label="Derivada por"
            className="sm:pr-3"
          >
            <p className="font-medium">{derivedBy ?? "—"}</p>
          </CompactMetaColumn>

          <CompactMetaColumn
            icon={MessageSquareText}
            label="Observaciones iniciales"
            className="sm:border-l sm:border-slate-200/70 sm:px-3"
          >
            <p className="line-clamp-3 whitespace-pre-wrap font-medium">
              {observations ?? "—"}
            </p>
          </CompactMetaColumn>

          <CompactMetaColumn
            icon={Clock3}
            label="Última intervención"
            className="sm:border-l sm:border-slate-200/70 sm:pl-3"
          >
            <p className="font-semibold tracking-wide text-slate-900 uppercase">
              {lastInterventionUser}
            </p>
            <p className="mt-0.5 text-slate-600">{lastInterventionWhen}</p>
          </CompactMetaColumn>
        </div>
      </PanelSectionCard>
    )
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.03]">
      <CardHeader>
        <CardTitle>Situación actual</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <SituationNarrativeBody
          narrative={narrative}
          commercialOpportunity={commercialOpportunity}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SituationField
            label="Última intervención"
            value={summary.lastInterventionAreaLabel}
          />
          <SituationField
            label="Última actualización"
            value={formatSituationDateTime(summary.lastUpdatedAt)}
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
