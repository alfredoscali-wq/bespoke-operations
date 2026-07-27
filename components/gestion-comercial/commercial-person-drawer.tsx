"use client"

import { useEffect, useState } from "react"

import { CommercialDrawerFooter } from "@/components/gestion-comercial/commercial-drawer-footer"
import { CommercialPersonForm } from "@/components/gestion-comercial/commercial-person-form"
import { useUpdateCommercialPerson } from "@/components/gestion-comercial/commercial-provider"
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
  type CommercialPersonFormValue,
  validateCommercialPersonForm,
} from "@/lib/commercial/display"
import type { CommercialPerson } from "@/lib/types/commercial"

const FORM_ID = "commercial-edit-person-form"

function toFormValue(person: CommercialPerson): CommercialPersonFormValue {
  return {
    personType: person.personType,
    firstName: person.firstName,
    lastName: person.lastName,
    companyName: person.companyName,
    phone: person.phone,
    mobile: person.mobile,
    email: person.email,
    documentNumber: person.documentNumber,
    taxId: person.taxId,
    address: person.address,
    city: person.city,
    province: person.province,
    postalCode: person.postalCode,
    notes: person.notes,
  }
}

type CommercialPersonDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: CommercialPerson | null
  onUpdated?: (person: CommercialPerson) => void
}

export function CommercialPersonDrawer({
  open,
  onOpenChange,
  person,
  onUpdated,
}: CommercialPersonDrawerProps) {
  const { mutateAsync: updatePerson } = useUpdateCommercialPerson()
  const [form, setForm] = useState<CommercialPersonFormValue | null>(null)
  const [baseline, setBaseline] = useState<CommercialPersonFormValue | null>(
    null
  )
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
    if (!open || !person) return
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      const next = toFormValue(person)
      setForm(next)
      setBaseline(next)
      setError(null)
      setIsSubmitting(false)
    })
    return () => {
      cancelled = true
    }
  }, [open, person])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!person || !form) return
    setError(null)

    const validationError = validateCommercialPersonForm(form)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    try {
      const result = await updatePerson({
        id: person.id,
        payload: {
          personType: form.personType,
          firstName: form.firstName,
          lastName: form.lastName,
          companyName: form.companyName,
          phone: form.phone,
          mobile: form.mobile,
          email: form.email,
          documentNumber: form.documentNumber,
          taxId: form.taxId,
          address: form.address,
          city: form.city,
          province: form.province,
          postalCode: form.postalCode,
          notes: form.notes,
        },
      })
      if (!result.success || !result.data) {
        setError(result.message ?? "No se pudo actualizar el prospecto.")
        return
      }
      onUpdated?.(result.data)
      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo actualizar el prospecto."
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
            <SheetTitle>Editar Prospecto</SheetTitle>
            <SheetDescription>
              Actualice los datos del prospecto sin salir del expediente.
            </SheetDescription>
          </SheetHeader>

          {form ? (
            <form
              id={FORM_ID}
              onSubmit={(event) => void handleSubmit(event)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
                <CommercialPersonForm
                  value={form}
                  onChange={(next) =>
                    setForm(next as CommercialPersonFormValue)
                  }
                  disabled={isSubmitting}
                  autoFocusName={open}
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
                submitLabel="Guardar Prospecto"
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
