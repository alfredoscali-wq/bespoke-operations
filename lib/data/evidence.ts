import type {
  EvidenceFilters,
  EvidenceNavigation,
  EvidenceRecord,
  EvidenceSummary,
  ProjectEvidenceStats,
  TaskEvidenceStats,
} from "@/lib/types/evidence"
import { isDocumentType } from "@/lib/evidence/constants"
import {
  enrichEvidenceRecords,
  type BaseEvidenceRecord,
} from "@/lib/data/evidence-enrichment"

const baseEvidence: BaseEvidenceRecord[] = [
  {
    id: "ev-001",
    fileName: "EMP-042_fusion_antes.jpg",
    type: "photo",
    projectId: "proj-001",
    projectCode: "FO-2026-001",
    projectName: "Despliegue FTTH Zona Norte — Sector B",
    taskId: "task-001",
    taskCode: "TSK-001",
    taskTitle: "Empalme FO Sector B14",
    crew: "Cuadrilla Norte",
    worker: "J. Ramírez",
    uploadedAt: "2026-06-12T09:30:00",
    status: "pending-review",
    description: "Vista de caja de empalme EMP-042 antes de fusión por calor.",
    category: "Empalmes",
    comments: [
      {
        id: "ec-1",
        author: "Ing. Roberto Méndez",
        role: "supervisor",
        content: "Verificar etiquetado de fibras antes de cerrar caja.",
        timestamp: "2026-06-12T10:00:00",
      },
    ],
  },
  {
    id: "ev-002",
    fileName: "OTDR_tramo_B10.pdf",
    type: "pdf",
    projectId: "proj-001",
    projectCode: "FO-2026-001",
    projectName: "Despliegue FTTH Zona Norte — Sector B",
    taskId: "task-002",
    taskCode: "TSK-002",
    taskTitle: "Certificación OTDR Tramo B-12",
    crew: "Cuadrilla Alpha",
    worker: "Cuadrilla Alpha",
    uploadedAt: "2026-06-11T14:20:00",
    status: "approved",
    description: "Reporte OTDR bidireccional tramo B-10 a B-12.",
    category: "Certificación",
    comments: [],
  },
  {
    id: "ev-003",
    fileName: "camara_PTZ_norte_instalada.jpg",
    type: "photo",
    projectId: "proj-002",
    projectCode: "CAM-2026-004",
    projectName: "Videovigilancia Parque Industrial Santa Fe",
    taskId: "task-003",
    taskCode: "TSK-003",
    taskTitle: "Instalación Cámara PTZ",
    crew: "Cuadrilla Bravo",
    worker: "R. Vega",
    uploadedAt: "2026-06-12T08:15:00",
    status: "pending-review",
    description: "Cámara PTZ montada en poste de 8 m — acceso norte.",
    category: "Instalación",
    comments: [
      {
        id: "ec-2",
        author: "Ing. Ana Torres",
        role: "supervisor",
        content: "Verificar alineación y campo de visión.",
        timestamp: "2026-06-12T09:00:00",
      },
    ],
  },
  {
    id: "ev-004",
    fileName: "plano_tendido_sector_B_rev3.pdf",
    type: "plan",
    projectId: "proj-001",
    projectCode: "FO-2026-001",
    projectName: "Despliegue FTTH Zona Norte — Sector B",
    taskId: "task-001",
    taskCode: "TSK-001",
    taskTitle: "Empalme FO Sector B14",
    crew: "Cuadrilla Norte",
    worker: "Ing. Roberto Méndez",
    uploadedAt: "2026-06-10T08:00:00",
    status: "approved",
    description: "Plano de tendido Sector B revisión 3.",
    category: "Planos",
    comments: [],
  },
  {
    id: "ev-005",
    fileName: "poste_km42_verticalidad.mp4",
    type: "video",
    projectId: "proj-010",
    projectCode: "PST-2026-002",
    projectName: "Replanteo Postes Av. Insurgentes",
    taskId: "task-006",
    taskCode: "TSK-006",
    taskTitle: "Verificar altura de poste km 4.2",
    crew: "Cuadrilla Postación",
    worker: "M. Soto",
    uploadedAt: "2026-06-11T11:30:00",
    status: "approved",
    description: "Medición de verticalidad con nivel digital.",
    category: "Inspección",
    comments: [],
  },
  {
    id: "ev-006",
    fileName: "tendido_calle_hidalgo_progreso.jpg",
    type: "photo",
    projectId: "proj-001",
    projectCode: "FO-2026-001",
    projectName: "Despliegue FTTH Zona Norte — Sector B",
    taskId: "task-007",
    taskCode: "TSK-007",
    taskTitle: "Tendido ducto subterráneo calle Hidalgo",
    crew: "Cuadrilla Charlie",
    worker: "L. Hernández",
    uploadedAt: "2026-06-12T07:00:00",
    status: "pending-review",
    description: "Avance de tendido subterráneo — 180 m completados.",
    category: "Tendido",
    comments: [],
  },
  {
    id: "ev-007",
    fileName: "NVR_canales_1-16_config.pdf",
    type: "pdf",
    projectId: "proj-002",
    projectCode: "CAM-2026-004",
    projectName: "Videovigilancia Parque Industrial Santa Fe",
    taskId: "task-008",
    taskCode: "TSK-008",
    taskTitle: "Configuración NVR canales 1-16",
    crew: "Cuadrilla Wireless",
    worker: "Cuadrilla Wireless",
    uploadedAt: "2026-06-10T16:45:00",
    status: "approved",
    description: "Captura de configuración NVR y prueba de grabación.",
    category: "Configuración",
    comments: [],
  },
  {
    id: "ev-008",
    fileName: "antena_PTP_alineacion.jpg",
    type: "photo",
    projectId: "proj-003",
    projectCode: "WLS-2026-002",
    projectName: "Backhaul Wireless Torre Sur — Enlace PTP",
    taskId: "task-004",
    taskCode: "TSK-004",
    taskTitle: "Alineación antenas enlace PTP 5 GHz",
    crew: "Cuadrilla Wireless",
    worker: "Cuadrilla Wireless",
    uploadedAt: "2026-06-09T15:30:00",
    status: "rejected",
    description: "Foto de alineación — RSSI insuficiente en captura.",
    category: "Wireless",
    comments: [
      {
        id: "ec-3",
        author: "Ing. Carlos Ruiz",
        role: "supervisor",
        content: "Repetir alineación. RSSI debe ser -65 dBm o mejor.",
        timestamp: "2026-06-10T08:00:00",
      },
    ],
  },
  {
    id: "ev-009",
    fileName: "replanteo_lote3_punto_12.jpg",
    type: "photo",
    projectId: "proj-004",
    projectCode: "PST-2026-007",
    projectName: "Infraestructura de Postes — Circuito 9",
    taskId: "task-005",
    taskCode: "TSK-005",
    taskTitle: "Replanteo postes Lote 3 — Circuito 9",
    crew: "Cuadrilla Postación",
    worker: "M. Soto",
    uploadedAt: "2026-06-11T08:00:00",
    status: "pending-review",
    description: "Replanteo topográfico punto 12 de 24.",
    category: "Replanteo",
    comments: [],
  },
  {
    id: "ev-010",
    fileName: "empalme_las_palmas_lote_sur.pdf",
    type: "pdf",
    projectId: "proj-005",
    projectCode: "FO-2026-008",
    projectName: "Fibra Residencial Col. Las Palmas",
    taskId: "task-012",
    taskCode: "TSK-012",
    taskTitle: "Prueba de continuidad empalmes Col. Las Palmas",
    crew: "Cuadrilla Charlie",
    worker: "L. Hernández",
    uploadedAt: "2026-06-08T11:00:00",
    status: "approved",
    description: "Reporte de continuidad 18 empalmes lote sur.",
    category: "Certificación",
    comments: [],
  },
  {
    id: "ev-011",
    fileName: "caja_EMP041_despues_fusion.jpg",
    type: "photo",
    projectId: "proj-001",
    projectCode: "FO-2026-001",
    projectName: "Despliegue FTTH Zona Norte — Sector B",
    taskId: "task-001",
    taskCode: "TSK-001",
    taskTitle: "Empalme FO Sector B14",
    crew: "Cuadrilla Norte",
    worker: "J. Ramírez",
    uploadedAt: "2026-06-12T11:45:00",
    status: "pending-review",
    description: "Caja EMP-041 después de fusión — bandejas organizadas.",
    category: "Empalmes",
    comments: [],
  },
  {
    id: "ev-012",
    fileName: "cableado_estructurado_rack.jpg",
    type: "photo",
    projectId: "proj-002",
    projectCode: "CAM-2026-004",
    projectName: "Videovigilancia Parque Industrial Santa Fe",
    taskId: "task-016",
    taskCode: "TSK-016",
    taskTitle: "Cableado estructurado sala de monitoreo",
    crew: "Cuadrilla Bravo",
    worker: "R. Vega",
    uploadedAt: "2026-06-07T14:30:00",
    status: "approved",
    description: "Organización de patch panel en rack principal.",
    category: "Cableado",
    comments: [],
  },
  {
    id: "ev-013",
    fileName: "poste_km8_sustitucion_inicio.jpg",
    type: "photo",
    projectId: "proj-010",
    projectCode: "PST-2026-002",
    projectName: "Replanteo Postes Av. Insurgentes",
    taskId: "task-014",
    taskCode: "TSK-014",
    taskTitle: "Sustitución poste concreto km 8",
    crew: "Cuadrilla Postación",
    worker: "M. Soto",
    uploadedAt: "2026-06-12T06:30:00",
    status: "pending-review",
    description: "Inicio de retiro de poste de concreto deteriorado.",
    category: "Postes",
    comments: [],
  },
  {
    id: "ev-014",
    fileName: "layout_camaras_planta_baja.pdf",
    type: "plan",
    projectId: "proj-002",
    projectCode: "CAM-2026-004",
    projectName: "Videovigilancia Parque Industrial Santa Fe",
    taskId: "task-003",
    taskCode: "TSK-003",
    taskTitle: "Instalación Cámara PTZ",
    crew: "Cuadrilla Bravo",
    worker: "Ing. Ana Torres",
    uploadedAt: "2026-06-05T10:00:00",
    status: "approved",
    description: "Layout de cámaras — planta baja parque industrial.",
    category: "Planos",
    comments: [],
  },
  {
    id: "ev-015",
    fileName: "inspeccion_empalmes_sector4.jpg",
    type: "photo",
    projectId: "proj-008",
    projectCode: "MNT-2026-003",
    projectName: "Mantenimiento Preventivo Red Troncal",
    taskId: "task-009",
    taskCode: "TSK-009",
    taskTitle: "Inspección empalmes trimestral — Troncal",
    crew: "Cuadrilla Alpha",
    worker: "Cuadrilla Alpha",
    uploadedAt: "2026-06-06T09:15:00",
    status: "approved",
    description: "Estado de cajas de empalme sector 4 antes de limpieza.",
    category: "Mantenimiento",
    comments: [],
  },
  {
    id: "ev-016",
    fileName: "torre_sur_antena_montaje.mp4",
    type: "video",
    projectId: "proj-003",
    projectCode: "WLS-2026-002",
    projectName: "Backhaul Wireless Torre Sur — Enlace PTP",
    taskId: "task-013",
    taskCode: "TSK-013",
    taskTitle: "Montaje antena sectorial torre este",
    crew: "Cuadrilla Wireless",
    worker: "Cuadrilla Wireless",
    uploadedAt: "2026-06-11T13:00:00",
    status: "pending-review",
    description: "Video de montaje de antena sectorial en torre de 24 m.",
    category: "Wireless",
    comments: [],
  },
  {
    id: "ev-017",
    fileName: "canalizacion_centro_historico.pdf",
    type: "plan",
    projectId: "proj-009",
    projectCode: "FO-2025-042",
    projectName: "Fibra Centro Histórico — Fase 2",
    taskId: "task-010",
    taskCode: "TSK-010",
    taskTitle: "Levantamiento topográfico ruta fibra",
    crew: "Cuadrilla Foxtrot",
    worker: "Cuadrilla Foxtrot",
    uploadedAt: "2025-11-05T11:00:00",
    status: "approved",
    description: "Plano de canalización subterránea zona patrimonial.",
    category: "Planos",
    comments: [],
  },
  {
    id: "ev-018",
    fileName: "vista_aerea_tendido_morelos.jpg",
    type: "photo",
    projectId: "proj-001",
    projectCode: "FO-2026-001",
    projectName: "Despliegue FTTH Zona Norte — Sector B",
    taskId: "task-001",
    taskCode: "TSK-001",
    taskTitle: "Empalme FO Sector B14",
    crew: "Cuadrilla Norte",
    worker: "M. Soto",
    uploadedAt: "2026-06-11T16:45:00",
    status: "approved",
    description: "Vista aérea de tendido en calle Morelos.",
    category: "Tendido",
    comments: [],
  },
]

