import type {
  NewProjectInput,
  Project,
  ProjectDetail,
  ProjectTask,
} from "@/lib/types/projects"
import type { Task, TaskStatus } from "@/lib/types/tasks"
import { getEvidenceByProjectId, mockEvidence } from "@/lib/data/evidence"
import { mockTasks } from "@/lib/data/tasks"

export const mockProjects: Project[] = [
  {
    id: "proj-001",
    code: "FO-2026-001",
    name: "Despliegue FTTH Zona Norte — Sector B",
    client: "TeleRed México",
    type: "fiber",
    status: "active",
    progress: 78,
    startDate: "2026-01-15",
    endDate: "2026-06-30",
    supervisor: "Ing. Roberto Méndez",
    location: "Monterrey, N.L. — Col. Mitras y Anáhuac",
    description:
      "Tendido de 48 km de fibra óptica monomodo, instalación de cajas de empalme y certificación OTDR para red de acceso FTTH.",
  },
  {
    id: "proj-002",
    code: "CAM-2026-004",
    name: "Videovigilancia Parque Industrial Santa Fe",
    client: "Seguridad Integral SA",
    type: "camera",
    status: "active",
    progress: 62,
    startDate: "2026-02-01",
    endDate: "2026-05-15",
    supervisor: "Ing. Ana Torres",
    location: "Querétaro, Qro. — Parque Industrial",
    description:
      "Instalación de 32 cámaras IP PTZ, cableado estructurado Cat6A y configuración de NVR central con acceso remoto.",
  },
  {
    id: "proj-003",
    code: "WLS-2026-002",
    name: "Backhaul Wireless Torre Sur — Enlace PTP",
    client: "Conecta Wireless",
    type: "wireless",
    status: "active",
    progress: 54,
    startDate: "2026-01-28",
    endDate: "2026-04-20",
    supervisor: "Ing. Carlos Ruiz",
    location: "Guadalajara, Jal. — Torre Cerro del Cuatro",
    description:
      "Enlace punto a punto 5 GHz de 12 km, alineación de antenas, instalación de radios y pruebas de throughput.",
  },
  {
    id: "proj-004",
    code: "PST-2026-007",
    name: "Infraestructura de Postes — Circuito 9",
    client: "InfraRed Nacional",
    type: "pole",
    status: "paused",
    progress: 41,
    startDate: "2025-11-10",
    endDate: "2026-03-31",
    supervisor: "Ing. Patricia Vega",
    location: "Puebla, Pue. — Carretera Federal 190",
    description:
      "Instalación de 86 postes metálicos de 12 m, anclajes, plataformas de trabajo y señalización de seguridad.",
  },
  {
    id: "proj-005",
    code: "FO-2026-008",
    name: "Fibra Residencial Col. Las Palmas",
    client: "Fibra Hogar",
    type: "fiber",
    status: "pending-closure",
    progress: 94,
    startDate: "2025-09-01",
    endDate: "2026-02-28",
    supervisor: "Ing. Roberto Méndez",
    location: "León, Gto. — Col. Las Palmas",
    description:
      "Red de distribución FTTH para 1,200 viviendas con empalmes por zona y pruebas de continuidad por lote.",
  },
  {
    id: "proj-006",
    code: "CAM-2026-011",
    name: "CCTV Accesos Planta Manufactura",
    client: "Grupo Industrial del Bajío",
    type: "camera",
    status: "planned",
    progress: 8,
    startDate: "2026-03-15",
    endDate: "2026-07-30",
    supervisor: "Ing. Ana Torres",
    location: "Silao, Gto. — Zona Industrial",
    description:
      "Sistema de videovigilancia perimetral con reconocimiento de placas en accesos principales y subestaciones.",
  },
  {
    id: "proj-007",
    code: "WLS-2026-005",
    name: "Red Mesh Campus Universitario",
    client: "Universidad Tecnológica del Centro",
    type: "wireless",
    status: "planned",
    progress: 12,
    startDate: "2026-04-01",
    endDate: "2026-08-15",
    supervisor: "Ing. Carlos Ruiz",
    location: "Aguascalientes, Ags. — Campus Central",
    description:
      "Despliegue de red mesh Wi-Fi 6 en campus universitario con 48 puntos de acceso y backhaul inalámbrico.",
  },
  {
    id: "proj-008",
    code: "MNT-2026-003",
    name: "Mantenimiento Preventivo Red Troncal",
    client: "TeleRed México",
    type: "maintenance",
    status: "active",
    progress: 35,
    startDate: "2026-02-10",
    endDate: "2026-12-31",
    supervisor: "Ing. Patricia Vega",
    location: "CDMX — Corredor Insurgentes Sur",
    description:
      "Inspección trimestral de empalmes, limpieza de cajas, revisión de OTDR y actualización de documentación técnica.",
  },
  {
    id: "proj-009",
    code: "FO-2025-042",
    name: "Fibra Centro Histórico — Fase 2",
    client: "Gobierno Municipal",
    type: "fiber",
    status: "closed",
    progress: 100,
    startDate: "2025-03-01",
    endDate: "2025-12-15",
    supervisor: "Ing. Roberto Méndez",
    location: "San Luis Potosí, SLP — Centro Histórico",
    description:
      "Canalización subterránea y tendido de fibra en zona patrimonial con permisos especiales de INAH.",
  },
  {
    id: "proj-010",
    code: "PST-2026-002",
    name: "Replanteo Postes Av. Insurgentes",
    client: "InfraRed Nacional",
    type: "pole",
    status: "active",
    progress: 67,
    startDate: "2026-01-05",
    endDate: "2026-04-30",
    supervisor: "Ing. Patricia Vega",
    location: "CDMX — Av. Insurgentes Sur km 4–12",
    description:
      "Replanteo y sustitución de postes de concreto deteriorados con migración de líneas existentes.",
  },
]

