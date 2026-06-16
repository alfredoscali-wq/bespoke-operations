import {
  Camera,
  Clock,
  FileText,
  FolderOpen,
} from "lucide-react"

import { getEvidenceSummary } from "@/lib/data/evidence"
import type { EvidenceRecord } from "@/lib/types/evidence"
import type { VisualTone } from "@/lib/ui/visual-tokens"
import { KpiCard } from "@/components/ui/kpi-card"

type EvidenceSummaryCardsProps = {
  evidence: EvidenceRecord[]
}

const cards: {
  key: "total" | "photos" | "documents" | "pendingReview"
  label: string
  icon: typeof FolderOpen
  tone: VisualTone
}[] = [
  {
    key: "total",
    label: "Total de Evidencias",
    icon: FolderOpen,
    tone: "neutral",
  },
  {
    key: "photos",
    label: "Fotos",
    icon: Camera,
    tone: "blue",
  },
  {
    key: "documents",
    label: "Documentos",
    icon: FileText,
    tone: "violet",
  },
  {
    key: "pendingReview",
    label: "Pendientes de Revisión",
    icon: Clock,
    tone: "yellow",
  },
]

export function EvidenceSummaryCards({ evidence }: EvidenceSummaryCardsProps) {
  const summary = getEvidenceSummary(evidence)

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <KpiCard
          key={card.key}
          label={card.label}
          value={summary[card.key]}
          icon={card.icon}
          tone={card.tone}
        />
      ))}
    </div>
  )
}
