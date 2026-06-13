"use client"

import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import type { EvidenceNavigation } from "@/lib/types/evidence"
import { Button } from "@/components/ui/button"

type EvidenceNavigationBarProps = {
  navigation: EvidenceNavigation
  taskCode: string
}

export function EvidenceNavigationBar({
  navigation,
  taskCode,
}: EvidenceNavigationBarProps) {
  const { prevId, nextId, currentIndex, totalInTask } = navigation

  if (totalInTask <= 1) {
    return (
      <p className="text-xs text-muted-foreground">
        Única evidencia en {taskCode} ({totalInTask})
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2">
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1"
        disabled={!prevId}
        asChild={Boolean(prevId)}
      >
        {prevId ? (
          <Link href={`/evidencias/${prevId}`}>
            <ChevronLeft className="size-4" />
            Anterior
          </Link>
        ) : (
          <>
            <ChevronLeft className="size-4" />
            Anterior
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground">
        Evidencia{" "}
        <span className="font-medium tabular-nums text-foreground">
          {currentIndex}
        </span>{" "}
        de{" "}
        <span className="font-medium tabular-nums text-foreground">
          {totalInTask}
        </span>{" "}
        en {taskCode}
      </p>

      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1"
        disabled={!nextId}
        asChild={Boolean(nextId)}
      >
        {nextId ? (
          <Link href={`/evidencias/${nextId}`}>
            Siguiente
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <>
            Siguiente
            <ChevronRight className="size-4" />
          </>
        )}
      </Button>
    </div>
  )
}
