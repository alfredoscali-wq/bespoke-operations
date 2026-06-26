import {
  Award,
  Camera,
  CheckCircle2,
  Clock,
} from "lucide-react"

import type { CrewPerformance } from "@/lib/types/crews"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type CrewPerformanceTabProps = {
  performance: CrewPerformance
}

const metrics = [
  {
    key: "completedTasks" as const,
    label: "Órdenes de Trabajo Completadas",
    icon: CheckCircle2,
    color: "text-emerald-600 bg-emerald-50",
    suffix: "",
  },
  {
    key: "averageCompletionDays" as const,
    label: "Tiempo Promedio de Cierre",
    icon: Clock,
    color: "text-blue-600 bg-blue-50",
    suffix: " días",
  },
  {
    key: "approvedEvidence" as const,
    label: "Evidencias Aprobadas",
    icon: Camera,
    color: "text-violet-600 bg-violet-50",
    suffix: "",
  },
  {
    key: "productivityScore" as const,
    label: "Índice de Productividad",
    icon: Award,
    color: "text-amber-600 bg-amber-50",
    suffix: "/100",
  },
]

export function CrewPerformanceTab({ performance }: CrewPerformanceTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {metrics.map((metric) => {
          const Icon = metric.icon
          const value = performance[metric.key]

          return (
            <Card key={metric.key} className="shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {metric.label}
                  </CardTitle>
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg",
                      metric.color
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tracking-tight tabular-nums">
                  {value}
                  {metric.suffix}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Desempeño general</CardTitle>
          <CardDescription>
            Índice calculado con tasa de cierre de órdenes de trabajo (60%) y aprobación de
            evidencias (40%)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Productividad</span>
            <span className="font-semibold tabular-nums">
              {performance.productivityScore}%
            </span>
          </div>
          <Progress value={performance.productivityScore} className="h-2" />
        </CardContent>
      </Card>
    </div>
  )
}
