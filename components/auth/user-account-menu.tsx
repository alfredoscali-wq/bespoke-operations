"use client"

import { LogOut } from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { resolveAuthDisplay } from "@/lib/auth/auth-display"
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
          className="hidden gap-2 px-2 sm:flex"
          disabled={!isAuthReady}
          aria-label="Menú de usuario"
        >
          <span className="hidden max-w-[140px] truncate text-xs font-medium text-foreground lg:inline">
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
          <p className="text-sm font-medium leading-none">
            {userDisplay.displayName}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {userDisplay.roleLabel}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => void signOut()}
          disabled={!isAuthReady}
        >
          <LogOut className="size-4" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
