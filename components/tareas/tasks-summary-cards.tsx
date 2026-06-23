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
  key: "pendiente" | "enCurso" | "pendienteCierre" | "cerrada" | "asignada"
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
    key: "enCurso",
    label: "En Curso",
    icon: Clock,
    tone: "yellow",
  },
  {
    key: "pendienteCierre",
    label: "Pendiente de Cierre",
    icon: ClipboardCheck,
    tone: "yellow",
  },
  {
    key: "cerrada",
    label: "Cerradas",
    icon: CheckCircle2,
    tone: "green",
  },
  {
    key: "asignada",
    label: "Asignadas",
    icon: UserCheck,
    tone: "blue",
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
