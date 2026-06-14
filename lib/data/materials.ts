import { resolveMaterialStatus } from "@/lib/materials/constants"
import type {
  EntityMaterialsStats,
  Material,
  MaterialAssignment,
  MaterialDetail,
  MaterialFilters,
  MaterialHistoryEvent,
  MaterialMovement,
  MaterialsSummary,
} from "@/lib/types/materials"

const TODAY = "2026-06-13"

export const mockMaterials: Material[] = [
  {
    id: "mat-001",
    code: "FO-SM-G652D-24",
    name: "Cable FO monomodo G.652D — 24 fibras",
    category: "fiber-optic",
    stock: 1840,
    minStock: 500,
    unit: "m",
    warehouse: "Bodega Norte — Sector B",
    status: "available",
    description:
      "Cable de fibra óptica monomodo para tendido aéreo y ducto subterráneo FTTH.",
    manufacturer: "Corning",
  },
  {
    id: "mat-002",
    code: "EMP-BOX-DOMO-48",
    name: "Caja de empalme domo 48 fibras",
    category: "fiber-optic",
    stock: 18,
    minStock: 20,
    unit: "pza",
    warehouse: "Bodega Norte — Sector B",
    status: "low-stock",
    description: "Caja tipo domo para empalmes por fusión en poste o fachada.",
    manufacturer: "CommScope",
  },
  {
    id: "mat-003",
    code: "CAM-PTZ-4MP-IR",
    name: "Cámara IP PTZ 4MP IR 150m",
    category: "cameras",
    stock: 12,
    minStock: 8,
    unit: "pza",
    warehouse: "Bodega Querétaro — PI",
    status: "available",
    description:
      "Cámara PTZ IP para videovigilancia perimetral con zoom óptico 25x.",
    manufacturer: "Hikvision",
  },
  {
    id: "mat-004",
    code: "CAT6A-UTP-305",
    name: "Cable UTP Cat6A blindado 305 m",
    category: "network-equipment",
    stock: 24,
    minStock: 10,
    unit: "rollo",
    warehouse: "Bodega Querétaro — PI",
    status: "available",
    description: "Cable estructurado Cat6A para enlaces de cámara a NVR.",
    manufacturer: "Panduit",
  },
  {
    id: "mat-005",
    code: "ANT-PTP-5GHZ-30",
    name: "Antena PTP 5 GHz 30 dBi",
    category: "wireless",
    stock: 4,
    minStock: 6,
    unit: "pza",
    warehouse: "Bodega Wireless — GDL",
    status: "low-stock",
    description: "Antena parabólica punto a punto para enlaces backhaul.",
    manufacturer: "Ubiquiti",
  },
  {
    id: "mat-006",
    code: "PST-MET-12M",
    name: "Poste metálico galvanizado 12 m",
    category: "pole-infrastructure",
    stock: 32,
    minStock: 15,
    unit: "pza",
    warehouse: "Patio Postes — PUE",
    status: "available",
    description: "Poste tubular metálico para soporte de fibra y equipos.",
    manufacturer: "InfraRed Nacional",
  },
  {
    id: "mat-007",
    code: "FUS-KIT-MECH-12",
    name: "Kit fusión mecánica 12 unidades",
    category: "consumables",
    stock: 45,
    minStock: 30,
    unit: "kit",
    warehouse: "Bodega Norte — Sector B",
    status: "available",
    description: "Protectores y sleeves para empalmes mecánicos de fibra.",
    manufacturer: "3M",
  },
  {
    id: "mat-008",
    code: "NVR-32CH-4K",
    name: "NVR 32 canales 4K PoE",
    category: "cameras",
    stock: 3,
    minStock: 4,
    unit: "pza",
    warehouse: "Bodega Querétaro — PI",
    status: "low-stock",
    description: "Grabador de video en red para sistema CCTV industrial.",
    manufacturer: "Hikvision",
  },
  {
    id: "mat-009",
    code: "PATCH-SM-LC-3M",
    name: "Patch cord SM LC/LC 3 m",
    category: "consumables",
    stock: 120,
    minStock: 50,
    unit: "pza",
    warehouse: "Almacén Central — MTY",
    status: "available",
    description: "Cordón de parcheo monomodo para rack de telecomunicaciones.",
    manufacturer: "FibreFab",
  },
  {
    id: "mat-010",
    code: "OTDR-MOD-1625",
    name: "Módulo OTDR portátil 1625 nm",
    category: "network-equipment",
    stock: 2,
    minStock: 2,
    unit: "pza",
    warehouse: "Almacén Central — MTY",
    status: "low-stock",
    description: "Equipo de certificación OTDR para tramos de fibra troncal.",
    manufacturer: "EXFO",
  },
  {
    id: "mat-011",
    code: "DUCT-HDPE-40",
    name: "Ducto HDPE corrugado 40 mm",
    category: "fiber-optic",
    stock: 960,
    minStock: 300,
    unit: "m",
    warehouse: "Bodega Norte — Sector B",
    status: "available",
    description: "Ducto subterráneo para canalización de fibra óptica.",
    manufacturer: "Mexichem",
  },
  {
    id: "mat-012",
    code: "POE-INJ-30W",
    name: "Inyector PoE+ 30 W gigabit",
    category: "network-equipment",
    stock: 0,
    minStock: 15,
    unit: "pza",
    warehouse: "Bodega Querétaro — PI",
    status: "out-of-stock",
    description: "Inyector PoE para alimentación de cámaras IP en campo.",
    manufacturer: "TP-Link",
  },
  {
    id: "mat-013",
    code: "RADIO-PTP-5G-1G",
    name: "Radio PTP 5 GHz 1 Gbps",
    category: "wireless",
    stock: 6,
    minStock: 4,
    unit: "pza",
    warehouse: "Bodega Wireless — GDL",
    status: "available",
    description: "Radio backhaul punto a punto para enlaces torre a torre.",
    manufacturer: "Ceragon",
  },
  {
    id: "mat-014",
    code: "ANC-HEAVY-1T",
    name: "Anclaje pesado 1 tonelada",
    category: "pole-infrastructure",
    stock: 48,
    minStock: 24,
    unit: "pza",
    warehouse: "Patio Postes — PUE",
    status: "available",
    description: "Anclaje de guy wire para postes en línea de transmisión.",
    manufacturer: "InfraRed Nacional",
  },
  {
    id: "mat-015",
    code: "CLEAVE-PEN-FO",
    name: "Cleaver de precisión FO",
    category: "consumables",
    stock: 8,
    minStock: 5,
    unit: "pza",
    warehouse: "Almacén Central — MTY",
    status: "available",
    description: "Cortadora de fibra para preparación de empalmes por fusión.",
    manufacturer: "Fujikura",
  },
]

