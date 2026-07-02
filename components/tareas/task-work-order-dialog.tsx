"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { DemoWriteBlockedError } from "@/lib/demo/demo-write-block"

import { useCustomers } from "@/components/clientes/customers-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { taskDefaultChecklist } from "@/components/tareas/task-form-dialog"
import { WorkOrderSchedulingFields } from "@/components/tareas/work-order-scheduling-fields"
import {
  formatCustomerAddressLabel,
  formatCustomerTechnologyLabel,
} from "@/lib/customers/format"
import {
  isCustomerEligibleForReconexion,
  validateReconexionCustomer,
} from "@/lib/customers/reconexion-eligibility"
import { validateCrewAssignment } from "@/lib/crews/status-workflow"
import {
  applySuggestedDurationPreset,
  buildWorkOrderCreatePayload,
  buildWorkOrderFormFromTask,
  buildWorkOrderUpdatePayload,
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
import {
  canAdminModifyWorkOrder,
} from "@/lib/tasks/work-order-admin-mutation"
import { WorkOrderCambioTecnologiaFields } from "@/components/tareas/work-order-cambio-tecnologia-fields"
import { WorkOrderCommercialFields } from "@/components/tareas/work-order-commercial-fields"
import { WorkOrderCambioDomicilioFields } from "@/components/tareas/work-order-cambio-domicilio-fields"
import { WorkOrderCustomerSyncDialog } from "@/components/tareas/work-order-customer-sync-dialog"
import { WorkOrderAmountToCollectField } from "@/components/tareas/work-order-amount-to-collect-field"
import { WorkOrderLocationSection } from "@/components/tareas/work-order-location-section"
import {
  buildCustomerSyncSnapshotFromCustomer,
  buildCustomerSyncSnapshotFromWorkOrderForm,
  buildCustomerUpdateFromSyncChanges,
  diffCustomerSyncSnapshots,
  shouldOfferCustomerSync,
  type CustomerSyncFieldChange,
  type CustomerSyncFieldKey,
} from "@/lib/tasks/customer-sync"
import { uploadPendingTaskReferencePhotos } from "@/lib/supabase/task-photos.browser"
import {
  TaskReferencePhotosPicker,
  revokePendingTaskReferencePhotos,
} from "@/components/tareas/task-reference-photos-picker"
import type { PendingTaskReferencePhoto, TaskPhotoUploadSummary } from "@/lib/types/task-photos"
import type { Customer } from "@/lib/types/customers"
import type { Task } from "@/lib/types/tasks"
import type { CreateTaskPayload, UpdateTaskPayload } from "@/lib/types/supabase/tasks"
import { Button } from "@/components/ui/button"
import { WhatsAppLink } from "@/components/ui/whatsapp-link"
import {
  Dialog,
  DialogContent,
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
export type TaskWorkOrderDialogMode = "create" | "edit"

type TaskWorkOrderDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingTasks: Task[]
  mode?: TaskWorkOrderDialogMode
  task?: Task
  onSubmit?: (payload: CreateTaskPayload) => Promise<Task>
  onUpdate?: (taskId: string, payload: UpdateTaskPayload) => Promise<Task>
  onTaskCreated?: (result: WorkOrderCreateResult) => void
  onTaskUpdated?: (task: Task) => void
  onEditBlocked?: () => void
}

export type WorkOrderCreateResult = {
  task: Task
  photoUpload: TaskPhotoUploadSummary
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
                    📞 <WhatsAppLink phone={customer.phone} />
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
          {form.customerPhone.trim() && (
            <p className="text-xs">
              <WhatsAppLink phone={form.customerPhone} />
            </p>
          )}
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
      {!isNewInstallationWorkOrder(form.serviceType) &&
        form.serviceType !== "cambio-domicilio" &&
        form.serviceType !== "cambio-tecnologia" && (
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
          <div className="space-y-2">
            <Label htmlFor="wo-locality">Localidad *</Label>
            <Input
              id="wo-locality"
              value={form.locality}
              onChange={(event) => updateField("locality", event.target.value)}
            />
          </div>
          <WorkOrderCommercialFields form={form} updateField={updateField} />
        </div>
      )

    case "cambio-domicilio":
      return (
        <WorkOrderCambioDomicilioFields form={form} updateField={updateField} />
      )

    case "cambio-tecnologia":
      return (
        <WorkOrderCambioTecnologiaFields form={form} updateField={updateField} />
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

function WorkOrderCrewInfoFields({
  form,
  updateField,
  referencePhotos,
  onReferencePhotosChange,
  photosDisabled,
  onPhotosError,
}: {
  form: WorkOrderFormInput
  updateField: <K extends keyof WorkOrderFormInput>(
    key: K,
    value: WorkOrderFormInput[K]
  ) => void
  referencePhotos: PendingTaskReferencePhoto[]
  onReferencePhotosChange: (photos: PendingTaskReferencePhoto[]) => void
  photosDisabled?: boolean
  onPhotosError?: (message: string | null) => void
}) {
  return (
    <section className="space-y-4">
      <SectionTitle>Información para la Cuadrilla</SectionTitle>
      <div className="space-y-2">
        <Label htmlFor="wo-observations-crew">
          Observaciones para la cuadrilla
        </Label>
        <Textarea
          id="wo-observations-crew"
          value={form.observationsForCrew}
          onChange={(event) =>
            updateField("observationsForCrew", event.target.value)
          }
          placeholder="Casa amarilla. Portón negro. Llamar antes de llegar."
          rows={3}
        />
      </div>
      <TaskReferencePhotosPicker
        photos={referencePhotos}
        onChange={onReferencePhotosChange}
        disabled={photosDisabled}
        onError={onPhotosError}
      />
    </section>
  )
}

export function TaskWorkOrderDialog({
  open,
  onOpenChange,
  existingTasks,
  mode = "create",
  task,
  onSubmit,
  onUpdate,
  onTaskCreated,
  onTaskUpdated,
  onEditBlocked,
}: TaskWorkOrderDialogProps) {
  const isEditMode = mode === "edit" && Boolean(task)
  const { searchCustomers, createCustomer, updateCustomer, fetchCustomerById } =
    useCustomers()
  const { crews } = useCrews()
  const [form, setForm] = useState<WorkOrderFormInput>(getDefaultWorkOrderForm)
  const [baselineForm, setBaselineForm] = useState<WorkOrderFormInput>(
    getDefaultWorkOrderForm
  )
  const [referencePhotos, setReferencePhotos] = useState<
    PendingTaskReferencePhoto[]
  >([])
  const [photosError, setPhotosError] = useState<string | null>(null)
  const [customerSelected, setCustomerSelected] = useState(false)
  const [linkedCustomer, setLinkedCustomer] = useState<Customer | null>(null)
  const [customerSyncState, setCustomerSyncState] = useState<{
    customer: Customer
    changes: CustomerSyncFieldChange[]
    task: Task
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)

  const isDirty =
    isFormStateDirty(form, baselineForm) || referencePhotos.length > 0
  const {
    handleOpenChange,
    requestClose,
    forceClose,
    discardOpen,
    setDiscardOpen,
    confirmDiscard,
  } = useProtectedFormDialog({ open, onOpenChange, isDirty })

  const handleCustomerSearch = useCallback(
    async (query: string) => {
      const items = await searchCustomers(query)

      if (form.serviceType === "reconexion") {
        return items.filter(isCustomerEligibleForReconexion)
      }

      return items
    },
    [searchCustomers, form.serviceType]
  )

  useEffect(() => {
    if (!open) {
      return
    }

    if (isEditMode && task) {
      if (!canAdminModifyWorkOrder(task.status)) {
        onOpenChange(false)
        onEditBlocked?.()
        return
      }

      const nextForm = buildWorkOrderFormFromTask(task)
      setForm(nextForm)
      setBaselineForm(nextForm)
      setReferencePhotos((current) => {
        revokePendingTaskReferencePhotos(current)
        return []
      })
      setPhotosError(null)
      setCustomerSelected(
        Boolean(task.customerId?.trim()) ||
          Boolean(task.customerName?.trim()) ||
          isNewInstallationWorkOrder(nextForm.serviceType)
      )
      setLinkedCustomer(null)
      setCustomerSyncState(null)
      setError(null)
      setSaveConfirmOpen(false)

      if (task.customerId?.trim()) {
        void fetchCustomerById(task.customerId).then((customer) => {
          if (customer) {
            setLinkedCustomer(customer)
          }
        })
      }

      return
    }

    const nextForm = getDefaultWorkOrderForm()
    setForm(nextForm)
    setBaselineForm(nextForm)
    setReferencePhotos((current) => {
      revokePendingTaskReferencePhotos(current)
      return []
    })
    setPhotosError(null)
    setCustomerSelected(false)
    setLinkedCustomer(null)
    setCustomerSyncState(null)
    setError(null)
    setSaveConfirmOpen(false)
  }, [open, isEditMode, task, fetchCustomerById, onOpenChange, onEditBlocked])

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
      ...applySuggestedDurationPreset(value),
    })
    setCustomerSelected(false)
    setLinkedCustomer(null)
    setError(null)
  }

  function handleCustomerSelect(customer: Customer) {
    setForm((current) => ({
      ...current,
      ...applyCustomerToForm(customer),
    }))
    setLinkedCustomer(customer)
    setCustomerSelected(true)
  }

  async function prepareCustomerSyncAfterCreate(
    task: Task,
    customerId: string,
    submittedForm: WorkOrderFormInput
  ) {
    if (
      !shouldOfferCustomerSync({
        customerId,
        serviceType: submittedForm.serviceType,
      })
    ) {
      return
    }

    const customer =
      linkedCustomer?.id === customerId
        ? linkedCustomer
        : await fetchCustomerById(customerId)

    if (!customer) {
      return
    }

    const changes = diffCustomerSyncSnapshots(
      buildCustomerSyncSnapshotFromCustomer(customer),
      buildCustomerSyncSnapshotFromWorkOrderForm(submittedForm)
    )

    if (changes.length === 0) {
      return
    }

    setCustomerSyncState({ customer, changes, task })
  }

  async function handleConfirmCustomerSync(selectedKeys: CustomerSyncFieldKey[]) {
    if (!customerSyncState) {
      return
    }

    const update = buildCustomerUpdateFromSyncChanges(
      customerSyncState.changes,
      selectedKeys
    )

    const result = await updateCustomer(
      customerSyncState.customer.id,
      update,
      {
        syncFromTask: {
          id: customerSyncState.task.id,
          code: customerSyncState.task.code,
        },
      }
    )

    if (!result.success) {
      throw new Error(result.message ?? "No se pudo actualizar la ficha del cliente.")
    }

    setCustomerSyncState(null)
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

  async function validateBeforeSave(): Promise<boolean> {
    const validation = validateWorkOrderForm(form)
    if (!validation.valid) {
      setError(validation.message ?? "Complete los campos obligatorios.")
      return false
    }

    const selectedCrew = crews.find((crew) => crew.id === form.crewId)
    const crewValidation = validateCrewAssignment(selectedCrew)
    if (!crewValidation.allowed) {
      setError(crewValidation.message ?? "Cuadrilla no disponible.")
      return false
    }

    return true
  }

  async function resolveCustomerIdForSave(): Promise<string | null> {
    let customerId = form.customerId.trim()

    if (isNewInstallationWorkOrder(form.serviceType)) {
      if (isEditMode) {
        return customerId || task?.customerId?.trim() || null
      }

      const customerResult = await createCustomer({
        name: form.customerName.trim(),
        phone: form.customerPhone.trim() || undefined,
        email: form.customerEmail.trim() || undefined,
        address: form.address.trim() || undefined,
        locality: form.locality.trim() || undefined,
        technology: form.technology || undefined,
      })

      if (!customerResult.success || !customerResult.customer) {
        throw new Error(customerResult.message ?? "No se pudo crear el cliente.")
      }

      return customerResult.customer.id
    }

    if (requiresCustomerLookup(form.serviceType) && !customerId) {
      setError("Seleccione un cliente registrado.")
      return null
    }

    if (form.serviceType === "reconexion") {
      const reconexionCustomer =
        linkedCustomer?.id === customerId
          ? linkedCustomer
          : await fetchCustomerById(customerId)

      const reconexionValidation = validateReconexionCustomer(reconexionCustomer)

      if (!reconexionValidation.valid) {
        setError(
          reconexionValidation.message ?? "Cliente no elegible para reconexión."
        )
        return null
      }
    }

    return customerId
  }

  async function performCreate(customerId: string) {
    if (!onSubmit) {
      throw new Error("No se configuró la acción de creación.")
    }

    const selectedCrew = crews.find((crew) => crew.id === form.crewId)
    const payload = buildWorkOrderCreatePayload({
      form,
      existingTasks,
      customerId,
      checklist: taskDefaultChecklist,
      crew: selectedCrew ?? null,
    })

    const createdTask = await onSubmit(payload)

    let photoUpload: TaskPhotoUploadSummary = {
      taskCreated: true,
      uploadedPhotos: 0,
      failedPhotos: 0,
    }

    if (referencePhotos.length > 0) {
      const uploadResult = await uploadPendingTaskReferencePhotos(
        createdTask.id,
        referencePhotos
      )
      photoUpload = uploadResult.summary
    }

    revokePendingTaskReferencePhotos(referencePhotos)
    setReferencePhotos([])
    onTaskCreated?.({ task: createdTask, photoUpload })
    await prepareCustomerSyncAfterCreate(createdTask, customerId, form)
    forceClose()
  }

  async function performEdit(customerId: string) {
    if (!task || !onUpdate) {
      throw new Error("No se configuró la acción de edición.")
    }

    const selectedCrew = crews.find((crew) => crew.id === form.crewId)
    const payload = buildWorkOrderUpdatePayload({
      form,
      task,
      customerId,
      crew: selectedCrew ?? null,
    })

    const updatedTask = await onUpdate(task.id, payload)

    if (referencePhotos.length > 0) {
      await uploadPendingTaskReferencePhotos(task.id, referencePhotos)
    }

    revokePendingTaskReferencePhotos(referencePhotos)
    setReferencePhotos([])
    onTaskUpdated?.(updatedTask)
    setSaveConfirmOpen(false)
    forceClose()
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (isEditMode && !isDirty) {
      forceClose()
      return
    }

    const valid = await validateBeforeSave()
    if (!valid) {
      return
    }

    if (isEditMode) {
      setSaveConfirmOpen(true)
      return
    }

    setIsSubmitting(true)

    try {
      const customerId = await resolveCustomerIdForSave()
      if (!customerId) {
        return
      }

      await performCreate(customerId)
    } catch (submitError) {
      if (submitError instanceof DemoWriteBlockedError) {
        return
      }

      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo crear la orden de trabajo."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleConfirmSaveChanges() {
    setError(null)
    setIsSubmitting(true)

    try {
      const customerId = await resolveCustomerIdForSave()
      if (!customerId) {
        return
      }

      await performEdit(customerId)
    } catch (submitError) {
      if (submitError instanceof DemoWriteBlockedError) {
        return
      }

      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo actualizar la orden de trabajo."
      )
      setSaveConfirmOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleConfirmDiscard() {
    revokePendingTaskReferencePhotos(referencePhotos)
    setReferencePhotos([])
    confirmDiscard()
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
            {isEditMode ? "Editar Orden de Trabajo" : "Nueva Orden de Trabajo"}
          </DialogTitle>
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

          {form.serviceType ? (
            <WorkOrderAmountToCollectField
              value={form.amountToCollect}
              onChange={(value) => updateField("amountToCollect", value)}
            />
          ) : null}

          {form.serviceType && form.serviceType !== "cambio-domicilio" ? (
            <WorkOrderLocationSection
              sharedLocation={form.sharedLocation}
              onSharedLocationChange={(value) =>
                updateField("sharedLocation", value)
              }
            />
          ) : null}

          {showScheduling ? (
            <WorkOrderSchedulingFields form={form} updateField={updateField} />
          ) : null}

          {showScheduling && (
            <WorkOrderCrewInfoFields
              form={form}
              updateField={updateField}
              referencePhotos={referencePhotos}
              onReferencePhotosChange={setReferencePhotos}
              photosDisabled={isSubmitting}
              onPhotosError={setPhotosError}
            />
          )}

          {showScheduling && (
            <section className="space-y-4">
              <SectionTitle>Observaciones</SectionTitle>
              <Textarea
                value={form.observations}
                onChange={(event) =>
                  updateField("observations", event.target.value)
                }
                placeholder="Notas administrativas internas"
                rows={3}
              />
            </section>
          )}

          {photosError && (
            <p className="text-sm text-amber-600 dark:text-amber-500" role="alert">
              {photosError}
            </p>
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
              onClick={requestClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !form.serviceType}
            >
              {isSubmitting
                ? "Guardando..."
                : isEditMode
                  ? "Guardar cambios"
                  : "Guardar orden"}
            </Button>
          </DialogFooter>
        </form>
        </ProtectedFormDialogContent>
      </Dialog>

      <DiscardChangesDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onConfirm={handleConfirmDiscard}
      />

      <Dialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Guardar modificaciones</DialogTitle>
            <DialogDescription>
              Se detectaron cambios en la Orden de Trabajo. ¿Desea guardar las
              modificaciones?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSaveConfirmOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirmSaveChanges()}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WorkOrderCustomerSyncDialog
        open={customerSyncState != null}
        onOpenChange={(open) => {
          if (!open) {
            setCustomerSyncState(null)
          }
        }}
        customerName={customerSyncState?.customer.name ?? ""}
        changes={customerSyncState?.changes ?? []}
        onConfirm={handleConfirmCustomerSync}
        onSkip={() => setCustomerSyncState(null)}
      />
    </>
  )
}
