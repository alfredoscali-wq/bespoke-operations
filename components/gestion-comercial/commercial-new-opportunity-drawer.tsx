"use client"

import { useEffect, useMemo, useState } from "react"

import { CommercialDrawerFooter } from "@/components/gestion-comercial/commercial-drawer-footer"
import { emptyCommercialPersonLocationFields } from "@/components/gestion-comercial/commercial-person-location-fields"
import { useCreateOpportunityWithPerson } from "@/components/gestion-comercial/commercial-provider"
import { SharedLocationInput } from "@/components/tareas/shared-location-input"
import { useEmployees } from "@/components/rrhh/employees-provider"
import {
  DiscardChangesDialog,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  buildCommercialClientAutoTitle,
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
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { listCommercialEtiquetasBrowser } from "@/lib/supabase/commercial-etiquetas.browser"
import type { CommercialEtiqueta } from "@/lib/types/commercial-etiquetas"
import type { CommercialPerson } from "@/lib/types/commercial"
import type { CommercialOpportunityListItem } from "@/lib/types/commercial"

const FORM_ID = "commercial-new-client-form"

function buildDefaultPerson(): CommercialNewOpportunityPersonInput {
  return {
    personType: "individual",
    firstName: "",
    lastName: "",
    companyName: "",
    documentNumber: "",
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
    etiquetaId: "",
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
  const { companyId, isAuthReady } = useTenantCompanyId()
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
  const [etiquetas, setEtiquetas] = useState<CommercialEtiqueta[]>([])
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
    if (!open || !isAuthReady || !companyId) return
    let cancelled = false
    void listCommercialEtiquetasBrowser(companyId, { activeOnly: true }).then(
      (result) => {
        if (cancelled) return
        if (result.data) {
          setEtiquetas(result.data)
        } else {
          setEtiquetas([])
        }
      }
    )
    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady, open])

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

  async function persistBundle(
    nextPerson: CommercialNewOpportunityPersonInput,
    nextOpportunity: CommercialNewOpportunityInput
  ) {
    const autoTitle = buildCommercialClientAutoTitle(nextPerson)
    const cleanBundle: CommercialCreateOpportunityBundleInput = {
      person: {
        ...nextPerson,
        address: composeCommercialAddress(nextPerson),
      },
      opportunity: {
        ...nextOpportunity,
        title: nextOpportunity.title.trim() || autoTitle,
      },
    }

    const validationError = validateCommercialCreateOpportunityBundle(cleanBundle)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const result = await createWithPerson(cleanBundle)
      if (!result.success || !result.data) {
        setError(result.message ?? "No se pudo crear el cliente.")
        return
      }

      onCreated(result.data.opportunity)
      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo crear el cliente."
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
      setError("No se pudo interpretar el enlace de Google Maps.")
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
        locationInput: person.locationInput,
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

  const fullName = [person.firstName, person.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")

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
            <SheetTitle>Nuevo Cliente</SheetTitle>
            <SheetDescription>
              Cargá solo lo esencial. El resto se puede completar después en la
              ficha.
            </SheetDescription>
          </SheetHeader>

          <form
            id={FORM_ID}
            onSubmit={(event) => void handleSubmit(event)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="commercial-client-full-name">
                  Nombre y Apellido *
                </Label>
                <Input
                  id="commercial-client-full-name"
                  value={fullName}
                  autoFocus={open}
                  disabled={isSubmitting}
                  onKeyDown={advanceOnEnter}
                  onChange={(event) => {
                    const raw = event.target.value
                    const space = raw.indexOf(" ")
                    setPerson((current) => ({
                      ...current,
                      personType: "individual",
                      firstName: space === -1 ? raw : raw.slice(0, space),
                      lastName: space === -1 ? "" : raw.slice(space + 1),
                      companyName: "",
                    }))
                  }}
                  placeholder="Nombre y apellido"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="commercial-client-phone">Teléfono *</Label>
                <Input
                  id="commercial-client-phone"
                  value={person.phone}
                  disabled={isSubmitting}
                  onKeyDown={advanceOnEnter}
                  onChange={(event) =>
                    setPerson((current) => ({
                      ...current,
                      phone: event.target.value,
                      mobile: event.target.value,
                    }))
                  }
                  placeholder="Teléfono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="commercial-client-etiqueta">
                  Etiqueta Comercial *
                </Label>
                <Select
                  value={opportunity.etiquetaId || undefined}
                  onValueChange={(value) =>
                    setOpportunity((current) => ({
                      ...current,
                      etiquetaId: value,
                    }))
                  }
                  disabled={isSubmitting || !isEmployeesReady}
                >
                  <SelectTrigger id="commercial-client-etiqueta">
                    <SelectValue placeholder="Seleccionar etiqueta" />
                  </SelectTrigger>
                  <SelectContent>
                    {etiquetas.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        Configurá etiquetas en Configuración
                      </SelectItem>
                    ) : (
                      etiquetas.map((etiqueta) => (
                        <SelectItem key={etiqueta.id} value={etiqueta.id}>
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="inline-block size-2 rounded-full"
                              style={{ backgroundColor: etiqueta.color }}
                              aria-hidden
                            />
                            {etiqueta.name}
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="commercial-client-dni">DNI</Label>
                <Input
                  id="commercial-client-dni"
                  value={person.documentNumber}
                  disabled={isSubmitting}
                  onKeyDown={advanceOnEnter}
                  onChange={(event) =>
                    setPerson((current) => ({
                      ...current,
                      documentNumber: event.target.value,
                    }))
                  }
                  placeholder="Opcional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="commercial-client-email">Email</Label>
                <Input
                  id="commercial-client-email"
                  type="email"
                  value={person.email}
                  disabled={isSubmitting}
                  onKeyDown={advanceOnEnter}
                  onChange={(event) =>
                    setPerson((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  placeholder="Opcional"
                />
              </div>

              <SharedLocationInput
                id="commercial-client-maps"
                label="Ubicación (Google Maps)"
                value={person.locationInput}
                onChange={(value) =>
                  setPerson((current) => ({
                    ...current,
                    locationInput: value,
                    latitude: null,
                    longitude: null,
                    locationSource: null,
                  }))
                }
                placeholder="Pegar aquí el enlace de Google Maps compartido por el cliente"
              />

              <div className="space-y-2">
                <Label htmlFor="commercial-client-notes">Observaciones</Label>
                <Textarea
                  id="commercial-client-notes"
                  value={opportunity.observations}
                  disabled={isSubmitting}
                  onChange={(event) =>
                    setOpportunity((current) => ({
                      ...current,
                      observations: event.target.value,
                    }))
                  }
                  placeholder="Opcional"
                  rows={3}
                />
              </div>

              {locationControls}

              {existingProspectNotice ? (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {existingProspectNotice}
                </p>
              ) : null}

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
