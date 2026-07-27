"use client"

import { Inbox } from "lucide-react"

import { CommercialEmptyState } from "@/components/gestion-comercial/commercial-ui"
import { CommercialPipelineCardView } from "@/components/gestion-comercial/pipeline/commercial-pipeline-card"
import {
  COMMERCIAL_PIPELINE_COLUMN_LABELS,
  COMMERCIAL_STATUS_MAP_COLORS,
  type CommercialStatusCode,
} from "@/lib/commercial/catalogs"
import type { CommercialPipelineCard } from "@/lib/types/commercial-pipeline"
import { cn } from "@/lib/utils"

type CommercialPipelineColumnProps = {
  status: CommercialStatusCode
  cards: CommercialPipelineCard[]
  isDropTarget: boolean
  draggingId: string | null
  onDragStart: (cardId: string, status: CommercialStatusCode) => void
  onDragOver: (status: CommercialStatusCode) => void
  onDragLeave: (status: CommercialStatusCode) => void
  onDrop: (status: CommercialStatusCode) => void
  onOpenDossier: (id: string) => void
  onRegisterActivity: (id: string) => void
  onCreateCommitment: (id: string) => void
  onEdit: (id: string) => void
}

export function CommercialPipelineColumn({
  status,
  cards,
  isDropTarget,
  draggingId,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onOpenDossier,
  onRegisterActivity,
  onCreateCommitment,
  onEdit,
}: CommercialPipelineColumnProps) {
  const accent = COMMERCIAL_STATUS_MAP_COLORS[status]

  return (
    <section
      className={cn(
        "flex h-full min-h-[420px] w-[288px] shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm",
        isDropTarget && "ring-2 ring-primary/25"
      )}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = "move"
        onDragOver(status)
      }}
      onDragLeave={() => onDragLeave(status)}
      onDrop={(event) => {
        event.preventDefault()
        onDrop(status)
      }}
    >
      <div className="h-1 w-full" style={{ backgroundColor: accent }} aria-hidden />
      <header className="flex items-center justify-between gap-2 border-b bg-muted/20 px-3 py-2.5">
        <h2 className="text-sm font-semibold tracking-tight">
          {COMMERCIAL_PIPELINE_COLUMN_LABELS[status]}
        </h2>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums text-white"
          style={{ backgroundColor: accent }}
        >
          {cards.length}
        </span>
      </header>

      <div className="flex-1 space-y-2.5 overflow-y-auto p-2.5">
        {cards.length === 0 ? (
          <CommercialEmptyState
            icon={Inbox}
            title="Sin oportunidades"
            description="Arrastrá una tarjeta acá para moverla de etapa."
            className="py-8"
          />
        ) : (
          cards.map((card) => (
            <CommercialPipelineCardView
              key={card.id}
              card={card}
              isDragging={draggingId === card.id}
              onDragStart={onDragStart}
              onOpenDossier={onOpenDossier}
              onRegisterActivity={onRegisterActivity}
              onCreateCommitment={onCreateCommitment}
              onEdit={onEdit}
            />
          ))
        )}
      </div>
    </section>
  )
}