export const mockEvidence: EvidenceRecord[] = enrichEvidenceRecords(baseEvidence)

export function createEvidenceFromInput(
  input: Omit<BaseEvidenceRecord, "id"> & { id?: string }
): EvidenceRecord {
  return enrichEvidenceRecords([
    {
      id: input.id ?? `ev-${Date.now()}`,
      fileName: input.fileName,
      type: input.type,
      projectId: input.projectId,
      projectCode: input.projectCode,
      projectName: input.projectName,
      taskId: input.taskId,
      taskCode: input.taskCode,
      taskTitle: input.taskTitle,
      crew: input.crew,
      worker: input.worker,
      uploadedAt: input.uploadedAt,
      status: input.status,
      description: input.description,
      category: input.category,
      comments: input.comments,
    },
  ])[0]
}

export function getEvidenceSummary(
  evidence: EvidenceRecord[]
): EvidenceSummary {
  return {
    total: evidence.length,
    photos: evidence.filter((item) => item.type === "photo").length,
    documents: evidence.filter((item) => isDocumentType(item.type)).length,
    pendingReview: evidence.filter(
      (item) => item.status === "pending-review"
    ).length,
  }
}

export function getEvidenceById(
  id: string,
  evidence = mockEvidence
): EvidenceRecord | undefined {
  return evidence.find((item) => item.id === id)
}

