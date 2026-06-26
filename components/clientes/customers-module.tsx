"use client"

import { useMemo, useState } from "react"
import { FileSpreadsheet, Plus } from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { CustomerArchiveDialog } from "@/components/clientes/customer-archive-dialog"
import { CustomerDeleteDialog } from "@/components/clientes/customer-delete-dialog"
import { CustomerFormDialog } from "@/components/clientes/customer-form-dialog"
import { CustomerImportDialog } from "@/components/clientes/customer-import-dialog"
import { CustomersBulkActionsBar } from "@/components/clientes/customers-bulk-actions-bar"
import { useCustomers } from "@/components/clientes/customers-provider"
import {
  CustomersFilters,
  defaultCustomerFilters,
} from "@/components/clientes/customers-filters"
import { CustomersList } from "@/components/clientes/customers-list"
import { CustomersSummary } from "@/components/clientes/customers-summary"
import { CustomersUIProvider } from "@/components/clientes/customers-ui-provider"
import { resolveAuthDisplay } from "@/lib/auth/auth-display"
import { filterCustomers } from "@/lib/customers/customer-filters"
import type { CustomerQuickFilter } from "@/lib/customers/customer-operational"
import type { Customer } from "@/lib/types/customers"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"

export function CustomersModule() {
  return (
    <CustomersUIProvider>
      <CustomersModuleContent />
    </CustomersUIProvider>
  )
}

function CustomersModuleContent() {
  const { isCustomersReady, customers, markCustomersAsActive } = useCustomers()
  const { sessionUser } = useAuth()
  const [filters, setFilters] = useState(defaultCustomerFilters)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Customer | Customer[] | null>(
    null
  )
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const displayedCustomers = useMemo(
    () => filterCustomers(customers, filters),
    [customers, filters]
  )

  const selectedCustomers = useMemo(
    () => customers.filter((customer) => selectedIds.has(customer.id)),
    [customers, selectedIds]
  )

  function handleQuickFilterChange(quickFilter: CustomerQuickFilter) {
    setFilters((current) => ({ ...current, quickFilter }))
  }

  function handleMutationSuccess(message: string) {
    setFeedback(message)
  }

  function openCreateDialog() {
    setEditingCustomer(null)
    setFormOpen(true)
  }

  function openEditDialog(customer: Customer) {
    setEditingCustomer(customer)
    setFormOpen(true)
  }

  function openArchiveDialog(customer: Customer | Customer[]) {
    setArchiveTarget(customer)
  }

  function openDeleteDialog(customer: Customer) {
    setDeleteTarget(customer)
  }

  async function handleMarkActive(customer: Customer) {
    const result = await markCustomersAsActive({
      customerIds: [customer.id],
      validatedBy: resolveAuthDisplay(sessionUser).displayName,
    })

    if (!result.success) {
      setFeedback(result.message ?? "No se pudo marcar el cliente como activo.")
      return
    }

    setFeedback("Cliente marcado como activo.")
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Base operativa de clientes para crear y administrar órdenes de trabajo.
          El estado de validación es informativo y no bloquea la operación.
        </p>
        <div className="flex flex-wrap gap-2 self-start">
          <Button size="sm" className="gap-1.5" onClick={openCreateDialog}>
            <Plus className="size-4" />
            Nuevo Cliente
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setImportOpen(true)}
          >
            <FileSpreadsheet className="size-4" />
            Importar Excel
          </Button>
        </div>
      </div>

      <EntityActionFeedback message={feedback} />

      <CustomersSummary
        quickFilter={filters.quickFilter}
        onQuickFilterChange={handleQuickFilterChange}
      />

      <Card className="shadow-sm">
        <CardHeader className="gap-4 border-b">
          <CardTitle className="text-base">Clientes operativos</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <CustomersFilters
            filters={filters}
            onChange={setFilters}
            resultCount={displayedCustomers.length}
          />

          <CustomersBulkActionsBar
            selectedCustomers={selectedCustomers}
            onClearSelection={() => setSelectedIds(new Set())}
            onArchive={openArchiveDialog}
            onFeedback={setFeedback}
          />

          {!isCustomersReady ? (
            <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
              Cargando clientes...
            </div>
          ) : (
            <CustomersList
              customers={displayedCustomers}
              quickFilter={filters.quickFilter}
              selectedIds={selectedIds}
              onSelectedIdsChange={setSelectedIds}
              onEdit={openEditDialog}
              onArchive={openArchiveDialog}
              onDelete={openDeleteDialog}
              onMarkActive={(customer) => void handleMarkActive(customer)}
            />
          )}
        </CardContent>
      </Card>

      <CustomerFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setEditingCustomer(null)
          }
        }}
        customer={editingCustomer}
        onSuccess={handleMutationSuccess}
      />

      <CustomerArchiveDialog
        customer={Array.isArray(archiveTarget) ? archiveTarget[0] : archiveTarget}
        customers={Array.isArray(archiveTarget) ? archiveTarget : undefined}
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setArchiveTarget(null)
            setSelectedIds(new Set())
          }
        }}
        onSuccess={handleMutationSuccess}
      />

      <CustomerDeleteDialog
        customer={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
        onSuccess={handleMutationSuccess}
      />

      <CustomerImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleMutationSuccess}
      />
    </div>
  )
}
