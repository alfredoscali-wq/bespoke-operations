import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type PageHeaderProps = {
  title: string
  description?: string
  icon?: LucideIcon
  className?: string
}

export function PageHeader({
  title,
  description,
  icon: Icon,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 space-y-1", className)}>
      <div className="flex items-center gap-2">
        {Icon && (
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/8 text-primary">
            <Icon className="size-4" />
          </div>
        )}
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
      </div>
      {description && (
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
