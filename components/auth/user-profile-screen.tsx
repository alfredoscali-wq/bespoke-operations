"use client"

import { Mail, Shield, User } from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { resolveAuthDisplay } from "@/lib/auth/auth-display"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function ProfileField({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-muted/30 p-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

export function UserProfileScreen() {
  const { sessionUser, isAuthReady } = useAuth()
  const userDisplay = resolveAuthDisplay(sessionUser)

  if (!isAuthReady) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center text-sm text-muted-foreground">
        Cargando perfil...
      </div>
    )
  }

  if (!sessionUser) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center text-sm text-muted-foreground">
        No hay una sesión activa.
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="items-center text-center">
          <Avatar size="lg" className="mx-auto">
            <AvatarFallback className="bg-primary/10 text-base font-medium text-primary">
              {userDisplay.initials}
            </AvatarFallback>
          </Avatar>
          <CardTitle className="mt-4">{userDisplay.displayName}</CardTitle>
          <CardDescription>{userDisplay.roleLabel}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ProfileField icon={User} label="Nombre" value={userDisplay.displayName} />
          <ProfileField icon={Shield} label="Rol" value={userDisplay.roleLabel} />
          {sessionUser.nationalId?.trim() ? (
            <ProfileField
              icon={User}
              label="DNI"
              value={sessionUser.nationalId.trim()}
            />
          ) : null}
          {sessionUser.email?.trim() ? (
            <ProfileField icon={Mail} label="Email" value={sessionUser.email.trim()} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
