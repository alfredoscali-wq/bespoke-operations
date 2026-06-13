"use client"

import Image from "next/image"
import { Camera, FileText, Map, Play } from "lucide-react"

import { formatEvidenceDateTime } from "@/lib/evidence/constants"
import type { EvidenceFileType, EvidenceRecord } from "@/lib/types/evidence"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const fileTypeLabels: Record<EvidenceFileType, string> = {
  photo: "Fotografía",
  pdf: "Documento PDF",
  plan: "Plano técnico",
  video: "Video de campo",
}

type EvidencePreviewProps = {
  record: EvidenceRecord
  className?: string
}

export function EvidencePreview({ record, className }: EvidencePreviewProps) {
  const isVisualPreview =
    record.type === "photo" ||
    record.type === "video" ||
    record.type === "plan" ||
    record.type === "pdf"

  return (
    <Card className={cn("overflow-hidden shadow-sm", className)}>
      <CardHeader className="border-b pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Vista previa</CardTitle>
            <CardDescription>{fileTypeLabels[record.type]}</CardDescription>
          </div>
          <Badge variant="outline" className="font-normal">
            {record.category}
          </Badge>
        </div>
      </CardHeader>

      <div className="relative aspect-video bg-muted/30">
        {isVisualPreview ? (
          <>
            <Image
              src={record.previewUrl}
              alt={record.fileName}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 66vw"
              priority
            />
            {record.type === "video" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="flex size-14 items-center justify-center rounded-full bg-white/90 shadow-lg">
                  <Play className="ml-0.5 size-6 text-foreground" />
                </div>
              </div>
            )}
            {(record.type === "pdf" || record.type === "plan") && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                <div className="flex items-center gap-2 text-white">
                  {record.type === "plan" ? (
                    <Map className="size-4 shrink-0" />
                  ) : (
                    <FileText className="size-4 shrink-0" />
                  )}
                  <span className="truncate text-sm font-medium">
                    {record.fileName}
                  </span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <Camera className="size-12 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Vista previa no disponible para este tipo de archivo
            </p>
          </div>
        )}
      </div>

      <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-4 text-xs text-muted-foreground">
        <span className="truncate font-medium text-foreground">
          {record.fileName}
        </span>
        <span>{formatEvidenceDateTime(record.uploadedAt)}</span>
      </CardContent>
    </Card>
  )
}
