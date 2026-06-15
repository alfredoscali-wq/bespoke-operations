"use client"

import { useMemo } from "react"
import { notFound } from "next/navigation"

import { EvidenceDetailView } from "@/components/evidencias/evidence-detail-view"
import { useEvidence } from "@/components/evidencias/evidence-provider"
import { getEvidenceNavigation } from "@/lib/data/evidence"

type EvidenceDetailPageClientProps = {
  id: string
}

export function EvidenceDetailPageClient({ id }: EvidenceDetailPageClientProps) {
  const { evidence, getEvidence } = useEvidence()
  const record = getEvidence(id)

  const navigation = useMemo(
    () => getEvidenceNavigation(id, evidence),
    [id, evidence]
  )

  if (!record) {
    notFound()
  }

  return (
    <EvidenceDetailView
      key={`${record.id}-${record.status}-${record.comments.length}-${record.deletedAt ?? "active"}`}
      record={record}
      navigation={navigation}
    />
  )
}
