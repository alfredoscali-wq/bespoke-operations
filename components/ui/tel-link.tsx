"use client"

import { buildTelUrl } from "@/lib/utils/phone"
import { cn } from "@/lib/utils"

type TelLinkProps = {
  phone?: string | null
  children?: React.ReactNode
  className?: string
}

export function TelLink({ phone, children, className }: TelLinkProps) {
  const href = phone?.trim() ? buildTelUrl(phone) : null

  if (!href) {
    return (
      <span className={className}>{children ?? phone?.trim() ?? "—"}</span>
    )
  }

  return (
    <a
      href={href}
      className={cn(
        "font-medium text-primary transition-colors hover:text-primary/80 hover:underline",
        className
      )}
    >
      {children ?? phone}
    </a>
  )
}
