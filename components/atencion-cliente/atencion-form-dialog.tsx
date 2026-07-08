"use client"

import { useCallback, useEffect, useState } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import {
  CUSTOMER_ATENCION_CHANNEL_OPTIONS,
  CUSTOMER_ATENCION_MOTIVO_OPTIONS,
} from "@/lib/customer-atenciones/format"
import type { Customer } from "@/lib/types/customers"
import type {
  CustomerAtencionChannel,
  CustomerAtencionMotivo,
  NewCustomerAtencionInput,
} from "@/lib/types/customer-atenciones"
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

type AtencionFormState = {
  channel: CustomerAtencionChannel | ""
  motivo: CustomerAtencionMotivo | ""
  detail: string
  resolution: string
}

const emptyForm: AtencionFormState = {
  channel: "",
  motivo: "",
  detail: "",
  resolution: "",
}

type AtencionFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (atencionId: string) => void
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
      <Label htmlFor="atencion-customer-search">Cliente</Label>
      <Input
        id="atencion-customer-search"
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
                {customer.dni ? (
                  <span className="ml-2 text-muted-foreground">{customer.dni}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}

export function AtencionFormDialog({
  open,
  onOpenChange,
  onCreated,
}: AtencionFormDialogProps) {
  const { searchCustomers, createAtencion } = useAtencionCliente()
  const [form, setForm] = useState<AtencionFormState>(emptyForm)
  const [baselineForm, setBaselineForm] = useState<AtencionFormState>(emptyForm)
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

    if (!form.channel || !form.motivo) {
      setError("Completá canal y motivo.")
      return
    }

    if (!form.detail.trim() || !form.resolution.trim()) {
      setError("Completá el detalle y la resolución.")
      return
    }

    const input: NewCustomerAtencionInput = {
      customerId: selectedCustomer.id,
      channel: form.channel,
      motivo: form.motivo,
      detail: form.detail,
      resolution: form.resolution,
    }

    setIsSubmitting(true)

    try {
      const result = await createAtencion(input)

      if (!result.success) {
        setError(result.message ?? "No se pudo registrar la atención.")
        return
      }

      forceClose()
      onCreated?.(result.atencion?.id ?? "")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <ProtectedFormDialogContent
          className="max-w-lg"
          onRequestClose={requestClose}
          isDirty={isDirty}
        >
          <DialogHeader>
            <DialogTitle>Nueva Atención</DialogTitle>
            <DialogDescription>
              Registrá una atención resuelta al cliente.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <CustomerSearchField
              onSearch={handleCustomerSearch}
              onSelect={setSelectedCustomer}
            />

            {selectedCustomer ? (
              <p className="text-sm text-muted-foreground">
                Cliente seleccionado:{" "}
                <span className="font-medium text-foreground">
                  {selectedCustomer.name}
                </span>
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="atencion-channel">Canal</Label>
                <Select
                  value={form.channel}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      channel: value as CustomerAtencionChannel,
                    }))
                  }
                >
                  <SelectTrigger id="atencion-channel">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_ATENCION_CHANNEL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="atencion-motivo">Motivo</Label>
                <Select
                  value={form.motivo}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      motivo: value as CustomerAtencionMotivo,
                    }))
                  }
                >
                  <SelectTrigger id="atencion-motivo">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {CUSTOMER_ATENCION_MOTIVO_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="atencion-detail">Detalle</Label>
              <Textarea
                id="atencion-detail"
                value={form.detail}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    detail: event.target.value,
                  }))
                }
                rows={3}
                placeholder="Descripción de la consulta o problema"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="atencion-resolution">Resolución</Label>
              <Textarea
                id="atencion-resolution"
                value={form.resolution}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    resolution: event.target.value,
                  }))
                }
                rows={3}
                placeholder="Qué se hizo para resolver la atención"
              />
            </div>

            <p className="text-sm text-muted-foreground">
              Resultado: <span className="font-medium text-foreground">Resuelta</span>
            </p>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={requestClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando…" : "Registrar atención"}
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
