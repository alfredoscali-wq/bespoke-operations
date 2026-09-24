import Link from "next/link"

import { ProjectWorkReportPdfDownloadButton } from "@/components/obras/project-work-report-pdf-download-button"
import { ProjectWorkReportWorkOrderSection } from "@/components/obras/project-work-report-work-order-section"
import type { ProjectWorkReport } from "@/lib/projects/work-report/types"
import { cn } from "@/lib/utils"

type ProjectWorkReportViewProps = {
  report: ProjectWorkReport
  pdf?: {
    endpoint: string
    body?: unknown
    fileName: string
  }
  backHref?: string
  backLabel?: string
  variant?: "web" | "print"
}

function rgbCss(color: { r: number; g: number; b: number } | null | undefined) {
  if (!color) return undefined
  return `rgb(${color.r} ${color.g} ${color.b})`
}

function MetaRow({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  )
}

export function ProjectWorkReportView({
  report,
  pdf,
  backHref,
  backLabel = "Volver a la obra",
  variant = "web",
}: ProjectWorkReportViewProps) {
  const accent = rgbCss(report.branding.primaryRgb)
  const logoSrc = report.branding.logoUrl ?? report.branding.logoDataUrl
  const isPrint = variant === "print"

  return (
    <article
      className={cn(
        "pwr-report mx-auto max-w-5xl space-y-8 pb-16",
        isPrint && "pwr-print"
      )}
    >
      <header className="pwr-cover space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt={report.project.name}
              className="h-12 max-w-[220px] object-contain"
            />
          ) : (
            <p className="text-sm font-medium" style={{ color: accent }}>
              Informe de obra
            </p>
          )}
          {pdf && !isPrint ? (
            <div className="pwr-web-only">
              <ProjectWorkReportPdfDownloadButton
                endpoint={pdf.endpoint}
                body={pdf.body}
                fileName={pdf.fileName}
              />
            </div>
          ) : null}
        </div>

        <div>
          <p
            className="text-sm font-semibold tracking-wide"
            style={{ color: accent }}
          >
            {report.cover.title}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {report.project.name}
          </h1>
          <p className="mt-1 text-lg font-semibold" style={{ color: accent }}>
            {report.project.code}
          </p>
        </div>

        <div className="pwr-cover-meta grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetaRow label="Cliente" value={report.project.client} />
          <MetaRow label="Ubicación" value={report.project.location} />
          <MetaRow label="Período" value={report.project.period} />
          <MetaRow
            label="Generado"
            value={report.metadata.generatedAtLabel}
          />
        </div>

        {backHref && !isPrint ? (
          <Link
            href={backHref}
            className="pwr-web-only inline-flex text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {backLabel}
          </Link>
        ) : null}
      </header>

      <section className="pwr-summary space-y-4">
        <h2 className="text-xl font-semibold">Resumen</h2>
        {report.summary.filterNote ? (
          <p className="text-sm italic text-muted-foreground">
            {report.summary.filterNote}
          </p>
        ) : null}
        {report.summary.description ? (
          <p className="text-sm leading-relaxed">{report.summary.description}</p>
        ) : null}
        <div className="pwr-kpis grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total OT" value={report.summary.includedCount} />
          <KpiCard label="Finalizadas" value={report.summary.completedCount} />
          <KpiCard label="Activas" value={report.summary.activeCount} />
          <KpiCard
            label="Pendientes de cierre"
            value={report.summary.pendingClosureCount}
          />
        </div>
        <h2 className="pwr-print-only text-xl font-semibold">
          Órdenes de trabajo
        </h2>
      </section>

      <section className="space-y-4">
        <h2 className="pwr-web-only text-xl font-semibold">Órdenes de trabajo</h2>
        {report.workOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay órdenes de trabajo para el filtro seleccionado.
          </p>
        ) : null}
        <div className="pwr-orders-list space-y-6">
          {report.workOrders.map((order) => (
            <div
              key={order.code}
              className="pwr-work-order"
              data-work-order={order.code}
            >
              <ProjectWorkReportWorkOrderSection
                order={order}
                accent={accent}
                interactive={!isPrint}
              />
            </div>
          ))}
        </div>
      </section>
    </article>
  )
}
