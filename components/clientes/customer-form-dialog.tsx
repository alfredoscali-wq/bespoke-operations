"use client"

import { useEffect, useState } from "react"

import { useCustomers } from "@/components/clientes/customers-provider"
import type { Customer } from "@/lib/types/customers"
import { WORK_ORDER_TECHNOLOGY_OPTIONS } from "@/lib/tasks/work-order"
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

type CustomerFormState = {
  name: string
  phone: string
  email: string
  address: string
  locality: string
  technology: "" | "fiber" | "wireless"
  externalCustomerCode: string
  dni: string
}

const emptyForm: CustomerFormState = {
  name: "",
  phone: "",
  email: "",
  address: "",
  locality: "",
  technology: "",
  externalCustomerCode: "",
  dni: "",
}

function customerToForm(customer: Customer): CustomerFormState {
  return {
    name: customer.name,
    phone: customer.phone ?? "",
    email: customer.email ?? "",
    address: customer.address ?? "",
    locality: customer.locality ?? "",
    technology:
      customer.technology === "fiber" || customer.technology === "wireless"
        ? customer.technology
        : "",
    externalCustomerCode: customer.externalCustomerCode ?? "",
    dni: customer.dni ?? "",
  }
}

type CustomerFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: Customer | null
  onSuccess: (message: string) => void
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  onSuccess,
}: CustomerFormDialogProps) {
  const { createCustomer, updateCustomer } = useCustomers()
  const isEditMode = Boolean(customer)
  const [form, setForm] = useState<CustomerFormState>(emptyForm)
  const [baselineForm, setBaselineForm] = useState<CustomerFormState>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isDirty = isFormStateDirty(form, baselineForm)
  const {
    handleOpenChange,
    requestClose,
    forceClose,
    discardOpen,
    setDiscardOpen,
    confirmDiscard,
  } = useProtectedFormDialog({ open, onOpenChange, isDirty })

  useEffect(() => {
    if (open) {
      const nextForm = customer ? customerToForm(customer) : emptyForm
      setForm(nextForm)
      setBaselineForm(nextForm)
      setError(null)
    }
  }, [open, customer])

  function updateField<K extends keyof CustomerFormState>(
    key: K,
    value: CustomerFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!form.name.trim()) {
      setError("El nombre es obligatorio.")
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        locality: form.locality.trim() || undefined,
        technology: form.technology || undefined,
        status: "activo",
        validationStatus: "active" as const,
        externalCustomerCode: form.externalCustomerCode.trim() || undefined,
        dni: form.dni.trim() || undefined,
      }

      if (isEditMode && customer) {
        const result = await updateCustomer(customer.id, payload)

        if (!result.success) {
          setError(result.message ?? "No se pudo actualizar al cliente.")
          return
        }

        onSuccess(`Cliente ${payload.name} actualizado correctamente.`)
      } else {
        const result = await createCustomer(payload)

        if (!result.success) {
          setError(result.message ?? "No se pudo registrar al cliente.")
          return
        }

        onSuccess(`Cliente ${payload.name} registrado correctamente.`)
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
          className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
          onRequestClose={requestClose}
          isDirty={isDirty}
        >
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Editar Cliente" : "Nuevo Cliente"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Actualice los datos del cliente en el directorio maestro."
              : "Registre un nuevo cliente en el directorio maestro."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer-name">Nombre *</Label>
            <Input
              id="customer-name"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Juan Pérez"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customer-phone">Teléfono</Label>
              <Input
                id="customer-phone"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                placeholder="3511234567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="cliente@email.com"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customer-address">Dirección</Label>
              <Input
                id="customer-address"
                value={form.address}
                onChange={(event) => updateField("address", event.target.value)}
                placeholder="Calle 123"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-locality">Localidad</Label>
              <Input
                id="customer-locality"
                value={form.locality}
                onChange={(event) => updateField("locality", event.target.value)}
                placeholder="Córdoba"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customer-external-code">N° Cliente</Label>
              <Input
                id="customer-external-code"
                value={form.externalCustomerCode}
                onChange={(event) =>
                  updateField("externalCustomerCode", event.target.value)
                }
                placeholder="45872"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-dni">DNI</Label>
              <Input
                id="customer-dni"
                value={form.dni}
                onChange={(event) => updateField("dni", event.target.value)}
                placeholder="30123456"
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tecnología</Label>
            <Select
              value={form.technology || "none"}
              onValueChange={(value) =>
                updateField(
                  "technology",
                  value === "none" ? "" : (value as CustomerFormState["technology"])
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin especificar</SelectItem>
                {WORK_ORDER_TECHNOLOGY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={requestClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !form.name.trim()}>
              {isSubmitting
                ? "Guardando..."
                : isEditMode
                  ? "Guardar cambios"
                  : "Registrar cliente"}
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
