import {
  Ban,
  Briefcase,
  GraduationCap,
  HeartPulse,
  HardHat,
  KeyRound,
  Palmtree,
  Shield,
  UserCheck,
  UserPlus,
  Users,
  UserX,
} from "lucide-react"

import { getEmployeeSummary } from "@/lib/employees/utils"
import type { Employee, EmployeeSummary } from "@/lib/types/employees"
import type { VisualTone } from "@/lib/ui/visual-tokens"
import { KpiCard } from "@/components/ui/kpi-card"

type EmployeesSummaryCardsProps = {
  employees: Employee[]
}

const cards: {
  key: keyof EmployeeSummary
  label: string
  icon: typeof Users
  tone: VisualTone
}[] = [
  {
    key: "total",
    label: "Total",
    icon: Users,
    tone: "neutral",
  },
  {
    key: "active",
    label: "Activos",
    icon: UserCheck,
    tone: "green",
  },
  {
    key: "administradores",
    label: "Administradores",
    icon: Shield,
    tone: "violet",
  },
  {
    key: "supervisores",
    label: "Supervisores",
    icon: Briefcase,
    tone: "blue",
  },
  {
    key: "administrativos",
    label: "Administrativos",
    icon: Users,
    tone: "gray",
  },
  {
    key: "operarios",
    label: "Operarios",
    icon: HardHat,
    tone: "blue",
  },
  {
    key: "provisionedUsers",
    label: "Usuarios provisionados",
    icon: KeyRound,
    tone: "green",
  },
  {
    key: "pendingProvision",
    label: "Pendientes de provisión",
    icon: UserPlus,
    tone: "yellow",
  },
  {
    key: "vacation",
    label: "Vacaciones",
    icon: Palmtree,
    tone: "red",
  },
  {
    key: "medicalLeave",
    label: "Licencia Médica",
    icon: HeartPulse,
    tone: "yellow",
  },
  {
    key: "training",
    label: "Capacitación",
    icon: GraduationCap,
    tone: "violet",
  },
  {
    key: "suspended",
    label: "Suspendidos",
    icon: Ban,
    tone: "yellow",
  },
  {
    key: "inactive",
    label: "Inactivos",
    icon: UserX,
    tone: "gray",
  },
]

export function EmployeesSummaryCards({ employees }: EmployeesSummaryCardsProps) {
  const summary = getEmployeeSummary(employees)

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
