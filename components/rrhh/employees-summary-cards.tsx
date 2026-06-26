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

import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"
import { getEmployeeSummary } from "@/lib/employees/utils"
import { employeeSummaryKeyToFilters } from "@/lib/navigation/query-filters"
import type { Employee, EmployeeSummary } from "@/lib/types/employees"
import type { VisualTone } from "@/lib/ui/visual-tokens"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type EmployeesSummaryCardsProps = {
  employees: Employee[]
  activeKpi?: keyof EmployeeSummary | null
  onKpiClick?: (key: keyof EmployeeSummary) => void
}

type SummaryCardConfig = {
  key: keyof EmployeeSummary
  label: string
  icon: typeof Users
  tone: VisualTone
}

const primaryCards: SummaryCardConfig[] = [
  { key: "total", label: "Total", icon: Users, tone: "neutral" },
  { key: "active", label: "Activos", icon: UserCheck, tone: "green" },
  {
    key: "administradores",
    label: "Administradores",
    icon: Shield,
    tone: "violet",
  },
  { key: "supervisores", label: "Supervisores", icon: Briefcase, tone: "blue" },
  {
    key: "administrativos",
    label: "Administrativos",
    icon: Users,
    tone: "gray",
  },
  { key: "operarios", label: "Operarios", icon: HardHat, tone: "blue" },
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
  { key: "vacation", label: "Vacaciones", icon: Palmtree, tone: "red" },
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
  { key: "suspended", label: "Suspendidos", icon: Ban, tone: "yellow" },
  { key: "inactive", label: "Inactivos", icon: UserX, tone: "gray" },
]

function isKpiActive(
  key: keyof EmployeeSummary,
  activeKpi: keyof EmployeeSummary | null | undefined
): boolean {
  if (!activeKpi) return false
  if (key === activeKpi) return true
  if (key === "total" && activeKpi === "total") return true
  return false
}

function matchesActiveKpi(
  key: keyof EmployeeSummary,
  activeKpi: keyof EmployeeSummary | null | undefined
): boolean {
  if (!activeKpi || key === "total") return activeKpi === key
  const target = employeeSummaryKeyToFilters(activeKpi)
  const current = employeeSummaryKeyToFilters(key)
  return (
    target.employmentStatus === current.employmentStatus &&
    target.systemRole === current.systemRole &&
    target.provision === current.provision &&
    target.systemAccess === current.systemAccess
  )
}

function SummaryCardsGrid({
  cards,
  summary,
  activeKpi,
  onKpiClick,
  compact = false,
}: {
  cards: SummaryCardConfig[]
  summary: EmployeeSummary
  activeKpi?: keyof EmployeeSummary | null
  onKpiClick?: (key: keyof EmployeeSummary) => void
  compact?: boolean
}) {
  return (
    <KpiCardGrid layout="compact">
      {cards.map((card) => (
        <FilterableKpiCard
          key={card.key}
          compact
          label={card.label}
          value={summary[card.key]}
          icon={card.icon}
          tone={card.tone}
          isActive={matchesActiveKpi(card.key, activeKpi) || isKpiActive(card.key, activeKpi)}
          onClick={
            onKpiClick && card.key !== "total"
              ? () => onKpiClick(card.key)
              : undefined
          }
          cardClassName={compact ? "min-h-[4.5rem]" : undefined}
        />
      ))}
    </KpiCardGrid>
  )
}

export function EmployeesSummaryCards({
  employees,
  activeKpi,
  onKpiClick,
}: EmployeesSummaryCardsProps) {
  const summary = getEmployeeSummary(employees)
  const [secondaryOpen, setSecondaryOpen] = useState(false)

  const secondaryTotal = useMemo(
    () =>
      secondaryCards.reduce((total, card) => total + summary[card.key], 0),
    [summary]
  )

  return (
    <div className="space-y-2">
      <SummaryCardsGrid
        cards={primaryCards}
        summary={summary}
        activeKpi={activeKpi}
        onKpiClick={onKpiClick}
        compact
      />

      <div className="rounded-lg border bg-muted/20">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setSecondaryOpen((open) => !open)}
          className="h-8 w-full justify-between px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
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
              "size-4 shrink-0 transition-transform duration-200",
              secondaryOpen && "rotate-180"
            )}
          />
        </Button>

        {secondaryOpen ? (
          <div className="border-t px-2 pb-2 pt-1">
            <SummaryCardsGrid
              cards={secondaryCards}
              summary={summary}
              activeKpi={activeKpi}
              onKpiClick={onKpiClick}
              compact
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
