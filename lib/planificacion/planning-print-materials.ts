import { formatDateOnly } from "@/lib/dates/date-only"
import { formatUnitLabel } from "@/lib/materials/units"
import {
  filterPlanningTasksByCrewFilter,
  resolvePlanningTaskClientLabel,
} from "@/lib/planificacion/planning-utils"
import {
  formatDispatchOrderNumericLabel,
  resolveTaskRouteOrder,
  sortTasksByDispatchRoute,
} from "@/lib/tasks/dispatch-order"
import { resolveTaskAddressLabel } from "@/lib/tasks/operational-category"
import { readMaterialsNeededFromTask } from "@/lib/tasks/work-order"
import type { Crew } from "@/lib/types/crews"
import type { TaskMaterialLineView } from "@/lib/types/materials"
import type { Task } from "@/lib/types/tasks"

export type PlanningMaterialsStructuredLine = {
  code: string
  name: string
  quantityPlanned: number
  unitLabel: string
  warehouseName: string
}

export type PlanningMaterialsReportRow = {
  executionOrder: string
  workOrderNumber: string
  clientName: string
  address: string
  structuredLines: PlanningMaterialsStructuredLine[]
  materialsNeeded: string
}

export type PlanningMaterialsReport = {
  planningDate: string
  planningDateLabel: string
  crewId: string
  crewName: string
  rows: PlanningMaterialsReportRow[]
}

function resolveWorkOrderNumber(task: Task): string {
  return task.workOrderNumber?.trim() || task.code?.trim() || "—"
}

export function mapTaskMaterialLineToStructuredPrintLine(
  line: TaskMaterialLineView
): PlanningMaterialsStructuredLine {
  return {
    code: line.materialCode,
    name: line.materialName,
    quantityPlanned: line.quantityPlanned,
    unitLabel: formatUnitLabel(line.unit),
    warehouseName: line.warehouseName,
  }
}

export function formatStructuredLineForPrint(
  line: PlanningMaterialsStructuredLine
): string {
  return `${line.code} — ${line.name} — ${line.quantityPlanned.toLocaleString("es-AR")} ${line.unitLabel} — ${line.warehouseName}`
}

