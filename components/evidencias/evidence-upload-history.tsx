"use client"

import { History } from "lucide-react"

import { formatEvidenceDateTime } from "@/lib/evidence/constants"
import type { EvidenceUploadEvent } from "@/lib/types/evidence"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type EvidenceUploadHistoryProps = {
  history: EvidenceUploadEvent[]
}

export function EvidenceUploadHistory({ history }: EvidenceUploadHistoryProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <div>
            <CardTitle className="text-base">Historial de carga</CardTitle>
            <CardDescription>
              Registro cronológico de acciones sobre esta evidencia
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Sin eventos registrados
          </p>
        ) : (
          <div className="relative space-y-0">
            {history.map((event, index) => (
              <div key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
                {index < history.length - 1 && (
                  <span className="absolute top-5 left-[7px] h-[calc(100%-4px)] w-px bg-border" />
                )}
                <span className="relative z-10 mt-1.5 size-3.5 shrink-0 rounded-full border-2 border-primary bg-background" />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium">{event.action}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatEvidenceDateTime(event.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{event.user}</p>
                  {event.note && (
                    <p className="text-sm leading-relaxed text-foreground/80">
                      {event.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
