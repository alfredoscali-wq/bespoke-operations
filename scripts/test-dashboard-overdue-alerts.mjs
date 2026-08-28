import assert from "node:assert/strict"
import test from "node:test"

import { buildOperationalAlerts } from "../lib/data/dashboard.ts"
import { moduleFilterUrls } from "../lib/navigation/query-filters.ts"

function project(id) {
  return {
    id,
    code: `OB-${id}`,
    name: `Obra ${id}`,
    client: "Cliente",
    status: "active",
    type: "ftth",
    supervisor: "Sup",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  }
}

function overdueProjectTask(projectId) {
  return {
    id: `task-${projectId}`,
    code: `OT-${projectId}`,
    title: "Tarea vencida",
    status: "vencida",
    projectId,
    projectCode: `OB-${projectId}`,
    dueDate: "2026-01-01",
    startDate: "2026-01-01",
    crewId: null,
    crewName: "",
    supervisorName: "",
    customerId: null,
    customerName: "",
    priority: "normal",
    category: "instalacion",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  }
}

function overdueFieldTask() {
  return {
    id: "task-field",
    code: "OT-FIELD",
    title: "Tarea campo",
    status: "vencida",
    projectId: null,
    projectCode: "",
    dueDate: "2026-01-01",
    startDate: "2026-01-01",
    crewId: null,
    crewName: "",
    supervisorName: "",
    customerId: null,
    customerName: "",
    priority: "normal",
    category: "instalacion",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  }
}

test("OT vencidas de Obras se identifican y enlazan a Obras", () => {
  const alerts = buildOperationalAlerts({
    projects: [project("p1")],
    tasks: [overdueProjectTask("p1")],
    crews: [],
    crewAvailabilityContext: {
      availabilityRecords: [],
      getEmployee: () => undefined,
    },
  })

  const projectAlert = alerts.find((alert) => alert.id === "overdue-project-tasks")
  assert.ok(projectAlert)
  assert.match(projectAlert.message, /OT vencida.*de Obras/)
  assert.equal(projectAlert.description, "Requieren reprogramación")
  assert.equal(projectAlert.href, moduleFilterUrls.projects.overdueOt())
  assert.equal(alerts.some((alert) => alert.id === "overdue-field-tasks"), false)
})

test("OT vencidas de campo siguen enlazando a Órdenes de Trabajo", () => {
  const alerts = buildOperationalAlerts({
    projects: [],
    tasks: [overdueFieldTask()],
    crews: [],
    crewAvailabilityContext: {
      availabilityRecords: [],
      getEmployee: () => undefined,
    },
  })

  const fieldAlert = alerts.find((alert) => alert.id === "overdue-field-tasks")
  assert.ok(fieldAlert)
  assert.equal(fieldAlert.href, moduleFilterUrls.tasks.status("vencida"))
  assert.equal(alerts.some((alert) => alert.id === "overdue-project-tasks"), false)
})

test("mezcla de OT vencidas genera dos alertas", () => {
  const alerts = buildOperationalAlerts({
    projects: [project("p1")],
    tasks: [overdueProjectTask("p1"), overdueFieldTask()],
    crews: [],
    crewAvailabilityContext: {
      availabilityRecords: [],
      getEmployee: () => undefined,
    },
  })

  assert.ok(alerts.some((alert) => alert.id === "overdue-project-tasks"))
  assert.ok(alerts.some((alert) => alert.id === "overdue-field-tasks"))
})