export function buildPlanningMaterialsReport(input: {
  tasks: Task[]
  crews: Pick<Crew, "id" | "name">[]
  planningDate: string
  crewId: string
  linesByTaskId?: Record<string, TaskMaterialLineView[]>
}): { ok: true; report: PlanningMaterialsReport } | { ok: false; message: string } {
  const crewId = input.crewId.trim()
  if (!crewId) {
    return { ok: false, message: "Seleccione una cuadrilla." }
  }

  const crew = input.crews.find((entry) => entry.id === crewId)
  if (!crew) {
    return { ok: false, message: "Cuadrilla no encontrada." }
  }

  const linesByTaskId = input.linesByTaskId ?? {}
  const crewTasks = filterPlanningTasksByCrewFilter(
    input.tasks,
    crewId,
    input.crews
  )
  const sorted = sortTasksByDispatchRoute(crewTasks, input.crews)

  const rows: PlanningMaterialsReportRow[] = sorted
    .map((task) => {
      const materialsNeeded = readMaterialsNeededFromTask(task)
      const structuredLines = (linesByTaskId[task.id] ?? []).map(
        mapTaskMaterialLineToStructuredPrintLine
      )

      if (structuredLines.length === 0 && !materialsNeeded) {
        return null
      }

      return {
        executionOrder:
          formatDispatchOrderNumericLabel(resolveTaskRouteOrder(task)) ?? "—",
        workOrderNumber: resolveWorkOrderNumber(task),
        clientName: resolvePlanningTaskClientLabel(task),
        address: resolveTaskAddressLabel(task),
        structuredLines,
        materialsNeeded,
      }
    })
    .filter((row): row is PlanningMaterialsReportRow => row !== null)

  return {
    ok: true,
    report: {
      planningDate: input.planningDate,
      planningDateLabel: formatDateOnly(input.planningDate, {
        locale: "es-AR",
      }),
      crewId: crew.id,
      crewName: crew.name.trim() || "Cuadrilla",
      rows,
    },
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function buildPlanningMaterialsReportHtml(
  report: PlanningMaterialsReport
): string {
  const rowsHtml =
    report.rows.length === 0
      ? `<p class="empty">No hay materiales registrados para esta cuadrilla.</p>`
      : report.rows
          .map((row) => {
            const structuredHtml =
              row.structuredLines.length > 0
                ? `<div class="materials-block">
            <div class="materials-label">Materiales del catálogo</div>
            <ul class="structured-list">
              ${row.structuredLines
                .map(
                  (line) =>
                    `<li>${escapeHtml(formatStructuredLineForPrint(line))}</li>`
                )
                .join("")}
            </ul>
          </div>`
                : ""

            const freeTextHtml = row.materialsNeeded
              ? `<div class="materials-block">
            <div class="materials-label">Materiales / indicaciones adicionales</div>
            <pre class="materials-body">${escapeHtml(row.materialsNeeded)}</pre>
          </div>`
              : ""

            return `
        <section class="ot">
          <div class="ot-meta">
            <div><strong>Orden:</strong> ${escapeHtml(row.executionOrder)}</div>
            <div><strong>OT:</strong> ${escapeHtml(row.workOrderNumber)}</div>
            <div><strong>Cliente:</strong> ${escapeHtml(row.clientName)}</div>
            <div><strong>Dirección:</strong> ${escapeHtml(row.address)}</div>
          </div>
          ${structuredHtml}
          ${freeTextHtml}
        </section>`
          })
          .join("")

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Materiales — ${escapeHtml(report.crewName)} — ${escapeHtml(report.planningDateLabel)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111;
      margin: 24px;
      font-size: 13px;
      line-height: 1.4;
    }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .subtitle { color: #444; margin: 0 0 20px; }
    .ot {
      border: 1px solid #ccc;
      border-radius: 6px;
      padding: 12px 14px;
      margin: 0 0 12px;
      page-break-inside: avoid;
    }
    .ot-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px 16px;
      margin-bottom: 10px;
    }
    .materials-block + .materials-block {
      margin-top: 10px;
    }
    .materials-label {
      font-weight: 700;
      margin-bottom: 4px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      color: #333;
    }
    .structured-list {
      margin: 0;
      padding-left: 18px;
    }
    .materials-body {
      white-space: pre-wrap;
      font-family: inherit;
      margin: 0;
      font-size: 13px;
    }
    .empty { color: #666; }
    @media print {
      body { margin: 12mm; }
    }
  </style>
</head>
<body>
  <h1>Informe de Materiales por Cuadrilla</h1>
  <p class="subtitle">
    <strong>Fecha:</strong> ${escapeHtml(report.planningDateLabel)}
    &nbsp;·&nbsp;
    <strong>Cuadrilla:</strong> ${escapeHtml(report.crewName)}
  </p>
  ${rowsHtml}
</body>
</html>`
}

export function printPlanningMaterialsReport(
  report: PlanningMaterialsReport
): boolean {
  if (typeof window === "undefined") {
    return false
  }

  const html = buildPlanningMaterialsReportHtml(report)

  const printWindow = window.open("", "_blank", "width=900,height=700")
  if (!printWindow || printWindow.closed) {
    return false
  }

  try {
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  } catch {
    printWindow.close()
    return false
  }

  const triggerPrint = () => {
    try {
      printWindow.focus()
      printWindow.print()
    } catch {
      // If print is blocked, content remains visible for manual print.
    }
  }

  if (printWindow.document.readyState === "complete") {
    printWindow.setTimeout(triggerPrint, 250)
  } else {
    printWindow.addEventListener("load", () => {
      printWindow.setTimeout(triggerPrint, 100)
    })
  }

  return true
}
