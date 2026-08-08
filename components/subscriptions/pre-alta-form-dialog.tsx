"use client"

import { useMemo, useState } from "react"

import { useEmployees } from "@/components/rrhh/employees-provider"
import { useSubscriptions } from "@/components/subscriptions/subscriptions-provider"
import {
  calculateProratedAmount,
  formatSubscriptionMoney,
} from "@/lib/subscriptions/proration"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
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
import { FILTER_SELECT_TRIGGER_CLASS } from "@/lib/ui/visual-tokens"

type PreAltaFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FormState = {
  firstName: string
  lastName: string
  dni: string
  phone: string
  email: string
  address: string
  city: string
  activationDate: string
  sellerEmployeeId: string
  commissionAmount: string
}

function todayInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function buildInitialForm(): FormState {
  return {
    firstName: "",
    lastName: "",
    dni: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    activationDate: todayInputValue(),
    sellerEmployeeId: "none",
    commissionAmount: "",
  }
}

export function PreAltaFormDialog({
  open,
  onOpenChange,
}: PreAltaFormDialogProps) {
  const { createPreAlta, bespokeTvService } = useSubscriptions()
  const { employees } = useEmployees()
  const [form, setForm] = useState<FormState>(buildInitialForm)
  const [baseline] = useState<FormState>(buildInitialForm)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isDirty = isFormStateDirty(form, baseline)
  const { handleOpenChange, requestClose, forceClose } =
    useProtectedFormDialog({
      open,
      onOpenChange,
      isDirty,
    })

  const monthlyPrice = bespokeTvService?.monthlyPrice ?? 0
  const prorated = useMemo(
    () => calculateProratedAmount(monthlyPrice, form.activationDate),
    [monthlyPrice, form.activationDate]
  )

  const activeEmployees = useMemo(
    () =>
      employees.filter(
        (employee) => employee.employmentStatus !== "inactive"
      ),
    [employees]
  )

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!bespokeTvService) {
      setError("No hay servicio Bespoke TV disponible. Aplicá la migración.")
      return
    }

    const commissionRaw = form.commissionAmount.trim()
    const commissionAmount =
      commissionRaw === "" ? undefined : Number(commissionRaw)
    if (
      commissionAmount !== undefined &&
      (!Number.isFinite(commissionAmount) || commissionAmount < 0)
    ) {
      setError("La comisión debe ser un monto válido.")
      return
    }

    setIsSubmitting(true)
    const result = await createPreAlta({
      serviceId: bespokeTvService.id,
      firstName: form.firstName,
      lastName: form.lastName,
      dni: form.dni,
      phone: form.phone,
      email: form.email || undefined,
      address: form.address || undefined,
      city: form.city || undefined,
      activationDate: form.activationDate,
      sellerEmployeeId:
        form.sellerEmployeeId === "none" ? null : form.sellerEmployeeId,
      commissionAmount,
    })
    setIsSubmitting(false)

    if (!result.success) {
      setError(result.message ?? "No se pudo crear la pre-alta.")
      return
    }

    forceClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <ProtectedFormDialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        onRequestClose={requestClose}
        isDirty={isDirty}
      >
        <DialogHeader>
          <DialogTitle>Nueva Pre-Alta</DialogTitle>
          <DialogDescription>
            Alta de suscriptor pendiente de pago para Bespoke TV.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sub-first-name">Nombre</Label>
              <Input
                id="sub-first-name"
                value={form.firstName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    firstName: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-last-name">Apellido</Label>
              <Input
                id="sub-last-name"
                value={form.lastName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    lastName: event.target.value,
                  }))
                }
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sub-dni">DNI</Label>
              <Input
                id="sub-dni"
                value={form.dni}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    dni: event.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-phone">Teléfono</Label>
              <Input
                id="sub-phone"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sub-email">Email</Label>
            <Input
              id="sub-email"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sub-address">Dirección</Label>
            <Input
              id="sub-address"
              value={form.address}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sub-city">Ciudad</Label>
              <Input
                id="sub-city"
                value={form.city}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    city: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-activation">Fecha de Alta</Label>
              <Input
                id="sub-activation"
                type="date"
                value={form.activationDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    activationDate: event.target.value,
                  }))
                }
                required
              />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">
              Servicio: {bespokeTvService?.name ?? "Bespoke TV"}
            </p>
            <div className="mt-2 grid gap-1 text-muted-foreground sm:grid-cols-2">
              <p>
                Abono Mensual:{" "}
                <span className="font-medium text-foreground">
                  {formatSubscriptionMoney(monthlyPrice)}
                </span>
              </p>
              <p>
                Proporcional Inicial:{" "}
                <span className="font-medium text-foreground">
                  {formatSubscriptionMoney(prorated)}
                </span>
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Vendedor</Label>
              <Select
                value={form.sellerEmployeeId}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    sellerEmployeeId: value,
                  }))
                }
              >
                <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                  <SelectValue placeholder="Sin vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin vendedor</SelectItem>
                  {activeEmployees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.preferredName?.trim() ||
                        `${employee.lastName}, ${employee.firstName}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-commission">Comisión (opcional)</Label>
              <Input
                id="sub-commission"
                type="number"
                min={0}
                step="0.01"
                value={form.commissionAmount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    commissionAmount: event.target.value,
                  }))
                }
                placeholder="0"
              />
            </div>
          </div>

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={requestClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting || !bespokeTvService}>
              {isSubmitting ? "Guardando…" : "Crear Pre-Alta"}
            </Button>
          </DialogFooter>
        </form>
      </ProtectedFormDialogContent>
    </Dialog>
  )
}
