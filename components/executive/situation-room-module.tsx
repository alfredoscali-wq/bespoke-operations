"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Radar } from "lucide-react"

import { SituationRoomView } from "@/components/executive/situation-room-view"
import { todayDateInputValue } from "@/lib/activity/employee-daily-report"
import { fetchSituationRoom } from "@/lib/executive/fetch-situation-room.client"
import { canAccessOperationsIntelligence } from "@/lib/activity/operations-intelligence"
import type { ExecutiveBrief } from "@/lib/executive"
import { getEmployeeFullName } from "@/lib/employees/utils"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { listEmployees } from "@/lib/supabase/employees.browser"
import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { moduleColorVar } from "@/lib/ui/module-colors"

export function SituationRoomModule() {
  const { sessionUser } = useAuth()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const allowed = canAccessOperationsIntelligence(sessionUser?.systemRole)
  const [date, setDate] = useState(() => todayDateInputValue())
  const [brief, setBrief] = useState<ExecutiveBrief | null>(null)
  const [employeeNamesById, setEmployeeNamesById] = useState<
    Record<string, string>
  >({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!allowed || !isAuthReady || !companyId) return
    let cancelled = false

    void (async () => {
      const result = await listEmployees(companyId)
      if (cancelled || !result.data) return
      const map: Record<string, string> = {}
      for (const employee of result.data) {
        map[employee.id] = getEmployeeFullName(employee)
      }
      setEmployeeNamesById(map)
    })()

    return () => {
      cancelled = true
    }
  }, [allowed, companyId, isAuthReady])

  useEffect(() => {
    if (!allowed) return
    let cancelled = false

    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setIsLoading(true)
      setError(null)

      const result = await fetchSituationRoom(date)
      if (cancelled) return

      if (!result.success) {
        setError(result.message)
        setBrief(null)
        setIsLoading(false)
        return
      }

      setBrief(result.data.brief)
      setIsLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [allowed, date])

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
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href={`/activity/daily-brief?date=${date}`}>
              Resumen Diario
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href={`/activity/workforce-monitor?date=${date}`}>
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
        />
      )}
    </div>
  )
}
