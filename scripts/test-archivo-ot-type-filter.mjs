import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import {
  ARCHIVE_OT_TYPE_FILTER_OPTIONS,
  taskMatchesWorkOrderOtTypeFilter,
} from "../lib/tasks/work-order-ot-type-filter.ts"

const root = resolve(import.meta.dirname, "..")

const fieldServiceTask = {
  projectId: undefined,
  serviceType: "instalacion-nueva",
  type: "fiber",
}

const obraTask = {
  projectId: "project-1",
  serviceType: null,
  type: "fiber",
}

const maintenanceTask = {
  projectId: undefined,
  serviceType: null,
  type: "maintenance",
}

test("Todas no filtra por tipo de OT", () => {
  assert.equal(
    taskMatchesWorkOrderOtTypeFilter(fieldServiceTask, "all"),
    true
  )
  assert.equal(taskMatchesWorkOrderOtTypeFilter(obraTask, "all"), true)
})

test("filtra por serviceType en OT de servicio", () => {
  assert.equal(
    taskMatchesWorkOrderOtTypeFilter(fieldServiceTask, "instalacion-nueva"),
    true
  )
  assert.equal(
    taskMatchesWorkOrderOtTypeFilter(fieldServiceTask, "service-tecnico"),
    false
  )
})

test("filtra tareas de Obra por projectId", () => {
  assert.equal(taskMatchesWorkOrderOtTypeFilter(obraTask, "obra"), true)
  assert.equal(
    taskMatchesWorkOrderOtTypeFilter(fieldServiceTask, "obra"),
    false
  )
})

test("filtra Mantenimiento por task.type", () => {
  assert.equal(
    taskMatchesWorkOrderOtTypeFilter(maintenanceTask, "mantenimiento"),
    true
  )
  assert.equal(
    taskMatchesWorkOrderOtTypeFilter(fieldServiceTask, "mantenimiento"),
    false
  )
})

test("opciones incluyen tipos actuales sin legacy", () => {
  const labels = ARCHIVE_OT_TYPE_FILTER_OPTIONS.map((option) => option.label)
  const values = ARCHIVE_OT_TYPE_FILTER_OPTIONS.map((option) => option.value)

  for (const label of [
    "Todas",
    "Instalación Nueva",
    "Service Técnico",
    "Cambio de Tecnología",
    "Mantenimiento",
    "Obra",
  ]) {
    assert.ok(labels.includes(label), `falta opción ${label}`)
  }

  for (const legacy of ["reclamo", "inspeccion-tecnica", "otro"]) {
    assert.equal(values.includes(legacy), false, `no debe incluir ${legacy}`)
  }
})

test("OTs legacy siguen siendo válidas en el listado sin romper el filtro", () => {
  const legacyTask = {
    projectId: undefined,
    serviceType: "reclamo",
    type: "fiber",
  }

  assert.equal(taskMatchesWorkOrderOtTypeFilter(legacyTask, "all"), true)
  assert.equal(
    taskMatchesWorkOrderOtTypeFilter(legacyTask, "instalacion-nueva"),
    false
  )
})

test("Archivo OT expone selector Tipo de OT en la barra de filtros", () => {
  const filtersSource = readFileSync(
    resolve(root, "components/tareas/tasks-filters.tsx"),
    "utf8"
  )
  const moduleSource = readFileSync(
    resolve(root, "components/tareas/tasks-module.tsx"),
    "utf8"
  )

  assert.match(filtersSource, /showWorkOrderTypeFilter/)
  assert.match(filtersSource, /Tipo de OT/)
  assert.match(filtersSource, /ARCHIVE_OT_TYPE_FILTER_OPTIONS/)
  assert.match(filtersSource, /taskMatchesWorkOrderOtTypeFilter/)
  assert.match(moduleSource, /showWorkOrderTypeFilter=\{isArchiveView\}/)
})
