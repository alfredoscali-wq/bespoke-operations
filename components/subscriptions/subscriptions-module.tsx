"use client"

import { useMemo, useState, useTransition } from "react"
import { Plus } from "lucide-react"

import { EmployeesProvider } from "@/components/rrhh/employees-provider"
import { PreAltaFormDialog } from "@/components/subscriptions/pre-alta-form-dialog"
import {
  SubscriptionsProvider,
  useSubscriptions,
} from "@/components/subscriptions/subscriptions-provider"
import { SubscriptionsSummaryCards } from "@/components/subscriptions/subscriptions-summary-cards"
import {
  formatSubscriptionMoney,
} from "@/lib/subscriptions/proration"
import {
  listActiveOrManagedSubscribers,
  listPreAltaCustomers,
  sortSalesNewestFirst,
} from "@/lib/subscriptions/summary"
import {
  SUBSCRIPTION_COMMISSION_STATUS_LABELS,
  SUBSCRIPTION_CUSTOMER_STATUS_LABELS,
  SUBSCRIPTION_CUSTOMER_STATUSES,
  SUBSCRIPTION_CUSTOMER_TRANSITIONS,
  SUBSCRIPTION_SALE_STATUS_LABELS,
  type SubscriptionCustomerStatus,
} from "@/lib/subscriptions/statuses"
import type { SubscriptionCustomer } from "@/lib/types/subscriptions"
import { STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const CUSTOMER_STATUS_STYLES: Record<SubscriptionCustomerStatus, string> = {
  pending_payment: STATUS_TONE_STYLES.amber,
  paid: STATUS_TONE_STYLES.blue,
  active: STATUS_TONE_STYLES.green,
  suspended: STATUS_TONE_STYLES.yellow,
  cancelled: STATUS_TONE_STYLES.red,
}

const TRANSITION_ACTION_LABELS: Partial<
  Record<SubscriptionCustomerStatus, string>
> = {
  paid: "Marcar Pagado",
  active: "Activar",
  suspended: "Suspender",
  cancelled: "Dar de Baja",
}

function customerFullName(customer: SubscriptionCustomer): string {
  return [customer.lastName, customer.firstName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ")
}

function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "—"
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  return `${match[3]}/${match[2]}/${match[1]}`
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-14 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}

function CustomerStatusBadge({
  status,
}: {
  status: SubscriptionCustomerStatus
}) {
  return (
    <StatusBadge className={cn(CUSTOMER_STATUS_STYLES[status])}>
      {SUBSCRIPTION_CUSTOMER_STATUS_LABELS[status]}
    </StatusBadge>
  )
}

function CustomerActions({ customer }: { customer: SubscriptionCustomer }) {
  const { canWrite, transitionCustomer } = useSubscriptions()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const nextStatuses = SUBSCRIPTION_CUSTOMER_TRANSITIONS[customer.status] ?? []

  if (!canWrite || nextStatuses.length === 0) {
    return null
  }

  function runTransition(next: SubscriptionCustomerStatus) {
    setError(null)
    startTransition(async () => {
      const result = await transitionCustomer(customer.id, next)
      if (!result.success) {
        setError(result.message ?? "No se pudo actualizar.")
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-1.5">
        {nextStatuses.map((next) => {
          const isCancel = next === SUBSCRIPTION_CUSTOMER_STATUSES.CANCELLED
          const isReactivate =
            customer.status === SUBSCRIPTION_CUSTOMER_STATUSES.SUSPENDED &&
            next === SUBSCRIPTION_CUSTOMER_STATUSES.ACTIVE
          const label = isReactivate
            ? "Reactivar"
            : (TRANSITION_ACTION_LABELS[next] ?? next)

          return (
            <Button
              key={next}
              type="button"
              size="sm"
              variant={isCancel ? "outline" : "secondary"}
              disabled={pending}
              onClick={() => runTransition(next)}
            >
              {label}
            </Button>
          )
        })}
      </div>
      {error ? (
        <p className="max-w-[14rem] text-right text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function CustomersTable({
  customers,
  emptyTitle,
  emptyDescription,
  showActions,
}: {
  customers: SubscriptionCustomer[]
  emptyTitle: string
  emptyDescription: string
  showActions: boolean
}) {
  if (customers.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Cliente</TableHead>
              <TableHead>DNI</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Servicio</TableHead>
              <TableHead>Fecha alta</TableHead>
              <TableHead>Estado</TableHead>
              {showActions ? <TableHead className="text-right">Acciones</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-medium">
                  {customerFullName(customer)}
                </TableCell>
                <TableCell>{customer.dni || "—"}</TableCell>
                <TableCell>{customer.phone || "—"}</TableCell>
                <TableCell>{customer.city || "—"}</TableCell>
                <TableCell>{customer.serviceName ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDateOnly(customer.activationDate)}
                </TableCell>
                <TableCell>
                  <CustomerStatusBadge status={customer.status} />
                </TableCell>
                {showActions ? (
                  <TableCell className="text-right">
                    <CustomerActions customer={customer} />
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function SalesTab() {
  const { sales, isReady } = useSubscriptions()
  const rows = useMemo(() => sortSalesNewestFirst(sales), [sales])

  if (!isReady) {
    return <p className="text-sm text-muted-foreground">Cargando ventas…</p>
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Sin ventas"
        description="Las pre-altas generan una venta con el cobro proporcional inicial."
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Servicio</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Abono</TableHead>
              <TableHead>Cobro inicial</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((sale) => (
              <TableRow key={sale.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDateOnly(sale.saleDate)}
                </TableCell>
                <TableCell className="font-medium">
                  {sale.customerName || "—"}
                </TableCell>
                <TableCell>{sale.serviceName ?? "—"}</TableCell>
                <TableCell>{sale.sellerName || "—"}</TableCell>
                <TableCell className="tabular-nums">
                  {formatSubscriptionMoney(sale.monthlyPrice)}
                </TableCell>
                <TableCell className="tabular-nums">
                  {formatSubscriptionMoney(sale.firstInvoiceAmount)}
                </TableCell>
                <TableCell>
                  {SUBSCRIPTION_SALE_STATUS_LABELS[sale.status]}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function CommissionsTab() {
  const { commissions, canWrite, markCommissionPaid, isReady } =
    useSubscriptions()
  const [pendingId, setPendingId] = useState<string | null>(null)

  if (!isReady) {
    return (
      <p className="text-sm text-muted-foreground">Cargando comisiones…</p>
    )
  }

  if (commissions.length === 0) {
    return (
      <EmptyState
        title="Sin comisiones"
        description="Podés asignar comisión al crear una pre-alta con vendedor."
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Fecha</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Monto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {commissions.map((commission) => (
              <TableRow key={commission.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDateOnly(commission.createdAt.slice(0, 10))}
                </TableCell>
                <TableCell className="font-medium">
                  {commission.employeeName || "—"}
                </TableCell>
                <TableCell>{commission.customerName || "—"}</TableCell>
                <TableCell className="tabular-nums">
                  {formatSubscriptionMoney(commission.commissionAmount)}
                </TableCell>
                <TableCell>
                  {SUBSCRIPTION_COMMISSION_STATUS_LABELS[commission.status]}
                </TableCell>
                <TableCell className="text-right">
                  {canWrite && commission.status === "pending" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={pendingId === commission.id}
                      onClick={async () => {
                        setPendingId(commission.id)
                        await markCommissionPaid(commission.id)
                        setPendingId(null)
                      }}
                    >
                      Marcar pagada
                    </Button>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function SubscriptionsModuleContent() {
  const { customers, canWrite, isReady } = useSubscriptions()
  const [preAltaOpen, setPreAltaOpen] = useState(false)

  const preAltas = useMemo(() => listPreAltaCustomers(customers), [customers])
  const subscribers = useMemo(
    () => listActiveOrManagedSubscribers(customers),
    [customers]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            TV & Suscripciones
          </h1>
          <p className="text-sm text-muted-foreground">
            Administración de servicios recurrentes. Primer servicio: Bespoke
            TV.
          </p>
        </div>
        <Button
          type="button"
          className="gap-2"
          disabled={!canWrite}
          onClick={() => setPreAltaOpen(true)}
        >
          <Plus className="size-4" />
          Nueva Pre-Alta
        </Button>
      </div>

      {!canWrite ? (
        <p className="text-xs text-muted-foreground">
          Solo lectura. La edición está disponible para Administración.
        </p>
      ) : null}

      <Tabs defaultValue="dashboard">
        <TabsList variant="line" className="w-full min-w-max justify-start">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="pre-altas">Pre-Altas</TabsTrigger>
          <TabsTrigger value="suscriptores">Suscriptores</TabsTrigger>
          <TabsTrigger value="ventas">Ventas</TabsTrigger>
          <TabsTrigger value="comisiones">Comisiones</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4 space-y-4">
          <SubscriptionsSummaryCards />
          {!isReady ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Workflow: Pendiente de Pago → Pagado → Activado → Suspendido /
              Baja.
            </p>
          )}
        </TabsContent>

        <TabsContent value="pre-altas" className="mt-4">
          <CustomersTable
            customers={preAltas}
            emptyTitle="Sin pre-altas"
            emptyDescription="Creá una pre-alta para iniciar el flujo de alta de Bespoke TV."
            showActions
          />
        </TabsContent>

        <TabsContent value="suscriptores" className="mt-4">
          <CustomersTable
            customers={subscribers}
            emptyTitle="Sin suscriptores"
            emptyDescription="Los clientes activados, suspendidos o dados de baja aparecen aquí."
            showActions
          />
        </TabsContent>

        <TabsContent value="ventas" className="mt-4">
          <SalesTab />
        </TabsContent>

        <TabsContent value="comisiones" className="mt-4">
          <CommissionsTab />
        </TabsContent>
      </Tabs>

      {preAltaOpen ? (
        <PreAltaFormDialog open onOpenChange={setPreAltaOpen} />
      ) : null}
    </div>
  )
}

export function SubscriptionsModule() {
  return (
    <EmployeesProvider>
      <SubscriptionsProvider>
        <SubscriptionsModuleContent />
      </SubscriptionsProvider>
    </EmployeesProvider>
  )
}