export function getProjectEvidenceStats(
  projectId: string,
  evidence = mockEvidence
): ProjectEvidenceStats {
  const items = evidence.filter((item) => item.projectId === projectId)
  const sorted = [...items].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  )

  return {
    totalPhotos: items.filter((item) => item.type === "photo").length,
    totalDocuments: items.filter((item) => isDocumentType(item.type)).length,
    lastUploadedAt: sorted[0]?.uploadedAt ?? null,
  }
}

export function getTaskEvidenceStats(
  taskId: string,
  evidence = mockEvidence
): TaskEvidenceStats {
  const items = evidence.filter((item) => item.taskId === taskId)
  const sorted = [...items].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  )

  return {
    count: items.length,
    lastUploadedAt: sorted[0]?.uploadedAt ?? null,
  }
}

export function getEvidenceByProjectId(
  projectId: string,
  evidence: EvidenceRecord[] = []
): EvidenceRecord[] {
  return evidence.filter(
    (item) => item.projectId === projectId || getEvidenceProjectKey(item) === projectId
  )
}

export function getEvidenceByTaskId(
  taskId: string,
  evidence = mockEvidence
): EvidenceRecord[] {
  return evidence.filter((item) => item.taskId === taskId)
}

export const defaultEvidenceFilters: EvidenceFilters = {
  search: "",
  projectId: "all",
  taskId: "all",
  crew: "all",
  worker: "all",
  dateFrom: "",
  dateTo: "",
  fileType: "all",
  evidenceType: "all",
}

