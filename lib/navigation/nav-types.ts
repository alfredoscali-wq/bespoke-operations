import type { LucideIcon } from "lucide-react"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  description?: string
  pageTitle?: string
}

export type NavGroup = {
  id: string
  label?: string
  items: NavItem[]
}
