export type PadronRowIdentity = {
  source: string
  sourceRow: number
}

export type PadronBulkRemovalResult = {
  key: string
  error: string | null
}

export type PadronBulkRemovalSummary = {
  removed: number
  failed: number
  failedKeys: string[]
  message: string | null
}

export function padronRowSelectionKey(row: PadronRowIdentity): string {
  return `${row.source}:${row.sourceRow}`
}

export function togglePadronRowSelection(
  selected: ReadonlySet<string>,
  key: string
): Set<string> {
  const next = new Set(selected)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return next
}

export function selectVisiblePadronRows(
  selected: ReadonlySet<string>,
  visibleKeys: readonly string[],
  selectAll: boolean
): Set<string> {
  const next = new Set(selected)
  for (const key of visibleKeys) {
    if (selectAll) next.add(key)
    else next.delete(key)
  }
  return next
}

export function visiblePadronSelectionState(
  selected: ReadonlySet<string>,
  visibleKeys: readonly string[]
): "none" | "some" | "all" {
  if (visibleKeys.length === 0) return "none"
  let count = 0
  for (const key of visibleKeys) {
    if (selected.has(key)) count += 1
  }
  if (count === 0) return "none"
  if (count === visibleKeys.length) return "all"
  return "some"
}

export function retainVisiblePadronSelection(
  selected: ReadonlySet<string>,
  visibleKeys: readonly string[]
): Set<string> {
  const visible = new Set(visibleKeys)
  const next = new Set<string>()
  for (const key of selected) {
    if (visible.has(key)) next.add(key)
  }
  return next
}

export function summarizePadronBulkRemoval(
  results: readonly PadronBulkRemovalResult[]
): PadronBulkRemovalSummary {
  const failedKeys = results.filter((result) => result.error).map((result) => result.key)
  const failed = failedKeys.length
  const removed = results.length - failed
  if (removed > 0 && failed > 0) {
    const removedLabel =
      removed === 1 ? "1 fila eliminada" : `${removed} filas eliminadas`
    const failedLabel =
      failed === 1
        ? "1 fila no pudo eliminarse"
        : `${failed} filas no pudieron eliminarse`
    return {
      removed,
      failed,
      failedKeys,
      message: `${removedLabel} correctamente. ${failedLabel}.`,
    }
  }
  if (removed === 0) {
    const onlyError = results.find((result) => result.error)?.error ?? null
    return {
      removed: 0,
      failed,
      failedKeys,
      message:
        failed === 1 && onlyError
          ? onlyError
          : "No se pudieron eliminar las filas seleccionadas.",
    }
  }
  return { removed, failed: 0, failedKeys: [], message: null }
}
