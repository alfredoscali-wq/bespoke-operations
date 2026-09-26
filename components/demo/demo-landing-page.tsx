import type { DemoPublicCredentials } from "@/lib/demo/public-credentials.server"
import { DEMO_MOBILE_APK_DOWNLOAD_PATH } from "@/lib/demo/constants"
import {
  DEMO_MOBILE_APK_METADATA,
  formatDemoApkApproximateSizeMb,
} from "@/lib/demo/mobile-apk"
import { LOGIN_PATH } from "@/lib/auth/routes"

function CredentialRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
      <dt className="w-36 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="font-mono text-sm text-slate-900">
        {value || "Configurá la variable de entorno correspondiente."}
      </dd>
    </div>
  )
}

export function DemoLandingPage({
  credentials,
}: {
  credentials: DemoPublicCredentials
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <section className="max-w-2xl">
        <p className="text-sm font-medium tracking-wide text-primary">Bespoke</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          BESPOKE DEMO
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Probá Bespoke Operations y Bespoke Mobile con un entorno completamente ficticio.
        </p>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Operations
          </p>
          <h2 className="mt-2 text-xl font-semibold">Probar Bespoke Operations</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Recorré el backoffice web con datos de demostración. La cuenta web
            permanece en modo lectura.
          </p>
          <a
            href={LOGIN_PATH}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            PROBAR OPERATIONS
          </a>
          <dl className="mt-6 space-y-3 border-t pt-4">
            <CredentialRow label="Usuario" value={credentials.webUsername} />
            <CredentialRow label="Contraseña" value={credentials.webPassword} />
          </dl>
        </section>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Mobile
          </p>
          <h2 className="mt-2 text-xl font-semibold">Probar Bespoke Mobile</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Descargá la aplicación Android y probá el flujo real de trabajo de un
            operario.
          </p>
          <dl className="mt-4 space-y-1 text-sm text-slate-800">
            <div>Bespoke Mobile</div>
            <div>{DEMO_MOBILE_APK_METADATA.platform}</div>
            <div>Versión {DEMO_MOBILE_APK_METADATA.versionName}</div>
            <div>
              Tamaño aproximado {formatDemoApkApproximateSizeMb()}
            </div>
          </dl>
          <a
            href={DEMO_MOBILE_APK_DOWNLOAD_PATH}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            DESCARGAR BESPOKE MOBILE
          </a>
          <dl className="mt-6 space-y-3 border-t pt-4">
            <CredentialRow label="Empresa" value={credentials.companyName} />
            <CredentialRow label="Código" value={credentials.companyCode} />
            <CredentialRow label="Usuario" value={credentials.mobileUsername} />
            <CredentialRow
              label="Contraseña"
              value={credentials.mobilePassword}
            />
          </dl>
        </section>
      </div>
    </div>
  )
}
