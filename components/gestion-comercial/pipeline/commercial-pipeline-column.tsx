"use client"

import { CommercialPipelineCardView } from "@/components/gestion-comercial/pipeline/commercial-pipeline-card"
import {
  COMMERCIAL_PIPELINE_COLUMN_LABELS,
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
  return (
    <section
      className={cn(
        "flex h-full min-h-[420px] w-[280px] shrink-0 flex-col rounded-lg border bg-muted/30",
        isDropTarget && "border-primary bg-primary/5"
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
      <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <h2 className="text-sm font-semibold tracking-tight">
          {COMMERCIAL_PIPELINE_COLUMN_LABELS[status]}
        </h2>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {cards.length}
        </span>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {cards.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            Sin oportunidades
          </p>
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
