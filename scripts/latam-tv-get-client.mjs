/**
 * Consulta de solo lectura: POST /api/get-clients.
 * Uso: npx tsx scripts/latam-tv-get-client.mjs <identificador>
 * No imprime el token ni llama a ningún endpoint de escritura.
 */
import { getLatamTvClientByIdentifier } from "../lib/integrations/latam-tv/client.ts"
import { LatamTvRequestError } from "../lib/integrations/latam-tv/errors.ts"

const identifier = process.argv[2]?.trim() ?? ""
const baseUrl = process.env.LATAM_TV_API_URL?.trim() ?? ""
const token = process.env.LATAM_TV_API_TOKEN?.trim() ?? ""

if (!identifier) {
  console.error("Indicá un identificador: npx tsx scripts/latam-tv-get-client.mjs <identificador>")
  process.exit(1)
}
if (!baseUrl || !token) {
  console.error("LATAM_TV_API_URL o LATAM_TV_API_TOKEN no configurado.")
  process.exit(1)
}

try {
  const lookup = await getLatamTvClientByIdentifier(identifier, { baseUrl, token })
  if (!lookup.found) {
    console.log(`Identificador ${identifier}: no existe en LATAM TV.`)
    process.exit(0)
  }
  const client = lookup.client
  const status =
    client.status === "enabled"
      ? "habilitado"
      : client.status === "disabled"
        ? "deshabilitado"
        : "sin estado"
  console.log(`Identificador: ${client.identifier}`)
  console.log("Resultado: existe en LATAM TV")
  console.log(`Usuario: ${client.username ?? "—"}`)
  console.log(`Estado: ${status}`)
  console.log(`Plan: ${client.plan?.name ?? "—"}`)
  console.log(`id_iptv: ${client.iptvId ?? "—"}`)
} catch (error) {
  if (error instanceof LatamTvRequestError) {
    console.error(error.message)
  } else {
    console.error("No se pudo consultar LATAM TV.")
  }
  process.exit(1)
}
