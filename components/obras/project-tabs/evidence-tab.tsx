"use client"

import Link from "next/link"
import Image from "next/image"
import { Camera, FileText } from "lucide-react"

import { useEvidence } from "@/components/evidencias/evidence-provider"
import {
  EvidenceStatusBadge,
  EvidenceTypeBadge,
} from "@/components/evidencias/evidence-badges"
import { EvidenceUploadDialog } from "@/components/evidencias/evidence-upload-dialog"
import { formatEvidenceDateTime } from "@/lib/evidence/constants"
import { getEvidenceByProjectId } from "@/lib/data/evidence"
import type { Project } from "@/lib/types/projects"
import { Badge } from "@/components/ui/badge"

type ProjectEvidenceTabProps = {
  project: Pick<Project, "id" | "code" | "name">
}

export function ProjectEvidenceTab({ project }: ProjectEvidenceTabProps) {
  const { evidence, uploadEvidence } = useEvidence()
  const projectEvidence = getEvidenceByProjectId(project.id, evidence)

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {projectEvidence.length} evidencia
          {projectEvidence.length === 1 ? "" : "s"}
        </p>

        <EvidenceUploadDialog
          onSubmit={uploadEvidence}
          project={{
            id: project.id,
            code: project.code,
            name: project.name,
          }}
          allowProjectOnly
        />
      </div>

      {projectEvidence.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/15 px-4 py-10 text-center text-sm text-muted-foreground">
          No hay evidencias cargadas.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projectEvidence.map((item) => {
            const Icon = item.type === "photo" ? Camera : FileText

            return (
              <Link
                key={item.id}
                href={`/evidencias/${item.id}`}
                className="group overflow-hidden rounded-lg border bg-card shadow-sm transition-colors hover:border-primary/30"
              >
                <div className="relative flex aspect-[4/3] items-center justify-center bg-muted/30">
                  {item.previewUrl ? (
                    <Image
                      src={item.previewUrl}
                      alt={item.fileName}
                      fill
                      className="object-cover transition group-hover:scale-[1.02]"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  ) : (
                    <Icon className="size-8 text-muted-foreground/50" />
                  )}
                </div>
                <div className="space-y-1.5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-medium leading-snug text-foreground">
                      {item.fileName}
                    </p>
                    <EvidenceTypeBadge type={item.type} className="shrink-0 text-[10px]" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.worker} · {formatEvidenceDateTime(item.uploadedAt)}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {item.category}
                    </Badge>
                    <EvidenceStatusBadge
                      status={item.status}
                      className="text-[10px]"
                    />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
