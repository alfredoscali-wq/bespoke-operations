import {
  AlertTriangle,
  CheckCircle2,
  Users,
  UserX,
} from "lucide-react"

import { CrewAvailabilityBadge } from "@/components/cuadrillas/crew-badges"
import { formatAvailabilityDate } from "@/lib/availability/constants"
import type { CrewAvailability } from "@/lib/types/crews"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type CrewAvailabilityStatsProps = {
  availability: CrewAvailability
}

const statItems = [
  {
    key: "totalMembers" as const,
    label: "Total integrantes",
    icon: Users,
    color: "text-primary bg-primary/8",
  },
  {
    key: "availableMembers" as const,
    label: "Disponibles",
    icon: CheckCircle2,
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    key: "absentMembers" as const,
    label: "Ausentes",
    icon: UserX,
    color: "text-red-600 bg-red-50",
  },
]

export function CrewAvailabilityStats({
  availability,
}: CrewAvailabilityStatsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statItems.map((item) => {
          const Icon = item.icon
          const value = availability[item.key]

          return (
            <Card key={item.key} className="shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {item.label}
                  </CardTitle>
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg",
                      item.color
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

      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Estado operativo
            </CardTitle>
            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <AlertTriangle className="size-4" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CrewAvailabilityBadge status={availability.status} />
          <p className="text-xs text-muted-foreground">
            Calculado para el {formatAvailabilityDate(availability.referenceDate)}{" "}
            según integrantes activos, RRHH y disponibilidad registrada.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
