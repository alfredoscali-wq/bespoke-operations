"use client"

import { useEffect, useMemo, useState } from "react"

import { CommercialDrawerFooter } from "@/components/gestion-comercial/commercial-drawer-footer"
import { CommercialOpportunitySection } from "@/components/gestion-comercial/commercial-opportunity-section"
import { CommercialPersonSection } from "@/components/gestion-comercial/commercial-person-section"
import { emptyCommercialPersonLocationFields } from "@/components/gestion-comercial/commercial-person-location-fields"
import { useCreateOpportunityWithPerson } from "@/components/gestion-comercial/commercial-provider"
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
  EXISTING_PROSPECT_NOTICE,
  normalizeCommercialEmail,
  normalizeCommercialPhone,
  validateCommercialCreateOpportunityBundle,
  type CommercialCreateOpportunityBundleInput,
  type CommercialNewOpportunityInput,
  type CommercialNewOpportunityPersonInput,
} from "@/lib/commercial/create-opportunity"
import { composeCommercialAddress } from "@/lib/commercial/location"
import { resolveCommercialPersonLocation } from "@/lib/commercial/resolve-person-location"
import { listCommercialResponsibleOptions } from "@/lib/commercial/responsible-employees"
import type { CommercialPerson } from "@/lib/types/commercial"
import type { CommercialOpportunityListItem } from "@/lib/types/commercial"

const FORM_ID = "commercial-new-opportunity-form"

function buildDefaultPerson(): CommercialNewOpportunityPersonInput {
  return {
    personType: "individual",
    firstName: "",
    lastName: "",
    companyName: "",
    phone: "",
    mobile: "",
    email: "",
    ...emptyCommercialPersonLocationFields(),
  }
}

function buildDefaultOpportunity(
  assignedEmployeeId = ""
): CommercialNewOpportunityInput {
  return {
    title: "",
    assignedEmployeeId,
    source: "otro",
    priority: "media",
    observations: "",
    latitude: null,
    longitude: null,
    locationSource: null,
  }
}

function resolveExistingProspectNotice(
  people: CommercialPerson[],
  person: CommercialNewOpportunityPersonInput
): string | null {
  const email = normalizeCommercialEmail(person.email)
  if (email) {
    const match = people.find(
      (entry) => normalizeCommercialEmail(entry.email) === email
    )
    if (match) return EXISTING_PROSPECT_NOTICE
  }

  const phones = [person.phone, person.mobile]
    .map(normalizeCommercialPhone)
    .filter(Boolean)

  for (const phone of phones) {
    const match = people.find(
      (entry) =>
        normalizeCommercialPhone(entry.phone) === phone ||
        normalizeCommercialPhone(entry.mobile) === phone
    )
    if (match) return EXISTING_PROSPECT_NOTICE
  }

  return null
}

function advanceOnEnter(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key !== "Enter") return
  event.preventDefault()

  const form = event.currentTarget.form
  if (!form) return

  const fields = Array.from(
    form.querySelectorAll<HTMLElement>(
      "input:not([type=hidden]):not([disabled]), textarea:not([disabled]), button[role=combobox]:not([disabled])"
    )
  ).filter((element) => element.tabIndex !== -1)

  const index = fields.indexOf(event.currentTarget)
  const next = fields[index + 1]
  next?.focus()
}

type CommercialNewOpportunityDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  people: CommercialPerson[]
  onCreated: (opportunity: CommercialOpportunityListItem) => void
  location?: {
    latitude: number | null
    longitude: number | null
    locationSource: CommercialNewOpportunityInput["locationSource"]
  }
  locationControls?: React.ReactNode
}

