import { NextResponse } from "next/server"
import * as XLSX from "xlsx"

import {
  queryAllAuditLogsForExport,
} from "@/lib/audit/audit-service"
import { buildAuditExportRow } from "@/lib/audit/display-utils"
import {
  formatAuditActionLabel,
  formatAuditModuleLabel,
} from "@/lib/audit/audit-labels"
import type { AuditEntityType, AuditModule, AuditSeverity } from "@/lib/audit/types"
import { requireAdministratorSession } from "@/lib/auth/require-administrator"
import { resolveTenantCompanyId } from "@/lib/operations/tenant-scope"
import { createAdminClient } from "@/lib/supabase/admin"

function parseModule(value: string | null): AuditModule | undefined {
  if (!value) return undefined
  return value as AuditModule
}

function parseSeverity(value: string | null): AuditSeverity | undefined {
  if (!value) return undefined
  return value as AuditSeverity
}

function parseEntityType(value: string | null): AuditEntityType | undefined {
  if (!value) return undefined
  return value as AuditEntityType
}

export async function GET(request: Request) {
  const auth = await requireAdministratorSession()

  if (!auth.ok) {
    return NextResponse.json(
      { success: false, message: auth.message },
      { status: auth.status }
    )
  }

  const { searchParams } = new URL(request.url)
  const format = searchParams.get("format") ?? "csv"

  if (format !== "csv" && format !== "xlsx" && format !== "pdf") {
    return NextResponse.json(
      { success: false, message: "Formato de exportación no soportado." },
      { status: 400 }
    )
  }

  try {
    const admin = createAdminClient()
    const entries = await queryAllAuditLogsForExport(admin, {
      companyId: resolveTenantCompanyId(auth.sessionUser),
      module: parseModule(searchParams.get("module")),
      action: searchParams.get("action") ?? undefined,
      entityType: parseEntityType(searchParams.get("entityType")),
      entityId: searchParams.get("entityId") ?? undefined,
      severity: parseSeverity(searchParams.get("severity")),
      performedByUserId: searchParams.get("performedByUserId") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      entityLabel: searchParams.get("entityLabel") ?? undefined,
      otCode: searchParams.get("otCode") ?? undefined,
      customerQuery: searchParams.get("customerQuery") ?? undefined,
      projectQuery: searchParams.get("projectQuery") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    })

    const rows: Record<string, string>[] = entries.map((entry) => {
      const base = buildAuditExportRow(entry)
      return {
        ...base,
        Modulo: formatAuditModuleLabel(entry.module),
        Accion: formatAuditActionLabel(entry.action),
      }
    })

    const stamp = new Date().toISOString().slice(0, 10)
    const filename = `historial-sistema-${stamp}`

    if (format === "csv") {
      const worksheet = XLSX.utils.json_to_sheet(rows)
      const csv = XLSX.utils.sheet_to_csv(worksheet)

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
        },
      })
    }

    if (format === "xlsx") {
      const worksheet = XLSX.utils.json_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Historial")
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

      return new NextResponse(buffer, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
        },
      })
    }

    const { jsPDF } = await import("jspdf")
    const doc = new jsPDF({ orientation: "landscape" })
    doc.setFontSize(12)
    doc.text("Log del Sistema", 14, 16)
    doc.setFontSize(8)

    let y = 24
    for (const row of rows.slice(0, 80)) {
      const line = `${row.Fecha} | ${row.Usuario} | ${row.Modulo} | ${row.Accion} | ${row.Entidad}`
      doc.text(line, 14, y)
      y += 5
      if (y > 190) break
    }

    const pdfBuffer = doc.output("arraybuffer")

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo exportar el historial."

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
