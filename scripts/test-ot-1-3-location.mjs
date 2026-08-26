/**
 * OT 1.3 — domicilio + GPS copy, type-change persistence, unique location validation.
 */
import assert from "node:assert/strict"
import { mock } from "node:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { formatCustomerAddressLabel } from "../lib/customers/format.ts"
import { buildGoogleMapsUrl } from "../lib/gps/coordinates.ts"
import { enrichCreateTaskPayloadWithResolvedLocation } from "../lib/location/client/enrich-task-payload.ts"
import { mapCreatePayloadToInsert } from "../lib/supabase/tasks.mapper.ts"
import {
  buildConsultationOtCreatePrefill,
  buildCrewObservationsFromConsultation,
} from "../lib/customer-atenciones/consultation-ot-create.ts"
import {
  applySolicitudPrefillToForm,
  applyCustomerToForm,
  applyWorkOrderServiceTypeChange,
} from "../lib/tasks/work-order-customer-prefill.ts"
import {
  buildSolicitudOtLocationFromPerson,
} from "../lib/commercial/solicitud-ot-create.ts"
import {
  buildWorkOrderCreatePayload,
  getDefaultWorkOrderForm,
  validateWorkOrderForm,
} from "../lib/tasks/work-order.ts"
import {
  hasWorkOrderGps,
  hasWorkOrderLocality,
  hasWorkOrderStreetAddress,
  isWorkOrderGpsLoaded,
  shouldResolveLocationOnSave,
  validateWorkOrderLocation,
} from "../lib/tasks/work-order-location.ts"

const root = resolve(import.meta.dirname, "..")
const dialogSource = readFileSync(
  resolve(root, "components/tareas/task-work-order-dialog.tsx"),
  "utf8"
)

const LAT = -31.4201
const LNG = -64.1888

function customerFixture(overrides = {}) {
  return {
    id: "cust-1",
    name: "Juan Perez",
    phone: "3515550000",
    email: "juan@example.com",
    address: "Av. Colón 123",
    locality: "Córdoba",
    technology: "fiber",
    sharedLocation: "https://maps.google.com/?q=-31.4201,-64.1888",
    latitude: LAT,
    longitude: LNG,
    ...overrides,
  }
}

function scheduledServiceForm(overrides = {}) {
  return {
    ...getDefaultWorkOrderForm(),
    serviceType: "service-tecnico",
    customerName: "Juan Perez",
    customerId: "cust-1",
    address: "Av. Colón 123",
    locality: "Córdoba",
    serviceReason: "sin-conexion",
    serviceDetail: "Sin servicio",
    scheduledDate: "2026-08-26",
    shift: "manana",
    crewId: "crew-1",
    estimatedDurationPreset: "45",
    latitude: LAT,
    longitude: LNG,
    sharedLocation: buildGoogleMapsUrl(LAT, LNG),
    ...overrides,
  }
}

test("1-4 applyCustomerToForm copia address, locality, sharedLocation y coords", () => {
  const patch = applyCustomerToForm(customerFixture())
  assert.equal(patch.address, "Av. Colón 123")
  assert.equal(patch.locality, "Córdoba")
  assert.equal(patch.sharedLocation, "https://maps.google.com/?q=-31.4201,-64.1888")
  assert.equal(patch.latitude, LAT)
  assert.equal(patch.longitude, LNG)
  assert.equal(typeof patch.latitude, "number")
  assert.equal(typeof patch.longitude, "number")
})

test("5 cliente con lat/lng y sin link genera sharedLocation compatible", () => {
  const patch = applyCustomerToForm(
    customerFixture({ sharedLocation: null, latitude: LAT, longitude: LNG })
  )
  assert.equal(patch.sharedLocation, buildGoogleMapsUrl(LAT, LNG))
  assert.equal(patch.latitude, LAT)
  assert.equal(patch.longitude, LNG)
  assert.equal(patch.newSharedLocation, undefined)
})

test("6 cliente con solo locality no pasa validación de calle", () => {
  const patch = applyCustomerToForm(
    customerFixture({
      address: "",
      locality: "Córdoba",
      sharedLocation: null,
      latitude: null,
      longitude: null,
    })
  )
  const form = scheduledServiceForm({
    ...patch,
    address: patch.address,
    locality: patch.locality,
    sharedLocation: patch.sharedLocation,
    latitude: patch.latitude,
    longitude: patch.longitude,
  })
  const location = validateWorkOrderLocation(form)
  assert.equal(hasWorkOrderStreetAddress(form), false)
  assert.equal(location.valid, false)
  assert.equal(location.missing, "address")
  assert.equal(formatCustomerAddressLabel({ locality: "Córdoba" }), "Sin domicilio registrado · Córdoba")
})

test("7 calle + localidad + GPS es válido", () => {
  const form = scheduledServiceForm()
  assert.equal(hasWorkOrderStreetAddress(form), true)
  assert.equal(hasWorkOrderLocality(form), true)
  assert.equal(hasWorkOrderGps(form), true)
  const location = validateWorkOrderLocation(form)
  assert.equal(location.valid, true)
  const full = validateWorkOrderForm(form)
  assert.equal(full.valid, true)
})

