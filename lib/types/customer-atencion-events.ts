import type {
  CustomerAtencionNextStep,
  CustomerAtencionStatus,
} from "@/lib/types/customer-atenciones"

export type CustomerAtencionEventActionType =
  | "consulta_creada"
  | "gestion_iniciada"
  | "gestion_registrada"
  | "consulta_pendiente"
  | "consulta_resuelta"
  | "proximo_paso_cambiado"
  | "consulta_ot_vinculada"
  | "gestion_liberada_por_inactividad"

export interface CustomerAtencionEvent {
  id: string
  companyId: string
  customerAtencionId: string
  employeeId: string
  actionType: CustomerAtencionEventActionType
  detail?: string | null
  previousStatus?: CustomerAtencionStatus | null
  newStatus?: CustomerAtencionStatus | null
  previousNextStep?: CustomerAtencionNextStep | null
  newNextStep?: CustomerAtencionNextStep | null
  createdAt: string
}
