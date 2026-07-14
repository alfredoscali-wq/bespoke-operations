import assert from "node:assert/strict"
import test from "node:test"

import {
  PLANNING_PENDING_CLOSURE_BRIEF_HISTORY_LIMIT,
  PLANNING_PENDING_CLOSURE_DETAIL_SECTIONS,
  PLANNING_PENDING_CLOSURE_EXECUTION_BLOCKS,
  PLANNING_PENDING_CLOSURE_REMOVED_DETAIL_BLOCKS,
  PLANNING_PENDING_CLOSURE_SUPERVISOR_ACTIONS,
  PLANNING_PENDING_CLOSURE_TASK_CONTEXT_FIELDS,
  resolvePendingClosureTechnicianObservations,
  selectPendingClosureBriefHistory,
  selectPendingClosureOperationalEvidences,
} from "../lib/planificacion/planning-pending-closure-detail.ts"

test("panel simplificado expone contexto OT reducido", () => {
  assert.deepEqual(PLANNING_PENDING_CLOSURE_TASK_CONTEXT_FIELDS, [
    "taskCode",
    "workTitle",
    "customer",
    "crew",
    "operator",
  ])
})

test("panel simplificado organiza OT, ejecución e historial", () => {
  assert.deepEqual(PLANNING_PENDING_CLOSURE_DETAIL_SECTIONS, [
    "ot",
    "execution",
    "history",
  ])
})

test("bloque de ejecución prioriza checklist, observaciones y evidencias", () => {
  assert.deepEqual(PLANNING_PENDING_CLOSURE_EXECUTION_BLOCKS, [
    "operationalChecklist",
    "technicianObservations",
    "operationalEvidences",
  ])
})

test("expediente completo y bloques administrativos quedan fuera del panel", () => {
  assert.equal(
    PLANNING_PENDING_CLOSURE_REMOVED_DETAIL_BLOCKS.includes(
      "TaskAdminDetailView"
    ),
    true
  )
  assert.equal(
    PLANNING_PENDING_CLOSURE_REMOVED_DETAIL_BLOCKS.includes("adminExpediente"),
    true
  )
  assert.equal(
    PLANNING_PENDING_CLOSURE_REMOVED_DETAIL_BLOCKS.includes(
      "TaskAdminReferencePhotos"
    ),
    true
  )
})

test("acciones de supervisor se mantienen sin cambios", () => {
  assert.deepEqual(PLANNING_PENDING_CLOSURE_SUPERVISOR_ACTIONS, [
    "Solicitar corrección",
    "Aprobar y cerrar",
  ])
})

test("historial breve limita eventos recientes", () => {
  const history = [
    {
      id: "h-1",
      action: "Orden creada",
      description: "Alta inicial",
      user: "Sistema",
      timestamp: "2026-06-08T09:00:00",
    },
    {
      id: "h-2",
      action: "Trabajo iniciado",
      description: "Inicio en campo",
      user: "Cuadrilla",
      timestamp: "2026-06-10T10:00:00",
    },
    {
      id: "h-3",
      action: "Enviada a aprobación",
      description: "Checklist completado",
      user: "Operario",
      timestamp: "2026-06-11T14:00:00",
    },
  ]

  const briefHistory = selectPendingClosureBriefHistory(history)

  assert.equal(briefHistory.length, 3)
  assert.equal(briefHistory[0]?.id, "h-3")
  assert.equal(
    selectPendingClosureBriefHistory(
      Array.from({ length: 8 }, (_, index) => ({
        id: `h-${index}`,
        action: `Evento ${index}`,
        description: "Detalle",
        user: "Sistema",
        timestamp: `2026-06-${String(index + 1).padStart(2, "0")}T10:00:00`,
      })),
      PLANNING_PENDING_CLOSURE_BRIEF_HISTORY_LIMIT
    ).length,
    PLANNING_PENDING_CLOSURE_BRIEF_HISTORY_LIMIT
  )
})

test("observaciones del técnico priorizan Trabajo Realizado", () => {
  const fromTrabajo = resolvePendingClosureTechnicianObservations(
    {
      operationalSteps: [
        {
          id: "step-1",
          label: "Cierre",
          observation: "Paso operativo",
          completedAt: "2026-06-11T12:00:00",
        },
      ],
      taskMetadata: {
        trabajoRealizado: "  Se cambió ONT y se configuró router.  ",
      },
    },
    {
      comments: [
        {
          id: "cm-1",
          author: "Operario",
          role: "operario",
          content: "Comentario alterno",
          timestamp: "2026-06-11T13:00:00",
        },
      ],
    }
  )

  assert.equal(fromTrabajo, "Se cambió ONT y se configuró router.")
})

test("observaciones del técnico priorizan pasos operativos", () => {
  const fromSteps = resolvePendingClosureTechnicianObservations(
    {
      operationalSteps: [
        {
          id: "step-1",
          label: "Cierre",
          observation: "  Cliente conforme  ",
          completedAt: "2026-06-11T12:00:00",
        },
      ],
    },
    {
      comments: [
        {
          id: "cm-1",
          author: "Operario",
          role: "operario",
          content: "Comentario alterno",
          timestamp: "2026-06-11T13:00:00",
        },
      ],
    }
  )

  assert.equal(fromSteps, "Cliente conforme")

  const fromComments = resolvePendingClosureTechnicianObservations(
    { operationalSteps: [] },
    {
      comments: [
        {
          id: "cm-1",
          author: "Operario",
          role: "operario",
          content: "Trabajo finalizado sin novedad",
          timestamp: "2026-06-11T13:00:00",
        },
      ],
    }
  )

  assert.equal(fromComments, "Trabajo finalizado sin novedad")
})

test("evidencias operativas excluyen fotos duplicadas del checklist", () => {
  const evidences = selectPendingClosureOperationalEvidences([
    {
      id: "ev-1",
      title: "Foto de cierre",
      type: "photo",
      uploadedBy: "Operario",
      uploadedAt: "2026-06-11T12:00:00",
    },
    {
      id: "ev-2",
      title: "Reporte PDF",
      type: "pdf",
      uploadedBy: "Operario",
      uploadedAt: "2026-06-11T12:30:00",
    },
  ])

  assert.deepEqual(
    evidences.map((evidence) => evidence.id),
    ["ev-2"]
  )
})