export function CommercialNewOpportunityDrawer({
  open,
  onOpenChange,
  people,
  onCreated,
  location,
  locationControls,
}: CommercialNewOpportunityDrawerProps) {
  const { employees, isEmployeesReady } = useEmployees()
  const { mutateAsync: createWithPerson } = useCreateOpportunityWithPerson()

  const defaultResponsibleId = useMemo(() => {
    const options = listCommercialResponsibleOptions(employees)
    return options[0]?.id ?? ""
  }, [employees])

  const [person, setPerson] = useState(buildDefaultPerson)
  const [opportunity, setOpportunity] = useState(() =>
    buildDefaultOpportunity()
  )
  const [baseline, setBaseline] = useState<CommercialCreateOpportunityBundleInput>(
    {
      person: buildDefaultPerson(),
      opportunity: buildDefaultOpportunity(),
    }
  )
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const formState = useMemo(
    () => ({ person, opportunity }),
    [person, opportunity]
  )
  const isDirty = isFormStateDirty(formState, baseline)
  const {
    handleOpenChange,
    requestClose,
    discardOpen,
    setDiscardOpen,
    confirmDiscard,
  } = useProtectedFormDialog({
    open,
    onOpenChange,
    isDirty: isDirty && !isSubmitting,
  })

  useEffect(() => {
    if (!open) return

    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      const nextPerson = buildDefaultPerson()
      const nextOpportunity = buildDefaultOpportunity(defaultResponsibleId)
      setPerson(nextPerson)
      setOpportunity(nextOpportunity)
      setBaseline({ person: nextPerson, opportunity: nextOpportunity })
      setError(null)
      setIsSubmitting(false)
    })

    return () => {
      cancelled = true
    }
  }, [defaultResponsibleId, open])

  useEffect(() => {
    if (!open || !location) return
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      setOpportunity((current) => ({
        ...current,
        latitude: location.latitude,
        longitude: location.longitude,
        locationSource: location.locationSource,
      }))
      setPerson((current) => ({
        ...current,
        latitude: location.latitude,
        longitude: location.longitude,
        locationSource: location.locationSource,
      }))
    })
    return () => {
      cancelled = true
    }
  }, [location, open])

  const existingProspectNotice = resolveExistingProspectNotice(people, person)

  const responsibleOptions = useMemo(
    () => listCommercialResponsibleOptions(employees),
    [employees]
  )

  async function persistBundle(
    nextPerson: CommercialNewOpportunityPersonInput,
    nextOpportunity: CommercialNewOpportunityInput
  ) {
    const personWithAddress = {
      ...nextPerson,
      address: composeCommercialAddress(nextPerson),
    }
    const bundle = {
      person: personWithAddress,
      opportunity: nextOpportunity,
    }
    const validationError = validateCommercialCreateOpportunityBundle(bundle)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const result = await createWithPerson(bundle)
      if (!result.success || !result.data) {
        setError(result.message ?? "No se pudo crear la oportunidad.")
        return
      }

      onCreated(result.data.opportunity)
      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo crear la oportunidad."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const locationResult = await resolveCommercialPersonLocation(person)
    if (locationResult.status === "failed") {
      setError("No se pudo interpretar la ubicación pegada.")
      return
    }

    let nextPerson = person
    let nextOpportunity = opportunity

    if (locationResult.status === "resolved") {
      nextPerson = {
        ...person,
        latitude: locationResult.coords.latitude,
        longitude: locationResult.coords.longitude,
        locationSource: locationResult.coords.locationSource,
        locationInput: "",
      }
      nextOpportunity = {
        ...opportunity,
        latitude: locationResult.coords.latitude,
        longitude: locationResult.coords.longitude,
        locationSource: locationResult.coords.locationSource,
      }
      setPerson(nextPerson)
      setOpportunity(nextOpportunity)
    } else if (
      person.latitude != null &&
      person.longitude != null &&
      (opportunity.latitude == null || opportunity.longitude == null)
    ) {
      nextOpportunity = {
        ...opportunity,
        latitude: person.latitude,
        longitude: person.longitude,
        locationSource: person.locationSource,
      }
      setOpportunity(nextOpportunity)
    }

    await persistBundle(nextPerson, nextOpportunity)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
          showCloseButton
          onEscapeKeyDown={(event) => {
            if (isDirty && !isSubmitting) {
              event.preventDefault()
              requestClose()
            }
          }}
        >
          <SheetHeader className="border-b">
            <SheetTitle>Nueva Oportunidad</SheetTitle>
            <SheetDescription>
              Registre la persona y la oportunidad comercial en un solo paso.
            </SheetDescription>
          </SheetHeader>

          <form
            id={FORM_ID}
            onSubmit={(event) => void handleSubmit(event)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-4 py-4">
              <CommercialPersonSection
                value={person}
                onChange={setPerson}
                disabled={isSubmitting}
                autoFocusName={open}
                existingProspectNotice={existingProspectNotice}
                onAdvanceField={advanceOnEnter}
              />
              <CommercialOpportunitySection
                value={opportunity}
                onChange={setOpportunity}
                responsibleOptions={responsibleOptions}
                disabled={isSubmitting || !isEmployeesReady}
                onAdvanceField={advanceOnEnter}
              />

              {locationControls}

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
            />
          </form>
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