export const mockMaterialAssignments: MaterialAssignment[] = [
  {
    id: "asg-001",
    materialId: "mat-001",
    projectId: "proj-001",
    projectCode: "FO-2026-001",
    projectName: "Despliegue FTTH Zona Norte — Sector B",
    taskId: "task-001",
    taskCode: "TSK-001",
    taskTitle: "Empalme FO Sector B14",
    crewId: "crew-norte",
    crewName: "Cuadrilla Norte",
    quantity: 420,
    unit: "m",
    assignedAt: "2026-06-10T08:00:00",
    status: "in-use",
  },
  {
    id: "asg-002",
    materialId: "mat-002",
    projectId: "proj-001",
    projectCode: "FO-2026-001",
    projectName: "Despliegue FTTH Zona Norte — Sector B",
    taskId: "task-001",
    taskCode: "TSK-001",
    taskTitle: "Empalme FO Sector B14",
    crewId: "crew-norte",
    crewName: "Cuadrilla Norte",
    quantity: 2,
    unit: "pza",
    assignedAt: "2026-06-10T08:00:00",
    status: "in-use",
  },
  {
    id: "asg-003",
    materialId: "mat-007",
    projectId: "proj-001",
    projectCode: "FO-2026-001",
    projectName: "Despliegue FTTH Zona Norte — Sector B",
    taskId: "task-001",
    taskCode: "TSK-001",
    taskTitle: "Empalme FO Sector B14",
    crewId: "crew-norte",
    crewName: "Cuadrilla Norte",
    quantity: 3,
    unit: "kit",
    assignedAt: "2026-06-10T08:00:00",
    status: "consumed",
  },
  {
    id: "asg-004",
    materialId: "mat-003",
    projectId: "proj-002",
    projectCode: "CAM-2026-004",
    projectName: "Videovigilancia Parque Industrial Santa Fe",
    taskId: "task-003",
    taskCode: "TSK-003",
    taskTitle: "Instalación Cámara PTZ",
    crewId: "crew-bravo",
    crewName: "Cuadrilla Bravo",
    quantity: 1,
    unit: "pza",
    assignedAt: "2026-06-11T07:30:00",
    status: "in-use",
  },
  {
    id: "asg-005",
    materialId: "mat-004",
    projectId: "proj-002",
    projectCode: "CAM-2026-004",
    projectName: "Videovigilancia Parque Industrial Santa Fe",
    taskId: "task-003",
    taskCode: "TSK-003",
    taskTitle: "Instalación Cámara PTZ",
    crewId: "crew-bravo",
    crewName: "Cuadrilla Bravo",
    quantity: 2,
    unit: "rollo",
    assignedAt: "2026-06-11T07:30:00",
    status: "in-use",
  },
  {
    id: "asg-006",
    materialId: "mat-005",
    projectId: "proj-003",
    projectCode: "WLS-2026-002",
    projectName: "Backhaul Wireless Torre Sur — Enlace PTP",
    taskId: "task-004",
    taskCode: "TSK-004",
    taskTitle: "Alineación antenas enlace PTP 5 GHz",
    crewId: "crew-echo",
    crewName: "Cuadrilla Wireless",
    quantity: 2,
    unit: "pza",
    assignedAt: "2026-06-12T09:00:00",
    status: "assigned",
  },
  {
    id: "asg-007",
    materialId: "mat-013",
    projectId: "proj-003",
    projectCode: "WLS-2026-002",
    projectName: "Backhaul Wireless Torre Sur — Enlace PTP",
    taskId: "task-013",
    taskCode: "TSK-013",
    taskTitle: "Montaje antena sectorial torre este",
    crewId: "crew-echo",
    crewName: "Cuadrilla Wireless",
    quantity: 1,
    unit: "pza",
    assignedAt: "2026-06-11T14:00:00",
    status: "assigned",
  },
  {
    id: "asg-008",
    materialId: "mat-006",
    projectId: "proj-010",
    projectCode: "PST-2026-002",
    projectName: "Replanteo Postes Av. Insurgentes",
    taskId: "task-014",
    taskCode: "TSK-014",
    taskTitle: "Sustitución poste concreto km 8",
    crewId: "crew-delta",
    crewName: "Cuadrilla Postación",
    quantity: 1,
    unit: "pza",
    assignedAt: "2026-06-10T06:30:00",
    status: "in-use",
  },
  {
    id: "asg-009",
    materialId: "mat-011",
    projectId: "proj-001",
    projectCode: "FO-2026-001",
    projectName: "Despliegue FTTH Zona Norte — Sector B",
    taskId: "task-007",
    taskCode: "TSK-007",
    taskTitle: "Tendido ducto subterráneo calle Hidalgo",
    crewId: "crew-charlie",
    crewName: "Cuadrilla Charlie",
    quantity: 420,
    unit: "m",
    assignedAt: "2026-06-13T07:00:00",
    status: "assigned",
  },
  {
    id: "asg-010",
    materialId: "mat-010",
    projectId: "proj-001",
    projectCode: "FO-2026-001",
    projectName: "Despliegue FTTH Zona Norte — Sector B",
    taskId: "task-002",
    taskCode: "TSK-002",
    taskTitle: "Certificación OTDR Tramo B-12",
    crewId: "crew-alpha",
    crewName: "Cuadrilla Alpha",
    quantity: 1,
    unit: "pza",
    assignedAt: "2026-06-12T08:00:00",
    status: "in-use",
  },
  {
    id: "asg-011",
    materialId: "mat-008",
    projectId: "proj-002",
    projectCode: "CAM-2026-004",
    projectName: "Videovigilancia Parque Industrial Santa Fe",
    taskId: "task-008",
    taskCode: "TSK-008",
    taskTitle: "Configuración NVR canales 1-16",
    crewId: "crew-echo",
    crewName: "Cuadrilla Wireless",
    quantity: 1,
    unit: "pza",
    assignedAt: "2026-06-05T10:00:00",
    status: "consumed",
  },
  {
    id: "asg-012",
    materialId: "mat-014",
    projectId: "proj-004",
    projectCode: "PST-2026-007",
    projectName: "Infraestructura de Postes — Circuito 9",
    taskId: "task-005",
    taskCode: "TSK-005",
    taskTitle: "Replanteo postes Lote 3 — Circuito 9",
    crewId: "crew-delta",
    crewName: "Cuadrilla Postación",
    quantity: 24,
    unit: "pza",
    assignedAt: "2026-06-15T08:00:00",
    status: "assigned",
  },
]

