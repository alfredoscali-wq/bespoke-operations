import assert from "node:assert/strict"
import test from "node:test"

import {
  canAccessPathWithMetadata,
  resolveAccessDeniedRedirectPath,
  resolvePostLoginPathFromAuthMetadata,
  resolvePostLoginPathFromSessionUser,
} from "../lib/auth/module-access.ts"
import { PROFILE_PATH } from "../lib/auth/routes.ts"
import {
  createEmptyModuleVisibility,
  createFullModuleVisibility,
} from "../lib/roles/app-modules.ts"
import { resolveHomePathFromModuleVisibility } from "../lib/navigation/build-nav-from-modules.ts"

function buildSessionUser(overrides) {
  const moduleVisibility = overrides.moduleVisibility ?? createEmptyModuleVisibility()

  return {
    systemRole: overrides.systemRole ?? "administrativo",
    roleId: overrides.roleId ?? "role-1",
    moduleVisibility,
    ...overrides,
  }
}

test("administrador legacy sin allowed_modules conserva dashboard", () => {
  assert.equal(resolvePostLoginPathFromAuthMetadata("administrador", {}), "/")
  assert.equal(
    resolvePostLoginPathFromSessionUser(
      buildSessionUser({
        systemRole: "administrador",
        roleId: null,
        moduleVisibility: createFullModuleVisibility(),
      })
    ),
    "/"
  )
})

test("usuario con dashboard habilitado ingresa al dashboard", () => {
  const visibility = {
    ...createEmptyModuleVisibility(),
    dashboard: true,
    calendar: true,
  }

  assert.equal(resolveHomePathFromModuleVisibility(visibility), "/")
  assert.equal(
    resolvePostLoginPathFromAuthMetadata("administrativo", {
      allowed_modules: ["dashboard", "calendar"],
    }),
    "/"
  )
  assert.equal(
    resolvePostLoginPathFromSessionUser(
      buildSessionUser({
        systemRole: "administrativo",
        moduleVisibility: visibility,
      })
    ),
    "/"
  )
})

test("usuario sin dashboard pero con calendar ingresa a calendario", () => {
  const metadata = {
    allowed_modules: ["calendar", "work_orders", "customers"],
  }

  assert.equal(
    resolvePostLoginPathFromAuthMetadata("administrativo", metadata),
    "/operations/calendar"
  )
  assert.equal(
    resolvePostLoginPathFromSessionUser(
      buildSessionUser({
        systemRole: "administrativo",
        moduleVisibility: {
          ...createEmptyModuleVisibility(),
          calendar: true,
          work_orders: true,
          customers: true,
        },
      })
    ),
    "/operations/calendar"
  )
})

test("usuario con varios modulos usa el primer modulo segun orden oficial", () => {
  const metadata = {
    allowed_modules: ["customers", "calendar", "work_orders"],
  }

  assert.equal(
    resolvePostLoginPathFromAuthMetadata("administrativo", metadata),
    "/operations/calendar"
  )
})

test("usuario sin modulos habilitados cae en perfil sin loop", () => {
  const metadata = {
    allowed_modules: [],
  }

  assert.equal(
    resolvePostLoginPathFromAuthMetadata("administrativo", metadata),
    PROFILE_PATH
  )
  assert.equal(
    resolvePostLoginPathFromSessionUser(
      buildSessionUser({
        systemRole: "administrativo",
        moduleVisibility: createEmptyModuleVisibility(),
      })
    ),
    PROFILE_PATH
  )
})

test("operario conserva redirect a /operario", () => {
  assert.equal(resolvePostLoginPathFromAuthMetadata("operario", {}), "/operario")
  assert.equal(
    resolvePostLoginPathFromSessionUser(
      buildSessionUser({
        systemRole: "operario",
        roleId: "role-operario",
        moduleVisibility: createEmptyModuleVisibility(),
      })
    ),
    "/operario"
  )
})

test("middleware no redirige repetidamente desde dashboard bloqueado", () => {
  const metadata = {
    allowed_modules: ["calendar", "work_orders", "customers", "crews"],
  }
  const home = resolvePostLoginPathFromAuthMetadata("administrativo", metadata)

  assert.notEqual(home, "/")
  assert.equal(home, "/operations/calendar")
  assert.equal(canAccessPathWithMetadata(home, metadata), true)
  assert.equal(
    resolveAccessDeniedRedirectPath("administrativo", metadata, "/"),
    "/operations/calendar"
  )
})

test("password change guard usa destino permitido por modulos", () => {
  const sessionUser = buildSessionUser({
    systemRole: "administrativo",
    moduleVisibility: {
      ...createEmptyModuleVisibility(),
      work_orders: true,
      customers: true,
    },
  })

  assert.equal(
    resolvePostLoginPathFromSessionUser(sessionUser),
    "/tareas"
  )
})

test("post-login usa destino permitido para area atencion al cliente", () => {
  const sessionUser = buildSessionUser({
    systemRole: "administrativo",
    roleId: "abd082c3-4c11-4a79-9e69-314d087a98b9",
    moduleVisibility: {
      ...createEmptyModuleVisibility(),
      calendar: true,
      work_orders: true,
      customers: true,
      crews: true,
    },
  })

  assert.equal(
    resolvePostLoginPathFromSessionUser(sessionUser),
    "/operations/calendar"
  )
})

test("access denied fallback evita loop cuando destino coincide con ruta actual", () => {
  assert.equal(
    resolveAccessDeniedRedirectPath(
      "administrativo",
      { allowed_modules: [] },
      PROFILE_PATH
    ),
    PROFILE_PATH
  )
})
