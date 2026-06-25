import type { Task, TaskDetail } from "@/lib/types/tasks"
import { getChecklistProgress, syncTaskProgress } from "@/lib/tasks/utils"

const defaultChecklist = [
  { id: "cl-1", label: "Fotos iniciales", completed: false, required: true },
  { id: "cl-2", label: "Material asignado", completed: false, required: true },
  { id: "cl-3", label: "Fotos finales", completed: false, required: true },
  { id: "cl-4", label: "Observaciones finales", completed: false, required: false },
]

function buildTask(
  task: Omit<Task, "progress"> & { progress?: number }
): Task {
  const withProgress = {
    ...task,
    progress: task.progress ?? getChecklistProgress(task.checklist),
  }
  return syncTaskProgress(withProgress)
}

export const mockTasks: Task[] = [
  buildTask({
    id: "task-001",
    code: "TSK-001",
    title: "Empalme FO Sector B14",
    description:
      "Realizar empalme por fusión en caja EMP-042 del tramo B-14. Verificar pérdida de inserción y registrar en bitácora OTDR.",
    projectCode: "FO-2026-001",
    projectName: "Despliegue FTTH Zona Norte — Sector B",
    type: "fiber",
    status: "en-curso",
    priority: "alta",
    supervisor: "Ing. Roberto Méndez",
    crew: "Cuadrilla Norte",
    startDate: "2026-06-10",
    dueDate: "2026-06-15",
    estimatedDuration: "6 horas",
    checklist: [
      { id: "cl-1", label: "Fotos iniciales", completed: true, required: true },
      { id: "cl-2", label: "Material asignado", completed: true, required: true },
      { id: "cl-3", label: "Fotos finales", completed: false, required: true },
      { id: "cl-4", label: "Observaciones finales", completed: false, required: false },
    ],
  }),
  buildTask({
    id: "task-002",
    code: "TSK-002",
    title: "Certificación OTDR Tramo B-12",
    description:
      "Ejecutar prueba OTDR bidireccional en tramo B-12 y generar reporte de certificación para entrega al cliente.",
    projectCode: "FO-2026-001",
    projectName: "Despliegue FTTH Zona Norte — Sector B",
    type: "fiber",
    status: "asignada",
    priority: "alta",
    supervisor: "Ing. Roberto Méndez",
    crew: "Cuadrilla Alpha",
    startDate: "2026-06-12",
    dueDate: "2026-06-16",
    estimatedDuration: "4 horas",
    checklist: [
      { id: "cl-1", label: "Fotos iniciales", completed: true, required: true },
      { id: "cl-2", label: "Material asignado", completed: false, required: true },
      { id: "cl-3", label: "Fotos finales", completed: false, required: true },
      { id: "cl-4", label: "Observaciones finales", completed: false, required: false },
    ],
  }),
  buildTask({
    id: "task-003",
    code: "TSK-003",
    title: "Instalación Cámara PTZ",
    description:
      "Montaje de cámara PTZ en poste de 8 m, cableado Cat6A y configuración de canal en NVR central.",
    projectCode: "CAM-2026-004",
    projectName: "Videovigilancia Parque Industrial Santa Fe",
    type: "camera",
    status: "en-curso",
    priority: "alta",
    supervisor: "Ing. Ana Torres",
    crew: "Cuadrilla Bravo",
    startDate: "2026-06-11",
    dueDate: "2026-06-12",
    estimatedDuration: "8 horas",
    checklist: [
      { id: "cl-1", label: "Foto inicial", completed: true, required: true },
      { id: "cl-2", label: "Material recibido", completed: true, required: true },
      { id: "cl-3", label: "Foto final", completed: false, required: true },
      { id: "cl-4", label: "Observación final", completed: false, required: false },
    ],
  }),
  buildTask({
    id: "task-004",
    code: "TSK-004",
    title: "Alineación antenas enlace PTP 5 GHz",
    description:
      "Optimizar alineación de antenas en torre sur. Objetivo RSSI -62 dBm o mejor.",
    projectCode: "WLS-2026-002",
    projectName: "Backhaul Wireless Torre Sur — Enlace PTP",
    type: "wireless",
    status: "pendiente",
    priority: "media",
    supervisor: "Ing. Carlos Ruiz",
    crew: "Cuadrilla Wireless",
    startDate: "2026-06-14",
    dueDate: "2026-06-18",
    estimatedDuration: "5 horas",
    checklist: defaultChecklist.map((item) => ({ ...item })),
  }),
  buildTask({
    id: "task-005",
    code: "TSK-005",
    title: "Replanteo postes Lote 3 — Circuito 9",
    description:
      "Replanteo topográfico de 24 postes metálicos en carretera federal. Validar distancias y anclajes.",
    projectCode: "PST-2026-007",
    projectName: "Infraestructura de Postes — Circuito 9",
    type: "pole",
    status: "pendiente",
    priority: "media",
    supervisor: "Ing. Patricia Vega",
    crew: "Cuadrilla Postación",
    startDate: "2026-06-15",
    dueDate: "2026-06-20",
    estimatedDuration: "2 días",
    checklist: defaultChecklist.map((item) => ({ ...item })),
  }),
  buildTask({
    id: "task-006",
    code: "TSK-006",
    title: "Verificar altura de poste km 4.2",
    description:
      "Inspección de poste metálico instalado en Av. Insurgentes. Confirmar verticalidad y señalización.",
    projectCode: "PST-2026-002",
    projectName: "Replanteo Postes Av. Insurgentes",
    type: "inspection",
    status: "en-aprobacion",
    priority: "alta",
    supervisor: "Ing. Patricia Vega",
    crew: "Cuadrilla Postación",
    startDate: "2026-06-08",
    dueDate: "2026-06-12",
    estimatedDuration: "3 horas",
    checklist: [
      { id: "cl-1", label: "Fotos iniciales", completed: true, required: true },
      { id: "cl-2", label: "Material asignado", completed: true, required: true },
      { id: "cl-3", label: "Fotos finales", completed: true, required: true },
      { id: "cl-4", label: "Observaciones finales", completed: true, required: false },
    ],
  }),
  buildTask({
    id: "task-007",
    code: "TSK-007",
    title: "Tendido ducto subterráneo calle Hidalgo",
    description:
      "Tendido de 420 m de ducto subterráneo para canalización de fibra en zona comercial.",
    projectCode: "FO-2026-001",
    projectName: "Despliegue FTTH Zona Norte — Sector B",
    type: "fiber",
    status: "asignada",
    priority: "alta",
    supervisor: "Ing. Roberto Méndez",
    crew: "Cuadrilla Charlie",
    startDate: "2026-06-13",
    dueDate: "2026-06-17",
    estimatedDuration: "3 días",
    checklist: [
      { id: "cl-1", label: "Fotos iniciales", completed: true, required: true },
      { id: "cl-2", label: "Material asignado", completed: true, required: true },
      { id: "cl-3", label: "Fotos finales", completed: false, required: true },
      { id: "cl-4", label: "Observaciones finales", completed: false, required: false },
    ],
  }),
  buildTask({
    id: "task-008",
    code: "TSK-008",
    title: "Configuración NVR canales 1-16",
    description:
      "Configuración de grabación, detección de movimiento y acceso remoto para primer lote de cámaras.",
    projectCode: "CAM-2026-004",
    projectName: "Videovigilancia Parque Industrial Santa Fe",
    type: "camera",
    status: "finalizada",
    priority: "media",
    supervisor: "Ing. Ana Torres",
    crew: "Cuadrilla Wireless",
    startDate: "2026-06-05",
    dueDate: "2026-06-10",
    estimatedDuration: "6 horas",
    checklist: [
      { id: "cl-1", label: "Fotos iniciales", completed: true, required: true },
      { id: "cl-2", label: "Material asignado", completed: true, required: true },
      { id: "cl-3", label: "Fotos finales", completed: true, required: true },
      { id: "cl-4", label: "Observaciones finales", completed: true, required: false },
    ],
  }),
  buildTask({
    id: "task-009",
    code: "TSK-009",
    title: "Inspección empalmes trimestral — Troncal",
    description:
      "Inspección preventiva de cajas de empalme en corredor Insurgentes Sur. Limpieza y documentación.",
    projectCode: "MNT-2026-003",
    projectName: "Mantenimiento Preventivo Red Troncal",
    type: "maintenance",
    status: "en-curso",
    priority: "baja",
    supervisor: "Ing. Patricia Vega",
    crew: "Cuadrilla Alpha",
    startDate: "2026-06-09",
    dueDate: "2026-06-22",
    estimatedDuration: "1 día",
    checklist: [
      { id: "cl-1", label: "Fotos iniciales", completed: true, required: true },
      { id: "cl-2", label: "Material asignado", completed: true, required: true },
      { id: "cl-3", label: "Fotos finales", completed: false, required: true },
      { id: "cl-4", label: "Observaciones finales", completed: false, required: false },
    ],
  }),
  buildTask({
    id: "task-010",
    code: "TSK-010",
    title: "Levantamiento topográfico ruta fibra",
    description:
      "Levantamiento topográfico de 1.8 km de ruta propuesta en centro histórico para permisos municipales.",
    projectCode: "FO-2025-042",
    projectName: "Fibra Centro Histórico — Fase 2",
    type: "inspection",
    status: "cerrada",
    priority: "baja",
    supervisor: "Ing. Roberto Méndez",
    crew: "Cuadrilla Foxtrot",
    startDate: "2025-11-01",
    dueDate: "2025-11-15",
    estimatedDuration: "2 días",
    checklist: [
      { id: "cl-1", label: "Fotos iniciales", completed: true, required: true },
      { id: "cl-2", label: "Material asignado", completed: true, required: true },
      { id: "cl-3", label: "Fotos finales", completed: true, required: true },
      { id: "cl-4", label: "Observaciones finales", completed: true, required: true },
    ],
  }),
  buildTask({
    id: "task-011",
    code: "TSK-011",
    title: "Instalación caja empalme EMP-043",
    description:
      "Instalar caja de empalme tipo domo en poste existente. Preparar reserva de fibra y etiquetado.",
    projectCode: "FO-2026-001",
    projectName: "Despliegue FTTH Zona Norte — Sector B",
    type: "fiber",
    status: "pendiente",
    priority: "media",
    supervisor: "Ing. Roberto Méndez",
    crew: "Cuadrilla Norte",
    startDate: "2026-06-16",
    dueDate: "2026-06-19",
    estimatedDuration: "5 horas",
    checklist: defaultChecklist.map((item) => ({ ...item })),
  }),
  buildTask({
    id: "task-012",
    code: "TSK-012",
    title: "Prueba de continuidad empalmes Col. Las Palmas",
    description:
      "Prueba de continuidad y reflectometría en 18 empalmes del lote residencial sur.",
    projectCode: "FO-2026-008",
    projectName: "Fibra Residencial Col. Las Palmas",
    type: "fiber",
    status: "en-aprobacion",
    priority: "media",
    supervisor: "Ing. Roberto Méndez",
    crew: "Cuadrilla Charlie",
    startDate: "2026-06-03",
    dueDate: "2026-06-11",
    estimatedDuration: "4 horas",
    checklist: [
      { id: "cl-1", label: "Fotos iniciales", completed: true, required: true },
      { id: "cl-2", label: "Material asignado", completed: true, required: true },
      { id: "cl-3", label: "Fotos finales", completed: true, required: true },
      { id: "cl-4", label: "Observaciones finales", completed: true, required: false },
    ],
  }),
  buildTask({
    id: "task-013",
    code: "TSK-013",
    title: "Montaje antena sectorial torre este",
    description:
      "Instalación de antena sectorial 90° y cableado de alimentación en torre de 24 m.",
    projectCode: "WLS-2026-002",
    projectName: "Backhaul Wireless Torre Sur — Enlace PTP",
    type: "wireless",
    status: "asignada",
    priority: "alta",
    supervisor: "Ing. Carlos Ruiz",
    crew: "Cuadrilla Wireless",
    startDate: "2026-06-14",
    dueDate: "2026-06-16",
    estimatedDuration: "7 horas",
    checklist: [
      { id: "cl-1", label: "Fotos iniciales", completed: false, required: true },
      { id: "cl-2", label: "Material asignado", completed: true, required: true },
      { id: "cl-3", label: "Fotos finales", completed: false, required: true },
      { id: "cl-4", label: "Observaciones finales", completed: false, required: false },
    ],
  }),
  buildTask({
    id: "task-014",
    code: "TSK-014",
    title: "Sustitución poste concreto km 8",
    description:
      "Retiro de poste de concreto deteriorado e instalación de poste metálico de 12 m con grúa.",
    projectCode: "PST-2026-002",
    projectName: "Replanteo Postes Av. Insurgentes",
    type: "pole",
    status: "en-curso",
    priority: "alta",
    supervisor: "Ing. Patricia Vega",
    crew: "Cuadrilla Postación",
    startDate: "2026-06-10",
    dueDate: "2026-06-14",
    estimatedDuration: "1 día",
    checklist: [
      { id: "cl-1", label: "Fotos iniciales", completed: true, required: true },
      { id: "cl-2", label: "Material asignado", completed: true, required: true },
      { id: "cl-3", label: "Fotos finales", completed: false, required: true },
      { id: "cl-4", label: "Observaciones finales", completed: false, required: false },
    ],
  }),
  buildTask({
    id: "task-015",
    code: "TSK-015",
    title: "Limpieza cajas empalme sector 4",
    description:
      "Limpieza, reorganización de bandejas y actualización de etiquetas en 12 cajas de empalme.",
    projectCode: "MNT-2026-003",
    projectName: "Mantenimiento Preventivo Red Troncal",
    type: "maintenance",
    status: "cerrada",
    priority: "baja",
    supervisor: "Ing. Patricia Vega",
    crew: "Cuadrilla Alpha",
    startDate: "2026-05-20",
    dueDate: "2026-05-28",
    estimatedDuration: "6 horas",
    checklist: [
      { id: "cl-1", label: "Fotos iniciales", completed: true, required: true },
      { id: "cl-2", label: "Material asignado", completed: true, required: true },
      { id: "cl-3", label: "Fotos finales", completed: true, required: true },
      { id: "cl-4", label: "Observaciones finales", completed: true, required: false },
    ],
  }),
  buildTask({
    id: "task-016",
    code: "TSK-016",
    title: "Cableado estructurado sala de monitoreo",
    description:
      "Tendido de 240 m de cable Cat6A desde rack principal a sala de monitoreo del parque industrial.",
    projectCode: "CAM-2026-004",
    projectName: "Videovigilancia Parque Industrial Santa Fe",
    type: "camera",
    status: "finalizada",
    priority: "media",
    supervisor: "Ing. Ana Torres",
    crew: "Cuadrilla Bravo",
    startDate: "2026-06-01",
    dueDate: "2026-06-08",
    estimatedDuration: "2 días",
    checklist: [
      { id: "cl-1", label: "Fotos iniciales", completed: true, required: true },
      { id: "cl-2", label: "Material asignado", completed: true, required: true },
      { id: "cl-3", label: "Fotos finales", completed: true, required: true },
      { id: "cl-4", label: "Observaciones finales", completed: false, required: false },
    ],
  }),
]