export const mockMaterialMovements: MaterialMovement[] = [
  {
    id: "mov-001",
    materialId: "mat-001",
    type: "outbound",
    quantity: 420,
    timestamp: "2026-06-13T08:15:00",
    user: "Almacén Norte",
    reference: "SAL-2026-0412",
    projectId: "proj-001",
    projectCode: "FO-2026-001",
    taskId: "task-001",
    taskCode: "TSK-001",
    crewId: "crew-norte",
    crewName: "Cuadrilla Norte",
    notes: "Salida para empalme sector B14",
  },
  {
    id: "mov-002",
    materialId: "mat-011",
    type: "outbound",
    quantity: 420,
    timestamp: "2026-06-13T07:45:00",
    user: "Almacén Norte",
    reference: "SAL-2026-0411",
    projectId: "proj-001",
    projectCode: "FO-2026-001",
    taskId: "task-007",
    taskCode: "TSK-007",
    crewId: "crew-charlie",
    crewName: "Cuadrilla Charlie",
    notes: "Ducto para tendido calle Hidalgo",
  },
  {
    id: "mov-003",
    materialId: "mat-003",
    type: "consumption",
    quantity: 1,
    timestamp: "2026-06-13T10:30:00",
    user: "Cuadrilla Bravo",
    reference: "CON-2026-0088",
    projectId: "proj-002",
    projectCode: "CAM-2026-004",
    taskId: "task-003",
    taskCode: "TSK-003",
    crewId: "crew-bravo",
    crewName: "Cuadrilla Bravo",
    notes: "Montaje cámara PTZ acceso norte",
  },
  {
    id: "mov-004",
    materialId: "mat-005",
    type: "transfer",
    quantity: 2,
    timestamp: "2026-06-13T09:00:00",
    user: "Logística Wireless",
    reference: "TRF-2026-0023",
    projectId: "proj-003",
    projectCode: "WLS-2026-002",
    taskId: "task-004",
    taskCode: "TSK-004",
    crewId: "crew-echo",
    crewName: "Cuadrilla Wireless",
    notes: "Transferencia GDL → Torre Sur",
  },
  {
    id: "mov-005",
    materialId: "mat-009",
    type: "inbound",
    quantity: 50,
    timestamp: "2026-06-13T11:00:00",
    user: "Compras",
    reference: "ENT-2026-0198",
    notes: "Recepción patch cords LC/LC",
  },
  {
    id: "mov-006",
    materialId: "mat-012",
    type: "outbound",
    quantity: 15,
    timestamp: "2026-06-12T16:00:00",
    user: "Bodega Querétaro",
    reference: "SAL-2026-0405",
    projectId: "proj-002",
    projectCode: "CAM-2026-004",
    taskId: "task-016",
    taskCode: "TSK-016",
    crewId: "crew-bravo",
    crewName: "Cuadrilla Bravo",
  },
  {
    id: "mov-007",
    materialId: "mat-002",
    type: "consumption",
    quantity: 1,
    timestamp: "2026-06-12T14:30:00",
    user: "Cuadrilla Norte",
    projectId: "proj-001",
    projectCode: "FO-2026-001",
    taskId: "task-001",
    taskCode: "TSK-001",
    crewId: "crew-norte",
    crewName: "Cuadrilla Norte",
  },
  {
    id: "mov-008",
    materialId: "mat-006",
    type: "outbound",
    quantity: 1,
    timestamp: "2026-06-12T06:45:00",
    user: "Patio Postes",
    projectId: "proj-010",
    projectCode: "PST-2026-002",
    taskId: "task-014",
    taskCode: "TSK-014",
    crewId: "crew-delta",
    crewName: "Cuadrilla Postación",
  },
  {
    id: "mov-009",
    materialId: "mat-010",
    type: "adjustment",
    quantity: -1,
    timestamp: "2026-06-11T17:00:00",
    user: "Control de Inventario",
    reference: "AJU-2026-0012",
    notes: "Ajuste por calibración de módulo OTDR",
  },
  {
    id: "mov-010",
    materialId: "mat-007",
    type: "inbound",
    quantity: 20,
    timestamp: "2026-06-10T09:00:00",
    user: "Compras",
    reference: "ENT-2026-0185",
  },
  {
    id: "mov-011",
    materialId: "mat-004",
    type: "outbound",
    quantity: 2,
    timestamp: "2026-06-11T07:30:00",
    user: "Bodega Querétaro",
    projectId: "proj-002",
    projectCode: "CAM-2026-004",
    taskId: "task-003",
    taskCode: "TSK-003",
    crewId: "crew-bravo",
    crewName: "Cuadrilla Bravo",
  },
  {
    id: "mov-012",
    materialId: "mat-001",
    type: "inbound",
    quantity: 2000,
    timestamp: "2026-06-08T10:00:00",
    user: "Compras",
    reference: "ENT-2026-0172",
    notes: "Recepción cable FO G.652D lote junio",
  },
]

