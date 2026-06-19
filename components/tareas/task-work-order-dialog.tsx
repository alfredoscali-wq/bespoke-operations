"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { useCustomers } from "@/components/clientes/customers-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { taskDefaultChecklist } from "@/components/tareas/task-form-dialog"
import {
  formatCustomerAddressLabel,
  formatCustomerTechnologyLabel,
} from "@/lib/customers/format"
import {
  getAssignableCrews,
  validateCrewAssignment,
} from "@/lib/crews/status-workflow"
import { resolveCrewSnapshotsForAssignment } from "@/lib/tasks/crew-relation"
import {
  buildWorkOrderCreatePayload,
  getDefaultWorkOrderForm,
  isNewInstallationWorkOrder,
  requiresCustomerLookup,
  SERVICE_TECHNICAL_REASON_OPTIONS,
  validateWorkOrderForm,
  WORK_ORDER_SERVICE_TYPE_OPTIONS,
  WORK_ORDER_TECHNOLOGY_OPTIONS,
  type WorkOrderFormInput,
  type WorkOrderServiceType,
} from "@/lib/tasks/work-order"
import { resolveSupervisorFromCrew } from "@/lib/tasks/utils"
import type { Customer } from "@/lib/types/customers"
import type { Task } from "@/lib/types/tasks"
import type { CreateTaskPayload } from "@/lib/types/supabase/tasks"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
type TaskWorkOrderDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingTasks: Task[]
  onSubmit: (payload: CreateTaskPayload) => Promise<void>
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-foreground">{children}</h3>
  )
}