const taskDetails: Record<string, TaskDetail> = {
  "task-001": {
    evidence: [
      {
        id: "ev-1",
        title: "Caja EMP-042 — antes del empalme",
        type: "photo",
        uploadedBy: "J. Ramírez",
        uploadedAt: "2026-06-12T09:30:00",
      },
      {
        id: "ev-2",
        title: "Reporte OTDR pre-empalme",
        type: "pdf",
        uploadedBy: "Ing. Roberto Méndez",
        uploadedAt: "2026-06-12T10:15:00",
      },
      {
        id: "ev-3",
        title: "Plano tramo B-14 Rev. 2",
        type: "plan",
        uploadedBy: "Dpto. Ingeniería",
        uploadedAt: "2026-06-10T08:00:00",
      },
    ],
    comments: [
      {
        id: "cm-1",
        author: "Ing. Roberto Méndez",
        role: "supervisor",
        content: "Verificar pérdida de inserción menor a 0.25 dB en cada empalme.",
        timestamp: "2026-06-11T14:00:00",
      },
      {
        id: "cm-2",
        author: "J. Ramírez",
        role: "operario",
        content: "Material verificado. Fusionadora calibrada y lista.",
        timestamp: "2026-06-12T08:30:00",
      },
      {
        id: "cm-3",
        author: "Ing. Roberto Méndez",
        role: "supervisor",
        content: "Proceder con empalme. Subir fotos finales al completar.",
        timestamp: "2026-06-12T09:00:00",
      },
    ],
    history: [
      {
        id: "h-1",
        action: "Tarea creada",
        description: "Tarea registrada en el sistema de operaciones.",
        user: "Sistema",
        timestamp: "2026-06-08T09:00:00",
      },
      {
        id: "h-2",
        action: "Asignada a cuadrilla",
        description: "Asignada a Cuadrilla Norte.",
        user: "Ing. Roberto Méndez",
        timestamp: "2026-06-09T10:00:00",
      },
      {
        id: "h-3",
        action: "Trabajo iniciado",
        description: "Cuadrilla reportó inicio de actividades en sitio.",
        user: "Cuadrilla Norte",
        timestamp: "2026-06-10T07:45:00",
      },
      {
        id: "h-4",
        action: "Foto cargada",
        description: "Evidencia fotográfica de caja EMP-042 subida.",
        user: "J. Ramírez",
        timestamp: "2026-06-12T09:30:00",
      },
    ],
  },
  "task-006": {
    evidence: [
      {
        id: "ev-1",
        title: "Poste km 4.2 — vista frontal",
        type: "photo",
        uploadedBy: "M. Soto",
        uploadedAt: "2026-06-11T11:00:00",
      },
      {
        id: "ev-2",
        title: "Medición verticalidad",
        type: "video",
        uploadedBy: "M. Soto",
        uploadedAt: "2026-06-11T11:30:00",
      },
    ],
    comments: [
      {
        id: "cm-1",
        author: "Ing. Patricia Vega",
        role: "supervisor",
        content: "Verificar altura del poste.",
        timestamp: "2026-06-10T16:00:00",
      },
      {
        id: "cm-2",
        author: "M. Soto",
        role: "operario",
        content: "Corregido.",
        timestamp: "2026-06-11T10:00:00",
      },
      {
        id: "cm-3",
        author: "Ing. Patricia Vega",
        role: "supervisor",
        content: "Aprobado.",
        timestamp: "2026-06-11T15:00:00",
      },
    ],
    history: [
      {
        id: "h-1",
        action: "Tarea creada",
        description: "Inspección de poste programada.",
        user: "Sistema",
        timestamp: "2026-06-08T09:00:00",
      },
      {
        id: "h-2",
        action: "Trabajo completado",
        description: "Cuadrilla reportó corrección de verticalidad.",
        user: "Cuadrilla Postación",
        timestamp: "2026-06-11T10:00:00",
      },
      {
        id: "h-3",
        action: "Enviada a aprobación",
        description: "Tarea marcada como Finalizada y enviada a revisión.",
        user: "M. Soto",
        timestamp: "2026-06-11T14:00:00",
      },
      {
        id: "h-4",
        action: "Aprobada",
        description: "Supervisor aprobó la inspección del poste.",
        user: "Ing. Patricia Vega",
        timestamp: "2026-06-11T15:00:00",
      },
    ],
  },
}