export const mockMaterialHistory: MaterialHistoryEvent[] = [
  {
    id: "hist-001",
    materialId: "mat-001",
    title: "Stock actualizado",
    description: "Entrada de 2,000 m por recepción de compras.",
    user: "Compras",
    timestamp: "2026-06-08T10:00:00",
  },
  {
    id: "hist-002",
    materialId: "mat-002",
    title: "Alerta de stock bajo",
    description: "Inventario por debajo del mínimo (18/20 unidades).",
    user: "Sistema",
    timestamp: "2026-06-12T18:00:00",
  },
  {
    id: "hist-003",
    materialId: "mat-012",
    title: "Material agotado",
    description: "Stock en cero. Solicitud de compra pendiente.",
    user: "Sistema",
    timestamp: "2026-06-12T16:30:00",
  },
  {
    id: "hist-004",
    materialId: "mat-005",
    title: "Asignación a proyecto",
    description: "2 antenas asignadas a WLS-2026-002 / TSK-004.",
    user: "Logística Wireless",
    timestamp: "2026-06-12T09:00:00",
  },
  {
    id: "hist-005",
    materialId: "mat-010",
    title: "Ajuste de inventario",
    description: "Módulo OTDR enviado a calibración externa.",
    user: "Control de Inventario",
    timestamp: "2026-06-11T17:00:00",
  },
]

