"use client"

import { useMemo, useState } from "react"

import { useEvidence } from "@/components/evidencias/evidence-provider"
import { EvidenceFiltersBar } from "@/components/evidencias/evidence-filters"
import { EvidenceSummaryCards } from "@/components/evidencias/evidence-summary-cards"
import { EvidenceTable } from "@/components/evidencias/evidence-table"
import {
  defaultEvidenceFilters,
  filterEvidence,
  getEvidenceFilterOptions,
} from "@/lib/data/evidence"
import type { EvidenceFilters } from "@/lib/types/evidence"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type EvidenceModuleProps = {
  initialFilters?: EvidenceFilters
}

export function EvidenceModule({ initialFilters }: EvidenceModuleProps) {
  const { evidence } = useEvidence()
  const [filters, setFilters] = useState<EvidenceFilters>(
    initialFilters ?? defaultEvidenceFilters
  )

  const filterOptions = useMemo(
    () => getEvidenceFilterOptions(evidence),
    [evidence]
  )

  const filteredEvidence = useMemo(
    () => filterEvidence(evidence, filters),
    [evidence, filters]
  )

  return (
    <div className="space-y-6">
      <EvidenceSummaryCards evidence={evidence} />

      <Card className="shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-base">Expediente de evidencias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <EvidenceFiltersBar
            filters={filters}
            onChange={setFilters}
            resultCount={filteredEvidence.length}
            projects={filterOptions.projects}
            tasks={filterOptions.tasks}
          />
          <EvidenceTable evidence={filteredEvidence} />
        </CardContent>
      </Card>
    </div>
  )
}
