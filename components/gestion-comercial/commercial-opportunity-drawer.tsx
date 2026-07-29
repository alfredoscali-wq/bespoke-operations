"use client"

import { useEffect, useMemo, useState } from "react"

import { CommercialDrawerFooter } from "@/components/gestion-comercial/commercial-drawer-footer"
import { CommercialOpportunityForm } from "@/components/gestion-comercial/commercial-opportunity-form"
import { useUpdateOpportunity } from "@/components/gestion-comercial/commercial-provider"
import { useEmployees } from "@/components/rrhh/employees-provider"
import {
  DiscardChangesDialog,
  isFormStateDirty,
  useProtectedFormDialog,
} from "@/components/ui/protected-form-dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  parseOptionalAmount,
  parseOptionalProbability,
  type CommercialOpportunityFormValue,
  validateCommercialOpportunityForm,
} from "@/lib/commercial/display"
import { listCommercialResponsibleOptions } from "@/lib/commercial/responsible-employees"
import type { CommercialOpportunity } from "@/lib/types/commercial"

const FORM_ID = "commercial-edit-opportunity-form"

function toFormValue(
  opportunity: CommercialOpportunity
): CommercialOpportunityFormValue {
  return {
    title: opportunity.title,
    assignedEmployeeId: opportunity.assignedEmployeeId ?? "",
    source: opportunity.source,
    priority: opportunity.priority,
    observations: opportunity.description,
    latitude: opportunity.latitude,
    longitude: opportunity.longitude,
    locationSource: opportunity.locationSource,
    status: opportunity.status,
    estimatedAmount:
      opportunity.estimatedAmount === null ||
      opportunity.estimatedAmount === undefined
        ? ""
        : String(opportunity.estimatedAmount),
    probability:
      opportunity.probability === null || opportunity.probability === undefined
        ? ""
        : String(opportunity.probability),
    expectedCloseDate: opportunity.expectedCloseDate ?? "",
    lostReason: opportunity.lostReason,
  }
}

type CommercialOpportunityDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  opportunity: CommercialOpportunity | null
  onUpdated?: (opportunity: CommercialOpportunity) => void
}

export function CommercialOpportunityDrawer({
  open,
  onOpenChange,
  opportunity,
  onUpdated,
}: CommercialOpportunityDrawerProps) {
  const { employees, isEmployeesReady } = useEmployees()
  const { mutateAsync: updateOpportunity } = useUpdateOpportunity()
  const [form, setForm] = useState<CommercialOpportunityFormValue | null>(null)
  const [baseline, setBaseline] =
    useState<CommercialOpportunityFormValue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isDirty =
    Boolean(form && baseline && isFormStateDirty(form, baseline)) &&
    !isSubmitting
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
    if (!open || !opportunity) return
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      const next = toFormValue(opportunity)
      setForm(next)
      setBaseline(next)
      setError(null)
      setIsSubmitting(false)
    })
    return () => {
      cancelled = true
    }
  }, [open, opportunity])

  const responsibleOptions = useMemo(
    () => listCommercialResponsibleOptions(employees),
    [employees]
  )

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!opportunity || !form) return
    setError(null)

    const validationError = validateCommercialOpportunityForm(form)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    try {
      const result = await updateOpportunity({
        id: opportunity.id,
        payload: {
          title: form.title,
          status: form.status,
          priority: form.priority,
          source: form.source,
          assignedEmployeeId: form.assignedEmployeeId || null,
          estimatedAmount: parseOptionalAmount(form.estimatedAmount),
          probability: parseOptionalProbability(form.probability),
          expectedCloseDate: form.expectedCloseDate.trim() || null,
          description: form.observations,
          lostReason: form.status === "perdida" ? form.lostReason : "",
          latitude: form.latitude,
          longitude: form.longitude,
          locationSource: form.locationSource,
        },
      })
      if (!result.success || !result.data) {
        setError(result.message ?? "No se pudo actualizar el cliente.")
        return
      }
      onUpdated?.(result.data)
      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo actualizar el cliente."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
          onEscapeKeyDown={(event) => {
            if (isDirty) {
              event.preventDefault()
              requestClose()
            }
          }}
        >
          <SheetHeader className="border-b">
            <SheetTitle>Editar Cliente</SheetTitle>
            <SheetDescription>
              Actualice el expediente comercial sin salir de esta pantalla.
            </SheetDescription>
          </SheetHeader>

          {form ? (
            <form
              id={FORM_ID}
              onSubmit={(event) => void handleSubmit(event)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
                <CommercialOpportunityForm
                  value={form}
                  onChange={(next) =>
                    setForm(next as CommercialOpportunityFormValue)
                  }
                  responsibleOptions={responsibleOptions}
                  disabled={isSubmitting || !isEmployeesReady}
                  showExtendedFields
                />
                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
              <CommercialDrawerFooter
                formId={FORM_ID}
                isSubmitting={isSubmitting}
                onCancel={requestClose}
                submitLabel="Guardar Cliente"
              />
            </form>
          ) : null}
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
