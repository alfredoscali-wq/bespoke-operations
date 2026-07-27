"use client"

import { useState } from "react"
import { History } from "lucide-react"

import { AttachmentList } from "@/components/attachments/attachment-list"
import { AttachmentPreview } from "@/components/attachments/attachment-preview"
import {
  deleteAttachmentFile,
  getAttachmentPreviewLink,
} from "@/lib/attachments/client"
import { resolveAttachmentPreviewKind } from "@/lib/attachments/format"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { ConsultationTimelineCard } from "@/lib/customer-atenciones/consultation-expediente"
import type { Attachment } from "@/lib/types/attachments"

type ConsultationEventsTimelineProps = {
  cards: ConsultationTimelineCard[]
  employeeNamesById: Record<string, string>
  presentation?: "page" | "panel"
  attachmentsByEventId?: Record<string, Attachment[]>
  canDeleteAttachments?: boolean
  onAttachmentsChanged?: () => void
}

function formatEventDateParts(isoDate: string): { date: string; time: string } {
  const eventDate = new Date(isoDate)
  return {
    date: eventDate.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    time: eventDate.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  }
}

function TimelineAttachmentsBlock({
  attachments,
  canDelete,
  onChanged,
}: {
  attachments: Attachment[]
  canDelete: boolean
  onChanged?: () => void
}) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(
    null
  )
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  if (attachments.length === 0) {
    return null
  }

  async function resolveUrl(attachment: Attachment) {
    const result = await getAttachmentPreviewLink(attachment.id)
    if (!result.success) {
      return null
    }
    return result.url
  }

  async function handleOpen(attachment: Attachment) {
    setIsBusy(true)
    try {
      const url = await resolveUrl(attachment)
      if (!url) return

      const kind = resolveAttachmentPreviewKind(attachment.mimeType)
      if (kind === "pdf" || kind === "file") {
        window.open(url, "_blank", "noopener,noreferrer")
        return
      }

      setPreviewAttachment(attachment)
      setPreviewUrl(url)
      setPreviewOpen(true)
    } finally {
      setIsBusy(false)
    }
  }

  async function handleDownload(attachment: Attachment) {
    setIsBusy(true)
    try {
      const url = await resolveUrl(attachment)
      if (!url) return
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = attachment.originalName
      anchor.target = "_blank"
      anchor.rel = "noopener noreferrer"
      anchor.click()
    } finally {
      setIsBusy(false)
    }
  }

  async function handleDelete(attachment: Attachment) {
    setIsBusy(true)
    try {
      const result = await deleteAttachmentFile(attachment.id)
      if (result.success) {
        onChanged?.()
      }
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[11px] font-semibold text-slate-700">Adjuntos</p>
      <AttachmentList
        attachments={attachments}
        canDelete={canDelete}
        isBusy={isBusy}
        compact
        onOpen={(item) => {
          void handleOpen(item)
        }}
        onDownload={(item) => {
          void handleDownload(item)
        }}
        onDelete={
          canDelete
            ? (item) => {
                void handleDelete(item)
              }
            : undefined
        }
      />
      <AttachmentPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        attachment={previewAttachment}
        url={previewUrl}
      />
    </div>
  )
}