function TechnologySelect({
  value,
  onChange,
  id,
  placeholder = "Seleccionar",
}: {
  value: WorkOrderFormInput["technology"]
  onChange: (value: WorkOrderFormInput["technology"]) => void
  id?: string
  placeholder?: string
}) {
  return (
    <Select
      value={value || undefined}
      onValueChange={(nextValue) =>
        onChange(nextValue as WorkOrderFormInput["technology"])
      }
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {WORK_ORDER_TECHNOLOGY_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
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
      <Label htmlFor="wo-customer-search">Buscar cliente</Label>
      <Input
        id="wo-customer-search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setIsOpen(true)
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 150)
        }}
        placeholder="Número, nombre, teléfono o dirección"
        autoComplete="off"
      />
      {isOpen && isSearching && (
        <p className="text-xs text-muted-foreground">Buscando clientes...</p>
      )}
      {isOpen && !isSearching && results.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
          {results.map((customer) => {
            const addressLabel = formatCustomerAddressLabel(customer)
            const technologyLabel = formatCustomerTechnologyLabel(
              customer.technology
            )

            return (
              <button
                key={customer.id}
                type="button"
                className="flex w-full flex-col gap-1 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onSelect(customer)
                  setQuery(customer.name)
                  setIsOpen(false)
                }}
              >
                <span className="font-mono text-[11px] font-medium text-primary">
                  {customer.customerNumber}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {customer.name}
                </span>
                {addressLabel && (
                  <span className="text-xs text-muted-foreground">
                    📍 {addressLabel}
                  </span>
                )}
                {customer.phone && (
                  <span className="text-xs text-muted-foreground">
                    📞 {customer.phone}
                  </span>
                )}
                {technologyLabel && (
                  <span className="text-xs text-muted-foreground">
                    🌐 {technologyLabel}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
      {isOpen && !isSearching && query.trim() && results.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No se encontraron clientes registrados.
        </p>
      )}
    </div>
  )
}

function CustomerFields({
  form,
  updateField,
  readOnlyContact = false,
}: {
  form: WorkOrderFormInput
  updateField: <K extends keyof WorkOrderFormInput>(
    key: K,
    value: WorkOrderFormInput[K]
  ) => void
  readOnlyContact?: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="wo-customer-name">Nombre *</Label>
        <Input
          id="wo-customer-name"
          value={form.customerName}
          onChange={(event) => updateField("customerName", event.target.value)}
          readOnly={readOnlyContact}
          className={readOnlyContact ? "bg-muted/40" : undefined}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="wo-phone">Teléfono</Label>
          <Input
            id="wo-phone"
            value={form.customerPhone}
            onChange={(event) =>
              updateField("customerPhone", event.target.value)
            }
            readOnly={readOnlyContact}
            className={readOnlyContact ? "bg-muted/40" : undefined}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wo-email">Email</Label>
          <Input
            id="wo-email"
            type="email"
            value={form.customerEmail}
            onChange={(event) =>
              updateField("customerEmail", event.target.value)
            }
          />
        </div>
      </div>
      {!isNewInstallationWorkOrder(form.serviceType) && (
        <>
          <div className="space-y-2">
            <Label htmlFor="wo-address">Dirección</Label>
            <Input
              id="wo-address"
              value={form.address}
              onChange={(event) => updateField("address", event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wo-locality">Localidad</Label>
              <Input
                id="wo-locality"
                value={form.locality}
                onChange={(event) => updateField("locality", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tecnología</Label>
              <TechnologySelect
                value={form.technology}
                onChange={(value) => updateField("technology", value)}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function WorkOrderDynamicFields({
  form,
  updateField,
}: {
  form: WorkOrderFormInput
  updateField: <K extends keyof WorkOrderFormInput>(
    key: K,
    value: WorkOrderFormInput[K]
  ) => void
}) {
  switch (form.serviceType) {
    case "instalacion-nueva":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wo-address">Dirección *</Label>
            <Input
              id="wo-address"
              value={form.address}
              onChange={(event) => updateField("address", event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wo-locality">Localidad *</Label>
              <Input
                id="wo-locality"
                value={form.locality}
                onChange={(event) => updateField("locality", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tecnología *</Label>
              <TechnologySelect
                value={form.technology}
                onChange={(value) => updateField("technology", value)}
              />
            </div>
          </div>
        </div>
      )

    case "cambio-domicilio":
      return (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wo-current-address">Dirección actual *</Label>
              <Input
                id="wo-current-address"
                value={form.currentAddress}
                onChange={(event) =>
                  updateField("currentAddress", event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wo-new-address">Nueva dirección *</Label>
              <Input
                id="wo-new-address"
                value={form.newAddress}
                onChange={(event) => updateField("newAddress", event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wo-current-locality">Localidad actual *</Label>
              <Input
                id="wo-current-locality"
                value={form.currentLocality}
                onChange={(event) =>
                  updateField("currentLocality", event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wo-new-locality">Nueva localidad *</Label>
              <Input
                id="wo-new-locality"
                value={form.newLocality}
                onChange={(event) =>
                  updateField("newLocality", event.target.value)
                }
              />
            </div>
          </div>
        </div>
      )

    case "cambio-tecnologia":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tecnología actual *</Label>
            <TechnologySelect
              value={form.currentTechnology}
              onChange={(value) => updateField("currentTechnology", value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Nueva tecnología *</Label>
            <TechnologySelect
              value={form.newTechnology}
              onChange={(value) => updateField("newTechnology", value)}
            />
          </div>
        </div>
      )

    case "service-tecnico":
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Motivo *</Label>
            <Select
              value={form.serviceReason || undefined}
              onValueChange={(value) =>
                updateField(
                  "serviceReason",
                  value as WorkOrderFormInput["serviceReason"]
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar motivo" />
              </SelectTrigger>
              <SelectContent>
                {SERVICE_TECHNICAL_REASON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="wo-service-detail">Detalle *</Label>
            <Textarea
              id="wo-service-detail"
              value={form.serviceDetail}
              onChange={(event) =>
                updateField("serviceDetail", event.target.value)
              }
              rows={3}
            />
          </div>
        </div>
      )

    case "baja":
      return (
        <div className="space-y-2">
          <Label htmlFor="wo-cancellation-reason">Motivo de baja *</Label>
          <Textarea
            id="wo-cancellation-reason"
            value={form.cancellationReason}
            onChange={(event) =>
              updateField("cancellationReason", event.target.value)
            }
            rows={3}
          />
        </div>
      )

    case "retiro-equipos":
      return (
        <div className="space-y-2">
          <Label htmlFor="wo-equipment">Equipo a retirar *</Label>
          <Textarea
            id="wo-equipment"
            value={form.equipmentToRemove}
            onChange={(event) =>
              updateField("equipmentToRemove", event.target.value)
            }
            rows={3}
          />
        </div>
      )

    case "relevamiento":
      return (
        <div className="space-y-2">
          <Label htmlFor="wo-survey-reason">Motivo del relevamiento *</Label>
          <Textarea
            id="wo-survey-reason"
            value={form.surveyReason}
            onChange={(event) => updateField("surveyReason", event.target.value)}
            rows={3}
          />
        </div>
      )

    case "postventa":
      return (
        <div className="space-y-2">
          <Label htmlFor="wo-postventa-detail">Detalle *</Label>
          <Textarea
            id="wo-postventa-detail"
            value={form.postventaDetail}
            onChange={(event) =>
              updateField("postventaDetail", event.target.value)
            }
            rows={3}
          />
        </div>
      )

    case "reconexion":
      return null

    default:
      return null
  }
}

function applyCustomerToForm(
  customer: Customer
): Partial<WorkOrderFormInput> {
  const technology =
    customer.technology === "fiber" || customer.technology === "wireless"
      ? customer.technology
      : ""

  return {
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone ?? "",
    customerEmail: customer.email ?? "",
    address: customer.address ?? "",
    locality: customer.locality ?? "",
    technology,
    currentAddress: customer.address ?? "",
    currentLocality: customer.locality ?? "",
    currentTechnology: technology,
  }
}

export function TaskWorkOrderDialog({
  open,
  onOpenChange,
  existingTasks,
  onSubmit,
}: TaskWorkOrderDialogProps) {
  const { crews } = useCrews()
  const { searchCustomers, createCustomer } = useCustomers()
  const assignableCrews = useMemo(() => getAssignableCrews(crews), [crews])
  const [form, setForm] = useState<WorkOrderFormInput>(getDefaultWorkOrderForm)
  const [customerSelected, setCustomerSelected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCustomerSearch = useCallback(
    (query: string) => searchCustomers(query),
    [searchCustomers]
  )

  useEffect(() => {
    if (open) {
      setForm(getDefaultWorkOrderForm())
      setCustomerSelected(false)
      setError(null)
    }
  }, [open])

  function updateField<K extends keyof WorkOrderFormInput>(
    key: K,
    value: WorkOrderFormInput[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleServiceTypeChange(value: WorkOrderServiceType) {
    setForm({
      ...getDefaultWorkOrderForm(),
      serviceType: value,
      scheduledDate: form.scheduledDate,
    })
    setCustomerSelected(false)
    setError(null)
  }

  function handleCustomerSelect(customer: Customer) {
    setForm((current) => ({
      ...current,
      ...applyCustomerToForm(customer),
    }))
    setCustomerSelected(true)
  }

  const showCustomerSection =
    Boolean(form.serviceType) &&
    (isNewInstallationWorkOrder(form.serviceType) ||
      (requiresCustomerLookup(form.serviceType) && customerSelected))

  const showCustomerLookup =
    requiresCustomerLookup(form.serviceType) && !customerSelected

  const showDynamicFields =
    Boolean(form.serviceType) &&
    (isNewInstallationWorkOrder(form.serviceType) || customerSelected)

  const showScheduling =
    Boolean(form.serviceType) &&
    (isNewInstallationWorkOrder(form.serviceType) || customerSelected)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const validation = validateWorkOrderForm(form)
    if (!validation.valid) {
      setError(validation.message ?? "Complete los campos obligatorios.")
      return
    }

    const selectedCrew = form.crewId
      ? assignableCrews.find((crew) => crew.id === form.crewId)
      : undefined

    if (form.crewId) {
      const crewValidation = validateCrewAssignment(selectedCrew)
      if (!crewValidation.allowed) {
        setError(crewValidation.message ?? "Cuadrilla no disponible.")
        return
      }
    }

    setIsSubmitting(true)

    try {
      let customerId = form.customerId.trim()

      if (isNewInstallationWorkOrder(form.serviceType)) {
        const customerResult = await createCustomer({
          name: form.customerName.trim(),
          phone: form.customerPhone.trim() || undefined,
          email: form.customerEmail.trim() || undefined,
          address: form.address.trim() || undefined,
          locality: form.locality.trim() || undefined,
          technology: form.technology || undefined,
        })

        if (!customerResult.success || !customerResult.customer) {
          throw new Error(
            customerResult.message ?? "No se pudo crear el cliente."
          )
        }

        customerId = customerResult.customer.id
      } else if (requiresCustomerLookup(form.serviceType) && !customerId) {
        setError("Seleccione un cliente registrado.")
        setIsSubmitting(false)
        return
      }

      const snapshots = resolveCrewSnapshotsForAssignment(selectedCrew)
      const payload = buildWorkOrderCreatePayload({
        form,
        existingTasks,
        customerId,
        crewId: form.crewId ? snapshots.crewId : null,
        crewName: snapshots.crew,
        supervisor:
          resolveSupervisorFromCrew(selectedCrew) || snapshots.supervisor,
        checklist: taskDefaultChecklist,
      })

      await onSubmit(payload)
      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo crear la orden de trabajo."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva Orden de Trabajo</DialogTitle>
          <DialogDescription>
            Seleccione el tipo de trabajo y complete los datos operativos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="space-y-4">
            <SectionTitle>Tipo de trabajo *</SectionTitle>
            <Select
              value={form.serviceType || undefined}
              onValueChange={(value) =>
                handleServiceTypeChange(value as WorkOrderServiceType)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo de trabajo" />
              </SelectTrigger>
              <SelectContent>
                {WORK_ORDER_SERVICE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          {showCustomerLookup && (
            <section className="space-y-4">
              <CustomerSearchField
                onSearch={handleCustomerSearch}
                onSelect={handleCustomerSelect}
              />
            </section>
          )}

          {showCustomerSection && (
            <section className="space-y-4">
              <SectionTitle>
                {isNewInstallationWorkOrder(form.serviceType)
                  ? "Datos del cliente"
                  : "Cliente"}
              </SectionTitle>
              <CustomerFields
                form={form}
                updateField={updateField}
                readOnlyContact={
                  requiresCustomerLookup(form.serviceType) && customerSelected
                }
              />
            </section>
          )}

          {showDynamicFields && form.serviceType && (
            <section className="space-y-4">
              <SectionTitle>Datos del trabajo</SectionTitle>
              <WorkOrderDynamicFields form={form} updateField={updateField} />
            </section>
          )}

          {showScheduling && (
            <section className="space-y-4">
              <SectionTitle>Programación</SectionTitle>
              <div className="space-y-2">
                <Label htmlFor="wo-scheduled-date">Fecha programada *</Label>
                <Input
                  id="wo-scheduled-date"
                  type="date"
                  value={form.scheduledDate}
                  onChange={(event) =>
                    updateField("scheduledDate", event.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Cuadrilla</Label>
                <Select
                  value={form.crewId || "none"}
                  onValueChange={(value) =>
                    updateField("crewId", value === "none" ? "" : value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sin cuadrilla" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin cuadrilla</SelectItem>
                    {assignableCrews.map((crew) => (
                      <SelectItem key={crew.id} value={crew.id}>
                        {crew.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>
          )}

          {showScheduling && (
            <section className="space-y-4">
              <SectionTitle>Observaciones</SectionTitle>
              <Textarea
                value={form.observations}
                onChange={(event) =>
                  updateField("observations", event.target.value)
                }
                placeholder="Información adicional para la cuadrilla"
                rows={3}
              />
            </section>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !form.serviceType}
            >
              {isSubmitting ? "Guardando..." : "Guardar orden"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
