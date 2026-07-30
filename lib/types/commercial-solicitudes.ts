import type {
  CommercialSolicitudPriorityCode,
  CommercialSolicitudResolutionCode,
  CommercialSolicitudStatusCode,
} from "@/lib/commercial/solicitud-catalogs"

export type CommercialSolicitudType = {
  id: string
  companyId: string
  name: string
  color: string
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type CreateCommercialSolicitudTypeInput = {
  name: string
  color?: string
  sortOrder?: number
  isActive?: boolean
}

export type UpdateCommercialSolicitudTypeInput = {
  name?: string
  color?: string
  sortOrder?: number
  isActive?: boolean
}

export type CommercialSolicitud = {
  id: string
  companyId: string
  opportunityId: string
  code: string
  requestTypeId: string
  requestTypeName: string | null
  requestTypeColor: string | null
  productPlan: string
  priority: CommercialSolicitudPriorityCode
  status: CommercialSolicitudStatusCode
  resolutionCode: CommercialSolicitudResolutionCode | null
  observations: string
  responsibleEmployeeId: string | null
  responsibleEmployeeName: string | null
  /** Permanent Solicitud → OT link after Generar Orden de Trabajo. */
  workOrderId: string | null
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type CommercialSolicitudFormValues = {
  requestTypeId: string
  productPlan: string
  priority: CommercialSolicitudPriorityCode
  observations: string
}

export type CreateCommercialSolicitudInput = {
  opportunityId: string
  requestTypeId: string
  productPlan?: string
  priority?: CommercialSolicitudPriorityCode
  observations?: string
}

export type UpdateCommercialSolicitudInput = {
  requestTypeId?: string
  productPlan?: string
  priority?: CommercialSolicitudPriorityCode
  observations?: string
  status?: CommercialSolicitudStatusCode
  resolutionCode?: CommercialSolicitudResolutionCode | null
  workOrderId?: string | null
}

export function emptyCommercialSolicitudFormValues(): CommercialSolicitudFormValues {
  return {
    requestTypeId: "",
    productPlan: "",
    priority: "normal",
    observations: "",
  }
}
