import { formatDateOnly } from "@/lib/dates/date-only"
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
import type { Task } from "@/lib/types/tasks"

export type PlanningMaterialsReportRow = {
  executionOrder: string
  workOrderNumber: string
  clientName: string
  address: string
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
  return (
    task.workOrderNumber?.trim() ||
    task.code?.trim() ||
    "—"
  )
}

export function buildPlanningMaterialsReport(input: {
  tasks: Task[]
  crews: Pick<Crew, "id" | "name">[]
  planningDate: string
  crewId: string
}): { ok: true; report: PlanningMaterialsReport } | { ok: false; message: string } {
  const crewId = input.crewId.trim()
  if (!crewId) {
    return { ok: false, message: "Seleccione una cuadrilla." }
  }

  const crew = input.crews.find((entry) => entry.id === crewId)
  if (!crew) {
    return { ok: false, message: "Cuadrilla no encontrada." }
  }

  const crewTasks = filterPlanningTasksByCrewFilter(
    input.tasks,
    crewId,
    input.crews
  )
  const sorted = sortTasksByDispatchRoute(crewTasks, input.crews)

  const rows: PlanningMaterialsReportRow[] = sorted
    .map((task) => {
      const materialsNeeded = readMaterialsNeededFromTask(task)
      if (!materialsNeeded) {
        return null
      }

      return {
        executionOrder:
          formatDispatchOrderNumericLabel(resolveTaskRouteOrder(task)) ?? "—",
        workOrderNumber: resolveWorkOrderNumber(task),
        clientName: resolvePlanningTaskClientLabel(task),
        address: resolveTaskAddressLabel(task),
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
      ? `<p class="empty">No hay materiales cargados para esta cuadrilla en la fecha seleccionada.</p>`
      : report.rows
          .map(
            (row) => `
        <section class="ot">
          <div class="ot-meta">
            <div><strong>Orden:</strong> ${escapeHtml(row.executionOrder)}</div>
            <div><strong>OT:</strong> ${escapeHtml(row.workOrderNumber)}</div>
            <div><strong>Cliente:</strong> ${escapeHtml(row.clientName)}</div>
            <div><strong>Dirección:</strong> ${escapeHtml(row.address)}</div>
          </div>
          <div class="materials">
            <div class="materials-label">Materiales Necesarios</div>
            <pre class="materials-body">${escapeHtml(row.materialsNeeded)}</pre>
          </div>
        </section>`
          )
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
    .materials-label {
      font-weight: 700;
      margin-bottom: 4px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.02em;
      color: #333;
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
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=700")
  if (!printWindow) {
    return false
  }

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()

  // Allow layout/paint before the print dialog.
  printWindow.setTimeout(() => {
    printWindow.print()
  }, 250)

  return true
}