export const defaultMaterialFilters: MaterialFilters = {
  search: "",
  category: "all",
  status: "all",
  warehouse: "all",
}

export function getMaterialById(
  id: string,
  materials = mockMaterials
): Material | undefined {
  return materials.find((material) => material.id === id)
}

export function getMaterialByCode(
  code: string,
  materials = mockMaterials
): Material | undefined {
  return materials.find((material) => material.code === code)
}

export function getMaterialsSummary(
  materials = mockMaterials,
  movements = mockMaterialMovements,
  assignments = mockMaterialAssignments
): MaterialsSummary {
  const lowStockItems = materials.filter(
    (material) =>
      material.status === "low-stock" || material.status === "out-of-stock"
  ).length

  const todaysMovements = movements.filter(
    (movement) => movement.timestamp.slice(0, 10) === TODAY
  ).length

  const activeAssignments = assignments.filter(
    (assignment) =>
      assignment.status === "assigned" || assignment.status === "in-use"
  )

  return {
    totalMaterials: materials.length,
    lowStockItems,
    todaysMovements,
    assignedMaterials: activeAssignments.length,
  }
}

export function getMaterialMovements(
  materialId: string,
  movements = mockMaterialMovements
): MaterialMovement[] {
  return movements
    .filter((movement) => movement.materialId === materialId)
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
}

export function getMaterialAssignments(
  materialId: string,
  assignments = mockMaterialAssignments
): MaterialAssignment[] {
  return assignments.filter((assignment) => assignment.materialId === materialId)
}

export function getMaterialHistory(
  materialId: string,
  history = mockMaterialHistory
): MaterialHistoryEvent[] {
  return history
    .filter((event) => event.materialId === materialId)
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
}