const projectDetails: Record<string, ProjectDetail> = {
  "proj-001": {
    stats: {
      activeTasks: 6,
      completedTasks: 24,
      evidenceFiles: 142,
      progress: 78,
    },
    tasks: [
      {
        id: "t1",
        title: "Fusión tramo B-14 — caja EMP-042",
        assignee: "Cuadrilla Alpha",
        dueDate: "2026-06-13",
        priority: "alta",
        status: "en-curso",
      },
      {
        id: "t2",
        title: "Certificación OTDR tramo B-12 a B-14",
        assignee: "Cuadrilla Alpha",
        dueDate: "2026-06-14",
        priority: "alta",
        status: "pendiente",
      },
      {
        id: "t3",
        title: "Instalación caja de empalme EMP-043",
        assignee: "Cuadrilla Charlie",
        dueDate: "2026-06-15",
        priority: "media",
        status: "pendiente",
      },
      {
        id: "t4",
        title: "Tendido ducto subterráneo calle Hidalgo",
        assignee: "Cuadrilla Postación",
        dueDate: "2026-06-12",
        priority: "alta",
        status: "en-curso",
      },
      {
        id: "t5",
        title: "Levantamiento topográfico tramo C",
        assignee: "Cuadrilla Foxtrot",
        dueDate: "2026-06-10",
        priority: "baja",
        status: "completada",
      },
    ],
    evidence: [
      {
        id: "e1",
        title: "Fusión EMP-041 — antes y después",
        type: "photo",
        uploadedBy: "J. Ramírez",
        uploadedAt: "2026-06-12T10:30:00",
        category: "Empalmes",
      },
      {
        id: "e2",
        title: "Tendido calle Morelos — vista aérea",
        type: "photo",
        uploadedBy: "M. Soto",
        uploadedAt: "2026-06-11T16:45:00",
        category: "Tendido",
      },
      {
        id: "e3",
        title: "Reporte OTDR tramo B-10",
        type: "file",
        uploadedBy: "Ing. Roberto Méndez",
        uploadedAt: "2026-06-10T09:15:00",
        category: "Certificación",
      },
      {
        id: "e4",
        title: "Instalación caja EMP-040",
        type: "photo",
        uploadedBy: "L. Hernández",
        uploadedAt: "2026-06-09T14:20:00",
        category: "Infraestructura",
      },
    ],
    documents: [
      {
        id: "d1",
        name: "Plano de tendido — Sector B Rev. 3",
        type: "plan",
        size: "4.2 MB",
        uploadedAt: "2026-01-20",
      },
      {
        id: "d2",
        name: "Especificaciones técnicas FTTH",
        type: "pdf",
        size: "1.8 MB",
        uploadedAt: "2026-01-15",
      },
      {
        id: "d3",
        name: "Certificado de materiales — cable SM G.652D",
        type: "certificate",
        size: "890 KB",
        uploadedAt: "2026-02-01",
      },
    ],
    history: [
      {
        id: "h1",
        title: "Tramo B-14 certificado",
        description: "Certificación OTDR aprobada con pérdida máxima 0.18 dB.",
        user: "Ing. Roberto Méndez",
        timestamp: "2026-06-12T11:00:00",
      },
      {
        id: "h2",
        title: "Avance actualizado al 78%",
        description: "Se completó tendido de 2.4 km adicionales en Sector B.",
        user: "Sistema",
        timestamp: "2026-06-11T18:30:00",
      },
      {
        id: "h3",
        title: "Cuadrilla Alpha asignada",
        description: "Cuadrilla Alpha reasignada al tramo B-14 por prioridad.",
        user: "Ing. Ana Torres",
        timestamp: "2026-06-10T08:00:00",
      },
      {
        id: "h4",
        title: "Obra iniciada",
        description: "Inicio formal de obra con kick-off en sitio.",
        user: "Ing. Roberto Méndez",
        timestamp: "2026-01-15T09:00:00",
      },
    ],
    costs: {
      materials: 2840000,
      labor: 1650000,
      equipment: 420000,
      vehicles: 185000,
    },
  },
  "proj-002": {
    stats: {
      activeTasks: 4,
      completedTasks: 18,
      evidenceFiles: 89,
      progress: 62,
    },
    tasks: [
      {
        id: "t1",
        title: "Montaje cámara PTZ acceso principal",
        assignee: "Cuadrilla Bravo",
        dueDate: "2026-06-13",
        priority: "alta",
        status: "en-curso",
      },
      {
        id: "t2",
        title: "Configuración NVR — canal 1-16",
        assignee: "Cuadrilla Wireless",
        dueDate: "2026-06-16",
        priority: "media",
        status: "pendiente",
      },
    ],
    evidence: [
      {
        id: "e1",
        title: "Cámara acceso norte instalada",
        type: "photo",
        uploadedBy: "R. Vega",
        uploadedAt: "2026-06-12T08:00:00",
        category: "Instalación",
      },
    ],
    documents: [
      {
        id: "d1",
        name: "Layout de cámaras — Planta baja",
        type: "plan",
        size: "3.1 MB",
        uploadedAt: "2026-02-05",
      },
    ],
    history: [
      {
        id: "h1",
        title: "16 cámaras configuradas",
        description: "Primer lote de cámaras IP conectadas al NVR central.",
        user: "Ing. Ana Torres",
        timestamp: "2026-06-11T15:00:00",
      },
    ],
    costs: {
      materials: 980000,
      labor: 540000,
      equipment: 120000,
      vehicles: 45000,
    },
  },
}

