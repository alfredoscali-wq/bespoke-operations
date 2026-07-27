"use client"

import { useEffect, useMemo, useState } from "react"

import { CommercialDrawerFooter } from "@/components/gestion-comercial/commercial-drawer-footer"
import {
  useCreateCommercialActivity,
  useCommercialActivityTypes,
  useUpdateCommercialActivity,
} from "@/components/gestion-comercial/commercial-activities-provider"
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
  COMMERCIAL_ACTIVITY_STATUS_LABELS,
  COMMERCIAL_ACTIVITY_STATUSES,
  COMMERCIAL_ACTIVITY_TYPE_CODES,
  COMMERCIAL_ACTIVITY_TYPE_LABELS,
  type CommercialActivityStatus,
  type CommercialActivityTypeCode,
} from "@/lib/commercial/activity-catalogs"
import type { CommercialActivityListItem } from "@/lib/types/commercial-activities"

const FORM_ID = "commercial-activity-form"

type ActivityFormValue = {
  activityTypeCode: CommercialActivityTypeCode
  title: string
  description: string
  scheduledAtLocal: string
  status: CommercialActivityStatus
}

function toLocalDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function fromLocalDateTimeInput(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function emptyForm(
  typeCode: CommercialActivityTypeCode = "nota"
): ActivityFormValue {
  return {
    activityTypeCode: typeCode,
    title: "",
    description: "",
    scheduledAtLocal: "",
    status: "pending",
  }
}

function fromActivity(activity: CommercialActivityListItem): ActivityFormValue {
  return {
    activityTypeCode: activity.activityTypeCode,
    title: activity.title,
    description: activity.description,
    scheduledAtLocal: toLocalDateTimeInput(activity.scheduledAt),
    status: activity.status,
  }
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
  defaultTypeCode = "nota",
}: CommercialActivityDrawerProps) {
  const { data: types } = useCommercialActivityTypes()
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

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      const next = activity
        ? fromActivity(activity)
        : emptyForm(defaultTypeCode)
      setForm(next)
      setBaseline(next)
      setError(null)
      setIsSubmitting(false)
    })
    return () => {
      cancelled = true
    }
  }, [activity, defaultTypeCode, open])

  const typeOptions = useMemo(() => {
    if (types.length > 0) {
      return types.map((entry) => ({
        code: entry.code,
        label: entry.label,
      }))
    }
    return COMMERCIAL_ACTIVITY_TYPE_CODES.map((code) => ({
      code,
      label: COMMERCIAL_ACTIVITY_TYPE_LABELS[code],
    }))
  }, [types])

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

    setIsSubmitting(true)
    setError(null)
    try {
      const scheduledAt = fromLocalDateTimeInput(form.scheduledAtLocal)
      if (isEdit && activity) {
        const result = await updateActivity({
          id: activity.id,
          payload: {
            activityTypeCode: form.activityTypeCode,
            title,
            description: form.description.trim(),
            scheduledAt,
            status: form.status,
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
          scheduledAt,
          status: form.status,
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

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {isEdit ? "Editar actividad" : "Nueva actividad"}
            </SheetTitle>
            <SheetDescription>
              Registrá una interacción comercial sobre la oportunidad.
            </SheetDescription>
          </SheetHeader>

          <form
            id={FORM_ID}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
            onSubmit={(event) => void handleSubmit(event)}
          >
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
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="commercial-activity-scheduled">
                Fecha programada
              </Label>
              <Input
                id="commercial-activity-scheduled"
                type="datetime-local"
                value={form.scheduledAtLocal}
                onChange={(event) =>
                  patch({ scheduledAtLocal: event.target.value })
                }
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="commercial-activity-status">Estado</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  patch({ status: value as CommercialActivityStatus })
                }
                disabled={isSubmitting}
              >
                <SelectTrigger id="commercial-activity-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMERCIAL_ACTIVITY_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {COMMERCIAL_ACTIVITY_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
