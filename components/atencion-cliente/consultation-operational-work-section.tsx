"use client"

import { useEffect, useState } from "react"
import {
  ChevronDown,
  FileText,
  Headphones,
  Phone,
  UserCheck,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import {
  getVisibleOperationalCategories,
  hasOperationalWorkCounts,
  SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG,
  type SharedInboxOperationalCategory,
  type SharedInboxOperationalCounts,
  type SharedInboxQuery,
} from "@/lib/customer-atenciones/shared-inbox"
import { cn } from "@/lib/utils"

const OPERATIONAL_ICONS: Record<SharedInboxOperationalCategory, LucideIcon> = {
  retenciones: UserCheck,
  administracion: FileText,
  tecnica: Headphones,
  contactar_cliente: Phone,
}

const OPERATIONAL_TONES = {
  retenciones: "red",
  administracion: "amber",
  tecnica: "violet",
  contactar_cliente: "blue",
} as const satisfies Record<
  SharedInboxOperationalCategory,
  "red" | "amber" | "violet" | "blue"
>

type ConsultationOperationalWorkSectionProps = {
  query: SharedInboxQuery
  onQueryChange: (query: SharedInboxQuery) => void
}

export function ConsultationOperationalWorkSection({
  query,
  onQueryChange,
}: ConsultationOperationalWorkSectionProps) {
  const { sharedInboxOperationalCounts, isSharedInboxLoading } =
    useAtencionCliente()
  const [isExpanded, setIsExpanded] = useState(true)

  const visibleCategories = getVisibleOperationalCategories(
    sharedInboxOperationalCounts
  )
  const hasWork = hasOperationalWorkCounts(sharedInboxOperationalCounts)

  useEffect(() => {
    if (!isSharedInboxLoading) {
      setIsExpanded(hasWork)
    }
  }, [hasWork, isSharedInboxLoading])

  function handleCategoryClick(category: SharedInboxOperationalCategory) {
    const isActive = query.operationalCategory === category

    onQueryChange({
      ...query,
      statusFilter: "all",
      operationalCategory: isActive ? null : category,
    })
  }

  return (
    <section className="rounded-lg border bg-card/40">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setIsExpanded((current) => !current)}
        aria-expanded={isExpanded}
      >
        <div>
          <p className="text-sm font-medium text-foreground">
            Trabajo por resolver
          </p>
          <p className="text-xs text-muted-foreground">
            Clasificación operativa por próximo paso
          </p>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {isExpanded ? (
        <div className="border-t px-4 pb-4 pt-3">
          {isSharedInboxLoading ? (
            <p className="text-sm text-muted-foreground">Cargando trabajo…</p>
          ) : visibleCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay trabajo clasificado pendiente.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {visibleCategories.map((category) => {
                const Icon = OPERATIONAL_ICONS[category]
                const config = SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG[category]

                return (
                  <FilterableKpiCard
                    key={category}
                    compact
                    label={config.label}
                    value={formatOperationalCount(
                      sharedInboxOperationalCounts,
                      category
                    )}
                    icon={Icon}
                    tone={OPERATIONAL_TONES[category]}
                    isActive={query.operationalCategory === category}
                    isLoading={isSharedInboxLoading}
                    onClick={() => handleCategoryClick(category)}
                  />
                )
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  )
}

function formatOperationalCount(
  counts: SharedInboxOperationalCounts,
  category: SharedInboxOperationalCategory
): string {
  return counts[category].toLocaleString("es-AR")
}
