"use client"

import { buildWhatsAppUrl } from "@/lib/utils/phone"
import { cn } from "@/lib/utils"

type WhatsAppLinkProps = {
  phone?: string | null
  children?: React.ReactNode
  className?: string
}

export function WhatsAppLink({
  phone,
  children,
  className,
}: WhatsAppLinkProps) {
  const href = phone?.trim() ? buildWhatsAppUrl(phone) : null

  if (!href) {
    return (
      <span className={className}>{children ?? phone?.trim() ?? "—"}</span>
    )
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "font-medium text-emerald-700 transition-colors hover:text-emerald-800 hover:underline",
        className
      )}
    >
      {children ?? phone}
    </a>
  )
}
