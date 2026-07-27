"use client"

import {
  CalendarPlus,
  FolderOpen,
  Pencil,
  StickyNote,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  COMMERCIAL_SOURCE_LABELS,
  type CommercialStatusCode,
} from "@/lib/commercial/catalogs"
import { resolveCommercialResponsibleColor } from "@/lib/commercial/responsible-colors"
import type { CommercialPipelineCard } from "@/lib/types/commercial-pipeline"
import { cn } from "@/lib/utils"

function formatCreatedDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value))
  } catch {
    return value.slice(0, 10)
  }
}

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
        "cursor-grab rounded-md border bg-background p-3 shadow-sm active:cursor-grabbing",
        isDragging && "opacity-60"
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: color.hex }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[11px] text-muted-foreground">{card.code}</p>
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
          style={{ backgroundColor: color.hex }}
          title={card.responsibleName}
        >
          {initials(card.responsibleName)}
        </span>
      </div>

      <p className="mt-1 truncate text-sm font-medium">{card.personName}</p>
      {card.companyName ? (
        <p className="truncate text-xs text-muted-foreground">{card.companyName}</p>
      ) : null}

      <p className="mt-2 text-xs text-muted-foreground">
        {card.responsibleName}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {formatCreatedDate(card.createdAt)} · {card.daysSinceLastActivity}d sin
        act.
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {COMMERCIAL_SOURCE_LABELS[card.source]}
      </p>

      {(card.hasOverdueCommitment || card.isDerived) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {card.hasOverdueCommitment ? (
            <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
              Compromiso vencido
            </span>
          ) : null}
          {card.isDerived ? (
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
              Derivada
            </span>
          ) : null}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-[11px]"
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
          className="h-7 gap-1 px-2 text-[11px]"
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
          className="h-7 gap-1 px-2 text-[11px]"
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
          className="h-7 gap-1 px-2 text-[11px]"
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
