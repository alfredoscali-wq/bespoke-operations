"use client"

import Link from "next/link"
import {
  BriefcaseBusiness,
  FolderOpen,
  Footprints,
  LayoutGrid,
  MapPinned,
  Plus,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { CommercialModuleSearch } from "@/components/gestion-comercial/search/commercial-module-search"
import type { CommercialModuleNavKey } from "@/lib/commercial/module-nav"
import { COMMERCIAL_PIPELINE_UI_ENABLED } from "@/lib/commercial/mvp-ui"
import { cn } from "@/lib/utils"

export type { CommercialModuleNavKey }

const NAV_ITEMS: Array<{
  key: CommercialModuleNavKey
  href: string
  label: string
  icon: LucideIcon
}> = [
  {
    key: "inicio",
    href: "/gestion-comercial",
    label: "Inicio",
    icon: BriefcaseBusiness,
  },
  {
    key: "oportunidades",
    href: "/gestion-comercial/oportunidades",
    label: "Clientes",
    icon: FolderOpen,
  },
  {
    key: "actividad",
    href: "/gestion-comercial/actividad-comercial",
    label: "Actividad Comercial",
    icon: Footprints,
  },
  {
    key: "pipeline",
    href: "/gestion-comercial/pipeline",
    label: "Pipeline",
    icon: LayoutGrid,
  },
  {
    key: "territorio",
    href: "/gestion-comercial/mapa",
    label: "Territorio (Clientes)",
    icon: MapPinned,
  },
]

const VISIBLE_NAV_ITEMS = NAV_ITEMS.filter(
  (item) => item.key !== "pipeline" || COMMERCIAL_PIPELINE_UI_ENABLED
)

type CommercialModuleHeroProps = {
  active: CommercialModuleNavKey
  title: string
  description: string
  /** Extra actions rendered after the standard nav (right side). */
  actions?: React.ReactNode
  /** Optional eyebrow above the title. */
  eyebrow?: string
  children?: React.ReactNode
  className?: string
  onNewOpportunity?: () => void
  showNewOpportunity?: boolean
}

export function CommercialModuleHero({
  active,
  title,
  description,
  actions,
  eyebrow = "Gestión Comercial",
  children,
  className,
  onNewOpportunity,
  showNewOpportunity = true,
}: CommercialModuleHeroProps) {
  return (
    <header
      className={cn(
        "overflow-hidden rounded-xl border border-blue-100/70 bg-gradient-to-br from-blue-500/[0.06] via-background to-slate-500/[0.03] shadow-sm",
        className
      )}
    >
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-medium tracking-wide text-blue-800/70 uppercase">
              {eyebrow}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.65rem]">
              {title}
            </h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            {VISIBLE_NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = item.key === active
              if (isActive) {
                return (
                  <Button
                    key={item.key}
                    type="button"
                    size="sm"
                    className="h-9 gap-2"
                    disabled
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Button>
                )
              }
              return (
                <Button
                  key={item.key}
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 gap-2"
                  asChild
                >
                  <Link href={item.href}>
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                </Button>
              )
            })}
            {showNewOpportunity && onNewOpportunity ? (
              <Button
                type="button"
                size="sm"
                className="h-9 gap-2"
                onClick={onNewOpportunity}
              >
                <Plus className="size-4" />
                Nuevo Cliente
              </Button>
            ) : null}
            {actions}
          </div>
        </div>

        <CommercialModuleSearch active={active} className="max-w-2xl" />

        {children ? <div className="pt-0.5">{children}</div> : null}
      </div>
    </header>
  )
}