export function getMaterialDetail(
  material: Material,
  movements = mockMaterialMovements,
  assignments = mockMaterialAssignments,
  history = mockMaterialHistory
): MaterialDetail {
  const materialMovements = getMaterialMovements(material.id, movements)
  const materialAssignments = getMaterialAssignments(material.id, assignments)
  const assignedQuantity = materialAssignments
    .filter(
      (assignment) =>
        assignment.status === "assigned" || assignment.status === "in-use"
    )
    .reduce((sum, assignment) => sum + assignment.quantity, 0)

  return {
    movements: materialMovements,
    assignments: materialAssignments,
    history: getMaterialHistory(material.id, history),
    stats: {
      assignedQuantity,
      totalMovements: materialMovements.length,
      lastMovementAt: materialMovements[0]?.timestamp ?? null,
    },
  }
}

export function getAssignmentsByTaskId(
  taskId: string,
  assignments = mockMaterialAssignments,
  materials = mockMaterials
) {
  return assignments
    .filter((assignment) => assignment.taskId === taskId)
    .map((assignment) => ({
      assignment,
      material: materials.find(
        (material) => material.id === assignment.materialId
      ),
    }))
    .filter(
      (
        item
      ): item is {
        assignment: MaterialAssignment
        material: Material
      } => Boolean(item.material)
    )
}

export function getAssignmentsByProjectId(
  projectId: string,
  assignments = mockMaterialAssignments,
  materials = mockMaterials
) {
  return assignments
    .filter((assignment) => assignment.projectId === projectId)
    .map((assignment) => ({
      assignment,
      material: materials.find(
        (material) => material.id === assignment.materialId
      ),
    }))
    .filter(
      (
        item
      ): item is {
        assignment: MaterialAssignment
        material: Material
      } => Boolean(item.material)
    )
}

export function getAssignmentsByCrewId(
  crewId: string,
  assignments = mockMaterialAssignments,
  materials = mockMaterials
) {
  return assignments
    .filter((assignment) => assignment.crewId === crewId)
    .map((assignment) => ({
      assignment,
      material: materials.find(
        (material) => material.id === assignment.materialId
      ),
    }))
    .filter(
      (
        item
      ): item is {
        assignment: MaterialAssignment
        material: Material
      } => Boolean(item.material)
    )
}

export function getTaskMaterialsStats(
  taskId: string,
  assignments = mockMaterialAssignments
): EntityMaterialsStats {
  const items = assignments.filter((assignment) => assignment.taskId === taskId)
  const materialIds = new Set(items.map((item) => item.materialId))

  return {
    totalItems: items.length,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    materialCount: materialIds.size,
  }
}

export function getProjectMaterialsStats(
  projectId: string,
  assignments = mockMaterialAssignments
): EntityMaterialsStats {
  const items = assignments.filter(
    (assignment) => assignment.projectId === projectId
  )
  const materialIds = new Set(items.map((item) => item.materialId))

  return {
    totalItems: items.length,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    materialCount: materialIds.size,
  }
}

export function getCrewMaterialsStats(
  crewId: string,
  assignments = mockMaterialAssignments
): EntityMaterialsStats {
  const items = assignments.filter((assignment) => assignment.crewId === crewId)
  const materialIds = new Set(items.map((item) => item.materialId))

  return {
    totalItems: items.length,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    materialCount: materialIds.size,
  }
}

export function getWarehouseOptions(materials = mockMaterials) {
  return Array.from(new Set(materials.map((material) => material.warehouse))).sort()
}

export function filterMaterials(
  materials: Material[],
  filters: MaterialFilters
): Material[] {
  const query = filters.search.trim().toLowerCase()

  return materials.filter((material) => {
    const matchesSearch =
      query === "" ||
      material.code.toLowerCase().includes(query) ||
      material.name.toLowerCase().includes(query) ||
      material.manufacturer.toLowerCase().includes(query)

    const matchesCategory =
      filters.category === "all" || material.category === filters.category

    const matchesStatus =
      filters.status === "all" || material.status === filters.status

    const matchesWarehouse =
      filters.warehouse === "all" || material.warehouse === filters.warehouse

    return (
      matchesSearch && matchesCategory && matchesStatus && matchesWarehouse
    )
  })
}