export function getEvidenceProjectKey(item: Pick<EvidenceRecord, "projectId" | "projectCode">) {
  return item.projectId || `code:${item.projectCode}`
}

export function getEvidenceTaskKey(item: Pick<EvidenceRecord, "taskId" | "taskCode">) {
  return item.taskId || `code:${item.taskCode}`
}

export function filterEvidence(
  evidence: EvidenceRecord[],
  filters: EvidenceFilters
): EvidenceRecord[] {
  const query = filters.search.trim().toLowerCase()

  return evidence.filter((item) => {
    const uploadedDate = item.uploadedAt.slice(0, 10)

    const matchesSearch =
      query === "" ||
      item.fileName.toLowerCase().includes(query) ||
      item.projectCode.toLowerCase().includes(query) ||
      item.taskCode.toLowerCase().includes(query) ||
      item.worker.toLowerCase().includes(query)

    const matchesProject =
      filters.projectId === "all" ||
      getEvidenceProjectKey(item) === filters.projectId

    const matchesTask =
      filters.taskId === "all" || getEvidenceTaskKey(item) === filters.taskId

    const matchesCrew =
      filters.crew === "all" || item.crew === filters.crew

    const matchesWorker =
      filters.worker === "all" || item.worker === filters.worker

    const matchesDateFrom =
      filters.dateFrom === "" || uploadedDate >= filters.dateFrom

    const matchesDateTo =
      filters.dateTo === "" || uploadedDate <= filters.dateTo

    const matchesType =
      filters.fileType === "all" ||
      (filters.fileType === "document" && isDocumentType(item.type)) ||
      item.type === filters.fileType

    const matchesEvidenceType =
      filters.evidenceType === "all" ||
      item.evidenceType === filters.evidenceType

    return (
      matchesSearch &&
      matchesProject &&
      matchesTask &&
      matchesCrew &&
      matchesWorker &&
      matchesDateFrom &&
      matchesDateTo &&
      matchesType &&
      matchesEvidenceType
    )
  })
}