function createDefaultDetail(task: Task): TaskDetail {
  return {
    evidence: [
      {
        id: "ev-default",
        title: `Evidencia de inicio — ${task.code}`,
        type: "photo",
        uploadedBy: task.crew,
        uploadedAt: `${task.startDate}T08:00:00`,
      },
    ],
    comments: [
      {
        id: "cm-default",
        author: task.supervisor,
        role: "supervisor",
        content: `Revisar entregables de la tarea ${task.code} antes del cierre.`,
        timestamp: `${task.startDate}T09:00:00`,
      },
    ],
    history: [
      {
        id: "h-default-1",
        action: "Tarea creada",
        description: task.description,
        user: "Sistema",
        timestamp: `${task.startDate}T08:00:00`,
      },
      ...(task.status !== "pendiente"
        ? [
            {
              id: "h-default-2",
              action: "Asignada a cuadrilla",
              description: `Asignada a ${task.crew}.`,
              user: task.supervisor,
              timestamp: `${task.startDate}T09:00:00`,
            },
          ]
        : []),
      ...(task.status === "en-curso" ||
      task.status === "pendiente-cierre" ||
      task.status === "finalizada" ||
      task.status === "en-aprobacion" ||
      task.status === "cerrada"
        ? [
            {
              id: "h-default-3",
              action: "Trabajo iniciado",
              description: "Inicio de actividades reportado en campo.",
              user: task.crew,
              timestamp: `${task.startDate}T10:00:00`,
            },
          ]
        : []),
    ],
  }
}

export function getTaskById(id: string, tasks = mockTasks): Task | undefined {
  return tasks.find((task) => task.id === id)
}

export function getTaskDetail(task: Task): TaskDetail {
  return taskDetails[task.id] ?? createDefaultDetail(task)
}

export function getTasksSummary(tasks: Task[]) {
  return {
    pendiente: tasks.filter((task) => task.status === "pendiente").length,
    asignada: tasks.filter((task) => task.status === "asignada").length,
    enCurso: tasks.filter((task) => task.status === "en-curso").length,
    incidencia: tasks.filter((task) => task.status === "incidencia").length,
    pendienteCierre: tasks.filter(
      (task) =>
        task.status === "pendiente-cierre" || task.status === "en-aprobacion"
    ).length,
    enAprobacion: tasks.filter((task) => task.status === "en-aprobacion").length,
    finalizada: tasks.filter((task) => task.status === "finalizada").length,
    cerrada: tasks.filter((task) => task.status === "cerrada").length,
    cancelada: tasks.filter((task) => task.status === "cancelada").length,
  }
}

export function createTaskFromInput(
  input: Omit<Task, "id" | "progress"> & { progress?: number }
): Task {
  return buildTask({
    id: `task-${Date.now()}`,
    ...input,
  })
}