function createEmptyDetail(project: Project): ProjectDetail {
  return {
    stats: {
      activeTasks: 0,
      completedTasks: 0,
      evidenceFiles: 0,
      progress: project.progress,
    },
    tasks: [],
    evidence: [],
    documents: [],
    history: [
      {
        id: "h-new",
        title: "Proyecto registrado",
        description: "Obra creada en el sistema de operaciones.",
        user: project.supervisor,
        timestamp: new Date().toISOString(),
      },
    ],
    costs: {
      materials: 0,
      labor: 0,
      equipment: 0,
      vehicles: 0,
    },
  }
}

function createDefaultDetail(project: Project): ProjectDetail {
  const stored = projectDetails[project.id]
  if (stored) return stored

  return {
    stats: {
      activeTasks: Math.max(1, Math.round((100 - project.progress) / 15)),
      completedTasks: Math.round(project.progress / 4),
      evidenceFiles: Math.round(project.progress * 1.2),
      progress: project.progress,
    },
    tasks: [
      {
        id: "t-default-1",
        title: "Levantamiento inicial de sitio",
        assignee: "Cuadrilla asignada",
        dueDate: project.endDate,
        priority: "media",
        status: project.progress > 50 ? "completada" : "en-curso",
      },
      {
        id: "t-default-2",
        title: "Documentación de avance semanal",
        assignee: project.supervisor,
        dueDate: project.endDate,
        priority: "baja",
        status: "pendiente",
      },
    ],
    evidence: [
      {
        id: "e-default-1",
        title: "Evidencia de inicio de obra",
        type: "photo",
        uploadedBy: project.supervisor,
        uploadedAt: project.startDate,
        category: "General",
      },
    ],
    documents: [
      {
        id: "d-default-1",
        name: `Expediente técnico — ${project.code}`,
        type: "pdf",
        size: "2.4 MB",
        uploadedAt: project.startDate,
      },
    ],
    history: [
      {
        id: "h-default-1",
        title: "Obra registrada",
        description: project.description,
        user: project.supervisor,
        timestamp: `${project.startDate}T09:00:00`,
      },
    ],
    costs: {
      materials: Math.round(project.progress * 25000),
      labor: Math.round(project.progress * 15000),
      equipment: Math.round(project.progress * 8000),
      vehicles: Math.round(project.progress * 3000),
    },
  }
}

