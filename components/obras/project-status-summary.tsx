import type { Project } from "@/lib/types/projects"
import {
  PROJECT_PAUSE_REASON_LABELS,
  PROJECT_STATUS_LABELS,
  formatDate,
} from "@/lib/projects/constants"
import { ProjectStatusBadge } from "@/components/obras/project-badges"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type ProjectStatusSummaryProps = {
  project: Project
}

function SummaryRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[120px_1fr] sm:items-start">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  )
}

export function ProjectStatusSummary({ project }: ProjectStatusSummaryProps) {
  const isPaused = project.status === "paused"
  const hasPauseInfo =
    isPaused && (project.pauseReason || project.pausedAt || project.pauseNotes)

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Estado de la Obra</CardTitle>
        <CardDescription>
          Situación operativa actual y detalle de pausa cuando aplique
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <SummaryRow
          label="Estado"
          value={<ProjectStatusBadge status={project.status} />}
        />

        {!hasPauseInfo && (
          <SummaryRow
            label="Resumen"
            value={PROJECT_STATUS_LABELS[project.status]}
          />
        )}

        {hasPauseInfo && (
          <>
            {project.pauseReason && (
              <SummaryRow
                label="Motivo"
                value={PROJECT_PAUSE_REASON_LABELS[project.pauseReason]}
              />
            )}
            {project.pausedAt && (
              <SummaryRow
                label="Desde"
                value={formatDate(project.pausedAt.slice(0, 10))}
              />
            )}
            {project.pauseNotes?.trim() && (
              <SummaryRow label="Observación" value={project.pauseNotes} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
