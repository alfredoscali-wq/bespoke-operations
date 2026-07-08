"use client"

import { useCallback, useEffect, useState } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import { CUSTOMER_RETENCION_MOTIVO_BAJA_OPTIONS } from "@/lib/customer-retenciones/format"
import type { Customer } from "@/lib/types/customers"
import type {
  CustomerRetencionMotivoBaja,
  NewCustomerRetencionInput,
} from "@/lib/types/customer-retenciones"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DiscardChangesDialog,
  ProtectedFormDialogContent,
  isFormStateDirty,
  useProtectedFormDialog,
} from "@/components/ui/protected-form-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type AssignFormState = {
  motivoBaja: CustomerRetencionMotivoBaja | ""
  detail: string
  assignedEmployeeId: string
}

const emptyForm: AssignFormState = {
  motivoBaja: "",
  detail: "",
  assignedEmployeeId: "",
}

type RetencionAssignDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function CustomerSearchField({
  onSearch,
  onSelect,
}: {
  onSearch: (query: string) => Promise<Customer[]>
  onSelect: (customer: Customer) => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Customer[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    let cancelled = false

    const timeout = window.setTimeout(async () => {
      setIsSearching(true)
      const items = await onSearch(query)
      if (!cancelled) {
        setResults(items)
        setIsSearching(false)
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [query, onSearch])

  return (
    <div className="relative space-y-2">
      <Label htmlFor="retencion-customer-search">Cliente</Label>
      <Input
        id="retencion-customer-search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Buscar por nombre, DNI o código"
      />
      {isOpen && (query.trim() || isSearching) ? (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-background shadow-md">
          {isSearching ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Sin resultados
            </p>
          ) : (
            results.map((customer) => (
              <button
                key={customer.id}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onSelect(customer)
                  setQuery(customer.name)
                  setIsOpen(false)
                }}
              >
                <span className="font-medium">{customer.name}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

export function RetencionAssignDialog({
  open,
  onOpenChange,
}: RetencionAssignDialogProps) {
  const { searchCustomers, listAssignees, assignRetencion } = useAtencionCliente()
  const [form, setForm] = useState<AssignFormState>(emptyForm)
  const [baselineForm, setBaselineForm] = useState<AssignFormState>(emptyForm)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [assignees, setAssignees] = useState<
    Array<{ id: string; displayName: string }>
  >([])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isDirty =
    isFormStateDirty(form, baselineForm) || selectedCustomer !== null

  const {
    handleOpenChange,
    requestClose,
    forceClose,
    discardOpen,
    setDiscardOpen,
    confirmDiscard,
  } = useProtectedFormDialog({ open, onOpenChange, isDirty })

  useEffect(() => {
    if (!open) {
      return
    }

    setForm(emptyForm)
    setBaselineForm(emptyForm)
    setSelectedCustomer(null)
    setError(null)

    void listAssignees().then(setAssignees)
  }, [listAssignees, open])

  const handleCustomerSearch = useCallback(
    (query: string) => searchCustomers(query),
    [searchCustomers]
  )

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!selectedCustomer) {
      setError("Seleccioná un cliente.")
      return
    }

    if (!form.motivoBaja || !form.assignedEmployeeId || !form.detail.trim()) {
      setError("Completá motivo, responsable y detalle.")
      return
    }

    const input: NewCustomerRetencionInput = {
      customerId: selectedCustomer.id,
      assignedEmployeeId: form.assignedEmployeeId,
      motivoBaja: form.motivoBaja,
      detail: form.detail,
    }

    setIsSubmitting(true)

    try {
      const result = await assignRetencion(input)

      if (!result.success) {
        setError(result.message ?? "No se pudo asignar la retención.")
        return
      }

      forceClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <ProtectedFormDialogContent
          className="sm:max-w-[50rem]"
          onRequestClose={requestClose}
          isDirty={isDirty}
        >
          <DialogHeader>
            <DialogTitle>Asignar Retención</DialogTitle>
            <DialogDescription>
              Derivá una solicitud de baja al equipo de Atención al Cliente.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-3" onSubmit={handleSubmit}>
            <CustomerSearchField
              onSearch={handleCustomerSearch}
              onSelect={setSelectedCustomer}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="retencion-motivo">Motivo de baja</Label>
                <Select
                  value={form.motivoBaja}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      motivoBaja: value as CustomerRetencionMotivoBaja,
                    }))
                  }
                >
                  <SelectTrigger id="retencion-motivo" className="w-full">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_RETENCION_MOTIVO_BAJA_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="retencion-responsable">Responsable</Label>
                <Select
                  value={form.assignedEmployeeId}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      assignedEmployeeId: value,
                    }))
                  }
                >
                  <SelectTrigger id="retencion-responsable" className="w-full">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignees.map((assignee) => (
                      <SelectItem key={assignee.id} value={assignee.id}>
                        {assignee.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="retencion-detail">Detalle de la solicitud</Label>
              <Textarea
                id="retencion-detail"
                value={form.detail}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    detail: event.target.value,
                  }))
                }
                rows={3}
                placeholder="Contexto de la solicitud de baja"
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={requestClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando…" : "Asignar retención"}
              </Button>
            </DialogFooter>
          </form>
        </ProtectedFormDialogContent>
      </Dialog>

      <DiscardChangesDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onConfirm={confirmDiscard}
      />
    </>
  )
}
