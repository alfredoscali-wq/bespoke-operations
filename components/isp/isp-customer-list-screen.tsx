"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, Download, Plus, Search, Upload } from "lucide-react"

import { AtencionFormDialog } from "@/components/atencion-cliente/atencion-form-dialog"
import { useAuth } from "@/components/auth/auth-provider"
import { useDemoMode } from "@/components/demo/demo-mode-provider"
import { IspCustomerEditSheet } from "@/components/isp/isp-customer-edit-sheet"
import {
  CustomerBulkActions,
  CustomerBulkAtencionConfirmDialog,
  CustomerEmptyState,
  CustomerListError,
  CustomerRemoveSubscriberDialog,
  CustomerSelectedViewDialog,
  CustomerTable,
  CustomerTableSkeleton,
} from "@/components/isp/isp-customer-list-ui"
import { IspSubscriberServiceSheet } from "@/components/isp/isp-subscriber-service-sheet"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ISP_CUSTOMER_LIST_DEFAULT_PAGE_SIZE,
  ISP_CUSTOMER_LIST_LOAD_ERROR,
  ISP_CUSTOMER_LIST_PAGE_SIZES,
  ISP_CUSTOMER_LIST_SEARCH_DEBOUNCE_MS,
  customerListErrorMessage,
  isIgnorableListLoadAbort,
  resolveIspCustomerListPageSize,
} from "@/lib/isp/customer-list-load"
import {
  canAccessIspMigration,
  canAddIspSubscriberService,
  canCreateIspAtencion,
  canEditIspSubscriber,
  canRemoveIspSubscriber,
} from "@/lib/isp/permissions"
import {
  ISP_SUBSCRIBER_REMOVED_MESSAGE,
  ISP_SUBSCRIBER_REMOVAL_CONFIRMATION,
  ISP_SUBSCRIBER_REMOVAL_ERROR_MESSAGE,
  formatIspSubscriberRemovalFailure,
  isIspSubscriberRemovalResolved,
} from "@/lib/isp/subscriber-removal"
import { submitIspCustomerAtencion } from "@/lib/isp/submit-consultation"
import {
  exportIspSubscribersCsv,
  ispListItemToCustomer,
  mergeSelectedSubscribers,
  toggleVisibleSubscriberSelection,
  visibleSubscriberSelectionState,
} from "@/lib/isp/subscriber-list-presentation"
import type { IspCustomerHeader, IspCustomerListItem } from "@/lib/isp/types"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import type { NewCustomerAtencionInput } from "@/lib/types/customer-atenciones"

function customerListPageWindow(
  page: number,
  pageCount: number
): Array<number | "ellipsis"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }
  const visible = [1, pageCount, page - 1, page, page + 1].filter(
    (value, index, values) =>
      value >= 1 && value <= pageCount && values.indexOf(value) === index
  )
  visible.sort((left, right) => left - right)
  const items: Array<number | "ellipsis"> = []
  for (const value of visible) {
    const previous = items.at(-1)
    if (typeof previous === "number" && value - previous > 1) {
      items.push("ellipsis")
    }
    items.push(value)
  }
  return items
}

