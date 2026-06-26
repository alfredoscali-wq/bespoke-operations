"use client"

import Link from "next/link"
import { Camera, FileText, Upload } from "lucide-react"

import { useEvidenceOptional } from "@/components/evidencias/evidence-provider"
import { formatEvidenceDateTime } from "@/lib/evidence/constants"
import { getProjectEvidenceStats } from "@/lib/data/evidence"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type ProjectEvidenceSummaryProps = {
  projectId: string
}

export function ProjectEvidenceSummary({ projectId }: ProjectEvidenceSummaryProps) {
  const evidenceContext = useEvidenceOptional()
  const evidence = evidenceContext?.evidence ?? []
  const stats = getProjectEvidenceStats(projectId, evidence)

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Evidencias de la obra</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3">
            <Camera className="size-4 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground">Total fotos</p>
              <p className="text-lg font-semibold tabular-nums">
                {stats.totalPhotos}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3">
            <FileText className="size-4 text-violet-600" />
            <div>
              <p className="text-xs text-muted-foreground">Documentos</p>
              <p className="text-lg font-semibold tabular-nums">
                {stats.totalDocuments}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
          <Upload className="size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Última evidencia</p>
            <p className="font-medium">
              {stats.lastUploadedAt
                ? formatEvidenceDateTime(stats.lastUploadedAt)
                : "Sin cargas"}
            </p>
          </div>
        </div>
        <Link
          href={`/evidencias?project=${projectId}`}
          className="inline-flex text-sm font-medium text-primary hover:underline"
        >
          Ver todas las evidencias →
        </Link>
      </CardContent>
    </Card>
  )
}
