import type { WorkOrderTechnology } from "@/lib/tasks/work-order"
import type {
  CommercialMigrationBucket,
  CommercialMigrationStatus,
  CustomerValidationStatus,
} from "@/lib/customers/normalization/status"

export type LegacyClientRow = {
  id: number
  nombre: string
  ncliente: string
  dnicuit: string
  domicilio: string
  telefono: string
  email: string
  provincia: string
  ciudad: string
  lat: string
  lng: string
  observ: string
  fecha: string
  estado: string
}

export type LegacyConnectionRow = {
  id: number
  idclientes: number | null
  idplanes: number | null
  plan: string
  tipo: string
  nodo: string
  ip: string
  estado: string
}

export type DuplicateMatchKind =
  | "external_code"
  | "dni"
  | "name"
  | "address"

export type DuplicateMatch = {
  kind: DuplicateMatchKind
  key: string
  legacyIds: number[]
  count: number
}

export type PreparedCommercialCustomer = {
  legacyId: number
  externalCustomerCode: string
  name: string
  dni: string
  phone: string
  phoneWhatsApp: string
  email: string
  address: string
  locality: string
  localityRaw: string
  technology: WorkOrderTechnology | ""
  technologyRaw: string
  migrationStatus: CommercialMigrationStatus
  bespokeStatus: "activo" | "inactivo" | ""
  bucket: CommercialMigrationBucket
  validationStatus: CustomerValidationStatus | null
  reviewReasons: string[]
  duplicateMatches: DuplicateMatchKind[]
  observations: string
  legacyClientState: string
  activeConnectionCount: number
  totalConnectionCount: number
  connectionIds: number[]
}

export type CommercialMigrationDataset = {
  generatedAt: string
  sourceDump: string
  summary: {
    totalLegacyClients: number
    listos: number
    revisar: number
    descartados: number
    duplicateGroups: {
      external_code: number
      dni: number
      name: number
      address: number
    }
    localitiesMapped: number
    localitiesUnmapped: number
  }
  duplicateGroups: DuplicateMatch[]
  records: PreparedCommercialCustomer[]
}

export type CommercialMigrationReport = {
  generatedAt: string
  clientesListos: number
  clientesARevisar: number
  clientesDescartados: number
  descartadosSinConexiones: number
  revisarSinConexionActiva: number
  total: number
  porEstadoMigracion: Record<CommercialMigrationStatus, number>
  topMotivosRevision: { motivo: string; count: number }[]
  rendimientoMs: number
}

export type CommercialMigrationAuditReport = {
  generatedAt: string
  clientes: {
    total: number
    estadoA: number
    estadoB: number
    estadoP: number
    estadoOtro: number
  }
  conexiones: {
    total: number
    porEstado: {
      A: number
      B: number
      C: number
      M: number
      I: number
      P: number
      otro: number
    }
    clientesConConexionActiva: number
    clientesSinConexiones: number
    clientesConConexionesSinActivas: number
    clientesUnicosPorEstadoConexion: {
      A: number
      B: number
      C: number
      M: number
      I: number
      P: number
      otro: number
    }
  }
}
