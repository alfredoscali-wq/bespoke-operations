"use client"

import { useMemo, useState } from "react"
import { Archive, CheckCircle2, Download, Trash2, UserX } from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { useCustomers } from "@/components/clientes/customers-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { resolveAuthDisplay } from "@/lib/auth/auth-display"
import { canDeleteCustomer } from "@/lib/customers/customer-delete"
import { CUSTOMER_EXCLUDE_BLOCKED_MESSAGE } from "@/lib/customers/customer-activity"
import type { Customer } from "@/lib/types/customers"
import { Button } from "@/components/ui/button"

type CustomersBulkActionsBarProps = {
  selectedCustomers: Customer[]
  onClearSelection: () => void
  onArchive: (customers: Customer[]) => void
  onFeedback: (message: string) => void
}

function exportCustomersCsv(customers: Customer[]) {
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
  const { tasks } = useTasks()
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
    const blocked = selectedCustomers.filter((customer) => {
      const check = canDeleteCustomer(customer.id, tasks)
      return !check.allowed
    })

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
          onFeedback(result.message ?? "No se pudieron excluir los clientes.")
          return
        }
        excluded++
      }

      onFeedback(`${excluded} cliente(s) excluido(s) de la migración.`)
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
        onFeedback(result.message ?? "No se pudieron marcar los clientes.")
        return
      }

      onFeedback(
        `${selectedCustomers.length} cliente(s) marcado(s) como activos.`
      )
      onClearSelection()
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium">
        {selectedCustomers.length} seleccionado(s)
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="gap-1.5"
          disabled={isPending}
          onClick={() => void handleMarkActive()}
        >
          <CheckCircle2 className="size-4" />
          Marcar activos
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => onArchive(selectedCustomers)}
        >
          <Archive className="size-4" />
          Archivar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => void handleExclude()}
        >
          <UserX className="size-4" />
          Excluir de la migración
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => exportCustomersCsv(selectedCustomers)}
        >
          <Download className="size-4" />
          Exportar
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClearSelection}
        >
          <Trash2 className="size-4" />
          Limpiar
        </Button>
      </div>
    </div>
  )
}
