export type CustomerRecuperacionChannel = "telefono" | "whatsapp" | "otro"

export type CustomerRecuperacionResultado =
  | "recuperado"
  | "interesado"
  | "no_interesado"
  | "no_responde"
  | "volver_a_contactar"

export interface CustomerRecuperacion {
  id: string
  companyId: string
  customerId: string | null
  manualCustomerName: string | null
  manualZone: string | null
  manualPhone: string | null
  performedByEmployeeId: string
  channel: CustomerRecuperacionChannel
  offer: string
  observation: string
  resultado: CustomerRecuperacionResultado
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export type CustomerRecuperacionActivityRow = Pick<
  CustomerRecuperacion,
  | "id"
  | "customerId"
  | "manualCustomerName"
  | "manualZone"
  | "manualPhone"
  | "channel"
  | "offer"
  | "observation"
  | "resultado"
  | "createdAt"
> & {
  displayName: string
  zoneLabel: string | null
}

export type NewCustomerRecuperacionExistingInput = {
  mode: "existing"
  customerId: string
  channel: CustomerRecuperacionChannel
  offer: string
  observation: string
  resultado: CustomerRecuperacionResultado
}

export type NewCustomerRecuperacionManualInput = {
  mode: "manual"
  manualCustomerName: string
  manualZone: string
  manualPhone: string
  channel: CustomerRecuperacionChannel
  offer: string
  observation: string
  resultado: CustomerRecuperacionResultado
}

export type NewCustomerRecuperacionInput =
  | NewCustomerRecuperacionExistingInput
  | NewCustomerRecuperacionManualInput

export type CustomerRecuperacionJornadaRow = {
  id: string
  kind: "recupero"
  occurredAt: string
  displayName: string
  zoneLabel: string | null
  channel: CustomerRecuperacionChannel
  offer: string
  resultado: CustomerRecuperacionResultado
  observation: string
}
