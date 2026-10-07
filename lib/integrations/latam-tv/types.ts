/** Fields read from GET /api/get-clients. Unknown LATAM keys are ignored. */
export type LatamTvExternalClient = {
  id_iptv?: unknown
  id_crm?: unknown
  identificador?: unknown
  usuario?: unknown
  dni?: unknown
  status?: unknown
  nombre?: unknown
  apellido?: unknown
  direccion?: unknown
  telefono?: unknown
  cantidad_dispositivos?: unknown
  fecha_creacion?: unknown
  fecha_modificacion?: unknown
  plan_name?: unknown
  plan_id?: unknown
  macs?: unknown
}

export type LatamTvAccountStatus = "enabled" | "disabled"

/** Respuesta real de POST /api/get-plans. No es el modelo interno. */
export type LatamTvExternalPlanCategory = {
  id?: unknown
  nombre?: unknown
}

export type LatamTvExternalPlan = {
  pl_id?: unknown
  nombre?: unknown
  categorias?: unknown
}

export type LatamTvPlansResponse = {
  error?: unknown
  planes?: unknown
}

export type LatamTvPlan = {
  id: string | null
  name: string | null
}

/** Internal model. Does not mirror the LATAM payload. */
export type LatamTvClient = {
  identifier: string
  iptvId: string | null
  username: string | null
  nationalId: string | null
  status: LatamTvAccountStatus | null
  firstName: string | null
  lastName: string | null
  address: string | null
  phone: string | null
  deviceCount: number | null
  createdAt: string | null
  updatedAt: string | null
  plan: LatamTvPlan | null
  macs: string[]
}

export type LatamTvLookup =
  | { found: true; client: LatamTvClient }
  | { found: false }

export type LatamTvFetch = (
  input: string,
  init?: RequestInit
) => Promise<Response>
