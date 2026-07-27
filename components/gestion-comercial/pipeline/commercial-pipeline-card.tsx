"use client"

import {
  CalendarPlus,
  FolderOpen,
  Pencil,
  StickyNote,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  COMMERCIAL_PRIORITY_LABELS,
  COMMERCIAL_SOURCE_LABELS,
  COMMERCIAL_STATUS_LABELS,
  type CommercialStatusCode,
} from "@/lib/commercial/catalogs"
import { resolveCommercialResponsibleColor } from "@/lib/commercial/responsible-colors"
import type { CommercialPipelineCard } from "@/lib/types/commercial-pipeline"
import { STATUS_BADGE_BASE, STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

type CommercialPipelineCardViewProps = {
  card: CommercialPipelineCard
  isDragging?: boolean
  onDragStart: (cardId: string, status: CommercialStatusCode) => void
  onOpenDossier: (id: string) => void
  onRegisterActivity: (id: string) => void
  onCreateCommitment: (id: string) => void
  onEdit: (id: string) => void
}

export function CommercialPipelineCardView({
  card,
  isDragging = false,
  onDragStart,
  onOpenDossier,
  onRegisterActivity,
  onCreateCommitment,
  onEdit,
}: CommercialPipelineCardViewProps) {
  const color = resolveCommercialResponsibleColor(card.assignedEmployeeId)

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/opportunity-id", card.id)
        event.dataTransfer.setData("text/from-status", card.status)
        event.dataTransfer.effectAllowed = "move"
        onDragStart(card.id, card.status)
      }}
      className={cn(
        "cursor-grab rounded-xl border bg-card p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing",
        isDragging && "opacity-60"
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: color.hex }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[11px] text-muted-foreground">{card.code}</p>
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white shadow-sm"
          style={{ backgroundColor: color.hex }}
          title={card.responsibleName}
        >
          {initials(card.responsibleName)}
        </span>
      </div>

      <p className="mt-1.5 truncate text-sm font-semibold tracking-tight">
        {card.personName}
      </p>
      {card.companyName ? (
        <p className="truncate text-xs text-muted-foreground">{card.companyName}</p>
      ) : null}

      <p className="mt-2 text-xs text-muted-foreground">
        <span className="text-foreground/80">{card.responsibleName}</span>
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {COMMERCIAL_STATUS_LABELS[card.status]} · {card.daysSinceLastActivity}d
        sin actividad
      </p>

      <div className="mt-2.5 flex flex-wrap gap-1">
        <span
          className={cn(
            STATUS_BADGE_BASE,
            card.priority === "alta"
              ? STATUS_TONE_STYLES.red
              : card.priority === "baja"
                ? STATUS_TONE_STYLES.gray
                : STATUS_TONE_STYLES.yellow
          )}
        >
          {COMMERCIAL_PRIORITY_LABELS[card.priority]}
        </span>
        <span className={cn(STATUS_BADGE_BASE, STATUS_TONE_STYLES.blue)}>
          {COMMERCIAL_SOURCE_LABELS[card.source]}
        </span>
        {card.hasOverdueCommitment ? (
          <span className={cn(STATUS_BADGE_BASE, STATUS_TONE_STYLES.red)}>
            Compromiso vencido
          </span>
        ) : null}
        {card.isDerived ? (
          <span className={cn(STATUS_BADGE_BASE, STATUS_TONE_STYLES.violet)}>
            Derivada
          </span>
        ) : null}
        {card.hasTodayCommitment && !card.hasOverdueCommitment ? (
          <span className={cn(STATUS_BADGE_BASE, STATUS_TONE_STYLES.yellow)}>
            Hoy
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1 px-2 text-[11px]"
          onClick={(event) => {
            event.stopPropagation()
            onOpenDossier(card.id)
          }}
        >
          <FolderOpen className="size-3" />
          Expediente
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1 px-2 text-[11px]"
          onClick={(event) => {
            event.stopPropagation()
            onRegisterActivity(card.id)
          }}
        >
          <StickyNote className="size-3" />
          Actividad
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1 px-2 text-[11px]"
          onClick={(event) => {
            event.stopPropagation()
            onCreateCommitment(card.id)
          }}
        >
          <CalendarPlus className="size-3" />
          Compromiso
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1 px-2 text-[11px]"
          onClick={(event) => {
            event.stopPropagation()
            onEdit(card.id)
          }}
        >
          <Pencil className="size-3" />
          Editar
        </Button>
      </div>
    </article>
  )
}
