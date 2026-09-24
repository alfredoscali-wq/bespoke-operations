import { ProjectWorkReportPhotoGallery } from "@/components/obras/project-work-report-photo-gallery"
import { ProjectWorkReportPhotoGrid } from "@/components/obras/project-work-report-photo-grid"
import { projectWorkReportClientMeta } from "@/lib/projects/work-report/work-order-presentation"
import type { ProjectWorkReportWorkOrder } from "@/lib/projects/work-report/types"

type ProjectWorkReportWorkOrderSectionProps = {
  order: ProjectWorkReportWorkOrder
  accent?: string
  interactive?: boolean
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
      <p className="whitespace-pre-wrap text-sm font-medium">{value}</p>
    </div>
  )
}

export function ProjectWorkReportWorkOrderSection({
  order,
  accent,
  interactive = true,
}: ProjectWorkReportWorkOrderSectionProps) {
  const meta = projectWorkReportClientMeta(order)

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
      <div>
        <p className="text-sm font-semibold" style={{ color: accent }}>
          OT {order.code}
        </p>
        {order.title && order.title !== order.code ? (
          <h3 className="mt-1 text-lg font-semibold">{order.title}</h3>
        ) : null}
      </div>

      {meta.length > 0 ? (
        <div className="pwr-ot-meta grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {meta.map((item) => (
            <MetaRow key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      ) : null}

      <MetaRow label="Observaciones" value={order.observations} />
      <MetaRow label="Trabajo realizado" value={order.trabajoRealizado} />

      {order.checklist && order.checklist.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold" style={{ color: accent }}>
            Checklist
          </h4>
          <ul className="space-y-1.5">
            {order.checklist.map((item, itemIndex) => (
              <li key={`${order.code}-chk-${itemIndex}`} className="text-sm">
                <span className="mr-2 font-mono text-xs">
                  {item.completed ? "[x]" : "[ ]"}
                </span>
                {item.label}
                {item.result ? (
                  <span className="text-muted-foreground"> — {item.result}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <h4 className="text-sm font-semibold" style={{ color: accent }}>
          Evidencias
        </h4>
        {interactive ? (
          <ProjectWorkReportPhotoGallery photos={order.photos} hideCaptions />
        ) : (
          <ProjectWorkReportPhotoGrid photos={order.photos} hideCaptions />
        )}
      </div>
    </section>
  )
}
