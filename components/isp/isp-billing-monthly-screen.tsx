"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  CalendarDays,
  CircleAlert,
  FileText,
  Plus,
} from "lucide-react"

import { IspTonedStatusBadge } from "@/components/isp/isp-status-badges"
import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import { KpiCard } from "@/components/ui/kpi-card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ISP_BILLING_MONTHLY_EMPTY_TITLE,
  ISP_BILLING_MONTHLY_PERIOD_BILLED,
  ISP_BILLING_MONTHLY_SUBTITLE,
  ISP_BILLING_MONTHLY_TITLE,
} from "@/lib/isp/billing-constants"
import { formatBillingMoney } from "@/lib/isp/billing-document-integrity"
import {
  billingRunStatusLabel,
  billingRunStatusTone,
} from "@/lib/isp/billing-run-engine"
import type { IspBillingRun } from "@/lib/isp/billing-run-types"
import {
  BILLING_MONTH_NAMES,
  billingPeriodLabel,
  billingPeriodTitle,
  currentBillingPeriod,
} from "@/lib/isp/billing-proration"
import { canWriteIspBilling } from "@/lib/isp/permissions"

export function IspBillingMonthlyScreen() {
  const router = useRouter()
  const { sessionUser } = useAuth()
  const canWrite = canWriteIspBilling(sessionUser)
  const initial = currentBillingPeriod()
  const [year, setYear] = useState(String(initial.year))
  const [month, setMonth] = useState(String(initial.month))
  const [runs, setRuns] = useState<IspBillingRun[]>([])
  const [loading, setLoading] = useState(true)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState("")

  const period = useMemo(
    () => ({ year: Number(year), month: Number(month) }),
    [year, month]
  )
  const selectedRun = runs.find(
    (run) => run.periodYear === period.year && run.periodMonth === period.month
  )

  async function loadRuns() {
    setLoading(true)
    try {
      const response = await fetch("/api/isp/billing/runs")
      const payload = (await response.json()) as {
        items?: IspBillingRun[]
        message?: string
      }
      if (!response.ok) throw new Error(payload.message)
      setRuns(payload.items ?? [])
      setError("")
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudieron cargar las corridas."
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadRuns()
  }, [])

  async function prepare() {
    if (!canWrite) return
    setPreparing(true)
    setError("")
    try {
      const response = await fetch("/api/isp/billing/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: period.year, month: period.month }),
      })
      const payload = (await response.json()) as {
        detail?: { run: IspBillingRun }
        run?: IspBillingRun
        message?: string
      }
      if (response.status === 409) {
        setError(payload.message || ISP_BILLING_MONTHLY_PERIOD_BILLED)
        await loadRuns()
        return
      }
      if (!response.ok || !payload.detail?.run) {
        throw new Error(payload.message || "No se pudo preparar la facturación.")
      }
      router.push(`/facturacion/mensual/${payload.detail.run.id}`)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo preparar la facturación."
      )
    } finally {
      setPreparing(false)
    }
  }

  const years = Array.from({ length: 6 }, (_, index) => initial.year - 2 + index)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">
            Administración → Facturación → Facturación mensual
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-800">
            {ISP_BILLING_MONTHLY_TITLE}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            {ISP_BILLING_MONTHLY_SUBTITLE}
          </p>
        </div>
        {selectedRun && selectedRun.status !== "cancelled" ? (
          <div className="flex flex-wrap gap-2">
            {canWrite && selectedRun.status !== "confirmed" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void prepare()}
                disabled={preparing}
              >
                Volver a preparar
              </Button>
            ) : null}
            <Button asChild>
              <Link href={`/facturacion/mensual/${selectedRun.id}`}>
                Revisar facturación
              </Link>
            </Button>
          </div>
        ) : (
          <Button onClick={() => void prepare()} disabled={!canWrite || preparing}>
            <Plus className="size-4" />
            {preparing ? "Preparando…" : "Preparar facturación"}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            {BILLING_MONTH_NAMES.map((label, index) => (
              <SelectItem key={label} value={String(index + 1)}>
                {label[0]?.toUpperCase()}
                {label.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28">
            <SelectValue placeholder="Año" />
          </SelectTrigger>
          <SelectContent>
            {years.map((value) => (
              <SelectItem key={value} value={String(value)}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !selectedRun ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-16 text-center">
          <CalendarDays className="mx-auto size-8 text-slate-300" />
          <p className="mt-3 text-base font-semibold text-slate-800">
            {billingPeriodTitle(period)}
          </p>
          <p className="mt-1 text-sm text-slate-500">{ISP_BILLING_MONTHLY_EMPTY_TITLE}</p>
          <Button
            className="mt-4"
            onClick={() => void prepare()}
            disabled={!canWrite || preparing}
          >
            <Plus className="size-4" />
            Preparar facturación
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            compact
            label={billingPeriodTitle(period)}
            value={billingRunStatusLabel(selectedRun.status)}
            icon={FileText}
            tone={billingRunStatusTone(selectedRun.status)}
          />
          <KpiCard
            compact
            label="Comprobantes"
            value={selectedRun.totalDocuments}
            icon={FileText}
            tone="blue"
          />
          <KpiCard
            compact
            label="Importe"
            value={formatBillingMoney(selectedRun.totalAmount)}
            icon={CalendarDays}
            tone="green"
          />
          <KpiCard
            compact
            label="Errores"
            value={selectedRun.errorsCount}
            icon={selectedRun.errorsCount ? CircleAlert : AlertTriangle}
            tone={selectedRun.errorsCount ? "red" : "gray"}
          />
          <div className="sm:col-span-2 lg:col-span-4">
            <Button asChild>
              <Link href={`/facturacion/mensual/${selectedRun.id}`}>
                Revisar facturación
              </Link>
            </Button>
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Historial de facturación
        </h2>
        {runs.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no hay corridas.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Preparación</TableHead>
                  <TableHead>Confirmación</TableHead>
                  <TableHead>Comprobantes</TableHead>
                  <TableHead>Importe</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <Link
                        href={`/facturacion/mensual/${run.id}`}
                        className="font-medium text-slate-800 hover:underline"
                      >
                        {billingPeriodLabel({
                          year: run.periodYear,
                          month: run.periodMonth,
                        })}
                      </Link>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {run.preparedAt
                        ? new Date(run.preparedAt).toLocaleString("es-AR")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {run.confirmedAt
                        ? new Date(run.confirmedAt).toLocaleString("es-AR")
                        : "—"}
                    </TableCell>
                    <TableCell>{run.totalDocuments}</TableCell>
                    <TableCell>{formatBillingMoney(run.totalAmount)}</TableCell>
                    <TableCell>
                      <IspTonedStatusBadge tone={billingRunStatusTone(run.status)}>
                        {billingRunStatusLabel(run.status)}
                      </IspTonedStatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
