import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

test("el sidebar ya no muestra perfil operativo ni rol debajo del logo", () => {
  const sidebar = read("components/layout/app-sidebar.tsx")
  assert.doesNotMatch(sidebar, /Perfil operativo/)
  assert.doesNotMatch(sidebar, /profileLabel/)
  assert.doesNotMatch(sidebar, /SidebarProfile/)
  assert.doesNotMatch(sidebar, /resolveAuthDisplay/)
  assert.match(sidebar, /Bespoke Operations/)
  assert.match(sidebar, /Contraer menú/)
})

test("el sidebar conserva áreas, colores y colapso", () => {
  const sidebar = read("components/layout/app-sidebar.tsx")
  assert.match(sidebar, /SIDEBAR_AREA_META/)
  assert.match(sidebar, /--sidebar-area-/)
  assert.match(sidebar, /compact/)
  assert.match(sidebar, /TooltipContent/)
  assert.match(sidebar, /onExpandSidebar/)
  assert.match(sidebar, /grid-template-rows/)
  assert.match(read("app/globals.css"), /--sidebar-area-operations/)
})

test("el header muestra título y subtítulo, sin logo", () => {
  const header = read("components/layout/app-header.tsx")
  assert.doesNotMatch(header, /BESPOKE_LOGO_SRC/)
  assert.doesNotMatch(header, /Bespoke Operations/)
  assert.match(header, /items-center/)
  assert.match(header, /<h1/)
  assert.match(header, /\{title\}/)
  assert.match(header, /\{subtitle/)
  assert.match(header, /lg:block/)
  assert.match(header, /UserAccountMenu/)
  assert.doesNotMatch(header, /bg-sidebar/)
})

test("el usuario permanece a la derecha con dropdown intacto", () => {
  const header = read("components/layout/app-header.tsx")
  const menu = read("components/auth/user-account-menu.tsx")
  assert.match(header, /<UserAccountMenu \/>/)
  assert.match(menu, /DropdownMenu/)
  assert.match(menu, /displayName/)
  assert.match(menu, /initials/)
  assert.match(menu, /signOut/)
  assert.match(menu, /PROFILE_PATH/)
  assert.match(menu, /Cerrar sesión/)
  assert.match(menu, /Mi perfil/)
})

test("el logo existente queda solo en el sidebar, sin deformarse", () => {
  const logo = read("lib/branding/logo.ts")
  assert.match(logo, /\/images\/logo\/LOGO_BESPOKE\.png/)
  const header = read("components/layout/app-header.tsx")
  const sidebar = read("components/layout/app-sidebar.tsx")
  assert.match(sidebar, /BESPOKE_LOGO_SRC/)
  assert.match(sidebar, /object-contain/)
  assert.doesNotMatch(sidebar, /object-cover/)
  assert.doesNotMatch(header, /BESPOKE_LOGO_SRC/)
})

test("no se toca autenticación, navegación ni backend", () => {
  const header = read("components/layout/app-header.tsx")
  const sidebar = read("components/layout/app-sidebar.tsx")
  const shell = read("components/layout/app-shell.tsx")
  assert.match(shell, /<AppHeader/)
  assert.match(shell, /<AppSidebar/)
  assert.doesNotMatch(header, /createClient|from\("isp_subscribers"\)/)
  assert.doesNotMatch(sidebar, /createClient|from\("isp_subscribers"\)/)
  assert.match(
    read("lib/navigation/build-nav-from-modules.ts"),
    /arrangeNavItemsIntoAreas/
  )
  assert.match(
    read("components/auth/user-account-menu.tsx"),
    /useAuth/
  )
})
