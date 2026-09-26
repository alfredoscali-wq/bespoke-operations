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

/** Código RRHH del administrador demo (no se elimina en reset de seed operativo). */
export const DEMO_ADMIN_EMPLOYEE_CODE = "DEMO-ADMIN"

/** Credencial de acceso al tenant demo (solo entorno de demostración). */
export const DEMO_ADMIN_EMAIL = "demo@bespoke-app.com.ar"

/** Usuario comercial visible en /demo. Se resuelve a emails Auth distintos por superficie. */
export const DEMO_COMMERCIAL_USERNAME = "bes-demo"

/** Código RRHH del operario de campo para Bespoke Mobile. */
export const DEMO_OPERARIO_EMPLOYEE_CODE = "DEMO-OPERARIO"

/** Usuario Mobile de demostración. No reutilizar DEMO-ADMIN. */
export const DEMO_OPERARIO_EMAIL = "demo.operario@bespoke-app.com.ar"

/** Cuadrilla reutilizada para jornada Mobile. */
export const DEMO_MOBILE_CREW_NAME = "Cuadrilla Demo 1"

/**
 * Company code for Bespoke Mobile bootstrap.
 * Stored lowercase (`companies.mobile_code` trigger). Display uses the uppercase form.
 */
export const DEMO_MOBILE_COMPANY_CODE = "demo-8f4k"

export const DEMO_MOBILE_COMPANY_CODE_DISPLAY = "DEMO-8F4K"

/** Logical demo device id (same registry as real Field Agent devices). */
export const DEMO_MOBILE_DEVICE_ID = "bespoke-demo-mobile-001"

export const DEMO_MOBILE_TASK_CODE_PREFIX = "DEMO-MOBILE-"

export const DEMO_MOBILE_TASK_CODES = [
  "DEMO-MOBILE-001",
  "DEMO-MOBILE-002",
  "DEMO-MOBILE-003",
] as const

export type DemoMobileTaskCode = (typeof DEMO_MOBILE_TASK_CODES)[number]

/** Fictional operational base — not copied from any other tenant. */
export const DEMO_MOBILE_BASE_GPS = {
  name: "Base operativa Demo",
  address: "Av. Demo 100, Ciudad Norte",
  latitude: -34.572,
  longitude: -58.423,
} as const

export const DEMO_MOBILE_APK_DOWNLOAD_PATH = "/api/demo/apk"

export const DEMO_LANDING_PATH = "/demo"

export const DEMO_BANNER_TITLE = "BESPOKE DEMO"

export const DEMO_BANNER_SUBTITLE = "Versión demostrativa"

export const DEMO_BANNER_HINT =
  "Algunas funciones se encuentran limitadas."

export const DEMO_RESTRICTED_DIALOG_TITLE = "Modo Demostración"

export const DEMO_RESTRICTED_DIALOG_MESSAGE = `Esta funcionalidad se encuentra deshabilitada para la empresa ${BESPOKE_DEMO_COMPANY_NAME}.

La demostración permite recorrer completamente el sistema sin modificar información.`

export const DEMO_RESTRICTED_DIALOG_ACCEPT = "Aceptar"