export function getProjectById(id: string, projects = mockProjects): Project | undefined {
  return projects.find((project) => project.id === id)
}

function mapTaskStatusToProjectStatus(
  status: TaskStatus
): ProjectTask["status"] {
  if (status === "finalizada" || status === "cerrada") {
    return "completada"
  }

  if (status === "en-curso" || status === "en-aprobacion") {
    return "en-curso"
  }

  return "pendiente"
}

export function getProjectTasksFromMock(
  project: Project,
  tasks = mockTasks
): ProjectTask[] {
  return tasks
    .filter((task) => task.projectCode === project.code)
    .map((task) => ({
      id: task.id,
      title: task.title,
      assignee: task.crew,
      dueDate: task.dueDate,
      priority: task.priority,
      status: mapTaskStatusToProjectStatus(task.status),
    }))
}

function enrichProjectDetail(
  project: Project,
  base: ProjectDetail,
  tasks = mockTasks,
  evidence = mockEvidence
): ProjectDetail {
  const linkedTasks = getProjectTasksFromMock(project, tasks)
  const linkedEvidence = getEvidenceByProjectId(project.id, evidence)
  const activeTasks = linkedTasks.filter(
    (task) => task.status !== "completada"
  ).length
  const completedTasks = linkedTasks.filter(
    (task) => task.status === "completada"
  ).length

  return {
    ...base,
    tasks: linkedTasks.length > 0 ? linkedTasks : base.tasks,
    stats: {
      activeTasks: linkedTasks.length > 0 ? activeTasks : base.stats.activeTasks,
      completedTasks:
        linkedTasks.length > 0 ? completedTasks : base.stats.completedTasks,
      evidenceFiles:
        linkedEvidence.length > 0
          ? linkedEvidence.length
          : base.stats.evidenceFiles,
      progress: project.progress,
    },
  }
}

export function getProjectDetail(
  project: Project,
  tasks = mockTasks,
  evidence = mockEvidence
): ProjectDetail {
  const base = projectDetails[project.id] ?? createDefaultDetail(project)
  return enrichProjectDetail(project, base, tasks, evidence)
}

export function createProjectFromInput(input: NewProjectInput): Project {
  return {
    id: `proj-${Date.now()}`,
    code: input.code,
    name: input.name,
    client: input.client,
    type: input.type,
    status: "planned",
    progress: 0,
    startDate: input.startDate,
    endDate: input.endDate,
    supervisor: input.supervisor,
    location: input.location,
    description: input.description,
  }
}

export function createProjectDetail(project: Project): ProjectDetail {
  return createEmptyDetail(project)
}
