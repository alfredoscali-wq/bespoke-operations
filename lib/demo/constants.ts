import {
  BESPOKE_DEMO_COMPANY_ID,
  BESPOKE_DEMO_COMPANY_NAME,
  BESPOKE_DEMO_COMPANY_SLUG,
} from "@/lib/supabase/company.constants"

export {
  BESPOKE_DEMO_COMPANY_ID,
  BESPOKE_DEMO_COMPANY_NAME,
  BESPOKE_DEMO_COMPANY_SLUG,
}

/** Prefijo para identificar datos generados por el seed demo (limpieza segura). */
export const DEMO_SEED_MARKER = "DEMO-SEED"

export const DEMO_BANNER_TITLE = "BESPOKE DEMO"

export const DEMO_BANNER_SUBTITLE = "Versión demostrativa"

export const DEMO_BANNER_HINT =
  "Algunas funciones se encuentran limitadas."

export const DEMO_RESTRICTED_DIALOG_TITLE = "Modo Demostración"

export const DEMO_RESTRICTED_DIALOG_MESSAGE = `Esta funcionalidad se encuentra deshabilitada para la empresa ${BESPOKE_DEMO_COMPANY_NAME}.

La demostración permite recorrer completamente el sistema sin modificar información.`

export const DEMO_RESTRICTED_DIALOG_ACCEPT = "Aceptar"
