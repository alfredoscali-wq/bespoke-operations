import { Suspense } from "react"
import { headers } from "next/headers"

import { LoginForm } from "@/components/auth/login-form"
import { getAppLogoAlt, getAppLogoSrc } from "@/lib/branding/logo"

export const metadata = {
  title: "Iniciar sesión",
  description: "Acceso a Bespoke Operations",
}

export default async function LoginPage() {
  const host = (await headers()).get("host")
  const logoSrc = getAppLogoSrc(host)
  const logoAlt = getAppLogoAlt(host)

  return (
    <Suspense fallback={null}>
      <LoginForm logoSrc={logoSrc} logoAlt={logoAlt} />
    </Suspense>
  )
}
