"use client"

import { useMemo } from "react"
import { notFound } from "next/navigation"

import { MaterialDetailView } from "@/components/materiales/material-detail-view"
import { getMaterialById, getMaterialDetail } from "@/lib/data/materials"

type MaterialDetailPageClientProps = {
  id: string
}

export function MaterialDetailPageClient({ id }: MaterialDetailPageClientProps) {
  const material = getMaterialById(id)

  const detail = useMemo(
    () => (material ? getMaterialDetail(material) : null),
    [material]
  )

  if (!material || !detail) {
    notFound()
  }

  return <MaterialDetailView material={material} detail={detail} />
}
