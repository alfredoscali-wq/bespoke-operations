"use client"

import { useEffect, useState } from "react"

import { CommercialDrawerFooter } from "@/components/gestion-comercial/commercial-drawer-footer"
import { CommercialPersonForm } from "@/components/gestion-comercial/commercial-person-form"
import {
  useUpdateCommercialPerson,
  useUpdateOpportunity,
} from "@/components/gestion-comercial/commercial-provider"
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
import { composeCommercialAddress } from "@/lib/commercial/location"
import { resolveCommercialPersonLocation } from "@/lib/commercial/resolve-person-location"
import { formatCoordinatePair } from "@/lib/location/coordinates"
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
    street: person.street,
    streetNumber: person.streetNumber,
    floor: person.floor,
    apartment: person.apartment,
    neighborhood: person.neighborhood,
    address: person.address,
    city: person.city,
    province: person.province,
    postalCode: person.postalCode,
    latitude: person.latitude,
    longitude: person.longitude,
    locationSource: person.locationSource,
    locationInput:
      person.latitude != null && person.longitude != null
        ? formatCoordinatePair(person.latitude, person.longitude)
        : "",
    notes: person.notes,
  }
}

type CommercialPersonDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: CommercialPerson | null
  opportunityId?: string | null
  onUpdated?: (person: CommercialPerson) => void
}

export function CommercialPersonDrawer({
  open,
  onOpenChange,
  person,
  opportunityId = null,
  onUpdated,
}: CommercialPersonDrawerProps) {
  const { mutateAsync: updatePerson } = useUpdateCommercialPerson()
  const { mutateAsync: updateOpportunity } = useUpdateOpportunity()
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

  async function persistForm(nextForm: CommercialPersonFormValue) {
    if (!person) return
    setIsSubmitting(true)
    setError(null)
    try {
      const address = composeCommercialAddress(nextForm)
      const result = await updatePerson({
        id: person.id,
        payload: {
          personType: nextForm.personType,
          firstName: nextForm.firstName,
          lastName: nextForm.lastName,
          companyName: nextForm.companyName,
          phone: nextForm.phone,
          mobile: nextForm.mobile,
          email: nextForm.email,
          documentNumber: nextForm.documentNumber,
          taxId: nextForm.taxId,
          street: nextForm.street,
          streetNumber: nextForm.streetNumber,
          floor: nextForm.floor,
          apartment: nextForm.apartment,
          neighborhood: nextForm.neighborhood,
          address,
          city: nextForm.city,
          province: nextForm.province,
          postalCode: nextForm.postalCode,
          latitude: nextForm.latitude,
          longitude: nextForm.longitude,
          locationSource: nextForm.locationSource,
          notes: nextForm.notes,
        },
      })
      if (!result.success || !result.data) {
        setError(result.message ?? "No se pudo actualizar el cliente.")
        return
      }

      if (
        opportunityId &&
        nextForm.latitude != null &&
        nextForm.longitude != null
      ) {
        await updateOpportunity({
          id: opportunityId,
          payload: {
            latitude: nextForm.latitude,
            longitude: nextForm.longitude,
            locationSource: nextForm.locationSource ?? "manual",
          },
        })
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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!person || !form) return
    setError(null)

    const validationError = validateCommercialPersonForm(form)
    if (validationError) {
      setError(validationError)
      return
    }

    const locationResult = await resolveCommercialPersonLocation(form)
    if (locationResult.status === "failed") {
      setError("No se pudo interpretar la ubicación pegada.")
      return
    }

    let nextForm = form
    if (locationResult.status === "resolved") {
      nextForm = {
        ...form,
        latitude: locationResult.coords.latitude,
        longitude: locationResult.coords.longitude,
        locationSource: locationResult.coords.locationSource,
        locationInput: "",
      }
      setForm(nextForm)
    }

    await persistForm(nextForm)
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
              Actualice los datos del cliente sin salir del expediente.
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
                  showLocationFields
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
                submitLabel="Guardar"
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
