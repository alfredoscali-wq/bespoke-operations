"use client"

import { LogOut } from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"

type SignOutButtonProps = {
  variant?: "ghost" | "outline"
  size?: "default" | "sm" | "icon" | "icon-sm"
  showLabel?: boolean
  className?: string
}

export function SignOutButton({
  variant = "ghost",
  size = "icon-sm",
  showLabel = false,
  className,
}: SignOutButtonProps) {
  const { signOut, isAuthReady } = useAuth()

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => void signOut()}
      disabled={!isAuthReady}
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
    >
      <LogOut className="size-4" />
      {showLabel && <span className="ml-2">Cerrar sesión</span>}
    </Button>
  )
}
