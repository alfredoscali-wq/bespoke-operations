import { Suspense } from "react"

import { LoginForm } from "@/components/auth/login-form"

export const metadata = {
  title: "Iniciar sesión",
  description: "Acceso a Bespoke Operations",
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
