"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

import {
  redirectAfterSignIn,
  useAuth,
} from "@/components/auth/auth-provider"
import { BESPOKE_LOGO_SRC } from "@/lib/branding/logo"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const ERROR_MESSAGES: Record<string, string> = {
  supabase_not_configured:
    "Supabase no está configurado. Revise las variables de entorno.",
  auth_callback:
    "No se pudo completar el inicio de sesión. Intente nuevamente.",
}

function resolveSignInErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = String(error.message).toLowerCase()

    if (message.includes("invalid login credentials")) {
      return "DNI o contraseña incorrectos."
    }

    if (message.includes("email not confirmed")) {
      return "La cuenta aún no está confirmada."
    }
  }

  return "No se pudo iniciar sesión. Verifique sus credenciales."
}

function LoginFormInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signIn, isAuthReady } = useAuth()
  const [dni, setDni] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const queryError = searchParams.get("error")
  const nextPath = searchParams.get("next")

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!dni.trim() || !password) {
      setError("Ingrese DNI y contraseña.")
      return
    }

    setIsSubmitting(true)

    try {
      const sessionUser = await signIn(dni, password)
      redirectAfterSignIn(router, sessionUser, nextPath)
    } catch (submitError) {
      setError(resolveSignInErrorMessage(submitError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const displayError =
    error ??
    (queryError ? ERROR_MESSAGES[queryError] ?? "Error de autenticación." : null)

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-4 text-center">
        <Image
          src={BESPOKE_LOGO_SRC}
          alt="Bespoke Operations"
          width={220}
          height={68}
          className="mx-auto h-14 w-auto object-contain"
          priority
        />
        <CardDescription>
          Ingrese con su DNI y contraseña para acceder a la plataforma.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-dni">DNI</Label>
            <Input
              id="login-dni"
              name="dni"
              type="text"
              inputMode="numeric"
              autoComplete="username"
              placeholder="Ej. 12345678"
              value={dni}
              onChange={(event) => setDni(event.target.value)}
              disabled={!isAuthReady || isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="login-password">Contraseña</Label>
            <Input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={!isAuthReady || isSubmitting}
            />
          </div>

          {displayError && (
            <p className="text-sm text-destructive" role="alert">
              {displayError}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!isAuthReady || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Ingresando...
              </>
            ) : (
              "Ingresar"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export function LoginForm() {
  return <LoginFormInner />
}
