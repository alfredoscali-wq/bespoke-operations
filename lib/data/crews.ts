import { mockEvidence } from "@/lib/data/evidence"
import { mockProjects } from "@/lib/data/projects"
import { getTaskDetail, mockTasks } from "@/lib/data/tasks"
import type { EvidenceRecord } from "@/lib/types/evidence"
import type { Project, ProjectStatus } from "@/lib/types/projects"
import type {
  Crew,
  CrewActivityEvent,
  CrewDetail,
  CrewFilters,
  CrewListItem,
  CrewPerformance,
  CrewSummary,
} from "@/lib/types/crews"
import type { Task, TaskStatus } from "@/lib/types/tasks"

export const mockCrews: Crew[] = [
  {
    id: "crew-norte",
    name: "Cuadrilla Norte",
    specialty: "Fibra Óptica FTTH",
    supervisor: "Ing. Roberto Méndez",
    vehicle: "Nissan NP300 — Placas BX-4812",
    status: "en-campo",
    members: [
      {
        id: "mem-n1",
        name: "J. Ramírez",
        position: "Técnico Fibra",
        status: "en-campo",
      },
      {
        id: "mem-n2",
        name: "M. Soto",
        position: "Ayudante de Tendido",
        status: "en-campo",
      },
      {
        id: "mem-n3",
        name: "A. Delgado",
        position: "Operador OTDR",
        status: "disponible",
      },
    ],
  },
  {
    id: "crew-alpha",
    name: "Cuadrilla Alpha",
    specialty: "Mantenimiento e Inspección de Red",
    supervisor: "Ing. Patricia Vega",
    vehicle: "Ford Ranger — Placas MT-2290",
    status: "en-campo",
    members: [
      {
        id: "mem-a1",
        name: "R. Castillo",
        position: "Técnico de Mantenimiento",
        status: "en-campo",
      },
      {
        id: "mem-a2",
        name: "E. Morales",
        position: "Inspector de Empalmes",
        status: "en-campo",
      },
    ],
  },
  {
    id: "crew-bravo",
    name: "Cuadrilla Bravo",
    specialty: "Videovigilancia y CCTV",
    supervisor: "Ing. Ana Torres",
    vehicle: "Chevrolet Express — Placas QRO-5518",
    status: "en-campo",
    members: [
      {
        id: "mem-b1",
        name: "Juan Pérez",
        position: "Técnico de Instalación CCTV",
        status: "en-campo",
      },
      {
        id: "mem-b2",
        name: "R. Vega",
        position: "Técnico Cableado Estructurado",
        status: "en-campo",
      },
      {
        id: "mem-b3",
        name: "S. Núñez",
        position: "Configurador NVR",
        status: "disponible",
      },
    ],
  },
  {
    id: "crew-charlie",
    name: "Cuadrilla Charlie",
    specialty: "Tendido y Empalmes FO",
    supervisor: "Ing. Roberto Méndez",
    vehicle: "Isuzu D-Max — Placas NL-7734",
    status: "en-campo",
    members: [
      {
        id: "mem-c1",
        name: "L. Hernández",
        position: "Técnico Fibra",
        status: "en-campo",
      },
      {
        id: "mem-c2",
        name: "P. Ríos",
        position: "Ayudante de Campo",
        status: "en-campo",
      },
    ],
  },
  {
    id: "crew-delta",
    name: "Cuadrilla Postación",
    specialty: "Postación e Infraestructura",
    supervisor: "Ing. Patricia Vega",
    vehicle: "Grúa Hidraulica — Placas PB-9021",
    status: "en-campo",
    members: [
      {
        id: "mem-d1",
        name: "M. Soto",
        position: "Topógrafo de Campo",
        status: "en-campo",
      },
      {
        id: "mem-d2",
        name: "G. Luna",
        position: "Montador de Postes",
        status: "en-campo",
      },
      {
        id: "mem-d3",
        name: "H. Vargas",
        position: "Operador de Grúa",
        status: "disponible",
      },
    ],
  },
  {
    id: "crew-echo",
    name: "Cuadrilla Wireless",
    specialty: "Enlaces Wireless PTP/PTMP",
    supervisor: "Ing. Carlos Ruiz",
    vehicle: "Toyota Hilux — Placas GDL-3340",
    status: "disponible",
    members: [
      {
        id: "mem-e1",
        name: "Marcos Vega",
        position: "Técnico Wireless",
        status: "disponible",
      },
      {
        id: "mem-e2",
        name: "D. Fuentes",
        position: "Especialista en Torre",
        status: "disponible",
      },
    ],
  },
  {
    id: "crew-foxtrot",
    name: "Cuadrilla Foxtrot",
    specialty: "Fibra en Zona Patrimonial",
    supervisor: "Ing. Roberto Méndez",
    vehicle: "Nissan NP300 — Placas SLP-1188",
    status: "disponible",
    members: [
      {
        id: "mem-f1",
        name: "C. Mendoza",
        position: "Técnico de Levantamiento",
        status: "disponible",
      },
      {
        id: "mem-f2",
        name: "I. Reyes",
        position: "Auxiliar Topográfico",
        status: "fuera-de-servicio",
      },
    ],
  },
]

