"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { FileSpreadsheet, Plus } from "lucide-react"

import { CustomerArchiveDialog } from "@/components/clientes/customer-archive-dialog"
import { CustomerDeleteDialog } from "@/components/clientes/customer-delete-dialog"
import { CustomerFormDialog } from "@/components/clientes/customer-form-dialog"
import { CustomerImportDialog } from "@/components/clientes/customer-import-dialog"
import { useCustomers } from "@/components/clientes/customers-provider"
import {
  CustomersFilters,
  defaultCustomerFilters,
} from "@/components/clientes/customers-filters"
import { CustomersList } from "@/components/clientes/customers-list"
import { CustomersSummary } from "@/components/clientes/customers-summary"
import {
  CustomersUIProvider,
  useCustomersUI,
} from "@/components/clientes/customers-ui-provider"
import { filterCustomers } from "@/lib/customers/customer-filters"
import type { Customer } from "@/lib/types/customers"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"

const SEARCH_LIMIT = 100

export function CustomersModule() {
  return (
    <CustomersUIProvider>
      <CustomersModuleContent />
    </CustomersUIProvider>
  )
}

function CustomersModuleContent() {
  const { isCustomersReady, searchCustomers } = useCustomers()
  const { filteredCustomers: categoryFilteredCustomers, selectedCategory } =
    useCustomersUI()
  const [filters, setFilters] = useState(defaultCustomerFilters)
  const [searchResults, setSearchResults] = useState<Customer[] | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Customer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const refreshSearchIfNeeded = useCallback(async () => {
    const query = filters.search.trim()

    if (!query) {
      setSearchResults(null)
      return
    }

    setIsSearching(true)
    const results = await searchCustomers(query, SEARCH_LIMIT)
    setSearchResults(results)
    setIsSearching(false)
  }, [filters.search, searchCustomers])

  useEffect(() => {
    if (selectedCategory) {
      setFilters((current) => ({ ...current, status: "all", technology: "all" }))
    }
  }, [selectedCategory])

  useEffect(() => {
    const query = filters.search.trim()

    if (!query) {
      setSearchResults(null)
      setIsSearching(false)
      return
    }

    let cancelled = false
    setIsSearching(true)

    const timeout = window.setTimeout(async () => {
      const results = await searchCustomers(query, SEARCH_LIMIT)

      if (!cancelled) {
        setSearchResults(results)
        setIsSearching(false)
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [filters.search, searchCustomers])

  const baseCustomers = useMemo(() => {
    if (filters.search.trim()) {
      return searchResults ?? []
    }

    return categoryFilteredCustomers
  }, [filters.search, searchResults, categoryFilteredCustomers])

  const displayedCustomers = useMemo(
    () => filterCustomers(baseCustomers, filters),
    [baseCustomers, filters]
  )

  function handleMutationSuccess(message: string) {
    setFeedback(message)
    void refreshSearchIfNeeded()
  }

  function openCreateDialog() {
    setEditingCustomer(null)
    setFormOpen(true)
  }

  function openEditDialog(customer: Customer) {
    setEditingCustomer(customer)
    setFormOpen(true)
  }

  function openArchiveDialog(customer: Customer) {
    setArchiveTarget(customer)
  }

  function openDeleteDialog(customer: Customer) {
    setDeleteTarget(customer)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">
          Directorio de abonados y suscriptores para operaciones de campo.
        </p>
        <div className="flex flex-wrap gap-2 self-start">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={openCreateDialog}
          >
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

      <CustomersSummary />

      <Card className="shadow-sm">
        <CardHeader className="gap-4 border-b">
          <CardTitle className="text-base">Clientes</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          <CustomersFilters
            filters={filters}
            onChange={setFilters}
            resultCount={displayedCustomers.length}
          />

          {!isCustomersReady || isSearching ? (
            <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
              {isSearching ? "Buscando clientes..." : "Cargando clientes..."}
            </div>
          ) : (
            <CustomersList
              customers={displayedCustomers}
              onEdit={openEditDialog}
              onArchive={openArchiveDialog}
              onDelete={openDeleteDialog}
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
        customer={archiveTarget}
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setArchiveTarget(null)
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
