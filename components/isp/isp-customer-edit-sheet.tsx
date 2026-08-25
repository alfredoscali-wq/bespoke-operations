"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { IspCustomerHeader } from "@/lib/isp/types"
import { WORK_ORDER_TECHNOLOGY_OPTIONS } from "@/lib/tasks/work-order"

type CustomerEditForm = {
  name: string
  dni: string
  phone: string
  whatsapp: string
  email: string
  address: string
  locality: string
  externalCustomerCode: string
  technology: "" | "fiber" | "wireless"
}

function headerToForm(customer: IspCustomerHeader): CustomerEditForm {
  return {
    name: customer.name,
    dni: customer.dni ?? "",
    phone: customer.phone ?? "",
    whatsapp: customer.whatsapp ?? "",
    email: customer.email ?? "",
    address: customer.address ?? "",
    locality: customer.locality ?? "",
    externalCustomerCode: customer.externalCustomerCode ?? "",
    technology:
      customer.technology === "fiber" || customer.technology === "wireless"
        ? customer.technology
        : "",
  }
}

export function IspCustomerEditSheet({
  open,
  customer,
  onClose,
  onSaved,
}: {
  open: boolean
  customer: IspCustomerHeader
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<CustomerEditForm>(headerToForm(customer))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(headerToForm(customer))
    setError(null)
  }, [customer, open])

  function updateField<K extends keyof CustomerEditForm>(
    key: K,
    value: CustomerEditForm[K]
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
    setSaving(true)
    try {
      const response = await fetch(`/api/isp/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          dni: form.dni.trim() || null,
          phone: form.phone.trim() || null,
          whatsapp: form.whatsapp.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          locality: form.locality.trim() || null,
          externalCustomerCode: form.externalCustomerCode.trim() || null,
          technology: form.technology || null,
        }),
      })
      const body = (await response.json()) as {
        success: boolean
        message?: string
      }
      if (!body.success) throw new Error(body.message)
      onSaved()
      onClose()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo actualizar al cliente."
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-y-auto sm:max-w-lg data-[side=right]:sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>Editar cliente</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 px-4 pb-4">
          <div className="space-y-2">
            <Label htmlFor="isp-customer-name">Nombre / Razón social *</Label>
            <Input
              id="isp-customer-name"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="isp-customer-dni">DNI / CUIT</Label>
              <Input
                id="isp-customer-dni"
                value={form.dni}
                onChange={(event) => updateField("dni", event.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="isp-customer-external-code">N° Cliente</Label>
              <Input
                id="isp-customer-external-code"
                value={form.externalCustomerCode}
                onChange={(event) =>
                  updateField("externalCustomerCode", event.target.value)
                }
                className="font-mono"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="isp-customer-phone">Teléfono</Label>
              <Input
                id="isp-customer-phone"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="isp-customer-whatsapp">WhatsApp</Label>
              <Input
                id="isp-customer-whatsapp"
                value={form.whatsapp}
                onChange={(event) => updateField("whatsapp", event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="isp-customer-email">Email</Label>
            <Input
              id="isp-customer-email"
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="isp-customer-address">Domicilio</Label>
              <Input
                id="isp-customer-address"
                value={form.address}
                onChange={(event) => updateField("address", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="isp-customer-locality">Localidad</Label>
              <Input
                id="isp-customer-locality"
                value={form.locality}
                onChange={(event) => updateField("locality", event.target.value)}
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
                  value === "none" ? "" : (value as CustomerEditForm["technology"])
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
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <SheetFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !form.name.trim()}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
