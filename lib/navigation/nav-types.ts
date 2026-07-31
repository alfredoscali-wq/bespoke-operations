import type { LucideIcon } from "lucide-react"

import type { ModuleColorId } from "@/lib/ui/module-colors"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  description?: string
  pageTitle?: string
  /** Visual divider above this item within its group (sidebar only). */
  separatorBefore?: boolean
  /** Stable module identity color (CSS --module-*). */
  moduleColor?: ModuleColorId
}

export type NavGroup = {
  id: string
  label?: string
  items: NavItem[]
}
