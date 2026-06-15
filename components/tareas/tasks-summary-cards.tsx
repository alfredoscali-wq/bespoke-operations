import {
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock,
  UserCheck,
} from "lucide-react"

import { getTasksSummary } from "@/lib/data/tasks"
import type { Task } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TasksSummaryCardsProps = {
  tasks: Task[]
}

const cards = [
  {
    key: "pendiente" as const,
    label: "Pendientes",
    icon: CircleDot,
    color: "text-slate-600 bg-slate-100",
  },
  {
    key: "asignada" as const,
    label: "Asignadas",
    icon: UserCheck,
    color: "text-blue-700 bg-blue-50",
  },
  {
    key: "enCurso" as const,
    label: "En Curso",
    icon: Clock,
    color: "text-amber-600 bg-amber-50",
  },
  {
    key: "enAprobacion" as const,
    label: "En Aprobación",
    icon: ClipboardCheck,
    color: "text-orange-600 bg-orange-50",
  },
  {
    key: "finalizada" as const,
    label: "Finalizadas",
    icon: CheckCircle2,
    color: "text-violet-700 bg-violet-50",
  },
]

export function TasksSummaryCards({ tasks }: TasksSummaryCardsProps) {
  const summary = getTasksSummary(tasks)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon
        const value = summary[card.key]

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
                {value}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
