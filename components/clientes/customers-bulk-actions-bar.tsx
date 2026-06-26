"use client"

import { useMemo, useState } from "react"
import { Archive, CheckCircle2, Download, Trash2, UserX } from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { useCustomers } from "@/components/clientes/customers-provider"
import { checkCustomerCanDelete } from "@/lib/supabase/customers.browser"
import { resolveAuthDisplay } from "@/lib/auth/auth-display"
import { CUSTOMER_EXCLUDE_BLOCKED_MESSAGE } from "@/lib/customers/customer-activity"
import type { CustomerListRow } from "@/lib/types/customers"
import { Button } from "@/components/ui/button"

type CustomersBulkActionsBarProps = {
  selectedCustomers: CustomerListRow[]
  onClearSelection: () => void
  onArchive: (customers: CustomerListRow[]) => void
  onFeedback: (message: string) => void
}

function exportCustomersCsv(customers: CustomerListRow[]) {
  const headers = [
    "N° Cliente",
    "Nombre",
    "DNI",
    "Teléfono",
    "Email",
    "Dirección",
    "Localidad",
    "Tecnología",
    "Validación",
  ]

  const rows = customers.map((customer) => [
    customer.externalCustomerCode ?? "",
    customer.name,
    customer.dni ?? "",
    customer.phone ?? "",
    customer.email ?? "",
    customer.address ?? "",
    customer.locality ?? "",
    customer.technology ?? "",
    customer.validationStatus,
  ])

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function CustomersBulkActionsBar({
  selectedCustomers,
  onClearSelection,
  onArchive,
  onFeedback,
}: CustomersBulkActionsBarProps) {
  const { markCustomersAsActive, deleteCustomer } = useCustomers()
  const { sessionUser } = useAuth()
  const [isPending, setIsPending] = useState(false)

  const validatedBy = useMemo(
    () => resolveAuthDisplay(sessionUser).displayName,
    [sessionUser]
  )

  if (selectedCustomers.length === 0) {
    return null
  }

  async function handleExclude() {
    const checks = await Promise.all(
      selectedCustomers.map(async (customer) => ({
        customer,
        check: await checkCustomerCanDelete(customer.id),
      }))
    )

    const blocked = checks.filter(({ check }) => !check.allowed)

    if (blocked.length > 0) {
      onFeedback(
        `${blocked.length} cliente(s) no pueden excluirse: ${CUSTOMER_EXCLUDE_BLOCKED_MESSAGE}`
      )
      return
    }

    setIsPending(true)
    try {
      let excluded = 0
      for (const customer of selectedCustomers) {
        const result = await deleteCustomer(customer.id)
        if (!result.success) {
          onFeedback(result.message ?? "No se pudo excluir al cliente.")
          return
        }
        excluded += 1
      }

      onFeedback(`${excluded} cliente(s) excluido(s).`)
      onClearSelection()
    } finally {
      setIsPending(false)
    }
  }

  async function handleMarkActive() {
    setIsPending(true)
    try {
      const result = await markCustomersAsActive({
        customerIds: selectedCustomers.map((customer) => customer.id),
        validatedBy,
      })

      if (!result.success) {
        onFeedback(result.message ?? "No se pudo marcar como activo.")
        return
      }

      onFeedback(`${selectedCustomers.length} cliente(s) marcado(s) como activo.`)
      onClearSelection()
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/20 px-3 py-2">
      <span className="text-sm font-medium text-foreground">
        {selectedCustomers.length} seleccionado(s)
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={isPending}
        onClick={() => onArchive(selectedCustomers)}
      >
        <Archive className="size-4" />
        Archivar
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={isPending}
        onClick={() => void handleMarkActive()}
      >
        <CheckCircle2 className="size-4" />
        Marcar activo
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5"
        disabled={isPending}
        onClick={() => exportCustomersCsv(selectedCustomers)}
      >
        <Download className="size-4" />
        Exportar CSV
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="gap-1.5 text-destructive hover:text-destructive"
        disabled={isPending}
        onClick={() => void handleExclude()}
      >
        <Trash2 className="size-4" />
        Excluir
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="gap-1.5"
        disabled={isPending}
        onClick={onClearSelection}
      >
        <UserX className="size-4" />
        Limpiar
      </Button>
    </div>
  )
}
