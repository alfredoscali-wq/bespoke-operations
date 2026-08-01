"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"

import type { AnalysisBreadcrumbCrumb } from "@/lib/analysis/smart-navigation/types"
import { cn } from "@/lib/utils"

export function AnalysisBreadcrumb({
  crumbs,
  className,
}: {
  crumbs: AnalysisBreadcrumbCrumb[]
  className?: string
}) {
  if (crumbs.length === 0) return null

  return (
    <nav
      aria-label="Navegación ejecutiva"
      className={cn(
        "flex flex-wrap items-center gap-1 text-xs text-muted-foreground",
        className
      )}
    >
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1
        return (
          <span key={crumb.id} className="inline-flex items-center gap-1">
            {index > 0 ? (
              <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden />
            ) : null}
            {crumb.href && !isLast ? (
              <Link
                href={crumb.href}
                className="hover:text-foreground hover:underline"
              >
                {crumb.label}
              </Link>
            ) : (
              <span
                className={cn(isLast && "font-medium text-foreground")}
                aria-current={isLast ? "page" : undefined}
              >
                {crumb.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
