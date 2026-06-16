"use client"

import {
  CalendarDays,
  GraduationCap,
  Palmtree,
  Stethoscope,
  UserCheck,
  Users,
} from "lucide-react"

import { getAvailabilitySummary } from "@/lib/availability/utils"
import type { EmployeeAvailability } from "@/lib/types/availability"
import type { VisualTone } from "@/lib/ui/visual-tokens"
import { KpiCard } from "@/components/ui/kpi-card"

type AvailabilitySummaryCardsProps = {
  records: EmployeeAvailability[]
  employeeIds: string[]
}

const cards: {
  key: "available" | "vacation" | "licenses" | "training" | "total"
  label: string
  icon: typeof UserCheck
  tone: VisualTone
  hint?: React.ReactNode
}[] = [
  {
    key: "available",
    label: "Personal Disponible",
    icon: UserCheck,
    tone: "green",
    hint: "Personal sin ausencia activa hoy",
  },
  {
    key: "vacation",
    label: "Vacaciones Activas",
    icon: Palmtree,
    tone: "red",
  },
  {
    key: "licenses",
    label: "Licencias Activas",
    icon: Stethoscope,
    tone: "blue",
  },
  {
    key: "training",
    label: "Capacitaciones Activas",
    icon: GraduationCap,
    tone: "yellow",
  },
  {
    key: "total",
    label: "Total de Novedades",
    icon: Users,
    tone: "neutral",
    hint: (
      <span className="inline-flex items-center gap-1">
        <CalendarDays className="size-3" />
        Novedades registradas
      </span>
    ),
  },
]

export function AvailabilitySummaryCards({
  records,
  employeeIds,
}: AvailabilitySummaryCardsProps) {
  const summary = getAvailabilitySummary(records, employeeIds)

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <KpiCard
          key={card.key}
          label={card.label}
          value={summary[card.key]}
          icon={card.icon}
          tone={card.tone}
          hint={card.hint}
        />
      ))}
    </div>
  )
}
