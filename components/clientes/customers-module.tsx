"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ChevronLeft, ChevronRight, FileSpreadsheet, Plus } from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { PermanentDeleteDialog } from "@/components/admin/permanent-delete-dialog"
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
import { TableRowsSkeleton } from "@/components/ui/kpi-grid-skeleton"
import { resolveAuthDisplay } from "@/lib/auth/auth-display"
import { parseCustomerQuickFilterQuery } from "@/lib/navigation/query-filters"
import { DEFAULT_CUSTOMER_PAGE_SIZE } from "@/lib/customers/customer-list"
import type { CustomerQuickFilter } from "@/lib/customers/customer-operational"
import type { Customer, CustomerListRow } from "@/lib/types/customers"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import { useIsSystemAdministrator } from "@/lib/auth/use-is-system-administrator"

const SEARCH_DEBOUNCE_MS = 300

export function CustomersModule() {
  return <CustomersModuleContent />
}

function CustomersModuleContent() {
  const searchParams = useSearchParams()
  const {
    isCustomersReady,
    isListLoading,
    listPage,
    listQuery,
    loadCustomerPage,
    fetchCustomerById,
    markCustomersAsActive,
    activateCustomer,
    removeCustomerLocally,
  } = useCustomers()
  const { sessionUser } = useAuth()
  const isSystemAdministrator = useIsSystemAdministrator()
  const [filters, setFilters] = useState(defaultCustomerFilters)
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<
    CustomerListRow | CustomerListRow[] | null
  >(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomerListRow | null>(null)
  const [permanentDeleteTarget, setPermanentDeleteTarget] =
    useState<CustomerListRow | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    const quickFilter = parseCustomerQuickFilterQuery(searchParams.get("filter"))
    setFilters((current) =>
      current.quickFilter === quickFilter
        ? current
        : { ...current, quickFilter }
    )
  }, [searchParams])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(filters.search.trim())
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [filters.search])

  useEffect(() => {
    void loadCustomerPage({
      page: 1,
      pageSize: DEFAULT_CUSTOMER_PAGE_SIZE,
      search: debouncedSearch,
      quickFilter: filters.quickFilter,
      locality: filters.locality,
      statusFilter: filters.statusFilter,
      sort: filters.sort,
    })
    setSelectedIds(new Set())
  }, [
    debouncedSearch,
    filters.quickFilter,
    filters.locality,
    filters.statusFilter,
    filters.sort,
    loadCustomerPage,
  ])

  const displayedCustomers = listPage?.items ?? []
  const totalResults = listPage?.total ?? 0
  const currentPage = listPage?.page ?? 1
  const pageSize = listPage?.pageSize ?? DEFAULT_CUSTOMER_PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(totalResults / pageSize))

  const selectedCustomers = useMemo(
    () => displayedCustomers.filter((customer) => selectedIds.has(customer.id)),
    [displayedCustomers, selectedIds]
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

  function openEditDialog(customer: CustomerListRow) {
    void (async () => {
      const fullCustomer = await fetchCustomerById(customer.id)
      if (fullCustomer) {
        setEditingCustomer(fullCustomer)
        setFormOpen(true)
      } else {
        setFeedback("No se pudo cargar el cliente para editar.")
      }
    })()
  }

  function openArchiveDialog(customer: CustomerListRow | CustomerListRow[]) {
    setArchiveTarget(customer)
  }

  function openDeleteDialog(customer: CustomerListRow) {
    setDeleteTarget(customer)
  }

  function openPermanentDeleteDialog(customer: CustomerListRow) {
    setPermanentDeleteTarget(customer)
  }

  function handlePermanentDeleteSuccess(message: string) {
    if (permanentDeleteTarget) {
      removeCustomerLocally(permanentDeleteTarget.id)
      setSelectedIds((current) => {
        const next = new Set(current)
        next.delete(permanentDeleteTarget.id)
        return next
      })
    }

    setPermanentDeleteTarget(null)
    setFeedback(message)
  }

  async function handleActivateCustomer(customer: CustomerListRow) {
    const result = await activateCustomer({
      customerId: customer.id,
      activatedBy: resolveAuthDisplay(sessionUser).displayName,
    })

    if (!result.success) {
      setFeedback(result.message ?? "No se pudo activar el cliente.")
      return
    }

    setFeedback("Cliente activado correctamente.")
  }

  async function handleMarkActive(customer: CustomerListRow) {
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

  function goToPage(page: number) {
    void loadCustomerPage({
      ...listQuery,
      page,
      search: debouncedSearch,
      quickFilter: filters.quickFilter,
      locality: filters.locality,
      statusFilter: filters.statusFilter,
      sort: filters.sort,
    })
    setSelectedIds(new Set())
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
            resultCount={totalResults}
          />

          <CustomersBulkActionsBar
            selectedCustomers={selectedCustomers}
            onClearSelection={() => setSelectedIds(new Set())}
            onArchive={openArchiveDialog}
            onFeedback={setFeedback}
          />

          {!isCustomersReady || isListLoading ? (
            <TableRowsSkeleton rows={8} columns={5} />
          ) : (
            <>
              <CustomersList
                customers={displayedCustomers}
                quickFilter={filters.quickFilter}
                selectedIds={selectedIds}
                onSelectedIdsChange={setSelectedIds}
                onEdit={openEditDialog}
                onArchive={openArchiveDialog}
                onDelete={openDeleteDialog}
                onMarkActive={(customer) => void handleMarkActive(customer)}
                onActivateCustomer={(customer) =>
                  void handleActivateCustomer(customer)
                }
                onPermanentDelete={
                  isSystemAdministrator ? openPermanentDeleteDialog : undefined
                }
              />

              {totalResults > pageSize ? (
                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    Página {currentPage} de {totalPages} · {totalResults}{" "}
                    {totalResults === 1 ? "cliente" : "clientes"}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={currentPage <= 1}
                      onClick={() => goToPage(currentPage - 1)}
                    >
                      <ChevronLeft className="size-4" />
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={currentPage >= totalPages}
                      onClick={() => goToPage(currentPage + 1)}
                    >
                      Siguiente
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
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

      {permanentDeleteTarget ? (
        <PermanentDeleteDialog
          open={permanentDeleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) {
              setPermanentDeleteTarget(null)
            }
          }}
          entityType="customer"
          entityId={permanentDeleteTarget.id}
          entityLabel={permanentDeleteTarget.name}
          onSuccess={handlePermanentDeleteSuccess}
        />
      ) : null}

      <CustomerImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={handleMutationSuccess}
      />
    </div>
  )
}
