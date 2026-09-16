/**
 * Tenant chrome branding — source of truth is public.company_branding.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { canManageCompanyBranding } from "../lib/company-branding/access.ts"
import { tenantChromeStyle } from "../lib/company-branding/theme.ts"
import {
  isAllowedCompanyBrandingLogoFile,
  isAllowedCompanyBrandingLogoUrl,
  normalizeCompanyBrandingHex,
  parseCompanyBrandingPatch,
  resolveAuthenticatedLogoSrc,
} from "../lib/company-branding/validate.ts"
import { mapCompanyBrandingRow } from "../lib/supabase/company-branding.mapper.ts"
import { mapMobileBootstrapBranding } from "../lib/mobile/v1/bootstrap/map-bootstrap-response.ts"

const root = process.cwd()

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8")
}

test("solo administrador puede editar branding", () => {
  assert.equal(
    canManageCompanyBranding({
      systemRole: "administrador",
      roleCode: "administrador",
    }),
    true
  )
  assert.equal(
    canManageCompanyBranding({
      systemRole: "supervisor",
      roleCode: "supervisor",
    }),
    false
  )
  assert.equal(canManageCompanyBranding(null), false)
})

test("hex y URL se normalizan; javascript/data se rechazan", () => {
  assert.equal(normalizeCompanyBrandingHex("#023166"), "#023166")
  assert.equal(normalizeCompanyBrandingHex("  #0694da  "), "#0694DA")
  assert.equal(normalizeCompanyBrandingHex("blue"), null)
  assert.equal(
    isAllowedCompanyBrandingLogoUrl("https://cdn.example.com/logo.png"),
    true
  )
  assert.equal(
    isAllowedCompanyBrandingLogoUrl("/images/logo/LOGO_ABNET.png"),
    true
  )
  assert.equal(
    isAllowedCompanyBrandingLogoUrl("javascript:alert(1)"),
    false
  )
  assert.equal(isAllowedCompanyBrandingLogoUrl("data:image/png;base64,xx"), false)
})

test("el login autenticado usa logo del tenant y cae al de instancia", () => {
  assert.equal(
    resolveAuthenticatedLogoSrc(
      "https://cdn.example.com/tenant.png",
      "/images/logo/LOGO_BESPOKE.png"
    ),
    "https://cdn.example.com/tenant.png"
  )
  assert.equal(
    resolveAuthenticatedLogoSrc(null, "/images/logo/LOGO_ABNET.png"),
    "/images/logo/LOGO_ABNET.png"
  )
  assert.equal(
    resolveAuthenticatedLogoSrc("  ", "/images/logo/LOGO_ABNET.png"),
    "/images/logo/LOGO_ABNET.png"
  )
})

test("el mapper de tenant no usa host/env ni billing", () => {
  const mapped = mapCompanyBrandingRow({
    company_id: "00000000-0000-4000-8000-000000000002",
    logo_url: "https://cdn.example.com/brand.png",
    primary_color: "#023166",
    secondary_color: "#0694da",
    created_at: "2026-09-16T00:00:00Z",
    updated_at: "2026-09-16T00:00:00Z",
  })
  assert.equal(mapped.logoUrl, "https://cdn.example.com/brand.png")
  assert.equal(mapped.primaryColor, "#023166")
  assert.equal(mapped.secondaryColor, "#0694DA")

  const queries = read("lib/supabase/company-branding.queries.ts")
  assert.match(queries, /from\("company_branding"\)/)
  assert.doesNotMatch(queries, /isp_billing_company_settings/)
  assert.doesNotMatch(queries, /getAppLogoSrc/)
  assert.doesNotMatch(queries, /ABNET-7K5G/)
  assert.doesNotMatch(read("lib/company-branding/validate.ts"), /ABNET-7K5G/)
  assert.doesNotMatch(
    read("components/configuracion/company-branding-config-page.tsx"),
    /ABNET-7K5G/
  )
})

test("bootstrap Mobile sigue proyectando logoUrl desde company_branding", () => {
  const branding = mapMobileBootstrapBranding({
    logo_url: "https://cdn.example.com/brand.png",
    primary_color: "#023166",
    secondary_color: "#0694DA",
  })
  assert.equal(branding.logoUrl, "https://cdn.example.com/brand.png")
  assert.equal(
    mapMobileBootstrapBranding(null).logoUrl,
    null
  )
  const service = read("lib/mobile/v1/bootstrap/bootstrap-service.ts")
  assert.match(service, /from\("company_branding"\)/)
  assert.match(service, /logo_url, primary_color, secondary_color/)
})

test("el chrome autenticado consume company_branding y el login público no", () => {
  const layout = read("app/(dashboard)/layout.tsx")
  const login = read("app/(auth)/login/page.tsx")
  const sidebar = read("components/layout/app-sidebar.tsx")
  assert.match(layout, /loadAuthenticatedChromeBranding/)
  assert.match(login, /getAppLogoSrc\(host\)/)
  assert.match(sidebar, /--tenant-accent/)
  assert.doesNotMatch(login, /loadAuthenticatedChromeBranding/)
  assert.doesNotMatch(layout, /isp_billing/)
})

test("API de escritura exige administrador y aísla por company_id de sesión", () => {
  const route = read("app/api/company-branding/route.ts")
  const logo = read("app/api/company-branding/logo/route.ts")
  assert.match(route, /canManageCompanyBranding/)
  assert.match(route, /requireWritablePlatformSession/)
  assert.match(route, /auth\.sessionUser\.companyId/)
  assert.match(logo, /canManageCompanyBranding/)
  assert.match(logo, /COMPANY_BRANDING_LOGO_BUCKET/)
  assert.doesNotMatch(route, /isp-billing-logos/)
  assert.doesNotMatch(logo, /isp-billing-logos/)
})

test("colores del tenant tocan primary/sidebar y no destructive", () => {
  const style = tenantChromeStyle({
    primaryColor: "#023166",
    secondaryColor: "#0694DA",
  })
  assert.equal(style["--primary"], "#023166")
  assert.equal(style["--sidebar-primary"], "#023166")
  assert.equal(style["--tenant-accent"], "#0694DA")
  assert.equal(style["--destructive"], undefined)
})

test("patch rechaza hex inválido y acepta limpieza", () => {
  assert.equal(parseCompanyBrandingPatch({ primaryColor: "red" }).ok, false)
  const ok = parseCompanyBrandingPatch({
    primaryColor: "#023166",
    secondaryColor: "",
    logoUrl: "https://cdn.example.com/a.png",
  })
  assert.equal(ok.ok, true)
  if (ok.ok) {
    assert.equal(ok.patch.primaryColor, "#023166")
    assert.equal(ok.patch.secondaryColor, null)
    assert.equal(ok.patch.logoUrl, "https://cdn.example.com/a.png")
  }
  assert.equal(
    isAllowedCompanyBrandingLogoFile({
      mimeType: "image/png",
      size: 1200,
      fileName: "logo.png",
    }),
    true
  )
  assert.equal(
    isAllowedCompanyBrandingLogoFile({
      mimeType: "application/pdf",
      size: 1200,
      fileName: "logo.pdf",
    }),
    false
  )
})

test("migración de storage no altera RLS de company_branding", () => {
  const sql = read(
    "supabase/migrations/20261225000100_company_branding_storage.sql"
  )
  assert.match(sql, /company-branding-logos/)
  assert.doesNotMatch(sql, /DROP POLICY IF EXISTS company_branding_select_policy/)
  assert.doesNotMatch(sql, /ALTER TABLE public\.company_branding/)
  assert.doesNotMatch(sql, /bucket_id = 'isp-billing-logos'/)
})