function PanelTimelineEntry({
  card,
  actorName,
  isLast,
  attachments,
  canDeleteAttachments,
  onAttachmentsChanged,
}: {
  card: ConsultationTimelineCard
  actorName: string
  isLast: boolean
  attachments: Attachment[]
  canDeleteAttachments: boolean
  onAttachmentsChanged?: () => void
}) {
  const { date, time } = formatEventDateParts(card.createdAt)
  const infoComment =
    card.comment && card.commentLabel === "Información registrada"
      ? card.comment
      : null
  const resultComment =
    card.comment && card.commentLabel === "Resultado de esa gestión"
      ? card.comment
      : null
  const hasRegisteredInfo = card.facts.length > 0 || Boolean(infoComment)
  const actionTitle = card.eventTitle
    .toLocaleLowerCase("es-AR")
    .replace(/^\w/, (letter) => letter.toUpperCase())

  return (
    <article className="relative grid grid-cols-[6.75rem_1rem_minmax(0,1fr)] gap-x-3 pb-5">
      {!isLast ? (
        <span className="absolute top-4 left-[calc(6.75rem+0.5rem-0.5px)] h-[calc(100%-0.25rem)] w-px bg-slate-200" />
      ) : null}

      <div className="min-w-0 pt-0.5 text-right">
        <p className="text-[11px] leading-tight text-slate-500">{date}</p>
        <p className="mt-0.5 text-[11px] leading-tight text-slate-500">{time}</p>
        <p className="mt-1.5 text-[11px] leading-snug font-medium text-slate-600">
          {actorName}
        </p>
      </div>

      <div className="relative z-10 flex justify-center pt-1.5">
        <span className="size-2.5 shrink-0 rounded-full bg-sky-500 ring-[3px] ring-white" />
      </div>

      <div className="min-w-0 max-w-2xl border-b border-slate-200/80 pb-5">
        <p className="text-[11px] font-medium tracking-wide text-sky-700">
          {card.areaLabel}
        </p>
        <h3 className="mt-0.5 text-[14px] leading-snug font-semibold text-slate-900">
          {actionTitle}
        </h3>
        <p className="mt-1 text-[12px] leading-snug text-slate-600">
          {actorName} {card.narrativeLead}
        </p>

        {hasRegisteredInfo ? (
          <div className="mt-3 space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-700">
              Qué realizó
            </p>
            {card.facts.map((fact) => (
              <p
                key={`${card.id}-${fact.label}`}
                className="text-[13px] leading-relaxed text-slate-700"
              >
                <span className="text-slate-500">{fact.label}:</span>{" "}
                <span className="whitespace-pre-wrap">{fact.value}</span>
              </p>
            ))}
            {infoComment ? (
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
                {infoComment}
              </p>
            ) : null}
          </div>
        ) : null}

        {resultComment ? (
          <div className="mt-3 space-y-1">
            <p className="text-[11px] font-semibold text-slate-700">
              Resultado obtenido
            </p>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-700">
              {resultComment}
            </p>
          </div>
        ) : null}

        <TimelineAttachmentsBlock
          attachments={attachments}
          canDelete={canDeleteAttachments}
          onChanged={onAttachmentsChanged}
        />

        {card.closingNote ? (
          <div className="mt-3 space-y-1">
            <p className="text-[11px] font-semibold text-slate-700">
              Próximo paso generado
            </p>
            <p className="text-[13px] leading-relaxed text-slate-600">
              {card.closingNote}
            </p>
          </div>
        ) : null}
      </div>
    </article>
  )
}

