"use client"

import Link from "next/link"

import { formatGainMeters } from "@/lib/gps/distance"
import { hasCoordinates } from "@/lib/gps/coordinates"
import {
  formatProjectDesignOtProposalStatusLabel,
  formatProjectDesignOtWorkTypeLabel,
  isPendingProjectDesignOtProposalStatus,
} from "@/lib/projects/design/ot-proposals"
import type { ProjectDesignOtProposal } from "@/lib/types/project-design-ot"
import type { Task } from "@/lib/types/tasks"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type ProjectDesignOtProposalsSectionProps = {
  proposals: ProjectDesignOtProposal[]
  tasks: Task[]
  designHref: string
  getCrew?: (id: string) => { name: string } | undefined
  onSelect: (proposal: ProjectDesignOtProposal) => void
}

export function ProjectDesignOtProposalsSection({
  proposals,
  tasks,
  designHref,
  getCrew,
  onSelect,
}: ProjectDesignOtProposalsSectionProps) {
  const visible = proposals.filter((proposal) =>
    isPendingProjectDesignOtProposalStatus(proposal.status)
  )

  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-sm font-semibold">OTs preliminares</h3>
        <p className="text-xs text-muted-foreground">
          Borradores desde Diseño. No son OTs reales y no entran a Planificación ni a Field Agent.
        </p>
      </div>
      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Todavía no hay preliminares. Usá Generar OTs preliminares en esta solapa.{" "}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs"
            asChild
          >
            <Link href={designHref}>Ir a Diseño</Link>
          </Button>
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((proposal) => {
            const created = proposal.status === "created" || Boolean(proposal.taskId)
            const task = proposal.taskId
              ? tasks.find((item) => item.id === proposal.taskId)
              : undefined
            const crewName = proposal.crewId
              ? getCrew?.(proposal.crewId)?.name
              : null
            return (
              <li key={proposal.id}>
                <button
                  type="button"
                  onClick={() => onSelect(proposal)}
                  className={cn(
                    "w-full rounded-lg border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted/40",
                    created ? "border-emerald-200" : "border-dashed"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">Preliminar</Badge>
                    <Badge variant={created ? "secondary" : "outline"}>
                      {created
                        ? "OT creada"
                        : formatProjectDesignOtProposalStatusLabel(proposal.status)}
                    </Badge>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {formatProjectDesignOtWorkTypeLabel(
                        proposal.workType === "nap" || proposal.workType === "node"
                          ? proposal.workType
                          : proposal.sourceElementKind
                      )}
                    </span>
                    {created && task?.code ? (
                      <span className="font-mono text-[11px] text-primary">
                        OT: {task.code}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-foreground">
                    {proposal.designName || proposal.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{proposal.title}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Ganancia: {formatGainMeters(proposal.designGainM)}
                    </span>
                    <span>
                      {hasCoordinates(proposal.latitude, proposal.longitude)
                        ? `${proposal.latitude!.toFixed(5)}, ${proposal.longitude!.toFixed(5)}`
                        : "Sin GPS"}
                    </span>
                    <span>
                      {crewName
                        ? `Cuadrilla: ${crewName}`
                        : proposal.crewId
                          ? "Cuadrilla asignada"
                          : "Sin cuadrilla"}
                    </span>
                    <span>
                      {proposal.startDate && proposal.dueDate
                        ? `Fecha: ${proposal.startDate} → ${proposal.dueDate}`
                        : "Sin fecha"}
                    </span>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">
        Abrí una preliminar para revisarla. “Crear OT” usa el flujo existente de OT de
        Obra. “Enviar a Cuadrilla” queda en la OT real.
      </p>
    </section>
  )
}
