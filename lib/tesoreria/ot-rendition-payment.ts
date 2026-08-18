/**
 * Tesorería 2.1 — expected vs received payment method on OT cash renditions.
 * Does not mutate tasks.payment_method.
 */

export const TREASURY_RECEIVED_PAYMENT_METHODS = [
  "efectivo",
  "transferencia",
  "debito",
  "credito",
  "mercadopago",
  "cheque",
  "otro",
] as const

export type TreasuryReceivedPaymentMethod =
  (typeof TREASURY_RECEIVED_PAYMENT_METHODS)[number]

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  debito: "Débito",
  credito: "Crédito",
  mercadopago: "Mercado Pago",
  cheque: "Cheque",
  otro: "Otro",
  /** Legacy OT catalog value — display only. */
  tarjeta: "Tarjeta",
}

export const TREASURY_RECEIVED_PAYMENT_METHOD_OPTIONS: {
  value: TreasuryReceivedPaymentMethod
  label: string
}[] = TREASURY_RECEIVED_PAYMENT_METHODS.map((value) => ({
  value,
  label: PAYMENT_METHOD_LABELS[value] ?? value,
}))

export function formatTreasuryPaymentMethodLabel(
  method: string | null | undefined
): string {
  const trimmed = method?.trim()
  if (!trimmed) return "—"
  return PAYMENT_METHOD_LABELS[trimmed] ?? trimmed
}

export const TREASURY_UNSPECIFIED_PAYMENT_METHOD_LABEL = "Sin especificar"

export function formatTreasuryExpensePaymentMethodLabel(
  method: string | null | undefined
): string {
  const trimmed = method?.trim()
  if (!trimmed) return TREASURY_UNSPECIFIED_PAYMENT_METHOD_LABEL
  return formatTreasuryPaymentMethodLabel(trimmed)
}

export function isTreasuryReceivedPaymentMethod(
  value: string | null | undefined
): value is TreasuryReceivedPaymentMethod {
  return TREASURY_RECEIVED_PAYMENT_METHODS.includes(
    (value?.trim() ?? "") as TreasuryReceivedPaymentMethod
  )
}

/** Initial select value: expected if it is a received option, otherwise expected if set. */
export function resolveInitialReceivedPaymentMethod(
  expected: string | null | undefined
): string {
  const trimmed = expected?.trim() ?? ""
  if (!trimmed) return "efectivo"
  return trimmed
}

export function resolveOtRenditionPaymentMatch(
  expected: string | null | undefined,
  received: string | null | undefined
): "match" | "modified" | null {
  const expectedTrimmed = expected?.trim() ?? ""
  const receivedTrimmed = received?.trim() ?? ""
  if (!expectedTrimmed || !receivedTrimmed) return null
  return expectedTrimmed === receivedTrimmed ? "match" : "modified"
}

export function formatOtRenditionPaymentAuditNote(input: {
  expected: string | null | undefined
  received: string | null | undefined
}): string {
  return [
    "Rendición de Cobranza",
    `Esperado: ${formatTreasuryPaymentMethodLabel(input.expected)}`,
    `Cobrado: ${formatTreasuryPaymentMethodLabel(input.received)}`,
  ].join(" · ")
}

export function readOtRenditionPaymentFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): { expected: string | null; received: string | null } {
  const expected =
    typeof metadata?.paymentMethodExpected === "string"
      ? metadata.paymentMethodExpected.trim() || null
      : null
  const received =
    typeof metadata?.paymentMethodReceived === "string"
      ? metadata.paymentMethodReceived.trim() || null
      : null
  return { expected, received }
}