function PageTimelineEntry({
  card,
  actorName,
  isLast,
  attachments,
  canDeleteAttachments,
  onAttachmentsChanged,
}: {
  card: ConsultationTimelineCard
  actorName: string
  isLast: boolean
  attachments: Attachment[]
  canDeleteAttachments: boolean
  onAttachmentsChanged?: () => void
}) {
  const { date, time } = formatEventDateParts(card.createdAt)
  const infoComment =
    card.comment && card.commentLabel === "Información registrada"
      ? card.comment
      : null
  const resultComment =
    card.comment && card.commentLabel === "Resultado de esa gestión"
      ? card.comment
      : null
  const hasRegisteredInfo = card.facts.length > 0 || Boolean(infoComment)
  const hasResult = Boolean(resultComment) || Boolean(card.closingNote)

  return (
    <article className="relative flex gap-3">
      {!isLast ? (
        <span className="absolute top-5 left-[7px] h-[calc(100%+0.75rem)] w-px bg-border" />
      ) : null}
      <div className="relative z-10 mt-1.5 size-3.5 shrink-0 rounded-full border-2 border-sky-500/70 bg-background" />

      <div className="min-w-0 flex-1 border-b border-border/60 pb-4">
        <p className="text-[11px] leading-none text-muted-foreground">
          {date} {time}
        </p>
        <p className="mt-1.5 text-[12px] font-medium text-muted-foreground">
          {actorName}
        </p>
        <h3 className="mt-2 text-[13px] font-semibold tracking-wide text-foreground uppercase">
          {card.eventTitle}
        </h3>

        {hasRegisteredInfo ? (
          <div className="mt-3 space-y-2">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Información registrada
            </p>
            {card.facts.map((fact) => (
              <div key={`${card.id}-${fact.label}`} className="min-w-0">
                <p className="text-[10px] leading-none text-muted-foreground">
                  {fact.label}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-snug text-foreground">
                  {fact.value}
                </p>
              </div>
            ))}
            {infoComment ? (
              <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground">
                {infoComment}
              </p>
            ) : null}
          </div>
        ) : null}

        {hasResult ? (
          <div className="mt-3 space-y-1.5">
            <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              Resultado de esa gestión
            </p>
            {resultComment ? (
              <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground">
                {resultComment}
              </p>
            ) : null}
            {card.closingNote ? (
              <p className="text-[12px] leading-snug text-muted-foreground">
                {card.closingNote}
              </p>
            ) : null}
          </div>
        ) : null}

        <TimelineAttachmentsBlock
          attachments={attachments}
          canDelete={canDeleteAttachments}
          onChanged={onAttachmentsChanged}
        />
      </div>
    </article>
  )
}

export function ConsultationEventsTimeline({
  cards,
  employeeNamesById,
  presentation = "page",
  attachmentsByEventId = {},
  canDeleteAttachments = false,
  onAttachmentsChanged,
}: ConsultationEventsTimelineProps) {
  if (cards.length === 0) {
    const empty = (
      <p className="py-2 text-xs text-muted-foreground">
        Todavía no hay intervenciones registradas.
      </p>
    )

    if (presentation === "panel") {
      return (
        <section className="min-w-0">
          <div className="mb-4 flex items-center gap-2">
            <History className="size-4 text-sky-600" aria-hidden />
            <h2 className="text-[11px] font-bold tracking-wide text-sky-700 uppercase">
              Historial de la consulta
            </h2>
          </div>
          {empty}
        </section>
      )
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Expediente de la consulta</CardTitle>
          <CardDescription>
            Historia completa de la gestión, del más antiguo al más reciente.
          </CardDescription>
        </CardHeader>
        <CardContent>{empty}</CardContent>
      </Card>
    )
  }

  if (presentation === "panel") {
    return (
      <section className="min-w-0">
        <div className="mb-5 flex items-center gap-2">
          <History className="size-4 text-sky-600" aria-hidden />
          <h2 className="text-[11px] font-bold tracking-wide text-sky-700 uppercase">
            Historial de la consulta
          </h2>
        </div>
        <div>
          {cards.map((card, index) => (
            <PanelTimelineEntry
              key={card.id}
              card={card}
              actorName={employeeNamesById[card.employeeId] ?? "Un operador"}
              isLast={index === cards.length - 1}
              attachments={attachmentsByEventId[card.id] ?? []}
              canDeleteAttachments={canDeleteAttachments}
              onAttachmentsChanged={onAttachmentsChanged}
            />
          ))}
        </div>
      </section>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expediente de la consulta</CardTitle>
        <CardDescription>
          Historia completa de la gestión, del más antiguo al más reciente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 py-1">
          {cards.map((card, index) => (
            <PageTimelineEntry
              key={card.id}
              card={card}
              actorName={employeeNamesById[card.employeeId] ?? "Un operador"}
              isLast={index === cards.length - 1}
              attachments={attachmentsByEventId[card.id] ?? []}
              canDeleteAttachments={canDeleteAttachments}
              onAttachmentsChanged={onAttachmentsChanged}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