const ACTIVE_TASK_STATUSES: TaskStatus[] = [
  "pendiente",
  "asignada",
  "en-curso",
  "en-aprobacion",
]

const COMPLETED_TASK_STATUSES: TaskStatus[] = ["finalizada", "cerrada"]

const ACTIVE_PROJECT_STATUSES: ProjectStatus[] = ["active", "pending-closure"]

export const defaultCrewFilters: CrewFilters = {
  search: "",
  status: "all",
  specialty: "all",
}

export function getCrewById(
  id: string,
  crews = mockCrews
): Crew | undefined {
  return crews.find((crew) => crew.id === id)
}

export function getCrewByName(
  name: string,
  crews = mockCrews
): Crew | undefined {
  return crews.find((crew) => crew.name === name)
}

export function getCrewTasks(
  crewName: string,
  tasks: Task[] = mockTasks
): Task[] {
  return tasks.filter((task) => task.crew === crewName)
}

export function getCrewActiveTasks(
  crewName: string,
  tasks: Task[] = mockTasks
): Task[] {
  return getCrewTasks(crewName, tasks).filter((task) =>
    ACTIVE_TASK_STATUSES.includes(task.status)
  )
}

export function getCrewProjects(
  crewName: string,
  tasks: Task[] = mockTasks,
  projects: Project[] = mockProjects
): Project[] {
  const projectCodes = new Set(
    getCrewTasks(crewName, tasks).map((task) => task.projectCode)
  )

  return projects.filter(
    (project) =>
      projectCodes.has(project.code) &&
      ACTIVE_PROJECT_STATUSES.includes(project.status)
  )
}

export function getCrewEvidence(
  crewName: string,
  evidence: EvidenceRecord[] = mockEvidence
): EvidenceRecord[] {
  return evidence.filter((item) => item.crew === crewName)
}

export function buildCrewListItem(
  crew: Crew,
  tasks: Task[] = mockTasks,
  projects: Project[] = mockProjects
): CrewListItem {
  return {
    ...crew,
    activeTasks: getCrewActiveTasks(crew.name, tasks).length,
    activeProjects: getCrewProjects(crew.name, tasks, projects).length,
    memberCount: crew.members.length,
  }
}

export function getCrewListItems(
  crews: Crew[] = mockCrews,
  tasks: Task[] = mockTasks,
  projects: Project[] = mockProjects
): CrewListItem[] {
  return crews.map((crew) => buildCrewListItem(crew, tasks, projects))
}

export function getCrewsSummary(
  crews: Crew[] = mockCrews,
  tasks: Task[] = mockTasks,
  projects: Project[] = mockProjects
): CrewSummary {
  const activeCrews = crews.filter(
    (crew) => crew.status !== "fuera-de-servicio"
  ).length

  const assignedTasks = tasks.filter(
    (task) =>
      ACTIVE_TASK_STATUSES.includes(task.status) &&
      getCrewByName(task.crew, crews)
  ).length

  const activeProjectCodes = new Set<string>()
  tasks.forEach((task) => {
    if (
      ACTIVE_TASK_STATUSES.includes(task.status) &&
      getCrewByName(task.crew, crews)
    ) {
      activeProjectCodes.add(task.projectCode)
    }
  })

  const activeProjects = projects.filter(
    (project) =>
      activeProjectCodes.has(project.code) &&
      ACTIVE_PROJECT_STATUSES.includes(project.status)
  ).length

  return {
    totalCrews: crews.length,
    activeCrews,
    assignedTasks,
    activeProjects,
  }
}

function daysBetween(start: string, end: string): number {
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()
  return Math.max(1, Math.round((endMs - startMs) / 86400000))
}

export function getCrewPerformance(
  crewName: string,
  tasks: Task[] = mockTasks,
  evidence: EvidenceRecord[] = mockEvidence
): CrewPerformance {
  const crewTasks = getCrewTasks(crewName, tasks)
  const completedTasks = crewTasks.filter((task) =>
    COMPLETED_TASK_STATUSES.includes(task.status)
  )

  const averageCompletionDays =
    completedTasks.length === 0
      ? 0
      : Math.round(
          completedTasks.reduce(
            (sum, task) => sum + daysBetween(task.startDate, task.dueDate),
            0
          ) / completedTasks.length
        )

  const crewEvidence = getCrewEvidence(crewName, evidence)
  const approvedEvidence = crewEvidence.filter(
    (item) => item.status === "approved"
  ).length

  const totalTasks = crewTasks.length
  const completionRate =
    totalTasks === 0 ? 0 : (completedTasks.length / totalTasks) * 100
  const evidenceRate =
    crewEvidence.length === 0
      ? 0
      : (approvedEvidence / crewEvidence.length) * 100

  const productivityScore = Math.round(
    completionRate * 0.6 + evidenceRate * 0.4
  )

  return {
    completedTasks: completedTasks.length,
    averageCompletionDays,
    approvedEvidence,
    productivityScore: Math.min(100, productivityScore),
  }
}