export function getEvidenceFilterOptions(evidence: EvidenceRecord[]) {
  const projects = new Map<string, { id: string; code: string; name: string }>()
  const tasks = new Map<string, { id: string; code: string; title: string }>()

  evidence.forEach((item) => {
    const projectKey = getEvidenceProjectKey(item)
    const taskKey = getEvidenceTaskKey(item)

    projects.set(projectKey, {
      id: projectKey,
      code: item.projectCode,
      name: item.projectName,
    })
    tasks.set(taskKey, {
      id: taskKey,
      code: item.taskCode,
      title: item.taskTitle,
    })
  })

  return {
    projects: Array.from(projects.values()),
    tasks: Array.from(tasks.values()),
  }
}

export function getEvidenceNavigation(
  currentId: string,
  evidence: EvidenceRecord[]
): EvidenceNavigation {
  const current = evidence.find((item) => item.id === currentId)
  if (!current) {
    return { prevId: null, nextId: null, currentIndex: 0, totalInTask: 0 }
  }

  const taskEvidence = getEvidenceByTaskId(current.taskId, evidence).sort(
    (a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
  )

  const currentIndex = taskEvidence.findIndex((item) => item.id === currentId)

  return {
    prevId: currentIndex > 0 ? taskEvidence[currentIndex - 1].id : null,
    nextId:
      currentIndex < taskEvidence.length - 1
        ? taskEvidence[currentIndex + 1].id
        : null,
    currentIndex: currentIndex + 1,
    totalInTask: taskEvidence.length,
  }
}
