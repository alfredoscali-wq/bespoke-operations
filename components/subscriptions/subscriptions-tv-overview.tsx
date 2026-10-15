"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { MonitorPlay, Tv, UserPlus, Users } from "lucide-react"

import { ConsultationStatusBadge } from "@/components/atencion-cliente/consultation-status-badge"
import { useSubscriptions } from "@/components/subscriptions/subscriptions-provider"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"
import { formatConsultationInboxDateTime } from "@/lib/customer-atenciones/format"
import {
  isActiveConsultationStatus,
  truncateConsultationDetail,
} from "@/lib/customer-atenciones/shared-inbox"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  getSharedInboxKpiSummary,
  listSharedInboxConsultations,
} from "@/lib/supabase/customer-atenciones.browser"
import type { CustomerAtencionInboxRow } from "@/lib/types/customer-atenciones"

type SubscriptionsTvOverviewProps = {
  pendingSignupCount: number | null
  pendingSignupsLoading: boolean
  pendingSignupsOpen: boolean
  onTogglePendingSignups: () => void
  children?: ReactNode
}

function formatCount(ready: boolean, value: number | undefined): number | string {
  if (!ready) return "—"
  return (value ?? 0).toLocaleString("es-AR")
}

export function SubscriptionsTvOverview({
  pendingSignupCount,
  pendingSignupsLoading,
  pendingSignupsOpen,
  onTogglePendingSignups,
  children,
}: SubscriptionsTvOverviewProps) {
  const {
    summary,
    isSummaryReady,
    showPadronView,
    tvKind,
    jubiladoOnly,
    statusFilter,
  } = useSubscriptions()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [consultaTvCount, setConsultaTvCount] = useState<number | null>(null)
  const [consultaTvReady, setConsultaTvReady] = useState(false)
  const [consultasOpen, setConsultasOpen] = useState(false)
  const [consultas, setConsultas] = useState<CustomerAtencionInboxRow[] | null>(null)
  const [consultasLoading, setConsultasLoading] = useState(false)
  const [consultasError, setConsultasError] = useState<string | null>(null)
  const totalPlansActive =
    tvKind === "all" && !jubiladoOnly && statusFilter === "all"

  useEffect(() => {
    if (!isAuthReady) return
    if (!companyId) {
      setConsultaTvCount(null)
      setConsultaTvReady(true)
      return
    }

    let cancelled = false
    setConsultaTvReady(false)
    void getSharedInboxKpiSummary(companyId).then((result) => {
      if (cancelled) return
      setConsultaTvCount(result.error ? null : (result.data?.consulta_tv ?? 0))
      setConsultaTvReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady])

  useEffect(() => {
    if (!consultasOpen || !companyId) return

    let cancelled = false
    setConsultasLoading(true)
    setConsultasError(null)
    void listSharedInboxConsultations(companyId, {
      statusFilter: "all",
      motivo: "consulta_tv",
      channel: "all",
      operationalCategory: null,
      workTray: null,
      createdDate: null,
      search: "",
    }).then((result) => {
      if (cancelled) return
      if (result.error || !result.data) {
        setConsultas(null)
        setConsultasError("No se pudieron cargar las consultas.")
      } else {
        setConsultas(
          result.data.rows.filter((row) => isActiveConsultationStatus(row.status))
        )
      }
      setConsultasLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [companyId, consultasOpen])

  const showConsultas = consultaTvReady && (consultaTvCount ?? 0) > 0
  const showPendingSignups = !pendingSignupsLoading && (pendingSignupCount ?? 0) > 0
  const optionalKpis = Number(showConsultas) + Number(showPendingSignups)

  useEffect(() => {
    if (!showConsultas) setConsultasOpen(false)
  }, [showConsultas])

  return (
    <section>
      <KpiCardGrid
        layout="standard"
        className={
          optionalKpis === 2
            ? "xl:grid-cols-6"
            : optionalKpis === 1
              ? "xl:grid-cols-5"
              : undefined
        }
      >
        <FilterableKpiCard
          label="TV Básica"
          value={formatCount(isSummaryReady, summary?.basicaCustomers)}
          hint="N° Cliente con este plan"
          icon={Tv}
          tone="blue"
          compact
          isLoading={!isSummaryReady}
          isActive={tvKind === "basica"}
          onClick={() => showPadronView("basica")}
          ariaLabel="Ver clientes con TV Básica"
        />
        <FilterableKpiCard
          label="TV Básica + Pack Fútbol"
          value={formatCount(isSummaryReady, summary?.basicaPackCustomers)}
          hint="N° Cliente con este plan"
          icon={Tv}
          tone="green"
          compact
          isLoading={!isSummaryReady}
          isActive={tvKind === "pack"}
          onClick={() => showPadronView("pack")}
          ariaLabel="Ver clientes con TV Básica y Pack Fútbol"
        />
        <FilterableKpiCard
          label="TV Full"
          value={formatCount(isSummaryReady, summary?.fullCustomers)}
          hint="N° Cliente con este plan"
          icon={Tv}
          tone="violet"
          compact
          isLoading={!isSummaryReady}
          isActive={tvKind === "full"}
          onClick={() => showPadronView("full")}
          ariaLabel="Ver clientes con TV Full"
        />
        <FilterableKpiCard
          label="Clientes con TV"
          value={formatCount(isSummaryReady, summary?.tvPlanCustomers)}
          hint="Suma de Básica, Pack y Full"
          icon={Users}
          tone="blue"
          compact
          isLoading={!isSummaryReady}
          isActive={totalPlansActive}
          onClick={() => showPadronView("all")}
          ariaLabel="Ver clientes cargados con planes de TV"
        />
        {showConsultas ? (
          <FilterableKpiCard
            label="Consulta sobre TV"
            value={(consultaTvCount ?? 0).toLocaleString("es-AR")}
            hint="Consultas pendientes"
            icon={MonitorPlay}
            tone="violet"
            compact
            isActive={consultasOpen}
            onClick={() => setConsultasOpen((open) => !open)}
            ariaLabel="Ver consultas sobre TV pendientes"
          />
        ) : null}
        {showPendingSignups ? (
          <FilterableKpiCard
            label="Altas pendientes en TV"
            value={(pendingSignupCount ?? 0).toLocaleString("es-AR")}
            hint="Requieren revisión"
            icon={UserPlus}
            tone="amber"
            compact
            isActive={pendingSignupsOpen}
            onClick={onTogglePendingSignups}
            ariaLabel="Ver altas pendientes en TV"
          />
        ) : null}
      </KpiCardGrid>
      {consultasOpen && showConsultas ? (
        <div className="mt-3 overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Consultas sobre TV</h2>
          </div>
          {consultasLoading ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Cargando consultas…
            </p>
          ) : null}
          {consultasError ? (
            <p className="px-4 py-3 text-sm text-destructive">{consultasError}</p>
          ) : null}
          {!consultasLoading && !consultasError && consultas?.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No hay consultas pendientes sobre TV.
            </p>
          ) : null}
          {!consultasLoading && !consultasError && consultas && consultas.length > 0 ? (
            <ul className="max-h-80 divide-y overflow-y-auto">
              {consultas.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/atencion-cliente/${row.id}`}
                    className="flex flex-col gap-1 px-4 py-3 hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {row.customerName}
                    </span>
                    <ConsultationStatusBadge status={row.status} />
                    <span className="min-w-0 flex-[1.4] truncate text-sm text-muted-foreground">
                      {truncateConsultationDetail(row.detail)}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {formatConsultationInboxDateTime(row.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}
