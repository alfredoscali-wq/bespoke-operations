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

type CreateFormState = {
  motivoBaja: CustomerRetencionMotivoBaja | ""
  detail: string
}

const emptyForm: CreateFormState = {
  motivoBaja: "",
  detail: "",
}

type RetencionCreateDialogProps = {
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
      <Label htmlFor="retencion-create-customer-search">Cliente</Label>
      <Input
        id="retencion-create-customer-search"
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

export function RetencionCreateDialog({
  open,
  onOpenChange,
}: RetencionCreateDialogProps) {
  const { searchCustomers, createRetencion } = useAtencionCliente()
  const [form, setForm] = useState<CreateFormState>(emptyForm)
  const [baselineForm, setBaselineForm] = useState<CreateFormState>(emptyForm)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
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
  }, [open])

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

    if (!form.motivoBaja || !form.detail.trim()) {
      setError("Completá motivo y detalle.")
      return
    }

    const input: NewCustomerRetencionInput = {
      customerId: selectedCustomer.id,
      motivoBaja: form.motivoBaja,
      detail: form.detail,
    }

    setIsSubmitting(true)

    try {
      const result = await createRetencion(input)

      if (!result.success) {
        setError(result.message ?? "No se pudo iniciar la gestión de baja.")
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
            <DialogTitle>Nueva gestión de baja</DialogTitle>
            <DialogDescription>
              Registrá la solicitud de baja del cliente e iniciá el intento de
              retención.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-3" onSubmit={handleSubmit}>
            <CustomerSearchField
              onSearch={handleCustomerSearch}
              onSelect={setSelectedCustomer}
            />

            <div className="space-y-2">
              <Label htmlFor="retencion-create-motivo">Motivo de baja</Label>
              <Select
                value={form.motivoBaja}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    motivoBaja: value as CustomerRetencionMotivoBaja,
                  }))
                }
              >
                <SelectTrigger id="retencion-create-motivo" className="w-full">
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
              <Label htmlFor="retencion-create-detail">Detalle inicial</Label>
              <Textarea
                id="retencion-create-detail"
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
                {isSubmitting ? "Guardando…" : "Iniciar gestión"}
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
