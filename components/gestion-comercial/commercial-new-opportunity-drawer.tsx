"use client"

import { useEffect, useMemo, useState } from "react"

import { CommercialDrawerFooter } from "@/components/gestion-comercial/commercial-drawer-footer"
import {
  CommercialLocationFields,
  emptyCommercialPersonLocationFields,
} from "@/components/gestion-comercial/commercial-person-location-fields"
import { CommercialSolicitudFormFields } from "@/components/gestion-comercial/commercial-solicitud-form-fields"
import {
  useCreateOpportunityWithPerson,
  useUpdateCommercialPerson,
  useUpdateOpportunity,
} from "@/components/gestion-comercial/commercial-provider"
import { useAuth } from "@/components/auth/auth-provider"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { Checkbox } from "@/components/ui/checkbox"
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
import { resolveCommercialActorEmployeeId } from "@/lib/commercial/module-access"
import { hasCoordinates } from "@/lib/gps"
import { formatCoordinatePair } from "@/lib/location/coordinates"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { listCommercialEtiquetasBrowser } from "@/lib/supabase/commercial-etiquetas.browser"
import { createCommercialSolicitudBrowser } from "@/lib/supabase/commercial-solicitudes.browser"
import { listCommercialSolicitudTypesBrowser } from "@/lib/supabase/commercial-solicitud-types.browser"
import type { CommercialEtiqueta } from "@/lib/types/commercial-etiquetas"
import type {
  CommercialSolicitudFormValues,
  CommercialSolicitudType,
} from "@/lib/types/commercial-solicitudes"
import { emptyCommercialSolicitudFormValues } from "@/lib/types/commercial-solicitudes"
import type {
  CommercialOpportunity,
  CommercialPerson,
} from "@/lib/types/commercial"
import type { CommercialOpportunityListItem } from "@/lib/types/commercial"
import type {
  UpdateCommercialOpportunityPayload,
  UpdateCommercialPersonPayload,
} from "@/lib/types/supabase/commercial"

const FORM_ID = "commercial-client-quick-form"

type EditableSnapshot = {
  fullName: string
  phone: string
  address: string
  locationInput: string
  latitude: number | null
  longitude: number | null
  locationSource: CommercialNewOpportunityInput["locationSource"]
  observations: string
  etiquetaId: string
}

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
  assignedEmployeeId = "",
  etiquetaId = ""
): CommercialNewOpportunityInput {
  return {
    title: "",
    assignedEmployeeId,
    source: "otro",
    priority: "media",
    observations: "",
    etiquetaId,
    latitude: null,
    longitude: null,
    locationSource: null,
  }
}

