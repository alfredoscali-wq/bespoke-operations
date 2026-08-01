"use client"

/**
 * Sync Análisis nav context to the URL without remounting screens.
 */

import { useCallback, useMemo } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import {
  buildAnalysisSearchParams,
  mergeAnalysisNavContext,
  parseAnalysisNavContext,
  pushAnalysisTrail,
} from "@/lib/analysis/smart-navigation"
import type {
  AnalysisNavContext,
  AnalysisNavStepId,
} from "@/lib/analysis/smart-navigation/types"

export function useAnalysisNavContext(currentStep: AnalysisNavStepId) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const context = useMemo(
    () => parseAnalysisNavContext(searchParams),
    [searchParams]
  )

  const replaceContext = useCallback(
    (patch: AnalysisNavContext) => {
      const next = mergeAnalysisNavContext(context, {
        ...patch,
        trail: pushAnalysisTrail(
          patch.trail ?? context.trail,
          currentStep
        ),
      })
      const params = buildAnalysisSearchParams(next)
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      })
    },
    [context, currentStep, pathname, router]
  )

  return { context, replaceContext, searchParams }
}
