import type { OperationalChecklistTemplateItem } from "@/lib/tasks/operational-checklist-template"
import type { WorkOrderServiceType } from "@/lib/tasks/work-order"
import type { TaskStatus, TaskType } from "@/lib/types/tasks"
import type { ChecklistFieldType } from "@/lib/work-order-types/checklist-field-types"

/** Fictional Córdoba Capital points. Not copied from any real customer. */
export const DEMO_CORDOBA_ZONES = {
  nuevaCordoba: {
    name: "Nueva Córdoba",
    latitude: -31.4285,
    longitude: -64.1868,
  },
  alberdi: {
    name: "Alberdi",
    latitude: -31.3992,
    longitude: -64.1995,
  },
  generalPaz: {
    name: "General Paz",
    latitude: -31.4128,
    longitude: -64.1682,
  },
  altaCordoba: {
    name: "Alta Córdoba",
    latitude: -31.3895,
    longitude: -64.181,
  },
  cerro: {
    name: "Cerro de las Rosas",
    latitude: -31.3712,
    longitude: -64.2258,
  },
  villaBelgrano: {
    name: "Villa Belgrano",
    latitude: -31.358,
    longitude: -64.2265,
  },
  arguello: {
    name: "Argüello",
    latitude: -31.3528,
    longitude: -64.251,
  },
  centro: {
    name: "Centro",
    latitude: -31.4201,
    longitude: -64.1888,
  },
} as const

export const DEMO_BRANDING_COLORS = {
  primary: "#FF6E3D",
  secondary: "#05D6B3",
} as const

export const DEMO_LIVE_TASK_CODE = "DEMO-MOBILE-001"

export type DemoCustomerSeed = {
  externalCode: string
  name: string
  phone: string
  email: string
  address: string
  locality: string
  latitude: number
  longitude: number
}

export const DEMO_CUSTOMERS: DemoCustomerSeed[] = [
  {
    externalCode: "DEMO-SEED-0001",
    name: "Familia Roldán",
    phone: "+54 351 4801-2201",
    email: "familia.roldan.demo@example.com",
    address: "Bv. Chacabuco 850",
    locality: DEMO_CORDOBA_ZONES.nuevaCordoba.name,
    latitude: DEMO_CORDOBA_ZONES.nuevaCordoba.latitude,
    longitude: DEMO_CORDOBA_ZONES.nuevaCordoba.longitude,
  },
  {
    externalCode: "DEMO-SEED-0002",
    name: "Café Güemes",
    phone: "+54 351 4801-2202",
    email: "cafe.guemes.demo@example.com",
    address: "Av. Hipólito Yrigoyen 412",
    locality: DEMO_CORDOBA_ZONES.nuevaCordoba.name,
    latitude: -31.4272,
    longitude: -64.1879,
  },
  {
    externalCode: "DEMO-SEED-0003",
    name: "Consultorio Alberdi",
    phone: "+54 351 4801-2203",
    email: "consultorio.alberdi.demo@example.com",
    address: "Av. Colón 1850",
    locality: DEMO_CORDOBA_ZONES.alberdi.name,
    latitude: DEMO_CORDOBA_ZONES.alberdi.latitude,
    longitude: DEMO_CORDOBA_ZONES.alberdi.longitude,
  },
  {
    externalCode: "DEMO-SEED-0004",
    name: "Edificio General Paz",
    phone: "+54 351 4801-2204",
    email: "edificio.paz.demo@example.com",
    address: "Av. 24 de Septiembre 640",
    locality: DEMO_CORDOBA_ZONES.generalPaz.name,
    latitude: DEMO_CORDOBA_ZONES.generalPaz.latitude,
    longitude: DEMO_CORDOBA_ZONES.generalPaz.longitude,
  },
  {
    externalCode: "DEMO-SEED-0005",
    name: "Familia Toledo",
    phone: "+54 351 4801-2205",
    email: "familia.toledo.demo@example.com",
    address: "Av. Castro Barros 920",
    locality: DEMO_CORDOBA_ZONES.altaCordoba.name,
    latitude: DEMO_CORDOBA_ZONES.altaCordoba.latitude,
    longitude: DEMO_CORDOBA_ZONES.altaCordoba.longitude,
  },
  {
    externalCode: "DEMO-SEED-0006",
    name: "Residencia Villa Belgrano",
    phone: "+54 351 4801-2206",
    email: "villa.belgrano.demo@example.com",
    address: "Av. Rafael Núñez 4680",
    locality: DEMO_CORDOBA_ZONES.villaBelgrano.name,
    latitude: DEMO_CORDOBA_ZONES.villaBelgrano.latitude,
    longitude: DEMO_CORDOBA_ZONES.villaBelgrano.longitude,
  },
  {
    externalCode: "DEMO-SEED-0007",
    name: "Comercio Argüello",
    phone: "+54 351 4801-2207",
    email: "comercio.arguello.demo@example.com",
    address: "Av. Donato Álvarez 7900",
    locality: DEMO_CORDOBA_ZONES.arguello.name,
    latitude: DEMO_CORDOBA_ZONES.arguello.latitude,
    longitude: DEMO_CORDOBA_ZONES.arguello.longitude,
  },
  {
    externalCode: "DEMO-SEED-0008",
    name: "Oficina Centro Córdoba",
    phone: "+54 351 4801-2208",
    email: "oficina.centro.demo@example.com",
    address: "San Martín 150",
    locality: DEMO_CORDOBA_ZONES.centro.name,
    latitude: DEMO_CORDOBA_ZONES.centro.latitude,
    longitude: DEMO_CORDOBA_ZONES.centro.longitude,
  },
]

