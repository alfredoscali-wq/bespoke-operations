"use client"

import Link from "next/link"
import { UserRound } from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { resolveAuthDisplay } from "@/lib/auth/auth-display"
import { PROFILE_PATH } from "@/lib/auth/routes"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function UserAccountMenu() {
  const { sessionUser, signOut, isAuthReady } = useAuth()
  const userDisplay = resolveAuthDisplay(sessionUser)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-2 px-2"
          disabled={!isAuthReady}
          aria-label="Menú de cuenta"
        >
          <span className="hidden max-w-[140px] truncate text-xs font-medium text-foreground md:inline">
            {userDisplay.displayName}
          </span>
          <Avatar size="sm">
            <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
              {userDisplay.initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-start gap-2">
            <span className="text-base leading-none" aria-hidden>
              👤
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-none">
                {userDisplay.displayName}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {userDisplay.roleLabel}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={PROFILE_PATH}>
            <UserRound className="size-4" />
            Mi perfil
          </Link>
        </DropdownMenuItem>
        {/*
          UX Cleanup 1.0 — restaurar cuando el flujo esté validado en producción:
          <DropdownMenuItem asChild>
            <Link href={CHANGE_PASSWORD_PATH}>
              <KeyRound className="size-4" />
              Cambiar contraseña
            </Link>
          </DropdownMenuItem>
        */}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => void signOut()}
          disabled={!isAuthReady}
        >
          <span aria-hidden>🚪</span>
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
