"use client"

import { useMemo, useState } from "react"
import {
  Banknote,
  CalendarPlus,
  Clock3,
  UserCheck,
  Users,
} from "lucide-react"

import { useSubscriptions } from "@/components/subscriptions/subscriptions-provider"
import { formatSubscriptionMoney } from "@/lib/subscriptions/proration"
import { summarizeSubscriptions } from "@/lib/subscriptions/summary"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"

export function SubscriptionsSummaryCards() {
  const { customers, services, isReady } = useSubscriptions()
  const [now] = useState(() => new Date())
  const summary = useMemo(
    () => summarizeSubscriptions(customers, services, now),
    [customers, services, now]
  )

  return (
    <KpiCardGrid layout="treasury">
      <FilterableKpiCard
        label="Suscriptores Activos"
        value={summary.activeSubscribers}
        icon={Users}
        tone="green"
        compact
        isLoading={!isReady}
        disabled
      />
      <FilterableKpiCard
        label="Pendientes de Pago"
        value={summary.pendingPayment}
        icon={Clock3}
        tone="amber"
        compact
        isLoading={!isReady}
        disabled
      />
      <FilterableKpiCard
        label="Pendientes de Activación"
        value={summary.pendingActivation}
        icon={UserCheck}
        tone="blue"
        compact
        isLoading={!isReady}
        disabled
      />
      <FilterableKpiCard
        label="Altas del Mes"
        value={summary.signupsThisMonth}
        icon={CalendarPlus}
        compact
        isLoading={!isReady}
        disabled
      />
      <FilterableKpiCard
        label="Facturación Esperada"
        value={formatSubscriptionMoney(summary.expectedBilling)}
        icon={Banknote}
        tone="green"
        hint="Suma de abonos de activos"
        compact
        isLoading={!isReady}
        disabled
      />
    </KpiCardGrid>
  )
}