export function IspCustomerListScreen() {
  const router = useRouter()
  const { sessionUser, isAuthReady } = useAuth()
  const { companyId } = useTenantCompanyId()
  const { isReadOnly, openRestrictedDialog } = useDemoMode()
  const canImport = canAccessIspMigration(sessionUser)
  const canEdit = canEditIspSubscriber(sessionUser)
  const canAddService = canAddIspSubscriberService(sessionUser)
  const canCreateAtencion = canCreateIspAtencion(sessionUser)
  const canRemove = canRemoveIspSubscriber(sessionUser)

  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [status, setStatus] = useState("all")
  const [locality, setLocality] = useState("all")
  const [minServices, setMinServices] = useState("")
  const [debouncedMinServices, setDebouncedMinServices] = useState("")
  const [minConnections, setMinConnections] = useState("")
  const [debouncedMinConnections, setDebouncedMinConnections] = useState("")
  const [items, setItems] = useState<IspCustomerListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(ISP_CUSTOMER_LIST_DEFAULT_PAGE_SIZE)
  const [localities, setLocalities] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedItems, setSelectedItems] = useState<
    Map<string, IspCustomerListItem>
  >(new Map())
  const [editCustomer, setEditCustomer] = useState<IspCustomerHeader | null>(null)
  const [serviceCustomerId, setServiceCustomerId] = useState<string | null>(null)
  const [atencionCustomers, setAtencionCustomers] = useState<
    IspCustomerListItem[]
  >([])
  const [bulkAtencionOpen, setBulkAtencionOpen] = useState(false)
  const [viewSelectedOpen, setViewSelectedOpen] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<IspCustomerListItem | null>(
    null
  )
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [feedbackVariant, setFeedbackVariant] = useState<"success" | "error">(
    "success"
  )
  const [exporting, setExporting] = useState(false)

  const searchFilters = useRef({ search, minServices, minConnections })
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const previous = searchFilters.current
      const changed =
        previous.search !== search ||
        previous.minServices !== minServices ||
        previous.minConnections !== minConnections
      searchFilters.current = { search, minServices, minConnections }
      setDebouncedSearch(search)
      setDebouncedMinServices(minServices)
      setDebouncedMinConnections(minConnections)
      if (changed) setPage(1)
    }, ISP_CUSTOMER_LIST_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timeout)
  }, [minConnections, minServices, search])

  useEffect(() => {
    if (!isAuthReady) return

    let cancelled = false
    const params = new URLSearchParams({
      search: debouncedSearch,
      status,
      locality,
      page: String(page),
      pageSize: String(pageSize),
    })
    if (debouncedMinServices.trim()) {
      params.set("minServices", debouncedMinServices.trim())
    }
    if (debouncedMinConnections.trim()) {
      params.set("minConnections", debouncedMinConnections.trim())
    }
    setLoading(true)

    fetch(`/api/isp/customers?${params.toString()}`, {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          success?: boolean
          customers?: IspCustomerListItem[]
          items?: IspCustomerListItem[]
          localities?: string[]
          total?: number
          page?: number
          pageSize?: number
          message?: string
        } | null
        if (cancelled) return
        if (!body || body.success !== true) {
          throw new Error(body?.message ?? ISP_CUSTOMER_LIST_LOAD_ERROR)
        }
        setItems(body.customers ?? body.items ?? [])
        setTotal(body.total ?? 0)
        if (typeof body.page === "number" && body.page !== page) {
          setPage(body.page)
        }
        setLocalities(body.localities ?? [])
        setError(null)
      })
      .catch((cause: unknown) => {
        if (cancelled || isIgnorableListLoadAbort(cause)) return
        setError(customerListErrorMessage(cause))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    debouncedMinConnections,
    debouncedMinServices,
    debouncedSearch,
    isAuthReady,
    locality,
    page,
    pageSize,
    reloadKey,
    status,
  ])

  const subtitle = useMemo(() => {
    const filtered =
      debouncedSearch.trim().length > 0 ||
      status !== "all" ||
      locality !== "all" ||
      debouncedMinServices.trim().length > 0 ||
      debouncedMinConnections.trim().length > 0
    if (!isAuthReady || (loading && items.length === 0)) return "Cargando abonados..."
    const formatted = total.toLocaleString("es-AR")
    if (total === 0) {
      return filtered ? "0 abonados encontrados" : "0 abonados"
    }
    const from = (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, total)
    const range = `${from.toLocaleString("es-AR")}–${to.toLocaleString("es-AR")} de ${formatted} abonados`
    return filtered ? `${range} · ${formatted} abonados encontrados` : range
  }, [
    debouncedMinConnections,
    debouncedMinServices,
    debouncedSearch,
    isAuthReady,
    items.length,
    loading,
    locality,
    page,
    pageSize,
    status,
    total,
  ])

  const headerState = visibleSubscriberSelectionState(
    selectedIds,
    items.map((item) => item.id)
  )
  const selectedList = [...selectedItems.values()]

  function showFeedback(
    message: string,
    variant: "success" | "error" = "success"
  ) {
    setFeedbackVariant(variant)
    setFeedback(message)
    window.setTimeout(() => setFeedback(null), 2500)
  }

  function updateSelection(nextIds: Set<string>, sourceItems = items) {
    setSelectedIds(nextIds)
    setSelectedItems((current) =>
      mergeSelectedSubscribers(current, sourceItems, nextIds)
    )
  }

  function toggleOne(item: IspCustomerListItem, checked: boolean) {
    const next = new Set(selectedIds)
    if (checked) next.add(item.id)
    else next.delete(item.id)
    updateSelection(next, [item, ...items])
  }

  async function openEdit(item: IspCustomerListItem) {
    try {
      const response = await fetch(`/api/isp/customers/${item.id}`, {
        cache: "no-store",
        credentials: "same-origin",
      })
      const body = (await response.json()) as {
        success?: boolean
        detail?: { customer: IspCustomerHeader }
        message?: string
      }
      if (!body.success || !body.detail) {
        throw new Error(body.message ?? "No se pudo cargar el cliente.")
      }
      setEditCustomer(body.detail.customer)
    } catch {
      showFeedback("No pudimos abrir la edición del cliente.")
    }
  }

  async function createAtencion(input: NewCustomerAtencionInput) {
    if (isReadOnly) {
      openRestrictedDialog()
      return { success: false, message: "Acción no disponible en demostración." }
    }
    if (!companyId || !sessionUser?.employeeId) {
      return { success: false, message: "No se pudo identificar al operador." }
    }
    return submitIspCustomerAtencion({
      companyId,
      employeeId: sessionUser.employeeId,
      payload: input,
    })
  }

  async function confirmRemoveSubscriber() {
    if (!removeTarget) return
    if (isReadOnly) {
      openRestrictedDialog()
      return
    }

    setRemoving(true)
    try {
      const response = await fetch(
        `/api/isp/customers/${removeTarget.id}/subscriber`,
        {
          method: "DELETE",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirmation: ISP_SUBSCRIBER_REMOVAL_CONFIRMATION,
          }),
        }
      )
      const body = (await response.json().catch(() => null)) as {
        success?: boolean
        alreadyRemoved?: boolean
        message?: string
      } | null

      if (isIspSubscriberRemovalResolved(response.status, body)) {
        const removedId = removeTarget.id
        const next = new Set(selectedIds)
        next.delete(removedId)
        updateSelection(next)
        setRemoveError(null)
        setRemoveTarget(null)
        showFeedback(ISP_SUBSCRIBER_REMOVED_MESSAGE)
        setReloadKey((current) => current + 1)
        return
      }

      setRemoveError(formatIspSubscriberRemovalFailure(body?.message))
    } catch {
      setRemoveError(ISP_SUBSCRIBER_REMOVAL_ERROR_MESSAGE)
    } finally {
      setRemoving(false)
    }
  }

  async function exportActiveCustomersExcel() {
    setExporting(true)
    try {
      const response = await fetch("/api/isp/customers/export", {
        cache: "no-store",
        credentials: "same-origin",
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string
        } | null
        throw new Error(body?.message ?? "No se pudo exportar el Excel.")
      }
      const blob = await response.blob()
      const header = response.headers.get("Content-Disposition") ?? ""
      const match = header.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? "Clientes360_ABNet.xlsx"
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      showFeedback(
        error instanceof Error ? error.message : "No se pudo exportar el Excel.",
        "error"
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-lg font-medium tracking-tight">{subtitle}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/clientes-360/nuevo">
              <Plus className="size-4" />
              Nuevo Cliente
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={exporting}
            onClick={() => void exportActiveCustomersExcel()}
          >
            <Download className="size-4" />
            {exporting ? "Exportando..." : "Exportar Excel"}
          </Button>
          {canImport ? (
            <Button asChild variant="outline">
              <Link href="/clientes-360/migracion">
                <Upload className="size-4" />
                Importar abonados
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar abonado..."
            className="pl-8"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="activo">Activo</SelectItem>
            <SelectItem value="suspendido">Suspendido</SelectItem>
            <SelectItem value="baja">Baja</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={locality}
          onValueChange={(value) => {
            setLocality(value)
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Localidad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las localidades</SelectItem>
            {localities.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          min={0}
          value={minServices}
          onChange={(event) => setMinServices(event.target.value)}
          placeholder="Cantidad de servicios"
          className="w-[180px]"
        />
        <Input
          type="number"
          min={0}
          value={minConnections}
          onChange={(event) => setMinConnections(event.target.value)}
          placeholder="Cantidad de conexiones"
          className="w-[200px]"
        />
        <Select
          value={String(pageSize)}
          onValueChange={(value) => {
            setPageSize(resolveIspCustomerListPageSize(Number(value)))
            setPage(1)
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Por página" />
          </SelectTrigger>
          <SelectContent>
            {ISP_CUSTOMER_LIST_PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} por página
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <EntityActionFeedback message={feedback} variant={feedbackVariant} />

      {error ? (
        <CustomerListError
          message={error}
          onRetry={() => {
            setError(null)
            setReloadKey((current) => current + 1)
          }}
        />
      ) : loading && items.length === 0 ? (
        <CustomerTableSkeleton />
      ) : items.length === 0 ? (
        <CustomerEmptyState canImport={canImport} />
      ) : (
        <div className={loading ? "space-y-3 opacity-60" : "space-y-3"} aria-busy={loading}>
          <CustomerBulkActions
            count={selectedIds.size}
            canCreateAtencion={canCreateAtencion}
            onClear={() => updateSelection(new Set())}
            onNewAtencion={() => setBulkAtencionOpen(true)}
            onExport={() => exportIspSubscribersCsv(selectedList)}
            onViewSelected={() => {
              if (selectedList.length === 1) {
                router.push(`/clientes-360/${selectedList[0].id}`)
                return
              }
              setViewSelectedOpen(true)
            }}
          />
          <CustomerTable
            items={items}
            selectedIds={selectedIds}
            headerState={headerState}
            canEdit={canEdit}
            canAddService={canAddService}
            canCreateAtencion={canCreateAtencion}
            canRemove={canRemove}
            onToggleAllVisible={(checked) =>
              updateSelection(
                toggleVisibleSubscriberSelection(
                  selectedIds,
                  items.map((item) => item.id),
                  checked
                )
              )
            }
            onToggleOne={toggleOne}
            onEdit={(item) => void openEdit(item)}
            onAddService={(item) => setServiceCustomerId(item.id)}
            onNewAtencion={(item) => setAtencionCustomers([item])}
            onRemove={(item) => {
              if (isReadOnly) {
                openRestrictedDialog()
                return
              }
              setRemoveError(null)
              setRemoveTarget(item)
            }}
          />
        </div>
      )}

      {error ? null : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {total === 0
              ? "0 abonados"
              : `Página ${page.toLocaleString("es-AR")} de ${Math.max(1, Math.ceil(total / pageSize)).toLocaleString("es-AR")}`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              <ChevronLeft className="size-4" />
              Anterior
            </Button>
            {customerListPageWindow(
              page,
              Math.max(1, Math.ceil(total / pageSize))
            ).map((item, index) =>
              item === "ellipsis" ? (
                <span
                  key={`ellipsis-${index}`}
                  className="px-1 text-xs text-muted-foreground"
                >
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  type="button"
                  variant={item === page ? "default" : "outline"}
                  size="sm"
                  className="min-w-8"
                  disabled={loading}
                  onClick={() => setPage(item)}
                >
                  {item}
                </Button>
              )
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={loading || page * pageSize >= total}
              onClick={() => setPage((current) => current + 1)}
            >
              Siguiente
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <CustomerRemoveSubscriberDialog
        open={Boolean(removeTarget)}
        item={removeTarget}
        isSubmitting={removing}
        error={removeError}
        onCancel={() => {
          if (removing) return
          setRemoveError(null)
          setRemoveTarget(null)
        }}
        onConfirm={() => void confirmRemoveSubscriber()}
      />

      {editCustomer ? (
        <IspCustomerEditSheet
          open
          customer={editCustomer}
          onClose={() => setEditCustomer(null)}
          onSaved={() => {
            setEditCustomer(null)
            showFeedback("Cambios guardados.")
            setReloadKey((current) => current + 1)
          }}
        />
      ) : null}

      <IspSubscriberServiceSheet
        open={Boolean(serviceCustomerId)}
        mode="add-service"
        customerId={serviceCustomerId ?? ""}
        service={null}
        onClose={() => setServiceCustomerId(null)}
        onSaved={() => {
          setServiceCustomerId(null)
          showFeedback("Cambios guardados.")
          setReloadKey((current) => current + 1)
        }}
      />

      <CustomerBulkAtencionConfirmDialog
        open={bulkAtencionOpen}
        count={selectedIds.size}
        onCancel={() => setBulkAtencionOpen(false)}
        onContinue={() => {
          setBulkAtencionOpen(false)
          setAtencionCustomers(selectedList)
        }}
      />

      <CustomerSelectedViewDialog
        open={viewSelectedOpen}
        items={selectedList}
        onClose={() => setViewSelectedOpen(false)}
      />

      <AtencionFormDialog
        open={atencionCustomers.length > 0}
        onOpenChange={(open) => {
          if (!open) setAtencionCustomers([])
        }}
        initialCustomer={
          atencionCustomers[0]
            ? ispListItemToCustomer(atencionCustomers[0])
            : null
        }
        targetCustomerIds={atencionCustomers.map((item) => item.id)}
        lockCustomer
        createAtencion={createAtencion}
        onCreated={() => {
          setAtencionCustomers([])
          showFeedback("Atención registrada.")
        }}
      />
    </div>
  )
}