function personDisplayName(person: {
  personType: CommercialNewOpportunityPersonInput["personType"]
  firstName: string
  lastName: string
  companyName: string
}): string {
  if (person.personType === "company") {
    return person.companyName
  }
  return [person.firstName, person.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
}

function applyDisplayName(
  current: CommercialNewOpportunityPersonInput,
  raw: string
): CommercialNewOpportunityPersonInput {
  if (current.personType === "company") {
    return {
      ...current,
      companyName: raw,
    }
  }
  const space = raw.indexOf(" ")
  return {
    ...current,
    personType: "individual",
    firstName: space === -1 ? raw : raw.slice(0, space),
    lastName: space === -1 ? "" : raw.slice(space + 1),
    companyName: "",
  }
}

function toEditableSnapshot(
  person: CommercialNewOpportunityPersonInput,
  opportunity: CommercialNewOpportunityInput
): EditableSnapshot {
  return {
    fullName: personDisplayName(person),
    phone: person.phone,
    address: person.address,
    locationInput: person.locationInput,
    latitude: person.latitude,
    longitude: person.longitude,
    locationSource: person.locationSource,
    observations: opportunity.observations,
    etiquetaId: opportunity.etiquetaId ?? "",
  }
}

function personFromExisting(person: CommercialPerson): CommercialNewOpportunityPersonInput {
  return {
    personType: person.personType,
    firstName: person.firstName,
    lastName: person.lastName,
    companyName: person.companyName,
    documentNumber: person.documentNumber,
    phone: person.phone || person.mobile,
    mobile: person.mobile || person.phone,
    email: person.email,
    street: person.street,
    streetNumber: person.streetNumber,
    floor: person.floor,
    apartment: person.apartment,
    neighborhood: person.neighborhood,
    city: person.city,
    province: person.province,
    postalCode: person.postalCode,
    address: person.address,
    latitude: person.latitude,
    longitude: person.longitude,
    locationSource: person.locationSource,
    locationInput:
      person.latitude != null && person.longitude != null
        ? formatCoordinatePair(person.latitude, person.longitude)
        : "",
  }
}

function opportunityFromExisting(
  opportunity: CommercialOpportunity
): CommercialNewOpportunityInput {
  return {
    title: opportunity.title,
    assignedEmployeeId: opportunity.assignedEmployeeId ?? "",
    source: opportunity.source,
    priority: opportunity.priority,
    observations: opportunity.description,
    etiquetaId: opportunity.etiquetaId ?? "",
    latitude: opportunity.latitude,
    longitude: opportunity.longitude,
    locationSource: opportunity.locationSource,
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

function buildPersonPatch(
  baseline: EditableSnapshot,
  next: EditableSnapshot,
  personState: CommercialNewOpportunityPersonInput
): Omit<UpdateCommercialPersonPayload, "updatedBy"> | null {
  const patch: Omit<UpdateCommercialPersonPayload, "updatedBy"> = {}

  if (next.fullName.trim() !== baseline.fullName.trim()) {
    if (personState.personType === "company") {
      patch.companyName = personState.companyName
    } else {
      patch.firstName = personState.firstName
      patch.lastName = personState.lastName
      patch.personType = "individual"
    }
  }

  if (next.phone.trim() !== baseline.phone.trim()) {
    patch.phone = next.phone
    patch.mobile = next.phone
  }

  if (next.address.trim() !== baseline.address.trim()) {
    patch.address = composeCommercialAddress({
      ...personState,
      address: next.address,
    })
  }

  const locationChanged =
    next.locationInput.trim() !== baseline.locationInput.trim() ||
    next.latitude !== baseline.latitude ||
    next.longitude !== baseline.longitude ||
    next.locationSource !== baseline.locationSource

  if (locationChanged) {
    patch.latitude = next.latitude
    patch.longitude = next.longitude
    patch.locationSource = next.locationSource
  }

  return Object.keys(patch).length > 0 ? patch : null
}

function buildOpportunityPatch(
  baseline: EditableSnapshot,
  next: EditableSnapshot,
  personState: CommercialNewOpportunityPersonInput,
  existingTitle: string
): Omit<UpdateCommercialOpportunityPayload, "updatedBy"> | null {
  const patch: Omit<UpdateCommercialOpportunityPayload, "updatedBy"> = {}

  if (next.fullName.trim() !== baseline.fullName.trim()) {
    const autoTitle = buildCommercialClientAutoTitle(personState)
    if (autoTitle && autoTitle !== existingTitle) {
      patch.title = autoTitle
    }
  }

  if (next.observations.trim() !== baseline.observations.trim()) {
    patch.description = next.observations
  }

  if (next.etiquetaId.trim() !== baseline.etiquetaId.trim()) {
    patch.etiquetaId = next.etiquetaId.trim() || null
  }

  const locationChanged =
    next.locationInput.trim() !== baseline.locationInput.trim() ||
    next.latitude !== baseline.latitude ||
    next.longitude !== baseline.longitude ||
    next.locationSource !== baseline.locationSource

  if (locationChanged) {
    patch.latitude = next.latitude
    patch.longitude = next.longitude
    patch.locationSource = next.locationSource
  }

  return Object.keys(patch).length > 0 ? patch : null
}

type CommercialNewOpportunityDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Required for create (duplicate notice). Optional in edit. */
  people?: CommercialPerson[]
  onCreated?: (opportunity: CommercialOpportunityListItem) => void
  mode?: "create" | "edit"
  person?: CommercialPerson | null
  opportunity?: CommercialOpportunity | null
  onUpdated?: (result: {
    person: CommercialPerson
    opportunity: CommercialOpportunity
  }) => void
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
  people = [],
  onCreated,
  mode = "create",
  person: editPerson = null,
  opportunity: editOpportunity = null,
  onUpdated,
  location,
  locationControls,
}: CommercialNewOpportunityDrawerProps) {
  const isEdit = mode === "edit"
  const { sessionUser } = useAuth()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const { employees } = useEmployees()
  const { mutateAsync: createWithPerson } = useCreateOpportunityWithPerson()
  const { mutateAsync: updatePerson } = useUpdateCommercialPerson()
  const { mutateAsync: updateOpportunity } = useUpdateOpportunity()

  const defaultResponsibleId = useMemo(() => {
    const options = listCommercialResponsibleOptions(employees)
    return options[0]?.id ?? ""
  }, [employees])

  const actorEmployeeId = useMemo(
    () =>
      sessionUser ? resolveCommercialActorEmployeeId(sessionUser) : null,
    [sessionUser]
  )

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
  const [includeFirstSolicitud, setIncludeFirstSolicitud] = useState(false)
  const [solicitudValues, setSolicitudValues] =
    useState<CommercialSolicitudFormValues>(emptyCommercialSolicitudFormValues)
  const [solicitudTypes, setSolicitudTypes] = useState<CommercialSolicitudType[]>(
    []
  )
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [locationMountId, setLocationMountId] = useState(0)

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
    if (!open || !isAuthReady || !companyId) return
    let cancelled = false
    void listCommercialEtiquetasBrowser(companyId, { activeOnly: true }).then(
      (result) => {
        if (cancelled) return
        setEtiquetas(result.data ?? [])
      }
    )
    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady, open])

  useEffect(() => {
    if (!open || !isAuthReady || !companyId || isEdit) return
    let cancelled = false
    void listCommercialSolicitudTypesBrowser(companyId, {
      activeOnly: true,
      ensureDefaults: true,
    }).then((result) => {
      if (cancelled) return
      setSolicitudTypes(result.data ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady, isEdit, open])

  useEffect(() => {
    if (!open) return

    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return

      if (isEdit && editPerson && editOpportunity) {
        const nextPerson = personFromExisting(editPerson)
        const nextOpportunity = opportunityFromExisting(editOpportunity)
        setPerson(nextPerson)
        setOpportunity(nextOpportunity)
        setBaseline({ person: nextPerson, opportunity: nextOpportunity })
      } else {
        const nextPerson = buildDefaultPerson()
        const nextOpportunity = buildDefaultOpportunity(defaultResponsibleId)
        setPerson(nextPerson)
        setOpportunity(nextOpportunity)
        setBaseline({ person: nextPerson, opportunity: nextOpportunity })
      }

      setIncludeFirstSolicitud(false)
      setSolicitudValues(emptyCommercialSolicitudFormValues())
      setError(null)
      setInfo(null)
      setIsSubmitting(false)
      setLocationMountId((current) => current + 1)
    })

    return () => {
      cancelled = true
    }
  }, [defaultResponsibleId, editOpportunity, editPerson, isEdit, open])

  useEffect(() => {
    if (!open || !location || isEdit) return
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
        address:
          location.latitude != null && location.longitude != null
            ? formatCoordinatePair(location.latitude, location.longitude)
            : current.address,
      }))
      setLocationMountId((current) => current + 1)
    })
    return () => {
      cancelled = true
    }
  }, [isEdit, location, open])

  const existingProspectNotice = isEdit
    ? null
    : resolveExistingProspectNotice(people, person)

  const fullName = personDisplayName(person)

  const selectedEtiquetaId = opportunity.etiquetaId ?? ""
  const etiquetaOptions = useMemo(() => {
    const active = etiquetas.filter((entry) => entry.isActive)
    if (!selectedEtiquetaId) return active
    const selected = etiquetas.find((entry) => entry.id === selectedEtiquetaId)
    if (!selected || selected.isActive) return active
    return [selected, ...active]
  }, [etiquetas, selectedEtiquetaId])

  async function resolveLocationForSave(): Promise<{
    nextPerson: CommercialNewOpportunityPersonInput
    nextOpportunity: CommercialNewOpportunityInput
  } | null> {
    const hasPaste = Boolean(person.locationInput.trim())
    const hasCoords = hasCoordinates(person.latitude, person.longitude)
    if (!hasPaste && !hasCoords) {
      setError("Indicá la ubicación (enlace de Google Maps o coordenadas GPS).")
      return null
    }

    const locationResult = await resolveCommercialPersonLocation(person)
    if (locationResult.status === "failed") {
      setError("No se pudo interpretar el enlace de Google Maps.")
      return null
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

    return { nextPerson, nextOpportunity }
  }

  async function persistCreate(
    nextPerson: CommercialNewOpportunityPersonInput,
    nextOpportunity: CommercialNewOpportunityInput
  ) {
    const autoTitle = buildCommercialClientAutoTitle(nextPerson)
    const etiquetaId =
      nextOpportunity.etiquetaId?.trim() || etiquetas[0]?.id || ""
    const cleanBundle: CommercialCreateOpportunityBundleInput = {
      person: {
        ...nextPerson,
        address: composeCommercialAddress(nextPerson),
      },
      opportunity: {
        ...nextOpportunity,
        etiquetaId,
        title: nextOpportunity.title.trim() || autoTitle,
      },
    }

    const validationError = validateCommercialCreateOpportunityBundle(cleanBundle)
    if (validationError) {
      setError(
        validationError === "Seleccione una etiqueta."
          ? "Configurá al menos una etiqueta comercial en Configuración."
          : validationError
      )
      return
    }

    if (!onCreated) {
      setError("No se pudo crear el cliente.")
      return
    }

    setIsSubmitting(true)
    setError(null)
    setInfo(null)
    try {
      if (includeFirstSolicitud && !solicitudValues.requestTypeId) {
        setError("Seleccioná el tipo de la primera solicitud.")
        return
      }

      const result = await createWithPerson(cleanBundle)
      if (!result.success || !result.data) {
        setError(result.message ?? "No se pudo crear el cliente.")
        return
      }

      if (includeFirstSolicitud && companyId) {
        const solicitudResult = await createCommercialSolicitudBrowser(
          companyId,
          {
            opportunityId: result.data.opportunity.id,
            requestTypeId: solicitudValues.requestTypeId,
            productPlan: solicitudValues.productPlan,
            priority: solicitudValues.priority,
            observations: solicitudValues.observations,
          },
          { employeeId: actorEmployeeId }
        )
        if (solicitudResult.error || !solicitudResult.data) {
          setError(
            solicitudResult.error?.message ??
              "El cliente se creó, pero no se pudo registrar la primera solicitud."
          )
          onCreated(result.data.opportunity)
          onOpenChange(false)
          return
        }
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

  async function persistEdit(
    nextPerson: CommercialNewOpportunityPersonInput,
    nextOpportunity: CommercialNewOpportunityInput
  ) {
    if (!editPerson || !editOpportunity) {
      setError("No se pudo actualizar el cliente.")
      return
    }

    const baselineSnapshot = toEditableSnapshot(
      baseline.person,
      baseline.opportunity
    )
    const nextSnapshot = toEditableSnapshot(nextPerson, nextOpportunity)

    if (!isFormStateDirty(nextSnapshot, baselineSnapshot)) {
      setInfo("Sin cambios.")
      setError(null)
      return
    }

    if (!nextSnapshot.fullName.trim()) {
      setError("Ingrese el nombre del cliente.")
      return
    }
    if (!normalizeCommercialPhone(nextSnapshot.phone)) {
      setError("Ingrese el teléfono del cliente.")
      return
    }

    if (!nextSnapshot.etiquetaId.trim()) {
      setError("Seleccione una etiqueta.")
      return
    }

    const personPatch = buildPersonPatch(
      baselineSnapshot,
      nextSnapshot,
      nextPerson
    )
    const opportunityPatch = buildOpportunityPatch(
      baselineSnapshot,
      nextSnapshot,
      nextPerson,
      editOpportunity.title
    )

    if (!personPatch && !opportunityPatch) {
      setInfo("Sin cambios.")
      setError(null)
      return
    }

    setIsSubmitting(true)
    setError(null)
    setInfo(null)

    try {
      let updatedPerson = editPerson
      let updatedOpportunity = editOpportunity

      if (personPatch) {
        const personResult = await updatePerson({
          id: editPerson.id,
          payload: personPatch,
        })
        if (!personResult.success || !personResult.data) {
          setError(personResult.message ?? "No se pudo actualizar el cliente.")
          return
        }
        updatedPerson = personResult.data
      }

      if (opportunityPatch) {
        const opportunityResult = await updateOpportunity({
          id: editOpportunity.id,
          payload: opportunityPatch,
        })
        if (!opportunityResult.success || !opportunityResult.data) {
          setError(
            opportunityResult.message ?? "No se pudo actualizar el cliente."
          )
          return
        }
        updatedOpportunity = opportunityResult.data
      }

      setInfo("Cliente actualizado correctamente.")
      onUpdated?.({
        person: updatedPerson,
        opportunity: updatedOpportunity,
      })
      window.setTimeout(() => {
        onOpenChange(false)
      }, 650)
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
    setError(null)
    setInfo(null)

    const resolved = await resolveLocationForSave()
    if (!resolved) return

    if (isEdit) {
      await persistEdit(resolved.nextPerson, resolved.nextOpportunity)
      return
    }

    await persistCreate(resolved.nextPerson, resolved.nextOpportunity)
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
            <SheetTitle>
              {isEdit ? "Editar Cliente" : "Nuevo Cliente"}
            </SheetTitle>
            <SheetDescription>
              {isEdit
                ? "Corregí solo lo necesario. El resto del expediente se mantiene."
                : "Cargá solo lo esencial. El resto se puede completar después en la ficha."}
            </SheetDescription>
          </SheetHeader>

          <form
            id={FORM_ID}
            onSubmit={(event) => void handleSubmit(event)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="commercial-client-full-name">Nombre *</Label>
                <Input
                  id="commercial-client-full-name"
                  value={fullName}
                  autoFocus={open}
                  disabled={isSubmitting}
                  onKeyDown={advanceOnEnter}
                  onChange={(event) => {
                    const raw = event.target.value
                    setPerson((current) => applyDisplayName(current, raw))
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
                <Label htmlFor="commercial-client-etiqueta">Etiqueta *</Label>
                <Select
                  value={opportunity.etiquetaId || undefined}
                  onValueChange={(value) =>
                    setOpportunity((current) => ({
                      ...current,
                      etiquetaId: value,
                    }))
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="commercial-client-etiqueta">
                    <SelectValue placeholder="Seleccionar etiqueta" />
                  </SelectTrigger>
                  <SelectContent>
                    {etiquetaOptions.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        Configurá etiquetas en Configuración
                      </SelectItem>
                    ) : (
                      etiquetaOptions.map((etiqueta) => (
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

              <CommercialLocationFields
                key={locationMountId}
                idPrefix="commercial-client"
                value={{
                  street: person.street,
                  streetNumber: person.streetNumber,
                  floor: person.floor,
                  apartment: person.apartment,
                  neighborhood: person.neighborhood,
                  city: person.city,
                  province: person.province,
                  postalCode: person.postalCode,
                  address: person.address,
                  latitude: person.latitude,
                  longitude: person.longitude,
                  locationSource: person.locationSource,
                  locationInput: person.locationInput,
                }}
                onChange={(nextLocation) => {
                  setPerson((current) => ({
                    ...current,
                    ...nextLocation,
                  }))
                  setOpportunity((current) => ({
                    ...current,
                    latitude: nextLocation.latitude,
                    longitude: nextLocation.longitude,
                    locationSource: nextLocation.locationSource,
                  }))
                }}
                disabled={isSubmitting}
                onAdvanceField={advanceOnEnter}
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

              {!isEdit ? (
                <div className="space-y-3 rounded-lg border px-3 py-3">
                  <div>
                    <p className="text-sm font-medium">Primera Solicitud</p>
                    <p className="text-xs text-muted-foreground">
                      Opcional. Registrá un pedido inicial al crear el cliente.
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={includeFirstSolicitud}
                      disabled={isSubmitting}
                      onCheckedChange={(checked) =>
                        setIncludeFirstSolicitud(checked === true)
                      }
                    />
                    Registrar una solicitud inicial
                  </label>
                  {includeFirstSolicitud ? (
                    <CommercialSolicitudFormFields
                      idPrefix="primera-solicitud"
                      values={solicitudValues}
                      onChange={setSolicitudValues}
                      types={solicitudTypes}
                      disabled={isSubmitting}
                    />
                  ) : null}
                </div>
              ) : null}

              {existingProspectNotice ? (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {existingProspectNotice}
                </p>
              ) : null}

              {info ? (
                <p className="text-sm text-muted-foreground" role="status">
                  {info}
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
              submitLabel="Guardar"
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
