"use client"

import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Pencil } from "lucide-react"
import { useEffect, useState } from "react"

import { CustomerFormDialog } from "@/components/clientes/customer-form-dialog"
import { useCustomers } from "@/components/clientes/customers-provider"
import {
  formatCustomerTechnologyLabel,
} from "@/lib/customers/format"
import {
  formatValidationStatusLabel,
  validationStatusBadgeClassName,
  validationStatusDotClassName,
} from "@/lib/customers/customer-validation"
import { getWorkOrderServiceTypeLabel } from "@/lib/tasks/work-order"
import { TASK_STATUS_LABELS, formatTaskDate } from "@/lib/tasks/constants"
import { formatScheduledTimeDisplay } from "@/lib/tasks/scheduling"
import { createClient } from "@/lib/supabase/client"
import { fetchWorkOrdersByCustomerId } from "@/lib/supabase/tasks.queries"
import type { Customer } from "@/lib/types/customers"
import type { Task } from "@/lib/types/tasks"
import { WhatsAppLink } from "@/components/ui/whatsapp-link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type CustomerDetailScreenProps = {
  customerId: string
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}

export function CustomerDetailScreen({ customerId }: CustomerDetailScreenProps) {
  const { fetchCustomerById } = useCustomers()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [workOrders, setWorkOrders] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadCustomerDetail() {
      setIsLoading(true)

      try {
        const [loadedCustomer, workOrdersResult] = await Promise.all([
          fetchCustomerById(customerId),
          fetchWorkOrdersByCustomerId(createClient(), customerId),
        ])

        if (cancelled) return

        setCustomer(loadedCustomer)
        setWorkOrders(workOrdersResult.data ?? [])
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadCustomerDetail()

    return () => {
      cancelled = true
    }
  }, [customerId, fetchCustomerById])

  if (isLoading) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center text-sm text-muted-foreground">
        Cargando cliente...
      </div>
    )
  }

  if (!customer) {
    notFound()
  }

  const technologyLabel = formatCustomerTechnologyLabel(customer.technology) ?? "—"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="-ml-2 h-9 gap-2 text-muted-foreground"
          >
            <Link href="/clientes">
              <ArrowLeft className="size-4" />
              Volver a clientes
            </Link>
          </Button>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {customer.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ficha operativa del cliente
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 self-start"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="size-4" />
          Editar Cliente
        </Button>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-base">Datos operativos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <DetailField label="Nombre" value={customer.name} />
          <DetailField
            label="N° Cliente"
            value={customer.externalCustomerCode?.trim() || "—"}
          />
          <DetailField label="DNI" value={customer.dni?.trim() || "—"} />
          <DetailField
            label="Teléfono"
            value={
              customer.phone ? <WhatsAppLink phone={customer.phone} /> : "—"
            }
          />
          <DetailField label="Mail" value={customer.email?.trim() || "—"} />
          <DetailField label="Dirección" value={customer.address?.trim() || "—"} />
          <DetailField label="Localidad" value={customer.locality?.trim() || "—"} />
          <DetailField label="Tecnología" value={technologyLabel} />
          <DetailField
            label="Validación"
            value={
              <span className={validationStatusBadgeClassName(customer.validationStatus)}>
                <span className={validationStatusDotClassName(customer.validationStatus)} />
                {formatValidationStatusLabel(customer.validationStatus)}
              </span>
            }
          />
          {customer.legacyClientState ? (
            <DetailField
              label="Estado comercial legacy"
              value={customer.legacyClientState}
            />
          ) : null}
          {customer.validatedAt ? (
            <DetailField
              label="Validado"
              value={`${customer.validatedBy ?? "—"} · ${new Date(customer.validatedAt).toLocaleString("es-AR")}`}
            />
          ) : null}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-base">
            Historial de Órdenes de Trabajo
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {workOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este cliente aún no tiene órdenes de trabajo registradas.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>OT</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workOrders.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>
                        <Link
                          href={`/tareas/${task.id}`}
                          className="font-mono text-xs font-medium text-primary hover:underline"
                        >
                          {task.code}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {getWorkOrderServiceTypeLabel(task.serviceType) ??
                          task.title}
                      </TableCell>
                      <TableCell>{formatTaskDate(task.dueDate)}</TableCell>
                      <TableCell>
                        {formatScheduledTimeDisplay(task.scheduledTime) ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {TASK_STATUS_LABELS[task.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CustomerFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        customer={customer}
        onSuccess={() => {
          setEditOpen(false)
          void fetchCustomerById(customerId).then((nextCustomer) => {
            if (nextCustomer) {
              setCustomer(nextCustomer)
            }
          })
        }}
      />
    </div>
  )
}
