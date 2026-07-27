"use client"

import { cn } from "@/lib/utils"

type CommercialInfoRowProps = {
  label: string
  children: React.ReactNode
  className?: string
}

export function CommercialInfoRow({
  label,
  children,
  className,
}: CommercialInfoRowProps) {
  return (
    <div className={cn("grid gap-1 sm:grid-cols-[9rem_1fr] sm:gap-3", className)}>
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm text-foreground break-words">{children}</dd>
    </div>
  )
}
