import {
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock,
  UserCheck,
} from "lucide-react"

import { getTasksSummary } from "@/lib/data/tasks"
import type { Task } from "@/lib/types/tasks"
import type { VisualTone } from "@/lib/ui/visual-tokens"
import { KpiCard } from "@/components/ui/kpi-card"

type TasksSummaryCardsProps = {
  tasks: Task[]
}

const cards: {
  key: "pendiente" | "asignada" | "enCurso" | "enAprobacion" | "finalizada"
  label: string
  icon: typeof CircleDot
  tone: VisualTone
}[] = [
  {
    key: "pendiente",
    label: "Pendientes",
    icon: CircleDot,
    tone: "gray",
  },
  {
    key: "asignada",
    label: "Asignadas",
    icon: UserCheck,
    tone: "blue",
  },
  {
    key: "enCurso",
    label: "En Curso",
    icon: Clock,
    tone: "yellow",
  },
  {
    key: "enAprobacion",
    label: "En Aprobación",
    icon: ClipboardCheck,
    tone: "yellow",
  },
  {
    key: "finalizada",
    label: "Finalizadas",
    icon: CheckCircle2,
    tone: "violet",
  },
]

export function TasksSummaryCards({ tasks }: TasksSummaryCardsProps) {
  const summary = getTasksSummary(tasks)

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
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
