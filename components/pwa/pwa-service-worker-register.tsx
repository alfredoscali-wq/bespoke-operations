"use client"

import { useEffect } from "react"

import { registerPwaServiceWorker } from "@/lib/pwa/register-service-worker"

/**
 * Registra el Service Worker en producción.
 * Sin impacto en reglas de negocio ni flujos operativos.
 */
export function PwaServiceWorkerRegister() {
  useEffect(() => {
    void registerPwaServiceWorker()
  }, [])

  return null
}
