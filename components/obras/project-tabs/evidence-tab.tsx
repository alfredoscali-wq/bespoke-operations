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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type ProjectEvidenceTabProps = {
  project: Pick<Project, "id" | "code" | "name">
}

export function ProjectEvidenceTab({ project }: ProjectEvidenceTabProps) {
  const { evidence, uploadEvidence } = useEvidence()
  const projectEvidence = getEvidenceByProjectId(project.id, evidence)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Evidencias de la obra
          </h3>
          <p className="text-sm text-muted-foreground">
            {projectEvidence.length}{" "}
            {projectEvidence.length === 1 ? "registro" : "registros"} cargados
          </p>
        </div>

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
        <Card className="border-dashed shadow-sm">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No hay evidencias cargadas para esta obra.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projectEvidence.map((item) => {
            const Icon = item.type === "photo" ? Camera : FileText

            return (
              <Link key={item.id} href={`/evidencias/${item.id}`}>
                <Card className="h-full overflow-hidden shadow-sm transition-colors hover:bg-muted/30">
                  <div className="relative flex aspect-video items-center justify-center bg-muted/40">
                    {item.previewUrl ? (
                      <Image
                        src={item.previewUrl}
                        alt={item.fileName}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    ) : (
                      <Icon className="size-10 text-muted-foreground/50" />
                    )}
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
                    <EvidenceStatusBadge
                      status={item.status}
                      className="text-[10px]"
                    />
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
