import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

export interface ProjectProgressBarProps {
  value: number
  className?: string
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, Math.round(value)))
}

export function ProjectProgressBar({
  value,
  className,
}: ProjectProgressBarProps) {
  const progress = clampProgress(value)

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <Progress value={progress} className="h-1.5 flex-1" />
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {progress}%
      </span>
    </div>
  )
}
