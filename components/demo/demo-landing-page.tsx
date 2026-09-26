import type { DemoPublicCredentials } from "@/lib/demo/public-credentials.server"
import { DEMO_MOBILE_APK_DOWNLOAD_PATH } from "@/lib/demo/constants"
import {
  DEMO_MOBILE_APK_METADATA,
  formatDemoApkApproximateSizeMb,
} from "@/lib/demo/mobile-apk"
import { LOGIN_PATH } from "@/lib/auth/routes"
import { DemoCopyField } from "@/components/demo/demo-copy-field"

const primaryButtonClass =
  "mt-6 inline-flex h-11 items-center justify-center rounded-full bg-[#FF6E3D] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(255,110,61,0.28)] transition hover:bg-[#e86132]"

export function DemoLandingPage({
  credentials,
}: {
  credentials: DemoPublicCredentials
}) {
  const passwordsMatch =
    credentials.webPassword.length > 0 &&
    credentials.webPassword === credentials.mobilePassword

  return (
    <div className="mx-auto max-w-6xl">
      <section className="max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight text-[#12324D] sm:text-5xl">
          Probá Bespoke
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[#3D5568]">
          Conocé cómo funciona la gestión de operaciones y el trabajo en campo
          desde una misma plataforma.
        </p>
        <p className="mt-3 text-sm text-[#5A7188]">
          Este entorno contiene datos completamente ficticios.
        </p>
      </section>

      <section className="mt-10 rounded-3xl border border-white/80 bg-white/90 p-6 shadow-[0_18px_50px_rgba(18,50,77,0.08)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF6E3D]">
          Datos de acceso
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <DemoCopyField label="Usuario" value={credentials.webUsername} />
          {passwordsMatch ? (
            <DemoCopyField
              label="Contraseña"
              value={credentials.webPassword}
            />
          ) : null}
        </div>
        {!passwordsMatch ? (
          <p className="mt-4 text-sm text-[#5A7188]">
            Operations y Mobile usan la misma cuenta comercial, con contraseña
            distinta en cada producto.
          </p>
        ) : null}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col rounded-3xl border border-[#E6EEF2] bg-white p-6 shadow-[0_12px_32px_rgba(18,50,77,0.06)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#05D6B3]">
            Operations
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[#12324D]">
            Bespoke Operations
          </h2>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-[#3D5568]">
            Gestioná clientes, obras, cuadrillas, órdenes de trabajo, evidencias
            y operación desde un único lugar.
          </p>
          <a href={LOGIN_PATH} className={primaryButtonClass}>
            PROBAR OPERATIONS
          </a>
          <p className="mt-4 text-sm text-[#5A7188]">
            Acceso de demostración incluido
          </p>
          {!passwordsMatch ? (
            <dl className="mt-5 space-y-4 border-t border-[#E6EEF2] pt-5">
              <DemoCopyField label="Usuario" value={credentials.webUsername} />
              <DemoCopyField
                label="Contraseña"
                value={credentials.webPassword}
              />
            </dl>
          ) : null}
        </section>

        <section className="flex flex-col rounded-3xl border border-[#E6EEF2] bg-white p-6 shadow-[0_12px_32px_rgba(18,50,77,0.06)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#FF6E3D]">
            Mobile
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[#12324D]">
            Bespoke Mobile
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#3D5568]">
            Probá el flujo real de un operario: jornada, agenda, ubicación,
            órdenes de trabajo, checklist, evidencias y cierre.
          </p>
          <a href={DEMO_MOBILE_APK_DOWNLOAD_PATH} className={primaryButtonClass}>
            DESCARGAR BESPOKE MOBILE
          </a>
          <p className="mt-4 text-sm text-[#5A7188]">
            Android · versión {DEMO_MOBILE_APK_METADATA.versionName} · ~
            {formatDemoApkApproximateSizeMb()}
          </p>

          <ol className="mt-6 grid grid-cols-3 gap-2 text-center text-xs font-medium text-[#12324D]">
            <li className="rounded-2xl bg-[#F4FAFA] px-2 py-3">
              <span className="block text-[11px] font-semibold text-[#FF6E3D]">
                1
              </span>
              Descargar
            </li>
            <li className="rounded-2xl bg-[#F4FAFA] px-2 py-3">
              <span className="block text-[11px] font-semibold text-[#05D6B3]">
                2
              </span>
              Instalar
            </li>
            <li className="rounded-2xl bg-[#F4FAFA] px-2 py-3">
              <span className="block text-[11px] font-semibold text-[#12324D]">
                3
              </span>
              Ingresar
            </li>
          </ol>

          <div className="mt-6 space-y-4 rounded-2xl bg-[#F4FAFA] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5A7188]">
              Datos para Mobile
            </p>
            <DemoCopyField
              label="Usuario"
              value={credentials.mobileUsername}
            />
            <DemoCopyField
              label="Contraseña"
              value={credentials.mobilePassword}
            />
            <DemoCopyField label="Código de empresa" value={credentials.companyCode} />
          </div>
        </section>
      </div>
    </div>
  )
}
