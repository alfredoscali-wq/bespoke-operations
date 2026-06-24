"use client"

import { useMemo, useState } from "react"
import {
  Ban,
  Briefcase,
  ChevronDown,
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
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type EmployeesSummaryCardsProps = {
  employees: Employee[]
}

type SummaryCardConfig = {
  key: keyof EmployeeSummary
  label: string
  icon: typeof Users
  tone: VisualTone
}

const primaryCards: SummaryCardConfig[] = [
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
]

const secondaryCards: SummaryCardConfig[] = [
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

function SummaryCardsGrid({
  cards,
  summary,
}: {
  cards: SummaryCardConfig[]
  summary: EmployeeSummary
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
      {cards.map((card) => (
        <KpiCard
          key={card.key}
          compact
          label={card.label}
          value={summary[card.key]}
          icon={card.icon}
          tone={card.tone}
        />
      ))}
    </div>
  )
}

export function EmployeesSummaryCards({ employees }: EmployeesSummaryCardsProps) {
  const summary = getEmployeeSummary(employees)
  const [secondaryOpen, setSecondaryOpen] = useState(false)

  const secondaryTotal = useMemo(
    () =>
      secondaryCards.reduce((total, card) => total + summary[card.key], 0),
    [summary]
  )

  return (
    <div className="space-y-2">
      <SummaryCardsGrid cards={primaryCards} summary={summary} />

      <div className="rounded-lg border bg-muted/20">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setSecondaryOpen((open) => !open)}
          className="h-8 w-full justify-between px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
          aria-expanded={secondaryOpen}
        >
          <span>
            Estados y licencias
            {!secondaryOpen ? (
              <span className="ml-2 tabular-nums text-foreground">
                ({secondaryTotal})
              </span>
            ) : null}
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 transition-transform",
              secondaryOpen && "rotate-180"
            )}
          />
        </Button>

        {secondaryOpen ? (
          <div className="border-t px-2 pb-2 pt-1">
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {secondaryCards.map((card) => (
                <KpiCard
                  key={card.key}
                  compact
                  label={card.label}
                  value={summary[card.key]}
                  icon={card.icon}
                  tone={card.tone}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
