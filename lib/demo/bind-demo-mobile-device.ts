import {
  BESPOKE_DEMO_COMPANY_ID,
  DEMO_MOBILE_CREW_NAME,
} from "@/lib/demo/constants"

export type DemoMobileBindableCrew = {
  id: string
  companyId: string
  name: string
}

export type DemoMobileDeviceBindDecision =
  | { action: "keep"; workTeamId: string }
  | { action: "bind"; workTeamId: string }
  | { action: "skip"; reason: "foreign_tenant" | "no_demo_crew" }

/**
 * Decides whether a provisioned device should be bound to Cuadrilla Demo 1.
 * Application-level only. Does not change RLS. Never binds ABNet crews.
 */
export function decideDemoMobileDeviceCrewBinding(input: {
  authCompanyId: string
  deviceWorkTeamId: string | null
  employeeCrews: DemoMobileBindableCrew[]
}): DemoMobileDeviceBindDecision {
  if (input.authCompanyId !== BESPOKE_DEMO_COMPANY_ID) {
    return { action: "skip", reason: "foreign_tenant" }
  }

  const demoCrews = input.employeeCrews.filter(
    (crew) => crew.companyId === BESPOKE_DEMO_COMPANY_ID
  )

  const preferred =
    demoCrews.find((crew) => crew.name === DEMO_MOBILE_CREW_NAME) ??
    (demoCrews.length === 1 ? demoCrews[0] : null)

  if (!preferred) {
    return { action: "skip", reason: "no_demo_crew" }
  }

  if (input.deviceWorkTeamId === preferred.id) {
    return { action: "keep", workTeamId: preferred.id }
  }

  if (input.deviceWorkTeamId) {
    const alreadyDemoCrew = demoCrews.some(
      (crew) => crew.id === input.deviceWorkTeamId
    )
    if (alreadyDemoCrew) {
      return { action: "keep", workTeamId: input.deviceWorkTeamId }
    }
  }

  return { action: "bind", workTeamId: preferred.id }
}
