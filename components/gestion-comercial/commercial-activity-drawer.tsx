"use client"

import { useEffect, useMemo, useState } from "react"

import { CommercialDrawerFooter } from "@/components/gestion-comercial/commercial-drawer-footer"
import {
  useCreateCommercialActivity,
  useCommercialActivityTypes,
  useUpdateCommercialActivity,
} from "@/components/gestion-comercial/commercial-activities-provider"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DiscardChangesDialog,
  isFormStateDirty,
  useProtectedFormDialog,
} from "@/components/ui/protected-form-dialog"
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  COMMERCIAL_ACTIVITY_TYPE_LABELS,
  type CommercialActivityTypeCode,
} from "@/lib/commercial/activity-catalogs"
import {
  COMMERCIAL_ACTIVITY_RESULT_OPTIONS,
  COMMERCIAL_MANUAL_ACTIVITY_TYPES,
  type CommercialCommitmentPriority,
} from "@/lib/commercial/location"
import { listCommercialResponsibleOptions } from "@/lib/commercial/responsible-employees"
import type { CommercialActivityListItem } from "@/lib/types/commercial-activities"
import type { CommercialActivityResultMetadata } from "@/lib/types/commercial-commitments"
import type { CreateCommercialActivityPayload } from "@/lib/types/supabase/commercial-activities"

const FORM_ID = "commercial-activity-form"

type CreateCommitmentPayload = NonNullable<
  CreateCommercialActivityPayload["commitment"]
>

type ActivityFormValue = {
  activityTypeCode: CommercialActivityTypeCode
  title: string
  description: string
  result: string
  resultOther: string
  managementEnds: "yes" | "no" | ""
  nextStepTitle: string
  assignedEmployeeId: string
  dueDate: string
  dueTime: string
  priority: CommercialCommitmentPriority
}

function emptyForm(
  typeCode: CommercialActivityTypeCode = "llamada"
): ActivityFormValue {
  return {
    activityTypeCode: typeCode,
    title: "",
    description: "",
    result: "",
    resultOther: "",
    managementEnds: "",
    nextStepTitle: "",
    assignedEmployeeId: "",
    dueDate: "",
    dueTime: "10:00",
    priority: "media",
  }
}

function readResultMetadata(
  activity: CommercialActivityListItem
): CommercialActivityResultMetadata {
  const metadata = (activity.metadata ?? {}) as CommercialActivityResultMetadata
  return metadata
}

function fromActivity(activity: CommercialActivityListItem): ActivityFormValue {
  const meta = readResultMetadata(activity)
  const result = meta.result ?? ""
  const isOther =
    result === "Otro" ||
    (result !== "" &&
      !(COMMERCIAL_ACTIVITY_RESULT_OPTIONS as readonly string[]).includes(
        result
      ))
  return {
    activityTypeCode: activity.activityTypeCode,
    title: activity.title,
    description: activity.description,
    result: isOther ? "Otro" : result,
    resultOther: isOther && result !== "Otro" ? result : meta.resultOther ?? "",
    managementEnds: meta.nextStep ? "no" : "yes",
    nextStepTitle: meta.nextStep?.title ?? "",
    assignedEmployeeId: meta.nextStep?.assignedEmployeeId ?? "",
    dueDate: meta.nextStep?.dueAt
      ? meta.nextStep.dueAt.slice(0, 10)
      : "",
    dueTime: meta.nextStep?.dueAt
      ? new Date(meta.nextStep.dueAt).toTimeString().slice(0, 5)
      : "10:00",
    priority: meta.nextStep?.priority ?? "media",
  }
}

function resolveResultLabel(form: ActivityFormValue): string {
  if (form.result === "Otro") {
    return form.resultOther.trim() || "Otro"
  }
  return form.result.trim()
}

function buildDueAt(date: string, time: string): string | null {
  if (!date.trim()) return null
  const local = `${date.trim()}T${(time.trim() || "10:00").padStart(5, "0")}`
  const parsed = new Date(local)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

type CommercialActivityDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  opportunityId: string
  activity?: CommercialActivityListItem | null
  defaultTypeCode?: CommercialActivityTypeCode
}

