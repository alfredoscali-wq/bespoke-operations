import { buildSessionUserFromAuthUser } from "@/lib/auth/resolve-session-user"
import type { SessionUser } from "@/lib/auth/types"
import { fetchEmployeeByAppUserId } from "@/lib/supabase/employees.queries"
import { createClient } from "@/lib/supabase/server"

export type { SessionUser } from "@/lib/auth/types"

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  const employeeResult = await fetchEmployeeByAppUserId(supabase, user.id)
  const employee = employeeResult.data ?? null

  return buildSessionUserFromAuthUser(user, employee)
}
