import { STATUS_BADGE_BASE } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

type StatusBadgeProps = React.ComponentProps<typeof Badge>

export function StatusBadge({ className, ...props }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(STATUS_BADGE_BASE, className)}
      {...props}
    />
  )
}