export function getCrewActivity(
  crewName: string,
  tasks: Task[] = mockTasks,
  projects: Project[] = mockProjects,
  evidence: EvidenceRecord[] = mockEvidence
): CrewActivityEvent[] {
  const events: CrewActivityEvent[] = []
  const crewTasks = getCrewTasks(crewName, tasks)

  crewTasks.forEach((task) => {
    events.push({
      id: `${task.id}-assigned`,
      type: "task-assigned",
      title: "Tarea asignada",
      description: `${task.title} asignada a ${crewName}.`,
      timestamp: `${task.startDate}T08:00:00`,
      projectCode: task.projectCode,
      taskCode: task.code,
    })

    if (
      task.status === "en-curso" ||
      task.status === "en-aprobacion" ||
      COMPLETED_TASK_STATUSES.includes(task.status)
    ) {
      events.push({
        id: `${task.id}-started`,
        type: "work-started",
        title: "Trabajo iniciado",
        description: `Inicio de actividades en sitio para ${task.code}.`,
        timestamp: `${task.startDate}T09:30:00`,
        projectCode: task.projectCode,
        taskCode: task.code,
      })
    }

    if (COMPLETED_TASK_STATUSES.includes(task.status)) {
      events.push({
        id: `${task.id}-completed`,
        type: "task-completed",
        title: "Tarea completada",
        description: `${task.title} marcada como completada.`,
        timestamp: `${task.dueDate}T17:00:00`,
        projectCode: task.projectCode,
        taskCode: task.code,
      })
    }

    const detail = getTaskDetail(task)
    detail.evidence.forEach((item) => {
      events.push({
        id: `${task.id}-ev-${item.id}`,
        type: "evidence-uploaded",
        title: "Evidencia cargada",
        description: item.title,
        timestamp: item.uploadedAt,
        projectCode: task.projectCode,
        taskCode: task.code,
      })
    })
  })

  getCrewEvidence(crewName, evidence).forEach((item) => {
    events.push({
      id: `ev-${item.id}`,
      type: "evidence-uploaded",
      title: "Evidencia cargada",
      description: `${item.fileName} — ${item.description}`,
      timestamp: item.uploadedAt,
      projectCode: item.projectCode,
      taskCode: item.taskCode,
    })
  })

  const crewProjectCodes = new Set(crewTasks.map((task) => task.projectCode))
  projects
    .filter(
      (project) =>
        crewProjectCodes.has(project.code) && project.status === "closed"
    )
    .forEach((project) => {
      events.push({
        id: `proj-${project.id}-completed`,
        type: "project-completed",
        title: "Proyecto completado",
        description: `${project.name} cerrado al 100%.`,
        timestamp: `${project.endDate}T18:00:00`,
        projectCode: project.code,
      })
    })

  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

export function getCrewDetail(
  crew: Crew,
  tasks: Task[] = mockTasks,
  projects: Project[] = mockProjects,
  evidence: EvidenceRecord[] = mockEvidence
): CrewDetail {
  const crewTasks = getCrewTasks(crew.name, tasks)
  const completedTasks = crewTasks.filter((task) =>
    COMPLETED_TASK_STATUSES.includes(task.status)
  ).length

  return {
    activity: getCrewActivity(crew.name, tasks, projects, evidence),
    performance: getCrewPerformance(crew.name, tasks, evidence),
    stats: {
      activeTasks: getCrewActiveTasks(crew.name, tasks).length,
      activeProjects: getCrewProjects(crew.name, tasks, projects).length,
      completedTasks,
      membersAvailable: crew.members.filter(
        (member) => member.status === "disponible"
      ).length,
    },
  }
}

export function filterCrews(
  crews: CrewListItem[],
  filters: CrewFilters
): CrewListItem[] {
  const query = filters.search.trim().toLowerCase()

  return crews.filter((crew) => {
    const matchesSearch =
      query === "" ||
      crew.name.toLowerCase().includes(query) ||
      crew.specialty.toLowerCase().includes(query) ||
      crew.supervisor.toLowerCase().includes(query) ||
      crew.members.some((member) =>
        member.name.toLowerCase().includes(query)
      )

    const matchesStatus =
      filters.status === "all" || crew.status === filters.status

    const matchesSpecialty =
      filters.specialty === "all" || crew.specialty === filters.specialty

    return matchesSearch && matchesStatus && matchesSpecialty
  })
}

export function getCrewSpecialtyOptions(crews: Crew[] = mockCrews) {
  return Array.from(new Set(crews.map((crew) => crew.specialty))).sort()
}
