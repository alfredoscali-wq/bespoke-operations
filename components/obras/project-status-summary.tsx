import type { Project } from "@/lib/types/projects"
import {
  PROJECT_PAUSE_REASON_LABELS,
  formatDate,
} from "@/lib/projects/constants"
import { ProjectStatusBadge } from "@/components/obras/project-badges"
import {
  Card,
  CardContent,
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
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-right text-foreground">{value}</div>
    </div>
  )
}

export function ProjectStatusSummary({ project }: ProjectStatusSummaryProps) {
  const isPaused = project.status === "paused"
  const hasPauseInfo =
    isPaused && (project.pauseReason || project.pausedAt || project.pauseNotes)

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Estado operativo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <SummaryRow
          label="Estado"
          value={<ProjectStatusBadge status={project.status} />}
        />

        {hasPauseInfo ? (
          <>
            {project.pauseReason ? (
              <SummaryRow
                label="Motivo"
                value={PROJECT_PAUSE_REASON_LABELS[project.pauseReason]}
              />
            ) : null}
            {project.pausedAt ? (
              <SummaryRow
                label="Desde"
                value={formatDate(project.pausedAt.slice(0, 10))}
              />
            ) : null}
            {project.pauseNotes?.trim() ? (
              <SummaryRow label="Nota" value={project.pauseNotes} />
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
