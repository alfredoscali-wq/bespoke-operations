"use client"

import {
  buildMigrationDataQuality,
  type MigrationDataQualityField,
} from "@/lib/customers/commercial-migration/review-utils"
import type { EnrichedMigrationCustomer } from "@/lib/customers/commercial-migration/review-types"
import { cn } from "@/lib/utils"

type MigrationDataQualityPanelProps = {
  record: EnrichedMigrationCustomer
}

function QualityRow({ field }: { field: MigrationDataQualityField }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={field.ok ? "text-emerald-600" : "text-red-600"}>
        {field.ok ? "✔" : "✖"}
      </span>
      <span className="text-foreground">{field.label}</span>
    </div>
  )
}

export function MigrationDataQualityPanel({
  record,
}: MigrationDataQualityPanelProps) {
  const { score, fields } = buildMigrationDataQuality(record)

  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Calidad de Datos
          </p>
          <p className="mt-1 text-3xl font-semibold text-foreground">{score} %</p>
        </div>
        <div
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            score >= 85
              ? "bg-emerald-100 text-emerald-800"
              : score >= 60
                ? "bg-amber-100 text-amber-800"
                : "bg-red-100 text-red-800"
          )}
        >
          {score >= 85 ? "Alta" : score >= 60 ? "Media" : "Baja"}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {fields.map((field) => (
          <QualityRow key={field.key} field={field} />
        ))}
      </div>
    </div>
  )
}
