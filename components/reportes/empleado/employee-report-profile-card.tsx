"use client"

import { formatDateOnly } from "@/lib/dates/date-only"
import { EMPLOYMENT_STATUS_LABELS } from "@/lib/employees/constants"
import { useEmployeeReports } from "@/components/reportes/empleado/employee-reports-provider"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function EmployeeReportProfileCard() {
  const { report, isLoading } = useEmployeeReports()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (!report) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Seleccioná un empleado para ver su ficha de rendimiento.
        </CardContent>
      </Card>
    )
  }

  const { profile, periodLabel, startDate, endDate } = report

  const rows = [
    { label: "Nombre", value: profile.displayName },
    { label: "Cargo", value: profile.jobTitle },
    { label: "Área", value: profile.areaLabel },
    { label: "Supervisor", value: profile.supervisorName ?? "—" },
    {
      label: "Estado",
      value: (
        <Badge variant="outline">
          {EMPLOYMENT_STATUS_LABELS[profile.employmentStatus]}
        </Badge>
      ),
    },
    {
      label: "Fecha de ingreso",
      value: profile.hireDate ? formatDateOnly(profile.hireDate) : "—",
    },
  ]

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{profile.displayName}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {profile.jobTitle} · {profile.department}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Período: {periodLabel} ({startDate} → {endDate})
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label}>
            <p className="text-xs text-muted-foreground">{row.label}</p>
            <div className="mt-1 text-sm font-medium text-foreground">
              {row.value}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
