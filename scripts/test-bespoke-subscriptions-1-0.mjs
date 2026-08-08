/**
 * Sprint Bespoke Subscriptions 1.0 — TV & Suscripciones.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { calculateProratedAmount } from "../lib/subscriptions/proration.ts"
import {
  canTransitionSubscriptionCustomer,
  SUBSCRIPTION_CUSTOMER_STATUSES,
} from "../lib/subscriptions/statuses.ts"
import { summarizeSubscriptions } from "../lib/subscriptions/summary.ts"
import { APP_MODULE_KEYS } from "../lib/roles/app-modules.ts"
import { DEFAULT_COMPANY_AREA_MODULE_VISIBILITY } from "../lib/roles/company-areas.ts"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

test("calculateProratedAmount matches sprint example ($20.000 alta 10/08 → $14.193)", () => {
  assert.equal(calculateProratedAmount(20000, "2025-08-10"), 14193)
  assert.equal(calculateProratedAmount(20000, new Date(2025, 7, 10)), 14193)
  assert.equal(calculateProratedAmount(20000, "2025-08-01"), 20000)
  assert.equal(calculateProratedAmount(0, "2025-08-10"), 0)
  assert.equal(calculateProratedAmount(20000, "bad"), 0)
})

test("customer workflow transitions", () => {
  assert.equal(
    canTransitionSubscriptionCustomer(
      SUBSCRIPTION_CUSTOMER_STATUSES.PENDING_PAYMENT,
      SUBSCRIPTION_CUSTOMER_STATUSES.PAID
    ),
    true
  )
  assert.equal(
    canTransitionSubscriptionCustomer(
      SUBSCRIPTION_CUSTOMER_STATUSES.PAID,
      SUBSCRIPTION_CUSTOMER_STATUSES.ACTIVE
    ),
    true
  )
  assert.equal(
    canTransitionSubscriptionCustomer(
      SUBSCRIPTION_CUSTOMER_STATUSES.ACTIVE,
      SUBSCRIPTION_CUSTOMER_STATUSES.SUSPENDED
    ),
    true
  )
  assert.equal(
    canTransitionSubscriptionCustomer(
      SUBSCRIPTION_CUSTOMER_STATUSES.SUSPENDED,
      SUBSCRIPTION_CUSTOMER_STATUSES.CANCELLED
    ),
    true
  )
  assert.equal(
    canTransitionSubscriptionCustomer(
      SUBSCRIPTION_CUSTOMER_STATUSES.PENDING_PAYMENT,
      SUBSCRIPTION_CUSTOMER_STATUSES.ACTIVE
    ),
    false
  )
  assert.equal(
    canTransitionSubscriptionCustomer(
      SUBSCRIPTION_CUSTOMER_STATUSES.CANCELLED,
      SUBSCRIPTION_CUSTOMER_STATUSES.ACTIVE
    ),
    false
  )
})

test("dashboard KPIs count actives, pending payment/activation, month signups, billing", () => {
  const summary = summarizeSubscriptions(
    [
      {
        status: "active",
        serviceId: "tv",
        createdAt: "2026-07-31T12:00:00.000Z",
      },
      {
        status: "pending_payment",
        serviceId: "tv",
        createdAt: "2026-07-15T12:00:00.000Z",
      },
      {
        status: "paid",
        serviceId: "tv",
        createdAt: "2026-07-20T12:00:00.000Z",
      },
      {
        status: "active",
        serviceId: "tv",
        createdAt: "2026-06-01T12:00:00.000Z",
      },
    ],
    [{ id: "tv", monthlyPrice: 20000 }],
    new Date(2026, 6, 31)
  )

  assert.equal(summary.activeSubscribers, 2)
  assert.equal(summary.pendingPayment, 1)
  assert.equal(summary.pendingActivation, 1)
  assert.equal(summary.signupsThisMonth, 3)
  assert.equal(summary.expectedBilling, 40000)
})

test("module is registered in nav, roles and areas", () => {
  assert.ok(APP_MODULE_KEYS.includes("subscriptions"))
  assert.equal(
    DEFAULT_COMPANY_AREA_MODULE_VISIBILITY.administracion.subscriptions,
    true
  )
  assert.equal(
    DEFAULT_COMPANY_AREA_MODULE_VISIBILITY.ventas.subscriptions,
    true
  )

  const nav = read("lib/navigation/nav-items.ts")
  assert.match(nav, /TV & Suscripciones/)
  assert.match(nav, /\/subscriptions/)

  const modules = read("lib/roles/app-modules.ts")
  assert.match(modules, /key: "subscriptions"/)
  assert.match(modules, /pathPrefixes: \["\/subscriptions"\]/)

  const buildNav = read("lib/navigation/build-nav-from-modules.ts")
  assert.match(buildNav, /subscriptionsNavItem/)
})

test("migration seeds Bespoke TV and applies RLS + soft delete", () => {
  const migration = read(
    "supabase/migrations/20261123000100_bespoke_subscriptions_1_0.sql"
  )
  assert.match(migration, /subscription_services/)
  assert.match(migration, /subscription_customers/)
  assert.match(migration, /subscription_sales/)
  assert.match(migration, /subscription_commissions/)
  assert.match(migration, /Bespoke TV/)
  assert.match(migration, /20000\.00/)
  assert.match(migration, /pending_payment/)
  assert.match(migration, /deleted_at/)
  assert.match(migration, /auth_user_has_allowed_module\('subscriptions'\)/)
  assert.match(migration, /company_id/)
})

test("UI wires tabs, pre-alta, prorate and workflow actions", () => {
  const page = read("app/(dashboard)/subscriptions/page.tsx")
  assert.match(page, /SubscriptionsModule/)

  const module = read("components/subscriptions/subscriptions-module.tsx")
  assert.match(module, /Dashboard/)
  assert.match(module, /Pre-Altas/)
  assert.match(module, /Suscriptores/)
  assert.match(module, /Ventas/)
  assert.match(module, /Comisiones/)
  assert.match(module, /Nueva Pre-Alta/)
  assert.match(module, /Marcar Pagado/)
  assert.match(module, /Activar/)

  const form = read("components/subscriptions/pre-alta-form-dialog.tsx")
  assert.match(form, /Proporcional Inicial/)
  assert.match(form, /Abono Mensual/)
  assert.match(form, /calculateProratedAmount/)

  const cards = read(
    "components/subscriptions/subscriptions-summary-cards.tsx"
  )
  assert.match(cards, /Suscriptores Activos/)
  assert.match(cards, /Pendientes de Pago/)
  assert.match(cards, /Pendientes de Activación/)
  assert.match(cards, /Altas del Mes/)
  assert.match(cards, /Facturación Esperada/)

  const queries = read("lib/supabase/subscriptions.queries.ts")
  assert.match(queries, /createSubscriptionPreAlta/)
  assert.match(queries, /calculateProratedAmount/)
  assert.match(queries, /transitionSubscriptionCustomer/)
})
