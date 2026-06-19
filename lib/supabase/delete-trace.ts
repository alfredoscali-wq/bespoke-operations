const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

type DeleteTraceInput = {
  entity: "task" | "project"
  id: string
  code?: string
}

/** TEMP — remove after delete flow is verified end-to-end. */
export function logDeleteTrace(layer: string, input: DeleteTraceInput) {
  console.info("[DELETE TRACE]", {
    layer,
    entity: input.entity,
    id: input.id,
    code: input.code ?? null,
    idLooksLikeUuid: isUuid(input.id),
    idEqualsCode: input.code != null ? input.id === input.code : null,
  })
}
