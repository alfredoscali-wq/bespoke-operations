import type { LucideIcon } from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  description?: string
  pageTitle?: string
  /** Visual divider above this item within its group (sidebar only). */
  separatorBefore?: boolean
}

export type NavGroup = {
  id: string
  label?: string
  items: NavItem[]
}
