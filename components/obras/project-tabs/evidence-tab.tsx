"use client"

import Link from "next/link"
import { Camera, FileText } from "lucide-react"

import { useEvidenceOptional } from "@/components/evidencias/evidence-provider"
import {
  EvidenceStatusBadge,
  EvidenceTypeBadge,
} from "@/components/evidencias/evidence-badges"
import { formatEvidenceDateTime } from "@/lib/evidence/constants"
import {
  getEvidenceByProjectId,
  mockEvidence,
} from "@/lib/data/evidence"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type ProjectEvidenceTabProps = {
  projectId: string
}

export function ProjectEvidenceTab({ projectId }: ProjectEvidenceTabProps) {
  const evidenceContext = useEvidenceOptional()
  const allEvidence = evidenceContext?.evidence ?? mockEvidence
  const evidence = getEvidenceByProjectId(projectId, allEvidence)

  if (evidence.length === 0) {
    return (
      <Card className="border-dashed shadow-sm">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No hay evidencias cargadas para esta obra.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {evidence.map((item) => {
        const Icon = item.type === "photo" ? Camera : FileText

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
                <Badge variant="outline" className="text-[10px]">
                  {item.category}
                </Badge>
                <EvidenceStatusBadge status={item.status} className="text-[10px]" />
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