export type DemoFieldTaskSeed = {
  code: string
  title: string
  description: string
  status: TaskStatus
  customerCode: string
  crewName: string | null
  serviceType: WorkOrderServiceType
  type: TaskType
  dueOffsetDays: number
  startOffsetDays: number
  scheduledTime: string | null
  role:
    | "live"
    | "assigned"
    | "programmed"
    | "in-progress"
    | "pending-closure"
    | "finished"
    | "overdue"
}

/** Field-service OTs (project_id null) for Dashboard, Tareas, Planificación and Calendar. */
export const DEMO_FIELD_TASKS: DemoFieldTaskSeed[] = [
  {
    code: "DEMO-OT-001",
    title: "Instalación de cliente",
    description: "Instalación de servicio de fibra en domicilio residencial.",
    status: "programada",
    customerCode: "DEMO-SEED-0004",
    crewName: "Cuadrilla Demo 2",
    serviceType: "instalacion-nueva",
    type: "fiber",
    dueOffsetDays: 0,
    startOffsetDays: 0,
    scheduledTime: "09:30:00",
    role: "programmed",
  },
  {
    code: "DEMO-OT-002",
    title: "Revisión de acometida",
    description: "Revisión de acometida y conectores en domicilio del cliente.",
    status: "programada",
    customerCode: "DEMO-SEED-0005",
    crewName: "Cuadrilla Demo 3",
    serviceType: "service-tecnico",
    type: "fiber",
    dueOffsetDays: 0,
    startOffsetDays: 0,
    scheduledTime: "11:00:00",
    role: "programmed",
  },
  {
    code: "DEMO-OT-003",
    title: "Empalme de fibra",
    description: "Empalme y verificación de tramo de red de acceso.",
    status: "programada",
    customerCode: "DEMO-SEED-0008",
    crewName: null,
    serviceType: "relevamiento",
    type: "fiber",
    dueOffsetDays: 1,
    startOffsetDays: 1,
    scheduledTime: "08:30:00",
    role: "programmed",
  },
  {
    code: "DEMO-OT-004",
    title: "Cambio de equipo",
    description: "Reemplazo de equipo de cliente y prueba de servicio.",
    status: "en-curso",
    customerCode: "DEMO-SEED-0003",
    crewName: "Cuadrilla Demo 2",
    serviceType: "service-tecnico",
    type: "fiber",
    dueOffsetDays: 0,
    startOffsetDays: 0,
    scheduledTime: "10:00:00",
    role: "in-progress",
  },
  {
    code: "DEMO-OT-005",
    title: "Mantenimiento de enlace",
    description: "Mantenimiento de enlace y verificación de señal.",
    status: "pendiente-cierre",
    customerCode: "DEMO-SEED-0006",
    crewName: "Cuadrilla Demo 3",
    serviceType: "service-tecnico",
    type: "fiber",
    dueOffsetDays: 0,
    startOffsetDays: -1,
    scheduledTime: "14:00:00",
    role: "pending-closure",
  },
  {
    code: "DEMO-OT-006",
    title: "Mantenimiento preventivo",
    description: "Mantenimiento preventivo de red de acceso ya cerrado.",
    status: "finalizada",
    customerCode: "DEMO-SEED-0007",
    crewName: "Cuadrilla Demo 2",
    serviceType: "service-tecnico",
    type: "fiber",
    dueOffsetDays: -2,
    startOffsetDays: -2,
    scheduledTime: "09:00:00",
    role: "finished",
  },
  {
    code: "DEMO-OT-007",
    title: "Revisión de potencia óptica",
    description: "Medición de potencia óptica y cierre de visita.",
    status: "finalizada",
    customerCode: "DEMO-SEED-0008",
    crewName: "Cuadrilla Demo 3",
    serviceType: "inspeccion-tecnica",
    type: "fiber",
    dueOffsetDays: -3,
    startOffsetDays: -3,
    scheduledTime: "16:00:00",
    role: "finished",
  },
  {
    code: "DEMO-OT-008",
    title: "Revisión de acometida vencida",
    description: "Visita vencida: revisión de acometida pendiente de reprogramar.",
    status: "vencida",
    customerCode: "DEMO-SEED-0005",
    crewName: "Cuadrilla Demo 2",
    serviceType: "service-tecnico",
    type: "fiber",
    dueOffsetDays: -1,
    startOffsetDays: -2,
    scheduledTime: "15:00:00",
    role: "overdue",
  },
]

