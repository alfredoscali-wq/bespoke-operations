"use client"

import Link from "next/link"
import { useMemo } from "react"
import {
  CalendarDays,
  Palmtree,
  Stethoscope,
  UserCheck,
  Users,
  UsersRound,
} from "lucide-react"

import { useAvailability } from "@/components/disponibilidad/availability-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { getAvailabilitySummary } from "@/lib/availability/utils"
import { getEmployeeSummary } from "@/lib/employees/utils"
import { KpiCard } from "@/components/ui/kpi-card"

export function DashboardRrhhSummary() {
  const { employees } = useEmployees()
  const { records } = useAvailability()
  const { crews } = useCrews()

  const employeeSummary = useMemo(
    () => getEmployeeSummary(employees),
    [employees]
  )

  const availabilitySummary = useMemo(
    () =>
      getAvailabilitySummary(
        records,
        employees.map((employee) => employee.id)
      ),
    [records, employees]
  )

  const activeCrews = useMemo(
    () => crews.filter((crew) => crew.status !== "inactiva").length,
    [crews]
  )

  const cards = [
    {
      id: "active-employees",
      label: "Empleados activos",
      value: String(employeeSummary.active),
      hint: "Personal operativo hoy",
      href: "/rrhh",
      icon: UserCheck,
      tone: "green" as const,
    },
    {
      id: "licenses",
      label: "Licencias",
      value: String(employeeSummary.medicalLeave),
      hint: "Licencias médicas activas",
      href: "/rrhh",
      icon: Stethoscope,
      tone: "blue" as const,
    },
    {
      id: "availability",
      label: "Disponibilidad",
      value: String(availabilitySummary.available),
      hint: "Personal disponible hoy",
      href: "/operations/availability",
      icon: CalendarDays,
      tone: "green" as const,
    },
    {
      id: "absences",
      label: "Ausencias",
      value: String(
        availabilitySummary.vacation +
          availabilitySummary.licenses +
          availabilitySummary.training
      ),
      hint: "Vacaciones, licencias y capacitaciones",
      href: "/operations/availability",
      icon: Palmtree,
      tone: "yellow" as const,
    },
    {
      id: "crews",
      label: "Cuadrillas",
      value: String(activeCrews),
      hint: "Equipos activos en operación",
      href: "/cuadrillas",
      icon: UsersRound,
      tone: "violet" as const,
    },
    {
      id: "total-employees",
      label: "Total de empleados",
      value: String(employeeSummary.total),
      hint: "Personal registrado",
      href: "/rrhh",
      icon: Users,
      tone: "gray" as const,
    },
  ]

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Resumen de RRHH
          </h3>
          <p className="text-sm text-muted-foreground">
            Empleados activos, licencias, disponibilidad, ausencias y cuadrillas.
          </p>
        </div>
        <Link
          href="/rrhh"
          className="text-sm font-medium text-primary hover:underline"
        >
          Ver empleados
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.id} href={card.href} className="block">
            <KpiCard
              label={card.label}
              value={card.value}
              hint={card.hint}
              icon={card.icon}
              tone={card.tone}
              className="h-full transition-shadow hover:shadow-md"
            />
          </Link>
        ))}
      </div>
    </section>
  )
}
