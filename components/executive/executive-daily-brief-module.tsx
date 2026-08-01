"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { FileText, Loader2 } from "lucide-react"

import { ExecutiveDailyBriefView } from "@/components/executive/executive-daily-brief-view"
import { todayDateInputValue } from "@/lib/activity/employee-daily-report"
import { canAccessOperationsIntelligence } from "@/lib/activity/operations-intelligence"
import { useSituationRoomQuery } from "@/lib/analysis/react-query"
import {
  buildExecutiveDailyBrief,
  type ExecutiveDailyBrief,
} from "@/lib/executive/build-daily-brief"
import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ExecutiveDailyBriefModule() {
  const { sessionUser } = useAuth()
  const searchParams = useSearchParams()
  const dateFromUrl = searchParams.get("date")?.trim() || ""
  const allowed = canAccessOperationsIntelligence(sessionUser?.systemRole)
  const [dateDraft, setDateDraft] = useState("")
  const date = dateDraft || dateFromUrl || todayDateInputValue()

  const situationQuery = useSituationRoomQuery(date, allowed)

  const daily = useMemo((): ExecutiveDailyBrief | null => {
    if (!situationQuery.data?.brief) return null
    return buildExecutiveDailyBrief({
      brief: situationQuery.data.brief,
      generatedAt: new Date().toISOString(),
    })
  }, [situationQuery.data?.brief])

  const isLoading = situationQuery.isPending
  const error = situationQuery.error
    ? situationQuery.error instanceof Error
      ? situationQuery.error.message
      : "No se pudo cargar el resumen."
    : null

  const timelineHref = useMemo(
    () => `/activity/timeline?dateFrom=${date}&dateTo=${date}`,
    [date]
  )

  if (!allowed) {
    return (
      <div className="rounded-xl border bg-card px-6 py-10 text-center shadow-sm">
        <FileText className="mx-auto size-8 text-muted-foreground" />
        <h2 className="mt-3 text-base font-semibold">
          Resumen Ejecutivo Diario
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Solo administración, supervisión y gerencia pueden acceder.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Resumen Ejecutivo Diario
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Lectura de menos de cinco minutos para gerentes y directores.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="daily-brief-date">Fecha</Label>
            <Input
              id="daily-brief-date"
              type="date"
              className="h-9 w-[11.5rem] bg-background"
              value={date}
              onChange={(event) => setDateDraft(event.target.value)}
            />
          </div>
          <Button asChild variant="outline" size="sm" className="h-9">
            <Link href="/activity">Sala de Situación</Link>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isLoading && !daily ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando resumen…
        </div>
      ) : (
        <ExecutiveDailyBriefView
          daily={daily}
          isLoading={isLoading}
          timelineHref={timelineHref}
        />
      )}
    </div>
  )
}