export function CommercialActivityDrawer({
  open,
  onOpenChange,
  opportunityId,
  activity = null,
  defaultTypeCode = "llamada",
}: CommercialActivityDrawerProps) {
  const { data: types } = useCommercialActivityTypes()
  const { employees, isEmployeesReady } = useEmployees()
  const { mutateAsync: createActivity } = useCreateCommercialActivity()
  const { mutateAsync: updateActivity } = useUpdateCommercialActivity()

  const [form, setForm] = useState<ActivityFormValue>(emptyForm(defaultTypeCode))
  const [baseline, setBaseline] = useState<ActivityFormValue>(
    emptyForm(defaultTypeCode)
  )
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEdit = Boolean(activity)
  const isDirty = isFormStateDirty(form, baseline) && !isSubmitting

  const {
    handleOpenChange,
    requestClose,
    discardOpen,
    setDiscardOpen,
    confirmDiscard,
  } = useProtectedFormDialog({
    open,
    onOpenChange,
    isDirty,
  })

  const defaultEmployeeId = useMemo(() => {
    const options = listCommercialResponsibleOptions(employees)
    return options[0]?.id ?? ""
  }, [employees])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      const next = activity
        ? fromActivity(activity)
        : {
            ...emptyForm(defaultTypeCode),
            assignedEmployeeId: defaultEmployeeId,
          }
      setForm(next)
      setBaseline(next)
      setError(null)
      setIsSubmitting(false)
    })
    return () => {
      cancelled = true
    }
  }, [activity, defaultEmployeeId, defaultTypeCode, open])

  const typeOptions = useMemo(() => {
    const allowed = new Set<string>(COMMERCIAL_MANUAL_ACTIVITY_TYPES)
    const fromDb = types
      .filter((entry) => allowed.has(entry.code))
      .map((entry) => ({ code: entry.code, label: entry.label }))
    if (fromDb.length > 0) return fromDb
    return COMMERCIAL_MANUAL_ACTIVITY_TYPES.map((code) => ({
      code,
      label: COMMERCIAL_ACTIVITY_TYPE_LABELS[code],
    }))
  }, [types])

  const responsibleOptions = useMemo(
    () => listCommercialResponsibleOptions(employees),
    [employees]
  )

  function patch(partial: Partial<ActivityFormValue>) {
    setForm((current) => ({ ...current, ...partial }))
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = form.title.trim()
    if (!title) {
      setError("El título es obligatorio.")
      return
    }
    if (!form.result.trim()) {
      setError("Seleccione el resultado de la gestión.")
      return
    }
    if (form.result === "Otro" && !form.resultOther.trim()) {
      setError("Describa el resultado.")
      return
    }
    if (!isEdit && !form.managementEnds) {
      setError("Indique si la gestión termina aquí.")
      return
    }

    const resultLabel = resolveResultLabel(form)
    let commitment: CreateCommitmentPayload | null = null

    if (!isEdit && form.managementEnds === "no") {
      if (!form.nextStepTitle.trim()) {
        setError("Ingrese el próximo paso.")
        return
      }
      if (!form.assignedEmployeeId.trim()) {
        setError("Seleccione el responsable del compromiso.")
        return
      }
      const dueAt = buildDueAt(form.dueDate, form.dueTime)
      if (!dueAt) {
        setError("Ingrese fecha y hora del próximo paso.")
        return
      }
      commitment = {
        title: form.nextStepTitle.trim(),
        assignedEmployeeId: form.assignedEmployeeId,
        dueAt,
        priority: form.priority,
      }
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const metadata: CommercialActivityResultMetadata = {
        result: resultLabel,
        ...(form.result === "Otro"
          ? { resultOther: form.resultOther.trim() }
          : {}),
      }

      if (isEdit && activity) {
        const previous = readResultMetadata(activity)
        const result = await updateActivity({
          id: activity.id,
          payload: {
            activityTypeCode: form.activityTypeCode,
            title,
            description: form.description.trim(),
            scheduledAt: null,
            status: "completed",
            metadata: {
              ...previous,
              ...metadata,
              nextStep: previous.nextStep ?? null,
            },
          },
        })
        if (!result.success) {
          setError(result.message ?? "No se pudo actualizar la actividad.")
          return
        }
      } else {
        const result = await createActivity({
          opportunityId,
          activityTypeCode: form.activityTypeCode,
          title,
          description: form.description.trim(),
          scheduledAt: null,
          status: "completed",
          completedAt: new Date().toISOString(),
          metadata,
          commitment,
        })
        if (!result.success) {
          setError(result.message ?? "No se pudo crear la actividad.")
          return
        }
      }
      setBaseline(form)
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const showCommitmentStep = !isEdit && form.managementEnds === "no"

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {isEdit ? "Editar actividad" : "Nueva actividad"}
            </SheetTitle>
            <SheetDescription>
              Registrá un hecho ocurrido. Si hay trabajo futuro, se crea un
              compromiso aparte.
            </SheetDescription>
          </SheetHeader>

          <form
            id={FORM_ID}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Paso 1 · ¿Qué hiciste?
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="commercial-activity-type">Tipo</Label>
              <Select
                value={form.activityTypeCode}
                onValueChange={(value) =>
                  patch({
                    activityTypeCode: value as CommercialActivityTypeCode,
                  })
                }
                disabled={isSubmitting}
              >
                <SelectTrigger id="commercial-activity-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((option) => (
                    <SelectItem key={option.code} value={option.code}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="commercial-activity-title">Título</Label>
              <Input
                id="commercial-activity-title"
                value={form.title}
                onChange={(event) => patch({ title: event.target.value })}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="commercial-activity-description">
                Descripción
              </Label>
              <Textarea
                id="commercial-activity-description"
                value={form.description}
                onChange={(event) =>
                  patch({ description: event.target.value })
                }
                disabled={isSubmitting}
                rows={3}
              />
            </div>

            <div className="space-y-1 pt-2">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Paso 2 · ¿Qué ocurrió?
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="commercial-activity-result">Resultado</Label>
              <Select
                value={form.result || undefined}
                onValueChange={(value) => patch({ result: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger id="commercial-activity-result">
                  <SelectValue placeholder="Seleccionar resultado" />
                </SelectTrigger>
                <SelectContent>
                  {COMMERCIAL_ACTIVITY_RESULT_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.result === "Otro" ? (
              <div className="space-y-2">
                <Label htmlFor="commercial-activity-result-other">
                  Detalle del resultado
                </Label>
                <Input
                  id="commercial-activity-result-other"
                  value={form.resultOther}
                  onChange={(event) =>
                    patch({ resultOther: event.target.value })
                  }
                  disabled={isSubmitting}
                />
              </div>
            ) : null}

            {!isEdit ? (
              <>
                <div className="space-y-1 pt-2">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Paso 3 · ¿La gestión termina aquí?
                  </p>
                </div>

                <div className="flex gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="commercial-activity-ends"
                      checked={form.managementEnds === "yes"}
                      onChange={() => patch({ managementEnds: "yes" })}
                      disabled={isSubmitting}
                    />
                    Sí
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="commercial-activity-ends"
                      checked={form.managementEnds === "no"}
                      onChange={() =>
                        patch({
                          managementEnds: "no",
                          assignedEmployeeId:
                            form.assignedEmployeeId || defaultEmployeeId,
                        })
                      }
                      disabled={isSubmitting}
                    />
                    No
                  </label>
                </div>
              </>
            ) : null}

            {showCommitmentStep ? (
              <div className="space-y-4 rounded-md border p-3">
                <p className="text-sm font-medium">Próximo paso</p>
                <div className="space-y-2">
                  <Label htmlFor="commercial-activity-next-step">
                    Compromiso
                  </Label>
                  <Input
                    id="commercial-activity-next-step"
                    value={form.nextStepTitle}
                    onChange={(event) =>
                      patch({ nextStepTitle: event.target.value })
                    }
                    disabled={isSubmitting}
                    placeholder="Ej. Enviar presupuesto"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commercial-activity-commitment-owner">
                    Responsable
                  </Label>
                  <Select
                    value={form.assignedEmployeeId || undefined}
                    onValueChange={(value) =>
                      patch({ assignedEmployeeId: value })
                    }
                    disabled={isSubmitting || !isEmployeesReady}
                  >
                    <SelectTrigger id="commercial-activity-commitment-owner">
                      <SelectValue placeholder="Seleccionar responsable" />
                    </SelectTrigger>
                    <SelectContent>
                      {responsibleOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="commercial-activity-due-date">Fecha</Label>
                    <Input
                      id="commercial-activity-due-date"
                      type="date"
                      value={form.dueDate}
                      onChange={(event) =>
                        patch({ dueDate: event.target.value })
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="commercial-activity-due-time">Hora</Label>
                    <Input
                      id="commercial-activity-due-time"
                      type="time"
                      value={form.dueTime}
                      onChange={(event) =>
                        patch({ dueTime: event.target.value })
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commercial-activity-priority">
                    Prioridad
                  </Label>
                  <Select
                    value={form.priority}
                    onValueChange={(value) =>
                      patch({
                        priority: value as CommercialCommitmentPriority,
                      })
                    }
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="commercial-activity-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="media">Media</SelectItem>
                      <SelectItem value="baja">Baja</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : null}

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </form>

          <CommercialDrawerFooter
            formId={FORM_ID}
            isSubmitting={isSubmitting}
            onCancel={requestClose}
            submitLabel="Guardar"
          />
        </SheetContent>
      </Sheet>

      <DiscardChangesDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onConfirm={confirmDiscard}
      />
    </>
  )
}
