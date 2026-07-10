"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  ClipboardList,
  Headset,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import { formatEquipoReportPeriodLabel } from "@/lib/atencion-cliente-equipo/period"
import type { EquipoReportPeriod } from "@/lib/atencion-cliente-equipo/period"
import type { EquipoIndividualReport } from "@/lib/atencion-cliente-equipo/report"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { loadEquipoIndividualReport } from "@/lib/supabase/atencion-cliente-equipo.browser"
import { KpiCard } from "@/components/ui/kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

const PERIOD_OPTIONS: EquipoReportPeriod[] = ["hoy", "semana", "mes"]

const KPI_CONFIG = [
  { key: "atenciones", label: "Atenciones", icon: Headset, tone: "blue" as const },
  { key: "resueltas", label: "Resueltas", icon: CheckCircle2, tone: "green" as const },
  {
    key: "seguimientosCompletados",
    label: "Seguimientos completados",
    icon: ClipboardList,
    tone: "blue" as const,
  },
  {
    key: "seguimientosPendientes",
    label: "Seguimientos pendientes",
    icon: ClipboardList,
    tone: "amber" as const,
    hint: "Carga pendiente actual del empleado.",
  },
  {
    key: "retencionesGestionadas",
    label: "Retenciones gestionadas",
    icon: ShieldCheck,
    tone: "violet" as const,
  },
  {
    key: "clientesRetenidos",
    label: "Clientes retenidos",
    icon: UserCheck,
    tone: "green" as const,
  },
  {
    key: "bajasProcedidas",
    label: "Bajas procedidas",
    icon: UserX,
    tone: "neutral" as const,
  },
  {
    key: "recuperosGestionados",
    label: "Recuperos gestionados",
    icon: UserPlus,
    tone: "orange" as const,
  },
  {
    key: "clientesRecuperados",
    label: "Clientes recuperados",
    icon: UserCheck,
    tone: "green" as const,
  },
] as const

function PeriodToggle({
  period,
  onPeriodChange,
}: {
  period: EquipoReportPeriod
  onPeriodChange: (period: EquipoReportPeriod) => void
}) {
  return (
    <div className="inline-flex rounded-lg border p-1">
      {PERIOD_OPTIONS.map((option) => (
        <Button
          key={option}
          type="button"
          size="sm"
          variant={period === option ? "default" : "ghost"}
          onClick={() => onPeriodChange(option)}
        >
          {formatEquipoReportPeriodLabel(option)}
        </Button>
      ))}
    </div>
  )
}

function toneForEntry(tone: "green" | "blue" | "neutral"): keyof typeof STATUS_TONE_STYLES {
  if (tone === "green") {
    return "green"
  }

  if (tone === "blue") {
    return "blue"
  }

  return "neutral"
}

export function EquipoSection() {
  const { sessionUser } = useAuth()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const { listAssignees } = useAtencionCliente()
  const [assignees, setAssignees] = useState<
    Array<{ id: string; displayName: string }>
  >([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("")
  const [period, setPeriod] = useState<EquipoReportPeriod>("hoy")
  const [report, setReport] = useState<EquipoIndividualReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingAssignees, setIsLoadingAssignees] = useState(true)
  const [isLoadingReport, setIsLoadingReport] = useState(false)

  useEffect(() => {
    if (!isAuthReady || !companyId) {
      return
    }

    let cancelled = false

    async function loadAssignees() {
      setIsLoadingAssignees(true)
      const result = await listAssignees()

      if (cancelled) {
        return
      }

      const options = result ?? []
      setAssignees(options)
      setSelectedEmployeeId((current) => current || options[0]?.id || "")
      setIsLoadingAssignees(false)
    }

    void loadAssignees()

    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady, listAssignees])

  useEffect(() => {
    if (!isAuthReady || !companyId || !selectedEmployeeId) {
      setReport(null)
      return
    }

    let cancelled = false

    async function loadReport() {
      setIsLoadingReport(true)
      setError(null)

      const result = await loadEquipoIndividualReport({
        companyId,
        employeeId: selectedEmployeeId,
        period,
        roleCode: sessionUser?.roleCode,
      })

      if (cancelled) {
        return
      }

      if (result.error || !result.data) {
        setReport(null)
        setError(result.error?.message ?? "No se pudo cargar el reporte.")
        setIsLoadingReport(false)
        return
      }

      setReport(result.data)
      setIsLoadingReport(false)
    }

    void loadReport()

    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady, period, selectedEmployeeId, sessionUser?.roleCode])

  const selectedEmployeeName = useMemo(() => {
    return (
      assignees.find((assignee) => assignee.id === selectedEmployeeId)?.displayName ??
      report?.employeeName ??
      "Empleado"
    )
  }, [assignees, report?.employeeName, selectedEmployeeId])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Equipo</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Reporte individual de actividad por empleado.
            </p>
          </div>
          <PeriodToggle period={period} onPeriodChange={setPeriod} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md space-y-2">
            <p className="text-sm font-medium">Empleado</p>
            <Select
              value={selectedEmployeeId}
              onValueChange={setSelectedEmployeeId}
              disabled={isLoadingAssignees || assignees.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    isLoadingAssignees
                      ? "Cargando empleados…"
                      : "Seleccionar empleado"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {assignees.map((assignee) => (
                  <SelectItem key={assignee.id} value={assignee.id}>
                    {assignee.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {selectedEmployeeId ? (
            <p className="text-sm text-muted-foreground">
              {selectedEmployeeName} · {formatEquipoReportPeriodLabel(period)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <KpiCardGrid layout="standard">
        {KPI_CONFIG.map((kpi) => (
          <KpiCard
            key={kpi.key}
            label={kpi.label}
            value={
              isLoadingReport || !report
                ? "…"
                : report.kpis[kpi.key]
            }
            icon={kpi.icon}
            tone={kpi.tone}
            hint={"hint" in kpi ? kpi.hint : undefined}
          />
        ))}
      </KpiCardGrid>

      <Card>
        <CardHeader>
          <CardTitle>Actividad del período</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoadingReport ? (
            <p className="text-sm text-muted-foreground">Cargando actividad…</p>
          ) : !report || report.activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay actividad registrada en este período.
            </p>
          ) : (
            report.activity.map((entry) => {
              const content = (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      {new Date(entry.occurredAt).toLocaleDateString("es-AR")}{" "}
                      {new Date(entry.occurredAt).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <Badge
                      variant="outline"
                      className={STATUS_TONE_STYLES[toneForEntry(entry.tone)]}
                    >
                      {entry.title}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm font-medium">{entry.subtitle}</p>
                  <p className="text-sm text-muted-foreground">{entry.detail}</p>
                </>
              )

              if (entry.kind === "atencion") {
                return (
                  <Link
                    key={`${entry.kind}-${entry.id}`}
                    href={`/atencion-cliente/${entry.id}`}
                    className="block rounded-lg border px-3 py-3 transition-colors hover:bg-muted/50"
                  >
                    {content}
                  </Link>
                )
              }

              return (
                <div
                  key={`${entry.kind}-${entry.id}`}
                  className={cn("rounded-lg border px-3 py-3")}
                >
                  {content}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
