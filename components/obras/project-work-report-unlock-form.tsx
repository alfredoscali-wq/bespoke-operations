import Image from "next/image"

type ProjectWorkReportUnlockFormProps = {
  token: string
  error?: string | null
}

export function ProjectWorkReportUnlockForm({
  token,
  error,
}: ProjectWorkReportUnlockFormProps) {
  const message =
    error === "password"
      ? "Contraseña incorrecta."
      : error === "unavailable"
        ? "Este informe no está disponible."
        : null

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4">
      <div className="w-full space-y-6 rounded-2xl border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <Image
            src="/images/logo/LOGO_BESPOKE.png"
            alt="Bespoke"
            width={160}
            height={48}
            className="h-12 w-auto object-contain"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Bespoke
            </p>
            <h1 className="mt-2 text-2xl font-semibold">Informe de obra</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Este informe está protegido.
            </p>
          </div>
        </div>

        <form
          method="post"
          action={`/informe/${encodeURIComponent(token)}/sesion`}
          className="space-y-4"
        >
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Contraseña</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              className="w-full rounded-md border bg-background px-3 py-2"
            />
          </label>
          {message ? (
            <p className="text-sm text-destructive">{message}</p>
          ) : null}
          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Ver informe
          </button>
        </form>
      </div>
    </div>
  )
}
