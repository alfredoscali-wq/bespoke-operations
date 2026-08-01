"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Loader2, Radar } from "lucide-react"

import { AnalysisBreadcrumb } from "@/components/analysis/analysis-breadcrumb"
import { useAnalysisNavContext } from "@/components/analysis/use-analysis-nav-context"
import { SituationRoomView } from "@/components/executive/situation-room-view"
import { todayDateInputValue } from "@/lib/activity/employee-daily-report"
import { canAccessOperationsIntelligence } from "@/lib/activity/operations-intelligence"
import { getEmployeeFullName } from "@/lib/employees/utils"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  buildAnalysisBreadcrumb,
  hrefDailyBrief,
  hrefWorkforce,
} from "@/lib/analysis/smart-navigation"
import {
  useAnalysisEmployeesQuery,
  useSituationRoomQuery,
} from "@/lib/analysis/react-query"
import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { moduleColorVar } from "@/lib/ui/module-colors"

export function SituationRoomModule() {
  const { sessionUser } = useAuth()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const { context, replaceContext } = useAnalysisNavContext("situation-room")
  const allowed = canAccessOperationsIntelligence(sessionUser?.systemRole)
  const [date, setDate] = useState(
    () => context.date?.trim() || todayDateInputValue()
  )

  const employeesQuery = useAnalysisEmployeesQuery(
    companyId,
    Boolean(allowed && isAuthReady && companyId)
  )
  const situationQuery = useSituationRoomQuery(date, allowed)

  const employeeNamesById = useMemo(() => {
    const map: Record<string, string> = {}
    for (const employee of employeesQuery.data?.employees ?? []) {
      map[employee.id] = getEmployeeFullName(employee)
    }
    return map
  }, [employeesQuery.data?.employees])

  const navContext = useMemo(
    () => ({ ...context, date }),
    [context, date]
  )

  const crumbs = useMemo(
    () =>
      buildAnalysisBreadcrumb({
        currentStep: "situation-room",
        context: navContext,
      }),
    [navContext]
  )

  function handleDateChange(next: string) {
    setDate(next)
    replaceContext({ date: next })
  }

  const brief = situationQuery.data?.brief ?? null
  const isLoading = situationQuery.isPending
  const error = situationQuery.error
    ? situationQuery.error instanceof Error
      ? situationQuery.error.message
      : "No se pudo cargar la Sala de Situación."
    : null

  if (!allowed) {
    return (
      <div className="rounded-xl border bg-card px-6 py-10 text-center shadow-sm">
        <Radar
          className="mx-auto size-8"
          style={{ color: moduleColorVar("intelligence") }}
        />
        <h2 className="mt-3 text-base font-semibold">Sala de Situación</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Solo administración, supervisión y gerencia pueden acceder.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-6 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <AnalysisBreadcrumb crumbs={crumbs} className="mb-1" />
          <div className="flex items-center gap-2.5">
            <Radar
              className="size-5 shrink-0"
              style={{ color: moduleColorVar("intelligence") }}
              aria-hidden
            />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Sala de Situación
            </h1>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            ¿Cómo está funcionando la empresa hoy?
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="situation-room-date">Fecha</Label>
            <Input
              id="situation-room-date"
              type="date"
              className="h-9 w-[11.5rem] bg-background"
              value={date}
              onChange={(event) => handleDateChange(event.target.value)}
            />
          </div>
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href={hrefDailyBrief(navContext, "situation-room")}>
              Resumen Diario
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href={hrefWorkforce(navContext, "situation-room")}>
              Workforce Monitor
            </Link>
          </Button>
        </div>
      </header>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isLoading && !brief ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando Sala de Situación…
        </div>
      ) : (
        <SituationRoomView
          brief={brief}
          isLoading={isLoading}
          employeeNamesById={employeeNamesById}
          navContext={navContext}
        />
      )}
    </div>
  )
}