test("8 calle + localidad sin GPS → GPS faltante", () => {
  const form = scheduledServiceForm({
    latitude: null,
    longitude: null,
    sharedLocation: "",
  })
  const location = validateWorkOrderLocation(form)
  assert.equal(location.valid, false)
  assert.equal(location.missing, "gps")
  assert.equal(location.message, "Falta la ubicación GPS.")
})

test("9 GPS sin domicilio → domicilio faltante", () => {
  const form = scheduledServiceForm({ address: "" })
  const location = validateWorkOrderLocation(form)
  assert.equal(location.valid, false)
  assert.equal(location.missing, "address")
  assert.equal(location.message, "La dirección es obligatoria.")
})

test("10 GPS parcial → gps-partial", () => {
  const form = scheduledServiceForm({
    longitude: null,
    sharedLocation: "",
  })
  const location = validateWorkOrderLocation(form)
  assert.equal(location.valid, false)
  assert.equal(location.missing, "gps-partial")
  assert.equal(
    location.message,
    "La ubicación GPS está incompleta (faltan latitud o longitud)."
  )
})

test("11 Atención → Generar OT conserva domicilio/GPS", () => {
  const prefill = buildConsultationOtCreatePrefill({
    atencionId: "at-1",
    customerId: "cust-1",
    motivoLabel: "Problema técnico",
    initialObservations: "Sin señal",
  })
  const form = {
    ...getDefaultWorkOrderForm(),
    observationsForCrew: buildCrewObservationsFromConsultation(prefill),
    ...applyCustomerToForm(customerFixture()),
  }
  assert.equal(form.customerId, "cust-1")
  assert.equal(form.address, "Av. Colón 123")
  assert.equal(form.locality, "Córdoba")
  assert.equal(form.latitude, LAT)
  assert.match(form.observationsForCrew, /Consulta de origen/)
})

test("12 Atención → cambiar tipo conserva domicilio/GPS", () => {
  const form = {
    ...getDefaultWorkOrderForm(),
    observationsForCrew: "Consulta de origen: AT-1",
    ...applyCustomerToForm(customerFixture()),
  }
  const next = applyWorkOrderServiceTypeChange(form, "service-tecnico")
  assert.equal(next.customerId, "cust-1")
  assert.equal(next.address, "Av. Colón 123")
  assert.equal(next.locality, "Córdoba")
  assert.equal(next.latitude, LAT)
  assert.equal(next.longitude, LNG)
  assert.equal(next.sharedLocation, customerFixture().sharedLocation)
  assert.equal(next.observationsForCrew, "Consulta de origen: AT-1")
  assert.equal(next.serviceType, "service-tecnico")
  assert.match(dialogSource, /applyWorkOrderServiceTypeChange/)
  const typeChangeHandler = dialogSource.slice(
    dialogSource.indexOf("function handleServiceTypeChange"),
    dialogSource.indexOf("function handleCustomerSelect")
  )
  assert.match(typeChangeHandler, /applyWorkOrderServiceTypeChange/)
  assert.doesNotMatch(typeChangeHandler, /getDefaultWorkOrderForm/)
  assert.doesNotMatch(typeChangeHandler, /setCustomerSelected\(false\)/)
})

test("13-14 Comercial conserva address/locality y copia GPS si existe", () => {
  const withoutGps = applySolicitudPrefillToForm({
    customerName: "Ana",
    customerPhone: "351111",
    address: "Calle Falsa 123",
    locality: "Córdoba",
    latitude: null,
    longitude: null,
    sharedLocation: null,
  })
  assert.equal(withoutGps.address, "Calle Falsa 123")
  assert.equal(withoutGps.locality, "Córdoba")
  assert.equal(withoutGps.latitude, null)
  assert.equal(withoutGps.sharedLocation, "")

  const withGps = buildSolicitudOtLocationFromPerson({
    address: "Calle Falsa 123",
    street: "",
    city: "Córdoba",
    latitude: LAT,
    longitude: LNG,
  })
  const commercialForm = applySolicitudPrefillToForm({
    customerName: "Ana",
    customerPhone: "351111",
    ...withGps,
  })
  assert.equal(commercialForm.latitude, LAT)
  assert.equal(commercialForm.longitude, LNG)
  assert.equal(commercialForm.sharedLocation, buildGoogleMapsUrl(LAT, LNG))
})

