import type { Customer } from "@/lib/types/customers"
import type { SolicitudOtCreatePrefill } from "@/lib/commercial/solicitud-ot-create"
import {
  applySuggestedDurationPreset,
  getDefaultWorkOrderForm,
  type WorkOrderFormInput,
  type WorkOrderServiceType,
  type WorkOrderTechnology,
} from "@/lib/tasks/work-order"
import { resolveCopiedGps } from "@/lib/tasks/work-order-location"

function resolveCustomerTechnology(
  technology: string | null | undefined
): WorkOrderTechnology | "" {
  return technology === "fiber" || technology === "wireless" ? technology : ""
}

export function applyCustomerToForm(
  customer: Pick<
    Customer,
    | "id"
    | "name"
    | "phone"
    | "email"
    | "address"
    | "locality"
    | "technology"
    | "sharedLocation"
    | "latitude"
    | "longitude"
  >
): Partial<WorkOrderFormInput> {
  const technology = resolveCustomerTechnology(customer.technology)
  const gps = resolveCopiedGps({
    latitude: customer.latitude,
    longitude: customer.longitude,
    sharedLocation: customer.sharedLocation,
  })

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
    sharedLocation: gps.sharedLocation,
    latitude: gps.latitude,
    longitude: gps.longitude,
    currentSharedLocation: gps.sharedLocation,
    currentLatitude: gps.latitude,
    currentLongitude: gps.longitude,
  }
}

export function applySolicitudPrefillToForm(
  prefill: Pick<
    SolicitudOtCreatePrefill,
    | "customerName"
    | "customerPhone"
    | "address"
    | "locality"
    | "latitude"
    | "longitude"
    | "sharedLocation"
    | "customerId"
  >
): Partial<WorkOrderFormInput> {
  const gps = resolveCopiedGps({
    latitude: prefill.latitude,
    longitude: prefill.longitude,
    sharedLocation: prefill.sharedLocation,
  })
  const customerId = prefill.customerId?.trim() ?? ""

  return {
    serviceType: "instalacion-nueva",
    ...(customerId ? { customerId } : {}),
    customerName: prefill.customerName,
    customerPhone: prefill.customerPhone,
    address: prefill.address,
    locality: prefill.locality,
    sharedLocation: gps.sharedLocation,
    latitude: gps.latitude,
    longitude: gps.longitude,
  }
}

function syncCurrentLocationFromPrimary(
  form: WorkOrderFormInput
): WorkOrderFormInput {
  return {
    ...form,
    currentAddress: form.currentAddress.trim() || form.address,
    currentLocality: form.currentLocality.trim() || form.locality,
    currentSharedLocation:
      form.currentSharedLocation.trim() || form.sharedLocation,
    currentLatitude: form.currentLatitude ?? form.latitude,
    currentLongitude: form.currentLongitude ?? form.longitude,
    currentTechnology: form.currentTechnology || form.technology,
  }
}

export function applyWorkOrderServiceTypeChange(
  form: WorkOrderFormInput,
  nextType: WorkOrderServiceType
): WorkOrderFormInput {
  const defaults = getDefaultWorkOrderForm()
  const next: WorkOrderFormInput = {
    ...form,
    serviceType: nextType,
    ...applySuggestedDurationPreset(nextType),
    serviceReason: defaults.serviceReason,
    serviceDetail: defaults.serviceDetail,
    cancellationReason: defaults.cancellationReason,
    equipmentToRemove: defaults.equipmentToRemove,
    surveyReason: defaults.surveyReason,
    postventaDetail: defaults.postventaDetail,
    installationIp: defaults.installationIp,
    napBox: defaults.napBox,
    napPort: defaults.napPort,
    onuSerial: defaults.onuSerial,
    currentContractedPlan: defaults.currentContractedPlan,
    newContractedPlan: defaults.newContractedPlan,
    contractedPlan: defaults.contractedPlan,
    serviceCatalogId: defaults.serviceCatalogId,
    newAddress: defaults.newAddress,
    newLocality: defaults.newLocality,
    newTechnology: defaults.newTechnology,
    newSharedLocation: defaults.newSharedLocation,
    newLatitude: defaults.newLatitude,
    newLongitude: defaults.newLongitude,
  }

  if (nextType === "cambio-domicilio") {
    return syncCurrentLocationFromPrimary(next)
  }

  return next
}
