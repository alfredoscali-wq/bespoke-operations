/**
 * Consulta de solo lectura: POST /api/get-plans.
 * Uso: npx tsx scripts/latam-tv-get-plans.mjs
 * No imprime el token ni llama a ningún endpoint de escritura.
 */
import { getLatamTvPlans } from "../lib/integrations/latam-tv/client.ts"
import { LatamTvRequestError } from "../lib/integrations/latam-tv/errors.ts"
import {
  formatLatamPlanCatalog,
  matchLatamTvPlans,
} from "../lib/integrations/latam-tv/plans.ts"

const baseUrl = process.env.LATAM_TV_API_URL?.trim() ?? ""
const token = process.env.LATAM_TV_API_TOKEN?.trim() ?? ""

if (!baseUrl || !token) {
  console.error("LATAM_TV_API_URL o LATAM_TV_API_TOKEN no configurado.")
  process.exit(1)
}

try {
  const plans = await getLatamTvPlans({ baseUrl, token })
  const diagnosis = matchLatamTvPlans(plans)
  if (plans.length === 0) {
    console.log("LATAM TV no devolvió planes.")
  }
  for (const line of formatLatamPlanCatalog(diagnosis)) {
    console.log(line)
  }
} catch (error) {
  if (error instanceof LatamTvRequestError) {
    console.error(error.message)
  } else {
    console.error("No se pudo consultar LATAM TV.")
  }
  process.exit(1)
}