test("15 cambio-domicilio no copia GPS actual como GPS nuevo", () => {
  const afterCustomer = {
    ...getDefaultWorkOrderForm(),
    ...applyCustomerToForm(customerFixture()),
  }
  const next = applyWorkOrderServiceTypeChange(afterCustomer, "cambio-domicilio")
  assert.equal(next.currentSharedLocation, customerFixture().sharedLocation)
  assert.equal(next.currentLatitude, LAT)
  assert.equal(next.newSharedLocation, "")
  assert.equal(next.newLatitude, null)
  assert.equal(next.newLongitude, null)
  assert.equal(next.newAddress, "")

  const payload = buildWorkOrderCreatePayload({
    form: {
      ...next,
      newAddress: "Nueva 100",
      newLocality: "Córdoba",
      newTechnology: "fiber",
      currentTechnology: "fiber",
      currentContractedPlan: "100Mb",
      newContractedPlan: "100Mb",
      scheduledDate: "2026-08-26",
      shift: "manana",
      crewId: "crew-1",
      estimatedDurationPreset: "120",
    },
    existingTasks: [],
    checklist: [],
    crew: { id: "crew-1", name: "A", supervisor: "S" },
  })
  assert.equal(payload.sharedLocation, undefined)
  assert.equal(payload.latitude, undefined)
})

test("16 baja conserva: sin calle, GPS sí, motivo obligatorio", () => {
  const form = {
    ...getDefaultWorkOrderForm(),
    serviceType: "baja",
    customerName: "Juan",
    customerId: "cust-1",
    address: "",
    cancellationReason: "Mudanza",
    scheduledDate: "2026-08-26",
    shift: "tarde",
    crewId: "crew-1",
    estimatedDurationPreset: "45",
    latitude: LAT,
    longitude: LNG,
    sharedLocation: buildGoogleMapsUrl(LAT, LNG),
  }
  assert.equal(hasWorkOrderStreetAddress(form), true)
  const location = validateWorkOrderLocation(form)
  assert.equal(location.valid, true)
  assert.equal(validateWorkOrderForm(form).valid, true)

  const missingGps = validateWorkOrderLocation({
    ...form,
    latitude: null,
    longitude: null,
    sharedLocation: "",
  })
  assert.equal(missingGps.valid, false)
  assert.equal(missingGps.missing, "gps")
})

test("17-19 cambio de tipo no elimina customerId, address ni coords", () => {
  const form = {
    ...getDefaultWorkOrderForm(),
    ...applyCustomerToForm(customerFixture()),
    serviceType: "reconexion",
  }
  const next = applyWorkOrderServiceTypeChange(form, "retiro-equipos")
  assert.equal(next.customerId, "cust-1")
  assert.equal(next.address, "Av. Colón 123")
  assert.equal(next.latitude, LAT)
  assert.equal(next.longitude, LNG)
})

test("20 payload conserva numbers en lat/lng", () => {
  const payload = buildWorkOrderCreatePayload({
    form: scheduledServiceForm(),
    existingTasks: [],
    checklist: [],
    crew: { id: "crew-1", name: "A", supervisor: "S" },
  })
  assert.equal(typeof payload.latitude, "number")
  assert.equal(typeof payload.longitude, "number")
  assert.equal(payload.latitude, LAT)
  assert.equal(payload.serviceAddress, "Av. Colón 123")

  const insert = mapCreatePayloadToInsert({
    ...payload,
    description: payload.description ?? "",
    progress: 0,
  })
  assert.equal(typeof insert.latitude, "number")
  assert.equal(typeof insert.longitude, "number")
  assert.equal(insert.service_address, "Av. Colón 123")
  assert.equal(insert.shared_location, buildGoogleMapsUrl(LAT, LNG))
})

test("21 enrich con GPS existente no llama resolver", () => {
  assert.equal(
    shouldResolveLocationOnSave(buildGoogleMapsUrl(LAT, LNG), LAT, LNG),
    false
  )
})

test("22 enrich con link sin GPS sí resuelve", async () => {
  assert.equal(
    shouldResolveLocationOnSave("https://maps.google.com/?q=-31.4,-64.2", null, null),
    true
  )

  mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({
      success: true,
      data: {
        latitude: LAT,
        longitude: LNG,
        normalizedLocation: buildGoogleMapsUrl(LAT, LNG),
        resolutionMethod: "redirect",
      },
    }),
  }))

  const payload = await enrichCreateTaskPayloadWithResolvedLocation({
    code: "TSK-OT-1",
    title: "Service Técnico",
    description: "",
    projectCode: "OT",
    projectName: "Juan",
    customerName: "Juan",
    type: "maintenance",
    status: "programada",
    priority: "media",
    supervisor: "S",
    crew: "A",
    startDate: "2026-08-26",
    dueDate: "2026-08-26",
    estimatedDuration: "45 min",
    checklist: [],
    sharedLocation: "https://maps.app.goo.gl/test",
    latitude: undefined,
    longitude: undefined,
  })

  assert.equal(payload.latitude, LAT)
  assert.equal(payload.longitude, LNG)
  mock.reset()
})

test("23 GPS parcial no muestra GPS cargado", () => {
  assert.equal(isWorkOrderGpsLoaded(LAT, null), false)
  assert.equal(isWorkOrderGpsLoaded(null, LNG), false)
  assert.equal(isWorkOrderGpsLoaded(LAT, LNG), true)
})

test("label de buscador: calle + localidad con punto medio", () => {
  assert.equal(
    formatCustomerAddressLabel({
      address: "Av. Siempre Viva 123",
      locality: "Córdoba",
    }),
    "Av. Siempre Viva 123 · Córdoba"
  )
})
