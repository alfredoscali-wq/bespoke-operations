"use client"

import {
  PWA_SERVICE_WORKER_PATH,
} from "@/lib/pwa/config"

type ServiceWorkerRegistrationResult = {
  registered: boolean
  registration?: ServiceWorkerRegistration
}

function shouldRegisterServiceWorker(): boolean {
  if (typeof window === "undefined") {
    return false
  }

  if (!("serviceWorker" in navigator)) {
    return false
  }

  return process.env.NODE_ENV === "production"
}

function listenForServiceWorkerUpdates(
  registration: ServiceWorkerRegistration
) {
  registration.addEventListener("updatefound", () => {
    const installingWorker = registration.installing
    if (!installingWorker) {
      return
    }

    installingWorker.addEventListener("statechange", () => {
      if (
        installingWorker.state === "installed" &&
        navigator.serviceWorker.controller
      ) {
        installingWorker.postMessage({ type: "SKIP_WAITING" })
      }
    })
  })

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    window.location.reload()
  })
}

export async function registerPwaServiceWorker(): Promise<ServiceWorkerRegistrationResult> {
  if (!shouldRegisterServiceWorker()) {
    return { registered: false }
  }

  try {
    const registration = await navigator.serviceWorker.register(
      PWA_SERVICE_WORKER_PATH,
      { scope: "/" }
    )

    listenForServiceWorkerUpdates(registration)

    return { registered: true, registration }
  } catch (error) {
    console.error("[PWA] No se pudo registrar el Service Worker.", error)
    return { registered: false }
  }
}
