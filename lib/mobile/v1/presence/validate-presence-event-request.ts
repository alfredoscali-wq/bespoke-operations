import {

  isPresenceEventType,

  isPresenceLocationProvider,

} from "@/lib/presence/constants"

import { MobileApiError } from "@/lib/mobile/v1/errors"

import type { MobilePresenceEventRequest } from "@/lib/mobile/v1/presence/types"



function readRequiredString(value: unknown, field: string): string {

  if (typeof value !== "string" || !value.trim()) {

    throw new MobileApiError(

      "INVALID_REQUEST",

      `Campo requerido: ${field}.`,

      400

    )

  }



  return value.trim()

}



function readRequiredNumber(value: unknown, field: string): number {

  if (typeof value !== "number" || !Number.isFinite(value)) {

    throw new MobileApiError(

      "INVALID_REQUEST",

      `Campo numérico inválido: ${field}.`,

      400

    )

  }



  return value

}



function readOptionalNumber(value: unknown, field: string): number | null {

  if (value == null) {

    return null

  }



  if (typeof value !== "number" || !Number.isFinite(value)) {

    throw new MobileApiError(

      "INVALID_REQUEST",

      `Campo numérico inválido: ${field}.`,

      400

    )

  }



  return value

}



function readCreatedAt(value: unknown): string {

  const raw = readRequiredString(value, "createdAt")

  const parsed = Date.parse(raw)

  if (!Number.isFinite(parsed)) {

    throw new MobileApiError(

      "INVALID_REQUEST",

      "Campo createdAt inválido.",

      400

    )

  }

  return new Date(parsed).toISOString()

}



/**

 * Validates Mobile presence observation payload.

 * `eventType` is optional (legacy). Server authority decides the fact.

 */

export function validateMobilePresenceEventRequest(

  body: unknown

): MobilePresenceEventRequest {

  if (!body || typeof body !== "object") {

    throw new MobileApiError("INVALID_REQUEST", "Cuerpo JSON inválido.", 400)

  }



  const record = body as Record<string, unknown>

  const providerRaw = readRequiredString(record.provider, "provider")



  if (!isPresenceLocationProvider(providerRaw)) {

    throw new MobileApiError(

      "INVALID_REQUEST",

      "provider inválido. Valores: GPS, NETWORK, FUSED.",

      400

    )

  }



  let eventType: MobilePresenceEventRequest["eventType"] = null

  if (record.eventType != null && record.eventType !== "") {

    const eventTypeRaw = readRequiredString(record.eventType, "eventType")

    if (!isPresenceEventType(eventTypeRaw)) {

      throw new MobileApiError(

        "INVALID_REQUEST",

        "eventType inválido. Valores: ENTER_RADIUS, HEARTBEAT, EXIT_RADIUS.",

        400

      )

    }

    eventType = eventTypeRaw

  }



  const latitude = readRequiredNumber(record.latitude, "latitude")

  const longitude = readRequiredNumber(record.longitude, "longitude")



  if (latitude < -90 || latitude > 90) {

    throw new MobileApiError(

      "INVALID_REQUEST",

      "latitude fuera de rango.",

      400

    )

  }



  if (longitude < -180 || longitude > 180) {

    throw new MobileApiError(

      "INVALID_REQUEST",

      "longitude fuera de rango.",

      400

    )

  }



  return {

    deviceId: readRequiredString(record.deviceId, "deviceId"),

    employeeId: readRequiredString(record.employeeId, "employeeId"),

    latitude,

    longitude,

    accuracy: readOptionalNumber(record.accuracy, "accuracy"),

    provider: providerRaw,

    eventType,

    createdAt: readCreatedAt(record.createdAt),

  }

}


