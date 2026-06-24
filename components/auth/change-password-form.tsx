"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react"

import {
  redirectAfterSignIn,
  useAuth,
} from "@/components/auth/auth-provider"
import { changePassword } from "@/lib/auth/change-password"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const MIN_PASSWORD_LENGTH = 8

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled,
  showPassword,
  onToggleVisibility,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: "new-password" | "off"
  disabled: boolean
  showPassword: boolean
  onToggleVisibility: () => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={id}
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder="••••••••"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-0 right-0 size-9 text-muted-foreground hover:text-foreground"
          onClick={onToggleVisibility}
          disabled={disabled}
          aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {showPassword ? (
            <EyeOff className="size-4" />
          ) : (
            <Eye className="size-4" />
          )}
        </Button>
      </div>
    </div>
  )
}

export function ChangePasswordForm() {
  const router = useRouter()
  const { sessionUser, isAuthReady, isAuthenticated, refreshSession } = useAuth()
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError("La contraseña debe tener al menos 8 caracteres.")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.")
      return
    }

    if (!sessionUser) {
      setError("No hay una sesión activa.")
      return
    }

    setIsSubmitting(true)

    try {
      const result = await changePassword({
        newPassword,
        employeeId: sessionUser.employeeId,
      })

      if (!result.ok) {
        setError(result.message)
        return
      }

      const refreshedUser = await refreshSession()

      if (!refreshedUser) {
        setError("La contraseña se actualizó, pero no se pudo refrescar la sesión.")
        return
      }

      redirectAfterSignIn(router, refreshedUser)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isDisabled = !isAuthReady || isSubmitting

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <KeyRound className="size-6" />
        </div>
        <CardTitle className="text-2xl">Cambiar contraseña</CardTitle>
        <CardDescription>
          Debe establecer una nueva contraseña antes de continuar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isAuthReady ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : !isAuthenticated || !sessionUser ? (
          <p className="text-center text-sm text-muted-foreground">
            Inicie sesión para cambiar su contraseña.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordField
              id="new-password"
              label="Nueva contraseña"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
              disabled={isDisabled}
              showPassword={showNewPassword}
              onToggleVisibility={() => setShowNewPassword((current) => !current)}
            />

            <PasswordField
              id="confirm-password"
              label="Confirmar contraseña"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              disabled={isDisabled}
              showPassword={showConfirmPassword}
              onToggleVisibility={() =>
                setShowConfirmPassword((current) => !current)
              }
            />

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isDisabled}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar contraseña"
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
