export type LatamTvErrorKind =
  | "not_configured"
  | "invalid_identifier"
  | "unavailable"

const PUBLIC_MESSAGE: Record<LatamTvErrorKind, string> = {
  not_configured: "La consulta de LATAM TV no está disponible.",
  invalid_identifier: "El identificador no es válido.",
  unavailable: "No se pudo consultar LATAM TV.",
}

/** Safe to send to the client. Never includes the token, URL, or LATAM body. */
export class LatamTvRequestError extends Error {
  readonly kind: LatamTvErrorKind

  constructor(kind: LatamTvErrorKind) {
    super(PUBLIC_MESSAGE[kind])
    this.name = "LatamTvRequestError"
    this.kind = kind
  }
}
