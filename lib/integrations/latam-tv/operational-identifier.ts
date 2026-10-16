/**
 * Diagnóstico del identificador que LATAM espera en las operaciones.
 *
 * modify-client, disable-client, enable-client, modify-password,
 * register-client y el filtro de get-clients envían un campo llamado
 * `identificador`. La documentación incorporada no dice que ese valor sea
 * `id_crm`, `id_iptv` ni el N° ABNet.
 *
 * En el padrón real de get-clients la clave `identificador` no existe e
 * `id_crm` llega null. `id_iptv` aparece, y get-clients responde code 3
 * si se lo envía como identificador.
 */

export type LatamOperationalIdentifierCase =
  | "confirmed"
  | "missing_from_catalog"
  | "undetermined"

export type LatamOperationalIdentifierReading = {
  case: LatamOperationalIdentifierCase
  requestField: "identificador"
  value: string | null
  identificador: string | null
  idCrm: string | null
  idIptv: string | null
  abnetNumber: string | null
}

function text(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function abnetNumber(value: string): string | null {
  const digits = value.replace(/\D/g, "").replace(/^0+/, "")
  return digits || null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/**
 * Lee el identificador operativo desde un cliente de get-clients.
 * No copia el N° ABNet ni `id_iptv`. `id_crm` se observa y no se adopta:
 * el contrato no lo declara equivalente a `identificador`.
 */
export function readLatamOperationalIdentifier(
  record: unknown,
  abnet: string | null = null
): LatamOperationalIdentifierReading {
  const client = asRecord(record)
  const abnetNumberValue = abnet ? abnetNumber(abnet) : null
  const idCrm = client ? text(client.id_crm) : null
  const idIptv = client ? text(client.id_iptv) : null
  const explicit = client && Object.prototype.hasOwnProperty.call(client, "identificador")
    ? text(client.identificador)
    : null

  if (!client) {
    return {
      case: "undetermined",
      requestField: "identificador",
      value: null,
      identificador: null,
      idCrm: null,
      idIptv: null,
      abnetNumber: abnetNumberValue,
    }
  }

  if (explicit) {
    return {
      case: "confirmed",
      requestField: "identificador",
      value: explicit,
      identificador: explicit,
      idCrm,
      idIptv,
      abnetNumber: abnetNumberValue,
    }
  }

  if (idCrm) {
    return {
      case: "undetermined",
      requestField: "identificador",
      value: null,
      identificador: null,
      idCrm,
      idIptv,
      abnetNumber: abnetNumberValue,
    }
  }

  return {
    case: "missing_from_catalog",
    requestField: "identificador",
    value: null,
    identificador: null,
    idCrm: null,
    idIptv,
    abnetNumber: abnetNumberValue,
  }
}
