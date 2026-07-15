/**
 * Smoke checks for SPRINT REPORTES 1.0 — Reportes por Empleado.
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

assert(
  existsSync(resolve(root, "app/(dashboard)/reportes/por-empleado/page.tsx")),
  "page route exists"
)

const nav = read("components/reportes/reportes-section-nav.tsx")
assert(nav.includes("/reportes/por-empleado"), "section nav includes route")
assert(nav.includes("Reportes por Empleado"), "section nav label")

const areas = read("lib/reports/employee-individual/areas.ts")
assert(areas.includes('"tecnica"'), "area tecnica")
assert(areas.includes('"ventas"'), "area ventas")
assert(areas.includes('"atencion"'), "area atencion")
assert(areas.includes('"rrhh"'), "area rrhh")
assert(areas.includes('"supervision"'), "area supervision")

const build = read("lib/reports/employee-individual/build-report.ts")
assert(build.includes("ot_finalizadas"), "technical KPI")
assert(build.includes("filterEmployeeActivityByKpi"), "kpi list filter")
assert(build.includes("mapEquipoReportToEmployeeKpis"), "reuses AC equipo")

const period = read("lib/reports/employee-individual/period.ts")
assert(period.includes('"personalizado"'), "custom period")

const exportActions = read(
  "components/reportes/empleado/employee-report-export-actions.tsx"
)
assert(exportActions.includes("Exportar PDF"), "pdf export")
assert(exportActions.includes("Exportar Excel"), "excel export")
assert(exportActions.includes("Imprimir"), "print")

console.log("OK: employee individual reports sprint contracts")
