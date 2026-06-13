import { Award, FileText, Map } from "lucide-react"

import type { ProjectDocument } from "@/lib/types/projects"
import { formatDate } from "@/lib/projects/constants"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type ProjectDocumentsTabProps = {
  documents: ProjectDocument[]
}

const documentConfig = {
  pdf: { label: "PDF", icon: FileText, style: "bg-red-50 text-red-700" },
  plan: { label: "Plano", icon: Map, style: "bg-blue-50 text-blue-700" },
  certificate: {
    label: "Certificado",
    icon: Award,
    style: "bg-emerald-50 text-emerald-700",
  },
}

export function ProjectDocumentsTab({ documents }: ProjectDocumentsTabProps) {
  if (documents.length === 0) {
    return (
      <Card className="border-dashed shadow-sm">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No hay documentos registrados para esta obra.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {documents.map((document) => {
        const config = documentConfig[document.type]
        const Icon = config.icon

        return (
          <Card key={document.id} className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-5 text-muted-foreground" />
                </div>
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-sm leading-snug">
                    {document.name}
                  </CardTitle>
                  <CardDescription>
                    {formatDate(document.uploadedAt)} · {document.size}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className={config.style}>
                {config.label}
              </Badge>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
