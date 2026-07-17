"use client"

import { useCallback, useEffect, useState } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import {
  CUSTOMER_ATENCION_CHANNEL_OPTIONS,
  CUSTOMER_ATENCION_MOTIVO_OPTIONS,
} from "@/lib/customer-atenciones/format"
import type { Customer, QuickCustomerInput } from "@/lib/types/customers"
import type {
  CustomerAtencionChannel,
  CustomerAtencionMotivo,
  CustomerAtencionNextStep,
  NewConsultationDecision,
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
import { cn } from "@/lib/utils"

type CustomerSelectionMode = "existing" | "unregistered"

type QuickCustomerFormState = {
  name: string
  phone: string
  dni: string
}

const emptyQuickCustomerForm: QuickCustomerFormState = {
  name: "",
  phone: "",
  dni: "",
}

type AtencionFormState = {
  channel: CustomerAtencionChannel | ""
  motivo: CustomerAtencionMotivo | ""
  detail: string
  decision: NewConsultationDecision
  resolution: string
  nextStep: CustomerAtencionNextStep | ""
}

const emptyForm: AtencionFormState = {
  channel: "",
  motivo: "",
  detail: "",
  decision: "resolver_ahora",
  resolution: "",
  nextStep: "",
}

/** Presentation-only area choice for the continue-management cascade (UX 2.1). */
type ContinuationArea =
  | "atencion_cliente"
  | "tecnica"
  | "administracion"
  | "ventas"

const CONTINUATION_AREA_OPTIONS: { value: ContinuationArea; label: string }[] =
  [
    { value: "atencion_cliente", label: "Atención al Cliente" },
    { value: "tecnica", label: "Área Técnica" },
    { value: "administracion", label: "Administración" },
    { value: "ventas", label: "Ventas" },
  ]

const ATENCION_CLIENTE_NEXT_STEP_OPTIONS: {
  value: CustomerAtencionNextStep
  label: string
}[] = [
  { value: "seguimiento_cliente", label: "Volver a contactar al cliente" },
  { value: "esperar_cliente", label: "Esperando respuesta del cliente" },
  { value: "realizar_retencion", label: "Realizar Retención" },
]

const ADMINISTRACION_NEXT_STEP_OPTIONS: {
  value: CustomerAtencionNextStep
  label: string
}[] = [
  { value: "derivar_admin_facturacion", label: "Facturación" },
  { value: "derivar_admin_morosos", label: "Deuda / Morosidad" },
  { value: "derivar_admin_gestion", label: "Gestión administrativa" },
]

/** Areas that map 1:1 to an existing next_step slug (no second selector). */
const DIRECT_AREA_NEXT_STEP: Partial<
  Record<ContinuationArea, CustomerAtencionNextStep>
> = {
  tecnica: "resolver_consulta_tecnica",
  ventas: "contactar_cliente",
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
        placeholder="Buscar por nombre, DNI o codigo"
      />
      {isOpen && (query.trim() || isSearching) ? (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-background shadow-md">
          {isSearching ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Buscando...</p>
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

function QuickCustomerFields({
  value,
  onChange,
}: {
  value: QuickCustomerFormState
  onChange: (next: QuickCustomerFormState) => void
}) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <p className="text-sm text-muted-foreground">
        Completa los datos minimos. Se registrara al cliente y luego la consulta.
      </p>
      <div className="space-y-2">
        <Label htmlFor="atencion-quick-customer-name">Nombre *</Label>
        <Input
          id="atencion-quick-customer-name"
          value={value.name}
          onChange={(event) =>
            onChange({ ...value, name: event.target.value })
          }
          placeholder="Juan Perez"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="atencion-quick-customer-phone">Telefono</Label>
          <Input
            id="atencion-quick-customer-phone"
            value={value.phone}
            onChange={(event) =>
              onChange({ ...value, phone: event.target.value })
            }
            placeholder="11 1234-5678"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="atencion-quick-customer-dni">DNI</Label>
          <Input
            id="atencion-quick-customer-dni"
            value={value.dni}
            onChange={(event) =>
              onChange({ ...value, dni: event.target.value })
            }
            placeholder="Opcional"
          />
        </div>
      </div>
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
  const [customerMode, setCustomerMode] =
    useState<CustomerSelectionMode>("existing")
  const [baselineCustomerMode, setBaselineCustomerMode] =
    useState<CustomerSelectionMode>("existing")
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [quickCustomerForm, setQuickCustomerForm] =
    useState<QuickCustomerFormState>(emptyQuickCustomerForm)
  const [baselineQuickCustomerForm, setBaselineQuickCustomerForm] =
    useState<QuickCustomerFormState>(emptyQuickCustomerForm)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  /** Presentation-only: which area continues management (UX 2.1 cascade). */
  const [continuationArea, setContinuationArea] = useState<
    ContinuationArea | ""
  >("")

  const isDirty =
    isFormStateDirty(form, baselineForm) ||
    customerMode !== baselineCustomerMode ||
    selectedCustomer !== null ||
    isFormStateDirty(quickCustomerForm, baselineQuickCustomerForm) ||
    continuationArea !== ""

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
    setCustomerMode("existing")
    setBaselineCustomerMode("existing")
    setSelectedCustomer(null)
    setQuickCustomerForm(emptyQuickCustomerForm)
    setBaselineQuickCustomerForm(emptyQuickCustomerForm)
    setContinuationArea("")
    setError(null)
  }, [open])

  const handleCustomerSearch = useCallback(
    (query: string) => searchCustomers(query),
    [searchCustomers]
  )

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (customerMode === "existing" && !selectedCustomer) {
      setError("Selecciona un cliente.")
      return
    }

    if (customerMode === "unregistered" && !quickCustomerForm.name.trim()) {
      setError("Completa el nombre del cliente.")
      return
    }

    if (!form.channel || !form.motivo) {
      setError("Completa canal y motivo.")
      return
    }

    if (!form.detail.trim()) {
      setError("Completa la descripcion de la consulta.")
      return
    }

    if (form.decision === "resolver_ahora" && !form.resolution.trim()) {
      setError("Completa la resolucion de la consulta.")
      return
    }

    if (form.decision === "continuar_gestion" && !form.nextStep) {
      setError("Selecciona el proximo paso para continuar la gestion.")
      return
    }

    const quickCustomer: QuickCustomerInput | undefined =
      customerMode === "unregistered"
        ? {
            name: quickCustomerForm.name.trim(),
            phone: quickCustomerForm.phone.trim() || undefined,
            dni: quickCustomerForm.dni.trim() || undefined,
          }
        : undefined

    const input: NewCustomerAtencionInput = {
      customerId:
        customerMode === "existing" ? selectedCustomer?.id : undefined,
      quickCustomer,
      channel: form.channel,
      motivo: form.motivo,
      detail: form.detail,
      decision: form.decision,
      resolution:
        form.decision === "resolver_ahora" ? form.resolution : undefined,
      nextStep:
        form.decision === "continuar_gestion" && form.nextStep
          ? form.nextStep
          : undefined,
    }

    setIsSubmitting(true)

    try {
      const result = await createAtencion(input)

      if (!result.success) {
        setError(result.message ?? "No se pudo registrar la atencion.")
        return
      }

      forceClose()
      onCreated?.(result.atencion?.id ?? "")
    } finally {
      setIsSubmitting(false)
    }
  }

  const submitLabel =
    form.decision === "resolver_ahora"
      ? isSubmitting
        ? "Guardando..."
        : "Guardar consulta resuelta"
      : isSubmitting
        ? "Guardando..."
        : "Guardar y continuar gestión"

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <ProtectedFormDialogContent
          className="sm:max-w-[50rem]"
          onRequestClose={requestClose}
          isDirty={isDirty}
        >
          <DialogHeader>
            <DialogTitle>Nueva Atencion</DialogTitle>
            <DialogDescription>
              Registra la consulta del cliente y define que ocurre a continuacion.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label>Cliente</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant={customerMode === "existing" ? "default" : "outline"}
                  className={cn(
                    "h-auto min-h-10 whitespace-normal py-2",
                    customerMode === "existing" && "ring-2 ring-primary"
                  )}
                  onClick={() => {
                    setCustomerMode("existing")
                    setQuickCustomerForm(emptyQuickCustomerForm)
                  }}
                >
                  Cliente registrado
                </Button>
                <Button
                  type="button"
                  variant={
                    customerMode === "unregistered" ? "default" : "outline"
                  }
                  className={cn(
                    "h-auto min-h-10 whitespace-normal py-2",
                    customerMode === "unregistered" && "ring-2 ring-primary"
                  )}
                  onClick={() => {
                    setCustomerMode("unregistered")
                    setSelectedCustomer(null)
                  }}
                >
                  Cliente no registrado
                </Button>
              </div>
            </div>

            {customerMode === "existing" ? (
              <>
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
              </>
            ) : (
              <QuickCustomerFields
                value={quickCustomerForm}
                onChange={setQuickCustomerForm}
              />
            )}

            <div className="grid gap-3 sm:grid-cols-2">
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
                  <SelectTrigger id="atencion-channel" className="w-full">
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
                  <SelectTrigger id="atencion-motivo" className="w-full">
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
              <Label htmlFor="atencion-detail">Descripcion</Label>
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
                placeholder="Descripcion de la consulta o problema"
              />
            </div>

            <div className="space-y-2">
              <Label>Resultado de la atención</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant={
                    form.decision === "resolver_ahora" ? "default" : "outline"
                  }
                  className={cn(
                    "h-auto min-h-10 whitespace-normal py-2",
                    form.decision === "resolver_ahora" && "ring-2 ring-primary"
                  )}
                  onClick={() => {
                    setContinuationArea("")
                    setForm((current) => ({
                      ...current,
                      decision: "resolver_ahora",
                      nextStep: "",
                    }))
                  }}
                >
                  Consulta resuelta durante el contacto
                </Button>
                <Button
                  type="button"
                  variant={
                    form.decision === "continuar_gestion" ? "default" : "outline"
                  }
                  className={cn(
                    "h-auto min-h-10 whitespace-normal py-2",
                    form.decision === "continuar_gestion" && "ring-2 ring-primary"
                  )}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      decision: "continuar_gestion",
                    }))
                  }
                >
                  Requiere continuar la gestión
                </Button>
              </div>
            </div>

            {form.decision === "resolver_ahora" ? (
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
                  placeholder="Que se hizo para resolver la consulta"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="atencion-continuation-area">
                    ¿Quién debe continuar la gestión?
                  </Label>
                  <Select
                    value={continuationArea}
                    onValueChange={(value) => {
                      const area = value as ContinuationArea
                      setContinuationArea(area)
                      const directNextStep = DIRECT_AREA_NEXT_STEP[area]
                      setForm((current) => ({
                        ...current,
                        nextStep: directNextStep ?? "",
                      }))
                    }}
                  >
                    <SelectTrigger
                      id="atencion-continuation-area"
                      className="w-full"
                    >
                      <SelectValue placeholder="Seleccionar área" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTINUATION_AREA_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {continuationArea === "atencion_cliente" ? (
                  <div className="space-y-2">
                    <Label htmlFor="atencion-next-step">
                      ¿Qué debe hacer Atención al Cliente?
                    </Label>
                    <Select
                      value={form.nextStep}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          nextStep: value as CustomerAtencionNextStep,
                        }))
                      }
                    >
                      <SelectTrigger id="atencion-next-step" className="w-full">
                        <SelectValue placeholder="Seleccionar una acción" />
                      </SelectTrigger>
                      <SelectContent>
                        {ATENCION_CLIENTE_NEXT_STEP_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {continuationArea === "administracion" ? (
                  <div className="space-y-2">
                    <Label htmlFor="atencion-admin-next-step">
                      Tipo de gestión administrativa
                    </Label>
                    <Select
                      value={form.nextStep}
                      onValueChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          nextStep: value as CustomerAtencionNextStep,
                        }))
                      }
                    >
                      <SelectTrigger
                        id="atencion-admin-next-step"
                        className="w-full"
                      >
                        <SelectValue placeholder="Seleccionar tipo de gestión" />
                      </SelectTrigger>
                      <SelectContent>
                        {ADMINISTRACION_NEXT_STEP_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {continuationArea === "tecnica" ? (
                  <p className="text-sm text-muted-foreground">
                    Derivar a Área Técnica
                  </p>
                ) : null}

                {continuationArea === "ventas" ? (
                  <p className="text-sm text-muted-foreground">
                    Derivar a Ventas
                  </p>
                ) : null}
              </div>
            )}

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={requestClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {submitLabel}
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
