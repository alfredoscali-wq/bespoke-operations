import { cn } from "@/lib/utils"

type QuickFilterBarProps = {
  children: React.ReactNode
  className?: string
}

export function QuickFilterBar({ children, className }: QuickFilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-3 rounded-xl border bg-muted/20 px-4 py-3",
        className
      )}
    >
      {children}
    </div>
  )
}

type QuickFilterFieldProps = {
  label: string
  children: React.ReactNode
  className?: string
}

export function QuickFilterField({
  label,
  children,
  className,
}: QuickFilterFieldProps) {
  return (
    <div className={cn("min-w-[160px] flex-1 space-y-1.5", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}
