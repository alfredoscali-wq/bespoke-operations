import {
  getProjectHealthLabel,
  getProjectHealthVariant,
  type ProjectHealth,
  type ProjectHealthVariant,
} from "@/lib/projects/project-operational-metrics"
import { STATUS_TONE_STYLES, type VisualTone } from "@/lib/ui/visual-tokens"
import { StatusBadge } from "@/components/ui/status-badge"
import { cn } from "@/lib/utils"

export interface ProjectHealthBadgeProps {
  health: ProjectHealth
  className?: string
}

const HEALTH_EMOJI: Record<ProjectHealth, string> = {
  healthy: "🟢",
  risk: "🟡",
  overdue: "🔴",
}

const VARIANT_TONE: Record<ProjectHealthVariant, VisualTone> = {
  success: "green",
  warning: "yellow",
  danger: "red",
}

export function ProjectHealthBadge({
  health,
  className,
}: ProjectHealthBadgeProps) {
  if (health === "risk") {
    return null
  }

  const variant = getProjectHealthVariant(health)
  const label = getProjectHealthLabel(health)

  return (
    <StatusBadge
      className={cn(STATUS_TONE_STYLES[VARIANT_TONE[variant]], className)}
    >
      {HEALTH_EMOJI[health]} {label}
    </StatusBadge>
  )
}
