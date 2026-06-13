import {
  Camera,
  Clock,
  FileText,
  FolderOpen,
} from "lucide-react"

import { getEvidenceSummary } from "@/lib/data/evidence"
import type { EvidenceRecord } from "@/lib/types/evidence"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type EvidenceSummaryCardsProps = {
  evidence: EvidenceRecord[]
}

const cards = [
  {
    key: "total" as const,
    label: "Total de Evidencias",
    icon: FolderOpen,
    color: "text-primary bg-primary/8",
  },
  {
    key: "photos" as const,
    label: "Fotos",
    icon: Camera,
    color: "text-blue-600 bg-blue-50",
  },
  {
    key: "documents" as const,
    label: "Documentos",
    icon: FileText,
    color: "text-violet-600 bg-violet-50",
  },
  {
    key: "pendingReview" as const,
    label: "Pendientes de Revisión",
    icon: Clock,
    color: "text-amber-600 bg-amber-50",
  },
]

export function EvidenceSummaryCards({ evidence }: EvidenceSummaryCardsProps) {
  const summary = getEvidenceSummary(evidence)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.key} className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </CardTitle>
                <div
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg",
                    card.color
                  )}
                >
                  <Icon className="size-4" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight tabular-nums">
                {summary[card.key]}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
