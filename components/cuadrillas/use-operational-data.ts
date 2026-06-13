"use client"

import { useEvidenceOptional } from "@/components/evidencias/evidence-provider"
import { mockEvidence } from "@/lib/data/evidence"
import { mockProjects } from "@/lib/data/projects"
import { mockTasks } from "@/lib/data/tasks"

export function useOperationalData() {
  const evidenceContext = useEvidenceOptional()

  return {
    tasks: mockTasks,
    projects: mockProjects,
    evidence: evidenceContext?.evidence ?? mockEvidence,
  }
}
