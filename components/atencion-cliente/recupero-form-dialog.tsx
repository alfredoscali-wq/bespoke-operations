"use client"

import { useCallback, useEffect, useState } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import {
  CUSTOMER_RECUPERACION_CHANNEL_OPTIONS,
  CUSTOMER_RECUPERACION_RESULTADO_OPTIONS,
} from "@/lib/customer-recuperaciones/format"
import type { Customer } from "@/lib/types/customers"
import type {
  CustomerRecuperacionChannel,
  CustomerRecuperacionResultado,
  NewCustomerRecuperacionInput,
} from "@/lib/types/customer-recuperaciones"
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

type CustomerMode = "existing" | "manual"

type RecuperoFormState = {
  channel: CustomerRecuperacionChannel | ""
  offer: string
  observation: string
  resultado: CustomerRecuperacionResultado | ""
  manualCustomerName: string
  manualZone: string
  manualPhone: string
}

const emptyForm: RecuperoFormState = {
  channel: "",
  offer: "",
  observation: "",
  resultado: "",
  manualCustomerName: "",
  manualZone: "",
  manualPhone: "",
}

type RecuperoFormDialogProps = {
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
      <Label htmlFor="recupero-customer-search">Cliente</Label>
      <Input
        id="recupero-customer-search"
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

export function RecuperoFormDialog({
  open,
  onOpenChange,
}: RecuperoFormDialogProps) {
  const { searchCustomers, createRecuperacion } = useAtencionCliente()
  const [customerMode, setCustomerMode] = useState<CustomerMode>("existing")
  const [form, setForm] = useState<RecuperoFormState>(emptyForm)
  const [baselineForm, setBaselineForm] = useState<RecuperoFormState>(emptyForm)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isDirty =
    isFormStateDirty(form, baselineForm) ||
    selectedCustomer !== null ||
    customerMode !== "existing"

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
    setCustomerMode("existing")
    setError(null)
  }, [open])

  const handleSearchCustomers = useCallback(
    (query: string) => searchCustomers(query),
    [searchCustomers]
  )

  async function handleSubmit() {
    setError(null)

    if (customerMode === "existing" && !selectedCustomer) {
      setError("Seleccioná un cliente existente.")
      return
    }

    if (!form.channel || !form.resultado) {
      setError("Completá canal y resultado.")
      return
    }

    let input: NewCustomerRecuperacionInput

    if (customerMode === "existing") {
      input = {
        mode: "existing",
        customerId: selectedCustomer!.id,
        channel: form.channel,
        offer: form.offer,
        observation: form.observation,
        resultado: form.resultado,
      }
    } else {
      input = {
        mode: "manual",
        manualCustomerName: form.manualCustomerName,
        manualZone: form.manualZone,
        manualPhone: form.manualPhone,
        channel: form.channel,
        offer: form.offer,
        observation: form.observation,
        resultado: form.resultado,
      }
    }

    setIsSubmitting(true)
    const result = await createRecuperacion(input)
    setIsSubmitting(false)

    if (!result.success) {
      setError(result.message ?? "No se pudo registrar la gestión.")
      return
    }

    forceClose()
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
          <DialogTitle>Nueva Gestión de Recupero</DialogTitle>
          <DialogDescription>
            Registrá el contacto con un excliente o carga manual.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>Tipo de cliente</Label>
            <div className="inline-flex rounded-lg border p-1">
              <Button
                type="button"
                size="sm"
                variant={customerMode === "existing" ? "default" : "ghost"}
                onClick={() => {
                  setCustomerMode("existing")
                  setForm((current) => ({
                    ...current,
                    manualCustomerName: "",
                    manualZone: "",
                    manualPhone: "",
                  }))
                }}
              >
                Cliente existente
              </Button>
              <Button
                type="button"
                size="sm"
                variant={customerMode === "manual" ? "default" : "ghost"}
                onClick={() => {
                  setCustomerMode("manual")
                  setSelectedCustomer(null)
                }}
              >
                Carga manual
              </Button>
            </div>
          </div>

          {customerMode === "existing" ? (
            <CustomerSearchField
              onSearch={handleSearchCustomers}
              onSelect={setSelectedCustomer}
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="recupero-manual-name">Nombre y apellido</Label>
                <Input
                  id="recupero-manual-name"
                  value={form.manualCustomerName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      manualCustomerName: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recupero-manual-zone">Zona</Label>
                <Input
                  id="recupero-manual-zone"
                  value={form.manualZone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      manualZone: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="recupero-manual-phone">Teléfono</Label>
                <Input
                  id="recupero-manual-phone"
                  value={form.manualPhone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      manualPhone: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Canal</Label>
              <Select
                value={form.channel}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    channel: value as CustomerRecuperacionChannel,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar canal" />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_RECUPERACION_CHANNEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Resultado</Label>
              <Select
                value={form.resultado}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    resultado: value as CustomerRecuperacionResultado,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar resultado" />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_RECUPERACION_RESULTADO_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recupero-offer">Oferta o promoción realizada</Label>
            <Input
              id="recupero-offer"
              value={form.offer}
              onChange={(event) =>
                setForm((current) => ({ ...current, offer: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recupero-observation">Observación</Label>
            <Textarea
              id="recupero-observation"
              value={form.observation}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  observation: event.target.value,
                }))
              }
              rows={3}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={requestClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Guardando…" : "Registrar recupero"}
          </Button>
        </DialogFooter>
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
