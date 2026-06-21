"use client"

import { Archive, Pencil, Trash2 } from "lucide-react"

import { useCustomersUI } from "@/components/clientes/customers-ui-provider"
import { Button } from "@/components/ui/button"
import {
  formatCustomerAddressLabel,
  formatCustomerStatusLabel,
  formatCustomerTechnologyLabel,
  isCustomerStatusActive,
} from "@/lib/customers/format"
import { CUSTOMER_CATEGORY_KPI_LABELS } from "@/lib/customers/customer-category"
import type { Customer } from "@/lib/types/customers"
import { cn } from "@/lib/utils"

type CustomersListProps = {
  customers: Customer[]
  onEdit: (customer: Customer) => void
  onArchive: (customer: Customer) => void
  onDelete: (customer: Customer) => void
}

export function CustomersList({
  customers,
  onEdit,
  onArchive,
  onDelete,
}: CustomersListProps) {
  const { selectedCategory } = useCustomersUI()

  if (customers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          No se encontraron clientes
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {selectedCategory
            ? `No hay clientes en ${CUSTOMER_CATEGORY_KPI_LABELS[selectedCategory].toLowerCase()}.`
            : "Ajustá los filtros para ver más resultados."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {customers.map((customer) => (
        <CustomerCard
          key={customer.id}
          customer={customer}
          onEdit={onEdit}
          onArchive={onArchive}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

function CustomerCard({
  customer,
  onEdit,
  onArchive,
  onDelete,
}: {
  customer: Customer
  onEdit: (customer: Customer) => void
  onArchive: (customer: Customer) => void
  onDelete: (customer: Customer) => void
}) {
  const addressLabel = formatCustomerAddressLabel(customer)
  const technologyLabel = formatCustomerTechnologyLabel(customer.technology)
  const statusLabel = formatCustomerStatusLabel(customer.status)
  const isActive = isCustomerStatusActive(customer.status)

  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/20 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">
            {customer.name}
          </h3>
          <p className="font-mono text-[11px] font-medium text-primary">
            {customer.customerNumber}
          </p>
          {customer.externalCustomerCode && (
            <p className="font-mono text-[11px] text-muted-foreground">
              {customer.externalCustomerCode}
            </p>
          )}
        </div>

        <div className="space-y-1 text-sm text-muted-foreground">
          {customer.phone && <p>📞 {customer.phone}</p>}
          {addressLabel && <p>📍 {addressLabel}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-medium",
              isActive
                ? "border-emerald-200/80 bg-emerald-50 text-emerald-800"
                : "border-slate-200/80 bg-slate-50 text-slate-700"
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                isActive ? "bg-emerald-500" : "bg-slate-400"
              )}
            />
            {statusLabel}
          </span>

          {technologyLabel && (
            <span className="inline-flex items-center rounded-md border border-blue-200/80 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800">
              🌐 {technologyLabel}
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2 self-start">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => onEdit(customer)}
        >
          <Pencil className="size-3.5" />
          Editar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => onArchive(customer)}
        >
          <Archive className="size-3.5" />
          Archivar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 text-destructive hover:text-destructive"
          onClick={() => onDelete(customer)}
        >
          <Trash2 className="size-3.5" />
          Eliminar
        </Button>
      </div>
    </article>
  )
}
