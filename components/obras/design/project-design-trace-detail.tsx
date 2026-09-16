import type { ProjectDesignTraceDetail } from "@/lib/projects/design/trace-detail"

type ProjectDesignTraceDetailCardProps = {
  detail: ProjectDesignTraceDetail
  compact?: boolean
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-foreground">{value}</dd>
    </div>
  )
}

export function ProjectDesignTraceDetailCard({
  detail,
  compact = false,
}: ProjectDesignTraceDetailCardProps) {
  if (compact) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{detail.identifier}</p>
        <p className="text-xs text-muted-foreground">
          {detail.plannedLengthLabel}
          {" · "}
          {detail.cableReferenceLabel}
        </p>
        <p className="text-xs text-muted-foreground">{detail.originDestinationLabel}</p>
        <p className="text-xs text-muted-foreground">Ganancia: {detail.gainLabel}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Traza
        </p>
        <p className="mt-0.5 text-sm font-semibold text-foreground">{detail.identifier}</p>
      </div>
      <dl className="space-y-1 text-xs">
        <Fact label="Tipo" value={detail.typeLabel} />
        <Fact label="Distancia estimada" value={detail.plannedLengthLabel} />
        <Fact label="Cable / referencia" value={detail.cableReferenceLabel} />
        <Fact label="Origen" value={detail.originLabel} />
        <Fact label="Destino" value={detail.destinationLabel} />
        <Fact label="Ganancia" value={detail.gainLabel} />
        <Fact label="Observaciones" value={detail.observationsLabel} />
      </dl>
    </div>
  )
}

export function ProjectDesignTendidoOtTracesSummary({
  plannedLengthLabel,
  traceGainLabel,
  plannedCableLabel,
}: {
  plannedLengthLabel: string
  traceGainLabel: string
  plannedCableLabel: string
}) {
  return (
    <section className="grid grid-cols-1 gap-2 rounded-lg border bg-muted/30 px-3 py-3 sm:grid-cols-3">
      <div>
        <p className="text-xs text-muted-foreground">Metros de tendido</p>
        <p className="text-sm font-semibold tabular-nums">{plannedLengthLabel}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Ganancias de trazas</p>
        <p className="text-sm font-semibold tabular-nums">{traceGainLabel}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Cable planificado</p>
        <p className="text-sm font-semibold tabular-nums">{plannedCableLabel}</p>
      </div>
    </section>
  )
}
