"use client"

import Link from "next/link"
import {
  Camera,
  FileText,
  Map,
  Video,
} from "lucide-react"

import { useEvidenceOptional } from "@/components/evidencias/evidence-provider"
import {
  EvidenceStatusBadge,
  EvidenceTypeBadge,
} from "@/components/evidencias/evidence-badges"
import { formatEvidenceDateTime } from "@/lib/evidence/constants"
import { getEvidenceByTaskId, mockEvidence } from "@/lib/data/evidence"
import type { EvidenceFileType } from "@/lib/types/evidence"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TaskEvidenceTabProps = {
  taskId: string
}

const evidenceConfig: Record<
  EvidenceFileType,
  { label: string; icon: typeof Camera; style: string }
> = {
  photo: { label: "Foto", icon: Camera, style: "bg-blue-50 text-blue-700" },
  pdf: { label: "PDF", icon: FileText, style: "bg-red-50 text-red-700" },
  plan: { label: "Plano", icon: Map, style: "bg-violet-50 text-violet-700" },
  video: { label: "Video", icon: Video, style: "bg-amber-50 text-amber-700" },
}

export function TaskEvidenceTab({ taskId }: TaskEvidenceTabProps) {
  const evidenceContext = useEvidenceOptional()
  const allEvidence = evidenceContext?.evidence ?? mockEvidence
  const evidence = getEvidenceByTaskId(taskId, allEvidence)

  if (evidence.length === 0) {
    return (
      <Card className="border-dashed shadow-sm">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No hay evidencias cargadas para esta tarea.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {evidence.map((item) => {
        const config = evidenceConfig[item.type]
        const Icon = config.icon

        return (
          <Link key={item.id} href={`/evidencias/${item.id}`}>
            <Card className="h-full overflow-hidden shadow-sm transition-colors hover:bg-muted/30">
              <div className="flex aspect-video items-center justify-center bg-muted/40">
                <Icon className="size-10 text-muted-foreground/50" />
              </div>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="line-clamp-2 text-sm leading-snug">
                    {item.fileName}
                  </CardTitle>
                  <EvidenceTypeBadge type={item.type} className="shrink-0" />
                </div>
                <CardDescription>
                  {item.worker} · {formatEvidenceDateTime(item.uploadedAt)}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <EvidenceStatusBadge status={item.status} className="text-[10px]" />
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