function checklistItem(
  id: string,
  title: string,
  fieldType: ChecklistFieldType,
  sortOrder: number
): OperationalChecklistTemplateItem {
  return {
    id,
    title,
    fieldType,
    required: true,
    sortOrder,
  }
}

export const DEMO_COMPANY_CHECKLISTS: Array<{
  serviceType: WorkOrderServiceType
  items: OperationalChecklistTemplateItem[]
}> = [
  {
    serviceType: "instalacion-nueva",
    items: [
      checklistItem("demo-inst-domicilio", "Verificar domicilio", "confirmacion", 1),
      checklistItem("demo-inst-equipo", "Verificar equipo", "confirmacion", 2),
      checklistItem("demo-inst-cableado", "Cableado realizado", "confirmacion", 3),
      checklistItem("demo-inst-senal", "Señal verificada", "confirmacion", 4),
      checklistItem("demo-inst-prueba", "Prueba de servicio", "entrada-datos", 5),
      checklistItem("demo-inst-foto", "Tomar fotografía", "fotografia", 6),
    ],
  },
  {
    serviceType: "service-tecnico",
    items: [
      checklistItem("demo-mant-equipo", "Revisar equipo", "confirmacion", 1),
      checklistItem("demo-mant-alimentacion", "Revisar alimentación", "confirmacion", 2),
      checklistItem("demo-mant-conectores", "Revisar conectores", "confirmacion", 3),
      checklistItem("demo-mant-senal", "Verificar señal", "confirmacion", 4),
      checklistItem("demo-mant-obs", "Observaciones", "entrada-datos", 5),
      checklistItem("demo-mant-foto", "Tomar fotografía", "fotografia", 6),
    ],
  },
  {
    serviceType: "relevamiento",
    items: [
      checklistItem("demo-tend-tramo", "Tramo identificado", "confirmacion", 1),
      checklistItem("demo-tend-cable", "Cable instalado", "confirmacion", 2),
      checklistItem("demo-tend-empalmes", "Empalmes realizados", "confirmacion", 3),
      checklistItem("demo-tend-senal", "Señal verificada", "confirmacion", 4),
      checklistItem("demo-tend-foto", "Tomar fotografía", "fotografia", 5),
    ],
  },
  {
    serviceType: "inspeccion-tecnica",
    items: [
      checklistItem("demo-insp-equipo", "Revisar equipo", "confirmacion", 1),
      checklistItem("demo-insp-senal", "Verificar señal", "confirmacion", 2),
      checklistItem("demo-insp-obs", "Observaciones", "entrada-datos", 3),
      checklistItem("demo-insp-foto", "Tomar fotografía", "fotografia", 4),
    ],
  },
]

export function isDemoCordobaCoordinate(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): boolean {
  if (latitude == null || longitude == null) {
    return false
  }

  return latitude < -31.2 && latitude > -31.55 && longitude < -64.05 && longitude > -64.35
}
