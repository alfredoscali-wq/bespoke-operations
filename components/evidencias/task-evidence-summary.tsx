"use client"

import Link from "next/link"
import { Camera, Upload } from "lucide-react"

import { useEvidenceOptional } from "@/components/evidencias/evidence-provider"
import { formatEvidenceDateTime } from "@/lib/evidence/constants"
import { getTaskEvidenceStats } from "@/lib/data/evidence"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TaskEvidenceSummaryProps = {
  taskId: string
}

export function TaskEvidenceSummary({ taskId }: TaskEvidenceSummaryProps) {
  const evidenceContext = useEvidenceOptional()
  const evidence = evidenceContext?.evidence ?? []
  const stats = getTaskEvidenceStats(taskId, evidence)

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Evidencias de la orden de trabajo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3">
          <Camera className="size-4 text-blue-600" />
          <div>
            <p className="text-xs text-muted-foreground">Total evidencias</p>
            <p className="text-lg font-semibold tabular-nums">{stats.count}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
          <Upload className="size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Última carga</p>
            <p className="font-medium">
              {stats.lastUploadedAt
                ? formatEvidenceDateTime(stats.lastUploadedAt)
                : "Sin cargas"}
            </p>
          </div>
        </div>
        <Link
          href={`/evidencias?task=${taskId}`}
          className="inline-flex text-sm font-medium text-primary hover:underline"
        >
          Ver evidencias →
        </Link>
      </CardContent>
    </Card>
  )
}
